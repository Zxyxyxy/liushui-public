import { useState } from 'react'
import { downloadExport, type ExportFormat, type ExportMode } from '../lib/exportDoc'
import { downloadText } from '../lib/download'
import { useApp } from '../store/AppContext'

// 和后端 EXPORT_RESUME_SKILLS / EXPORT_PRACTICE_SKILLS 保持一致
const RESUME_SKILLS = new Set(['resume-fix', 'resume-fix-story', 'resume-fix-campus', 'jd-tailor'])
const PRACTICE_SKILLS = new Set(['interview-q'])

type Item = { label: string; run: () => void }

/** 工具结果的下载菜单：Word、PDF，简历类多一组「只要简历」，面试题多一组「练习版」。点了才由服务端生成 */
export function DownloadMenu({ outputId, skillId, name, text, up, className }: {
  outputId?: string
  skillId: string
  name: string
  text: string
  /** 向上展开（放在卡片底部时用） */
  up?: boolean
  className?: string
}) {
  const { toast } = useApp()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  async function go(format: ExportFormat, mode: ExportMode) {
    setOpen(false)
    if (!outputId) return
    setBusy(true)
    const err = await downloadExport(outputId, format, mode)
    setBusy(false)
    if (err) toast(err, 'warn')
  }

  const both = (mode: ExportMode): Item[] => [
    { label: '📄 Word 文档', run: () => go('docx', mode) },
    { label: '📕 PDF 文档', run: () => go('pdf', mode) },
  ]
  const groups: { title?: string; items: Item[] }[] = []
  if (outputId) {
    groups.push({ items: both('full') })
    if (RESUME_SKILLS.has(skillId)) groups.push({ title: '只要修改后的简历', items: both('resume') })
    if (PRACTICE_SKILLS.has(skillId)) groups.push({ title: '练习版（每题留作答框）', items: both('practice') })
  }
  groups.push({ items: [{ label: 'Markdown 原文', run: () => { setOpen(false); downloadText(`${name}.md`, text) } }] })

  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} disabled={busy} className={className}>
        {busy ? '生成中…' : '⬇️ 下载'}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div
            className={`absolute z-30 w-52 rounded-2xl border border-water-200/80 bg-white/95 p-1.5 shadow-[0_14px_34px_-14px_rgba(0,119,182,.45)] backdrop-blur ${
              up ? 'bottom-full left-0 mb-1.5' : 'right-0 top-full mt-1.5'
            }`}
          >
            {groups.map((g, gi) => (
              <div key={gi} className={gi ? 'mt-1 border-t border-water-100 pt-1' : ''}>
                {g.title && <p className="px-2.5 pb-0.5 pt-1 text-[11px] font-semibold text-ink-400">{g.title}</p>}
                {g.items.map((it) => (
                  <button key={it.label} onClick={it.run}
                    className="block w-full rounded-xl px-2.5 py-1.5 text-left text-xs text-ink-700 transition-colors hover:bg-water-100/70">
                    {it.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
