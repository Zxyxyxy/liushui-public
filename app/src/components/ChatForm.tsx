import { useEffect, useRef, useState } from 'react'
import type { Tool } from '../data/types'
import { useApp } from '../store/AppContext'
import { useAuth } from '../store/AuthContext'
import { uploadFile, deleteUpload, checkUploadable, type FormSubmission } from '../lib/api'

/** 一个字段里已选的文件：上传中 / 已就绪 / 失败。原文只在服务端，这里只有名字和 id */
interface FieldFile {
  key: string
  name: string
  progress: number
  id?: string
  error?: string
}

/**
 * 会话里的工具参数卡片。填完点运行，结果回到会话里，不跳页面。
 * 带「上传」标记的文本字段可以直接传 PDF / Word：文件以附件形式挂在卡片上，
 * 解析出来的文字不显示、不回传前端。
 */
export function ChatFormCard({
  tool,
  prefill,
  busy,
  onSubmit,
  onCancel,
}: {
  tool: Tool
  prefill?: Record<string, string>
  busy: boolean
  onSubmit: (fields: FormSubmission) => void
  onCancel: () => void
}) {
  const { toast, credits } = useApp()
  const { requireLogin } = useAuth()
  const [text, setText] = useState<Record<string, string>>(() => ({ ...(prefill ?? {}) }))
  const [files, setFiles] = useState<Record<string, FieldFile[]>>({})
  const aborts = useRef<Record<string, () => void>>({})
  const filesRef = useRef(files)
  filesRef.current = files
  const submitted = useRef(false)

  // 卡片被丢弃（取消、离开页面）而没提交：把没用上的文件从服务端删掉，不留残件
  useEffect(() => () => {
    if (submitted.current) return
    for (const list of Object.values(filesRef.current)) {
      for (const f of list) {
        aborts.current[f.key]?.()
        if (f.id) deleteUpload(f.id)
      }
    }
  }, [])

  function addFiles(fieldKey: string, list: File[]) {
    if (!requireLogin()) return
    const have = files[fieldKey]?.length ?? 0
    if (list.length > 3 - have) toast('一个字段最多带 3 个文件', 'warn')
    for (const f of list.slice(0, Math.max(3 - have, 0))) {
      const bad = checkUploadable(f)
      if (bad) { toast(bad, 'warn'); continue }
      const key = `${Date.now()}-${Math.random()}`
      setFiles((s) => ({ ...s, [fieldKey]: [...(s[fieldKey] ?? []), { key, name: f.name, progress: 0 }] }))
      const { promise, abort } = uploadFile(f, (pct) =>
        setFiles((s) => ({ ...s, [fieldKey]: (s[fieldKey] ?? []).map((x) => (x.key === key ? { ...x, progress: pct } : x)) })))
      aborts.current[key] = abort
      promise.then((r) => {
        delete aborts.current[key]
        setFiles((s) => {
          const cur = s[fieldKey] ?? []
          if (!cur.some((x) => x.key === key)) {
            if (r.ok) deleteUpload(r.file.id)   // 上传期间已被移除
            return s
          }
          return {
            ...s,
            [fieldKey]: cur.map((x) => (x.key === key ? (r.ok ? { ...x, id: r.file.id, progress: 100 } : { ...x, error: r.error }) : x)),
          }
        })
      })
    }
  }

  function removeFile(fieldKey: string, f: FieldFile) {
    aborts.current[f.key]?.()
    if (f.id) deleteUpload(f.id)
    setFiles((s) => ({ ...s, [fieldKey]: (s[fieldKey] ?? []).filter((x) => x.key !== f.key) }))
  }

  const uploading = Object.values(files).some((l) => l.some((f) => !f.id && !f.error))
  // 必填：手写文字或已传好的文件，二者有一个即可
  const missing = tool.fields.filter(
    (f) => f.required && !text[f.key]?.trim() && !(files[f.key] ?? []).some((x) => x.id),
  )
  const canRun = missing.length === 0 && !uploading && !busy
  const enough = credits >= tool.credits

  function submit() {
    if (!canRun) return
    if (!requireLogin()) return
    const out: FormSubmission = {}
    for (const f of tool.fields) {
      out[f.key] = {
        text: text[f.key]?.trim() || undefined,
        uploads: (files[f.key] ?? []).filter((x) => x.id).map((x) => x.id!),
      }
    }
    submitted.current = true   // 文件交给服务端用，不再清理
    onSubmit(out)
  }

  return (
    <div className="glass-deep w-full max-w-2xl overflow-hidden p-5" style={{ animation: 'rise .3s ease-out both' }}>
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-water-100 text-xl">{tool.icon}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-ink-900">{tool.name}</p>
          <p className="truncate text-xs text-ink-500">{tool.promise}</p>
        </div>
        <button onClick={onCancel} aria-label="关闭" className="shrink-0 text-lg leading-none text-ink-300 hover:text-ink-600">×</button>
      </div>

      <div className="mt-4 space-y-3.5">
        {tool.fields.map((f) => (
          <div key={f.key}>
            <label className="flex items-baseline gap-1.5 text-xs font-bold text-ink-800">
              {f.label}
              {f.required && <span className="text-accent-coral">*</span>}
            </label>
            {f.hint && <p className="mt-0.5 text-[11px] text-ink-400">{f.hint}</p>}

            <div className="mt-1.5">
              {f.type === 'textarea' && (
                <textarea
                  rows={3}
                  value={text[f.key] ?? ''}
                  onChange={(e) => setText({ ...text, [f.key]: e.target.value })}
                  placeholder={f.placeholder}
                  className="field resize-y text-sm"
                />
              )}
              {f.type === 'text' && (
                <input
                  value={text[f.key] ?? ''}
                  onChange={(e) => setText({ ...text, [f.key]: e.target.value })}
                  placeholder={f.placeholder}
                  className="field text-sm"
                />
              )}
              {f.type === 'select' && (
                <div className="flex flex-wrap gap-2">
                  {f.options?.map((o) => (
                    <button
                      key={o}
                      onClick={() => setText({ ...text, [f.key]: o })}
                      className={`chip ${text[f.key] === o ? 'chip-on' : ''}`}
                    >
                      {o}
                    </button>
                  ))}
                </div>
              )}

              {f.type === 'textarea' && f.upload && (
                <FieldUpload
                  files={files[f.key] ?? []}
                  onPick={(list) => addFiles(f.key, list)}
                  onRemove={(file) => removeFile(f.key, file)}
                />
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-water-100 pt-3">
        <p className="text-[11px] text-ink-400">
          消耗 {tool.credits} 积分 · 失败不扣
          {!enough && <span className="ml-1 text-accent-coral">（当前余额 {credits}，不足）</span>}
        </p>
        <div className="flex items-center gap-2">
          {!canRun && !busy && (
            <span className="text-[11px] text-accent-coral">
              {uploading ? '文件上传中…' : `还有 ${missing.length} 项必填`}
            </span>
          )}
          <button onClick={submit} disabled={!canRun} className="btn-water px-5 py-2 text-sm">
            运行
          </button>
        </div>
      </div>
    </div>
  )
}

function FieldUpload({
  files,
  onPick,
  onRemove,
}: {
  files: FieldFile[]
  onPick: (list: File[]) => void
  onRemove: (f: FieldFile) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div className="mt-2">
      <input
        ref={ref}
        type="file"
        multiple
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={(e) => { onPick(Array.from(e.target.files ?? [])); e.target.value = '' }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => ref.current?.click()} disabled={files.length >= 3} className="chip disabled:opacity-50">
          📎 上传文件
        </button>
        <span className="text-[11px] text-ink-300">PDF / Word，10MB 以内，也可以直接在上面粘贴文字</span>
      </div>
      {files.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {files.map((f) => (
            <div
              key={f.key}
              className={`flex max-w-[16rem] items-center gap-2 rounded-xl border px-2.5 py-1.5 text-xs ${
                f.error ? 'border-accent-coral/40 bg-accent-coral/10' : 'border-water-200 bg-white/80'
              }`}
            >
              <span aria-hidden>{f.error ? '⚠️' : f.id ? '📄' : '⏳'}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-ink-800">{f.name}</span>
                <span className={`block truncate ${f.error ? 'text-accent-coral' : 'text-ink-400'}`}>
                  {f.error ?? (f.id ? '已读取' : `上传中 ${f.progress}%`)}
                </span>
              </span>
              <button onClick={() => onRemove(f)} aria-label="移除" className="shrink-0 text-base leading-none text-ink-300 hover:text-accent-coral">×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
