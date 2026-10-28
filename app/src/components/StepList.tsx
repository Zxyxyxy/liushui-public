import { useState } from 'react'
import type { ChatStep } from '../lib/api'

/**
 * AI 这一轮在做什么：读文件 → 整理信息 → 选工具 → 生成 → 检查。
 * 进行中展开，一步一步显示；全部完成后收成一行「已完成 N 步」，点开才看详情，
 * 免得结果上方一直占着一大块过程信息。
 */
export function StepList({ steps, running }: { steps: ChatStep[]; running: boolean }) {
  const [open, setOpen] = useState(false)
  if (steps.length === 0) return null

  const failed = steps.some((s) => s.state === 'failed')
  const collapsed = !running && !steps.some((s) => s.state === 'running') && !open && !failed

  if (collapsed) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-full border border-water-200 bg-white/70 px-3 py-1 text-xs text-ink-500 transition-colors hover:border-water-400 hover:text-water-700"
      >
        <span className="font-bold text-accent-mint">✓</span>
        已完成 {steps.length} 步
        <span className="text-ink-300">›</span>
      </button>
    )
  }

  return (
    <div className="glass max-w-[90%] px-4 py-3" style={{ animation: 'rise .25s ease-out both' }}>
      <ol className="space-y-2">
        {steps.map((s) => (
          <li key={s.id} className="flex items-start gap-2.5 text-sm">
            <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center">
              {s.state === 'running' && (
                <span className="inline-block h-3.5 w-3.5 animate-[spin_1s_linear_infinite] rounded-full border-2 border-water-200 border-t-water-500" />
              )}
              {s.state === 'done' && <span className="text-[13px] font-bold text-accent-mint">✓</span>}
              {s.state === 'failed' && <span className="text-[13px] font-bold text-accent-coral">!</span>}
            </span>
            <span className="min-w-0 flex-1">
              <span className={s.state === 'running' ? 'text-ink-900' : 'text-ink-600'}>{s.label}</span>
              {s.detail && <span className="ml-2 text-xs text-ink-400">{s.detail}</span>}
            </span>
          </li>
        ))}
      </ol>
      {open && !running && (
        <button onClick={() => setOpen(false)} className="mt-2 text-xs text-ink-400 hover:text-water-700">收起 ˄</button>
      )}
    </div>
  )
}
