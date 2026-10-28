import { useSkills } from '../store/SkillsContext'
import type { Tool } from '../data/types'

/**
 * 同类备选选择：同一件事有几款侧重不同的工具，把各自的侧重、适合谁、输出什么摆出来，
 * 让用户自己挑。内容全部来自 skill 数据：recommendReason / compareDims；还没整理过的工具，
 * 维度退回它已有的「适用场景」和「需要提供」，没有的就不显示，不编话凑数。
 */
export function SkillChoice({
  skillIds,
  disabled,
  onPick,
}: {
  skillIds: string[]
  disabled?: boolean
  onPick: (tool: Tool) => void
}) {
  const { skillsMap } = useSkills()
  const tools = skillIds.map((id) => skillsMap[id]).filter(Boolean)
  if (tools.length === 0) return null

  return (
    <div className="w-full max-w-3xl" style={{ animation: 'rise .3s ease-out both' }}>
      <p className="mb-2 text-xs text-ink-500">{tools.length > 1 ? `为你挑了 ${tools.length} 款相关工具，对比后选一款继续：` : '这个工具可以帮你：'}</p>
      <div className={`grid gap-3 ${tools.length > 1 ? 'md:grid-cols-2' : ''}`}>
        {tools.map((t, i) => (
          <div key={t.id} className="glass-deep flex flex-col p-3.5">
            <div className="flex items-start gap-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-water-100 text-lg">{t.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="font-bold text-ink-900">{t.name}</p>
                  {i === 0 && tools.length > 1 && (
                    <span className="rounded-full bg-water-500 px-1.5 py-px text-[10px] font-semibold text-white">平台推荐</span>
                  )}
                  {t.variantLabel && (
                    <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 ring-1 ring-amber-200/70 ring-inset">
                      侧重：{t.variantLabel}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs leading-relaxed text-ink-500">{t.promise}</p>
              </div>
            </div>

            {t.recommendReason && (
              <p className="mt-2.5 rounded-xl bg-water-50/80 px-3 py-1.5 text-xs leading-relaxed text-ink-700">
                <span className="font-semibold text-water-700">推荐理由：</span>
                <Hl text={t.recommendReason} />
              </p>
            )}

            {dimsOf(t) && (
              <dl className="mt-2.5 space-y-1">
                {orderedDims(dimsOf(t)!).map(([k, v]) => (
                  <div key={k} className="flex gap-2 text-xs leading-relaxed">
                    <dt className="w-8 shrink-0 font-semibold text-ink-400">{k}</dt>
                    <dd className="min-w-0 flex-1 text-ink-700"><Hl text={v} /></dd>
                  </div>
                ))}
              </dl>
            )}

            {t.sourceInfo?.repo && (
              <p className="mt-2.5 text-[11px] text-ink-400">
                方法依据：{t.sourceInfo.origin}
              </p>
            )}

            <div className="flex-1" />
            <div className="mt-2.5 flex items-center justify-between border-t border-water-100 pt-2.5">
              <span className="text-[11px] text-ink-400">{t.credits} 积分</span>
              <button onClick={() => onPick(t)} disabled={disabled} className={i === 0 ? 'btn-water px-4 py-1.5 text-xs' : 'btn-ghost px-4 py-1.5 text-xs'}>
                用这个
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** 对比维度：整理过的用整理结果；没整理的退回已有的适用场景和所需信息 */
function dimsOf(t: Tool): Record<string, string> | null {
  if (t.compareDims && Object.keys(t.compareDims).length > 0) return t.compareDims
  const d: Record<string, string> = {}
  if (t.goodFor?.length) d['适合'] = t.goodFor.join('、')
  if (t.needs?.length) d['需要'] = t.needs.join('、')
  return Object.keys(d).length ? d : null
}

/** 维度的固定顺序：先说侧重，再说适合谁、输出什么，最后是要注意的 */
const DIM_ORDER = ['侧重', '适合', '输出', '需要', '注意']

function orderedDims(d: Record<string, string>): [string, string][] {
  const rank = (k: string) => (DIM_ORDER.includes(k) ? DIM_ORDER.indexOf(k) : DIM_ORDER.length)
  return Object.entries(d).sort((a, b) => rank(a[0]) - rank(b[0]))
}

/** 把文案里 **这样标出来** 的关键短语渲染成荧光笔高亮加粗；其余原样 */
function Hl({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**') && p.length > 4 ? (
          <strong
            key={i}
            className="rounded-[3px] bg-[linear-gradient(transparent_55%,rgba(255,196,64,.55)_55%)] px-0.5 font-bold text-ink-900"
          >
            {p.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  )
}
