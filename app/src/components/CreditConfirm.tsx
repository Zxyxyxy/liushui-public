import type { Tool } from '../data/types'
import { useApp } from '../store/AppContext'
import { Modal } from './ui/Ui'
import { CountUp, Drop } from './water/Water'

/**
 * 运行前的积分确认弹窗。
 * 文档 §7.2：工作流必须展示每一步的实际扣费，不得隐藏。
 */
export function CreditConfirm({
  open,
  tool,
  onClose,
  onConfirm,
}: {
  open: boolean
  tool: Tool
  onClose: () => void
  onConfirm: () => void
}) {
  const { credits } = useApp()
  const enough = credits >= tool.credits
  const after = credits - tool.credits

  return (
    <Modal open={open} onClose={onClose}>
      <div className="flex items-start gap-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-water-100 to-water-200 text-2xl">
          {tool.icon}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-bold text-ink-900">确认运行 {tool.name}</h3>
          <p className="mt-0.5 line-clamp-2 text-xs text-ink-400">{tool.promise}</p>
        </div>
        <button onClick={onClose} className="text-xl leading-none text-ink-300 hover:text-ink-500">
          ×
        </button>
      </div>

      {/* 步骤明细 —— 加总等于总价 */}
      <div className="mt-5 rounded-2xl border border-water-200/70 bg-water-50/70 p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <span className="text-sm font-semibold text-ink-700">
            {tool.kind === 'workflow' ? '工作流预计消耗' : '本次预计消耗'}
          </span>
          <span className="flex items-center gap-1 text-xl font-bold text-water-700">
            <Drop className="h-4 w-4" />
            {tool.credits}
          </span>
        </div>
        <div className="space-y-1.5">
          {tool.steps.map((s, i) => (
            <div key={s.title} className="flex items-baseline justify-between gap-3 text-xs">
              <span className="min-w-0 text-ink-500">
                <span className="mr-1.5 text-ink-300 tabular-nums">步骤 {i + 1}</span>
                {s.title}
              </span>
              <span className="shrink-0 font-semibold text-ink-700 tabular-nums">{s.credits} 积分</span>
            </div>
          ))}
        </div>
      </div>

      {/* 权限声明 —— 文档 §8.3 */}
      <div className="mt-3 space-y-1.5 text-xs text-ink-500">
        <div className="flex gap-2">
          <span className="shrink-0 text-water-400">·</span>
          <span>
            文件上传与存储 <span className="font-semibold text-accent-mint">不扣积分</span>
            ，解析费用已包含在本次运行中
          </span>
        </div>
        {tool.externalData.length > 0 && (
          <div className="flex gap-2">
            <span className="shrink-0 text-water-400">·</span>
            <span>
              本次将访问外部数据：
              <span className="font-semibold text-ink-700">{tool.externalData.join('、')}</span>
            </span>
          </div>
        )}
        <div className="flex gap-2">
          <span className="shrink-0 text-water-400">·</span>
          <span>运行失败不扣积分，结果可保存到工作台</span>
        </div>
      </div>

      {/* 余额变化 */}
      <div className="mt-4 flex items-center justify-between rounded-2xl bg-white/70 px-4 py-3 text-sm ring-1 ring-water-200/70 ring-inset">
        <span className="text-ink-500">余额变化</span>
        <span className="flex items-center gap-2 font-semibold tabular-nums">
          <CountUp value={credits} className="text-ink-400" />
          <span className="text-water-300">→</span>
          <span className={enough ? 'text-water-700' : 'text-accent-coral'}>{after}</span>
        </span>
      </div>

      {!enough && (
        <p className="mt-2 rounded-xl bg-accent-coral/10 px-3 py-2 text-xs text-accent-coral">
          积分不足，还差 {tool.credits - credits} 积分。可在右上角积分账户领取签到积分。
        </p>
      )}

      <div className="mt-5 flex gap-2">
        <button onClick={onClose} className="btn-ghost flex-1">
          再想想
        </button>
        <button onClick={onConfirm} disabled={!enough} className="btn-water flex-[1.6]">
          确认运行 · 扣 {tool.credits} 积分
        </button>
      </div>
    </Modal>
  )
}
