import { useState } from 'react'
import { Link } from 'react-router-dom'
import { wsApi, type ProgressItem } from '../lib/api'
import { useApp } from '../store/AppContext'

const EVENT_ICON: Record<string, string> = { interview: '🎤', test: '📝', deadline: '⏰', other: '📌' }

function describe(it: ProgressItem): { icon: string; text: string } {
  const org = it.org ? `${it.org} · ` : ''
  const abroad = it.ws === 'abroad'
  switch (it.type) {
    case 'target': return abroad
      ? { icon: '🎓', text: `新申请：${it.org}${it.role ? ` · ${it.role}` : ''}` }
      : { icon: '🏢', text: `新投递：${it.org}${it.role ? ` · ${it.role}` : ''}` }
    case 'role': return { icon: '🏷️', text: `${it.org} 补充${abroad ? '项目' : '岗位'}：${it.role}` }
    case 'stage': return { icon: '➡️', text: `${org}进入「${it.stage_label}」` }
    case 'event': return { icon: EVENT_ICON[it.kind ?? 'other'], text: `${org}${it.title}` }
    default: return { icon: '☑️', text: `${org}待办：${it.text}` }
  }
}

/**
 * 回答下面的确认条：从这几轮用户说的话里识别出的求职进度。每条都能勾掉或改日期，确认后才写进工作台。
 * 鼠标停在一条上能看到依据的原话。
 */
export function ProgressConfirm({ threadId, items, onDone }: {
  threadId: string
  items: ProgressItem[]
  onDone: (applied: boolean) => void
}) {
  const { toast } = useApp()
  const [rows, setRows] = useState(items.map((it) => ({ it, on: true })))
  const [busy, setBusy] = useState(false)
  const picked = rows.filter((r) => r.on).map((r) => r.it)

  function patch(i: number, f: Partial<ProgressItem>) {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, it: { ...r.it, ...f } } : r)))
  }

  function toggle(i: number) {
    setRows((rs) => {
      const next = rs.map((r, j) => (j === i ? { ...r, on: !r.on } : r))
      // 取消新投递时，挂在它下面的阶段、日程、待办也一起取消，否则写进去会找不到归属
      const it = rs[i].it
      if (it.type === 'target' && rs[i].on) {
        return next.map((r) => (r.it.new_org === it.org && (r.it.ws ?? 'job') === (it.ws ?? 'job') ? { ...r, on: false } : r))
      }
      return next
    })
  }

  async function save() {
    if (!picked.length) { onDone(false); return }
    setBusy(true)
    const r = await wsApi.applyProgress(threadId, picked)
    setBusy(false)
    if (!r) { toast('没保存成功，稍后再试', 'warn'); return }
    const parts = [r.targets && `${r.targets} 条${picked.some((x) => x.type === 'target' && x.ws === 'abroad') ? (picked.some((x) => x.type === 'target' && x.ws !== 'abroad') ? '投递 / 申请' : '申请') : '投递'}`, r.roles && `${r.roles} 个岗位`, r.stages && `${r.stages} 个阶段`, r.events && `${r.events} 个日程`, r.todos && `${r.todos} 条待办`].filter(Boolean)
    toast(parts.length ? `已更新工作台：${parts.join('、')}` : '没有需要更新的内容', parts.length ? 'ok' : 'info')
    onDone(true)
  }

  return (
    <div className="max-w-[90%] rounded-2xl border border-water-200 bg-white/80 px-4 py-3 shadow-[0_8px_24px_-16px_rgba(0,119,182,.6)]">
      <p className="text-xs font-semibold text-water-700">识别到这些进度，要加入工作台吗？</p>
      <ul className="mt-2 space-y-1">
        {rows.map(({ it, on }, i) => {
          const d = describe(it)
          return (
            <li key={i} className="flex items-center gap-2" title={`依据：「${it.quote}」`}>
              <button
                onClick={() => toggle(i)}
                aria-label={on ? '不加入这条' : '加入这条'}
                className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-md border-2 text-[10px] text-white transition-colors ${
                  on ? 'border-water-500 bg-gradient-to-br from-water-400 to-water-600' : 'border-water-300 bg-white'
                }`}
              >
                {on && '✓'}
              </button>
              <span className={`min-w-0 flex-1 truncate text-sm ${on ? 'text-ink-800' : 'text-ink-300 line-through'}`}>
                {d.icon} {d.text}
              </span>
              {(it.type === 'event' || (it.type === 'todo' && it.due)) && (
                <input
                  type="date"
                  value={(it.type === 'event' ? it.date : it.due) ?? ''}
                  onChange={(e) => patch(i, it.type === 'event' ? { date: e.target.value } : { due: e.target.value })}
                  disabled={!on}
                  className="field w-36 shrink-0 py-1 text-xs"
                />
              )}
            </li>
          )
        })}
      </ul>
      <div className="mt-3 flex items-center gap-2">
        <button onClick={save} disabled={busy} className="btn-water px-4 py-1.5 text-xs">
          {busy ? '保存中…' : picked.length ? `加入工作台（${picked.length}）` : '都不加'}
        </button>
        <button onClick={() => onDone(false)} className="btn-quiet px-3 py-1.5 text-xs">忽略</button>
        <Link to="/workspace" className="ml-auto text-[11px] text-ink-400 hover:text-water-700">打开工作台 →</Link>
      </div>
    </div>
  )
}
