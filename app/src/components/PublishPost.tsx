import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Tool } from '../data/types'
import { useApp } from '../store/AppContext'
import { useSkills } from '../store/SkillsContext'
import { relatedTools } from '../lib/relatedTools'
import { plainSummary } from '../lib/runResult'
import { Modal } from './ui/Ui'

/** 一键生成经验帖：自动摘要、关联工具、匿名发布 */
export function PublishPost({
  open,
  onClose,
  tool,
  markdown,
}: {
  open: boolean
  onClose: () => void
  tool: Tool
  markdown: string
}) {
  const { toast } = useApp()
  const { skills } = useSkills()
  const [anon, setAnon] = useState(true)
  const [title, setTitle] = useState('')
  const nav = useNavigate()

  useEffect(() => {
    if (open) setTitle(`用「${tool.name}」跑了一次，记录一下过程和结果`)
  }, [open, tool.name])

  return (
    <Modal open={open} onClose={onClose} width="max-w-xl">
      <h3 className="text-lg font-bold text-ink-900">发布经验帖</h3>
      <p className="mt-1 text-xs text-ink-400">
        平台已自动生成标题、摘要和标签，并隐去了简历、成绩单和联系方式等隐私字段。发布前可以修改。
      </p>

      <div className="mt-4 space-y-3">
        <div>
          <label className="text-xs font-semibold text-ink-500">标题</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="field mt-1.5" />
        </div>

        <div>
          <label className="text-xs font-semibold text-ink-500">自动生成的摘要</label>
          <div className="field mt-1.5 bg-water-50/70 text-ink-500">
            {plainSummary(markdown)}
            …
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-ink-500">自动关联的工具</label>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <span className="chip chip-on">
              {tool.icon} {tool.name}
            </span>
            {relatedTools(tool, skills, 2).map((t) => (
              <span key={t.id} className="chip">
                {t.icon} {t.name}
              </span>
            ))}
          </div>
        </div>

        <label className="flex cursor-pointer items-start gap-2.5 rounded-2xl bg-water-50/70 p-3">
          <input
            type="checkbox"
            checked={anon}
            onChange={(e) => setAnon(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[var(--color-water-500)]"
          />
          <span className="text-xs leading-relaxed text-ink-700">
            <span className="font-semibold">匿名发布并隐去隐私字段</span>
            <br />
            <span className="text-ink-400">
              将自动移除姓名、学校、联系方式、成绩单原文和文件名中的个人信息。
            </span>
          </span>
        </label>
      </div>

      <div className="mt-5 flex gap-2">
        <button onClick={onClose} className="btn-ghost flex-1">
          再改改
        </button>
        <button
          onClick={() => {
            toast('帖子已发布')
            onClose()
            nav('/community')
          }}
          className="btn-water flex-[1.4]"
        >
          发布
        </button>
      </div>
    </Modal>
  )
}
