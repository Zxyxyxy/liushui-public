import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SCENES as ALL_SCENES, KIND_LABEL } from '../data/scenes'
import { CREATORS } from '../data/creators'
import type { ProductKind, SceneId, Tool } from '../data/types'
import { useApp } from '../store/AppContext'
import { useSkills } from '../store/SkillsContext'
import { ToolCard } from '../components/ToolCard'
import { Empty, SectionTitle } from '../components/ui/Ui'
import { Bubbles, FlowField } from '../components/water/Water'
import { searchToolsWithApi } from '../lib/searchWithApi'

type Sort = 'hot' | 'rating' | 'cheap' | 'new'

// 工具市场里的场景顺序：求职、留学的工具最多、用户最常找，放前面
const MARKET_ORDER: SceneId[] = ['job', 'abroad', 'study', 'exam']
const SCENES = MARKET_ORDER.map((id) => ALL_SCENES.find((s) => s.id === id)!).filter(Boolean)

const SORTS: { id: Sort; label: string }[] = [
  { id: 'hot', label: '最多人用' },
  { id: 'rating', label: '评分最高' },
  { id: 'cheap', label: '积分最低' },
  { id: 'new', label: '最新上线' },
]

const CREDIT_BANDS = [
  { id: 'all', label: '不限', test: () => true },
  { id: 'low', label: '15 积分以内', test: (c: number) => c <= 15 },
  { id: 'mid', label: '16–30 积分', test: (c: number) => c > 15 && c <= 30 },
  { id: 'high', label: '30 积分以上', test: (c: number) => c > 30 },
] as const

export function Market() {
  const [params, setParams] = useSearchParams()
  const { favorites, isFavorite } = useApp()
  const { skills: TOOLS, skillsMap } = useSkills()

  const [q, setQ] = useState(params.get('q') ?? '')
  const [scene, setScene] = useState<SceneId | 'all'>((params.get('scene') as SceneId) ?? 'all')
  const [kind, setKind] = useState<ProductKind | 'all'>((params.get('kind') as ProductKind) ?? 'all')
  const [band, setBand] = useState<string>('all')
  const [creator, setCreator] = useState<string>('all')
  const [sort, setSort] = useState<Sort>('hot')
  const [favOnly, setFavOnly] = useState(params.get('fav') === '1')
  const [searching, setSearching] = useState(false)

  // URL 变化时同步（从首页带 q 跳过来）
  useEffect(() => {
    const nq = params.get('q') ?? ''
    const ns = (params.get('scene') as SceneId) ?? 'all'
    const nk = (params.get('kind') as ProductKind) ?? 'all'
    setQ(nq)
    setScene(ns)
    setKind(nk)
    setFavOnly(params.get('fav') === '1')
  }, [params])

  // 后端检索命中的工具 id（按相关度排序）；null 表示没走过后端
  const [apiRanked, setApiRanked] = useState<string[] | null>(null)

  // 关键词走后端检索，筛选项仍在前端做
  useEffect(() => {
    const kw = q.trim()
    if (!kw) {
      setApiRanked(null)
      setSearching(false)
      return
    }

    let cancelled = false
    setSearching(true)

    const t = setTimeout(() => {
      searchToolsWithApi(kw, TOOLS, skillsMap, 30)
        .then((tools) => {
          if (cancelled) return
          setApiRanked(tools.map((x) => x.id))
        })
        .catch(() => {
          if (!cancelled) setApiRanked(null)
        })
        .finally(() => {
          if (!cancelled) setSearching(false)
        })
    }, 260)

    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [q])

  const results = useMemo(() => {
    const kw = q.trim().toLowerCase()
    const bandDef = CREDIT_BANDS.find((b) => b.id === band)!
    const rank = kw && apiRanked ? new Map(apiRanked.map((id, i) => [id, i])) : null

    const list = TOOLS.filter((t) => {
      if (scene !== 'all' && t.scene !== scene) return false
      if (kind !== 'all' && t.kind !== kind) return false
      if (!bandDef.test(t.credits)) return false
      if (creator !== 'all' && t.creatorId !== creator) return false
      if (favOnly && !favorites.includes(t.id)) return false
      if (!kw) return true
      if (rank) return rank.has(t.id)
      const hay = [t.name, t.promise, ...t.tags, ...t.goodFor, ...t.needs].join(' ').toLowerCase()
      return hay.includes(kw)
    })

    return list.sort((a, b) => {
      // 有关键词且后端给了排序时，相关度优先
      if (rank && sort === 'hot') return rank.get(a.id)! - rank.get(b.id)!
      if (sort === 'hot') return b.users - a.users
      if (sort === 'rating') return b.rating - a.rating || b.reviewCount - a.reviewCount
      if (sort === 'cheap') return a.credits - b.credits
      return Number(!!b.isNew) - Number(!!a.isNew) || b.users - a.users
    })
    // TOOLS 是异步加载的：漏掉它会让 memo 停在首帧的空数组上，
    // 于是头部「18 个工具」和列表「找到 0 个工具」自相矛盾。
  }, [TOOLS, q, scene, kind, band, creator, sort, favOnly, favorites, apiRanked])

  // 浏览模式：没搜关键词、没开其他筛选时，按四个场景分区展示；同一件事的几个版本合成一张卡。
  // 搜索和筛选时仍然平铺，搜到哪个版本就直接显示哪个。
  const browsing = !q.trim() && kind === 'all' && band === 'all' && creator === 'all' && !favOnly
  const sections = useMemo(() => {
    if (!browsing) return []
    const cmp = (a: Tool, b: Tool) => {
      if (sort === 'rating') return b.rating - a.rating || b.reviewCount - a.reviewCount
      if (sort === 'cheap') return a.credits - b.credits
      if (sort === 'new') return Number(!!b.isNew) - Number(!!a.isNew)
      return 0   // 最多人用：保持上架顺序，也就是每个场景里从前到后的使用流程
    }
    return SCENES.filter((sc) => scene === 'all' || sc.id === scene)
      .map((sc) => {
        const inScene = TOOLS.filter((t) => t.scene === sc.id)
        const seen = new Set<string>()
        const cards: { tool: Tool; variants: Tool[] }[] = []
        for (const t of inScene) {
          if (seen.has(t.id)) continue
          // 同组里排最前的是默认推荐版本，当卡片主体；其余挂在卡片底部
          const group = t.group ? inScene.filter((x) => x.group === t.group) : [t]
          group.forEach((x) => seen.add(x.id))
          cards.push({ tool: group[0], variants: group.slice(1) })
        }
        cards.sort((a, b) => cmp(a.tool, b.tool))
        return { scene: sc, cards, total: inScene.length }
      })
      .filter((x) => x.cards.length > 0)
  }, [browsing, TOOLS, scene, sort])

  function updateUrl(next: Record<string, string | null>) {
    const p = new URLSearchParams(params)
    for (const [k, v] of Object.entries(next)) {
      if (v === null || v === 'all' || v === '') p.delete(k)
      else p.set(k, v)
    }
    setParams(p, { replace: true })
  }

  const activeCount =
    Number(scene !== 'all') + Number(kind !== 'all') + Number(band !== 'all') + Number(creator !== 'all') + Number(favOnly)

  return (
    <div>
      {/* 搜索区 */}
      <section className="relative overflow-hidden pb-8 pt-12">
        <FlowField />
        <Bubbles count={10} />
        <div className="relative mx-auto max-w-4xl px-5 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">
            工具<span className="text-flow">市场</span>
          </h1>
          <p className="mt-2.5 text-sm text-ink-500">
            {[
              `${TOOLS.length} 个工具`,
              ...SCENES.map((sc) => `${sc.short} ${TOOLS.filter((t) => t.scene === sc.id).length}`),
            ].join(' · ')}
            ，像逛应用商店一样挑
          </p>

          <div className="glass-deep relative mx-auto mt-6 flex max-w-2xl items-center gap-2 p-2" style={{ boxShadow: 'var(--shadow-water-glow)' }}>
            <span className="pl-3 text-lg text-ink-300">⌕</span>
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                updateUrl({ q: e.target.value })
              }}
              placeholder="搜工具名、场景或你要解决的问题"
              className="flex-1 bg-transparent py-2.5 text-[15px] text-ink-900 outline-none placeholder:text-ink-300"
            />
            {q && (
              <button
                onClick={() => {
                  setQ('')
                  updateUrl({ q: null })
                }}
                className="mr-1 grid h-7 w-7 place-items-center rounded-full text-ink-300 transition-colors hover:bg-water-100 hover:text-ink-500"
                aria-label="清空"
              >
                ×
              </button>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <span className="text-xs text-ink-300">热搜：</span>
            {['简历', 'PPT', '选校', '面试', 'Excel', '文书'].map((k) => (
              <button
                key={k}
                onClick={() => {
                  setQ(k)
                  updateUrl({ q: k })
                }}
                className={`chip ${q === k ? 'chip-on' : ''}`}
              >
                {k}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-5 pb-6">
        <div className="grid gap-6 lg:grid-cols-[248px_1fr]">
          {/* 筛选侧栏 */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="glass p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-bold text-ink-900">筛选</p>
                {activeCount > 0 && (
                  <button
                    onClick={() => {
                      setScene('all')
                      setKind('all')
                      setBand('all')
                      setCreator('all')
                      setFavOnly(false)
                      updateUrl({ scene: null, kind: null, fav: null })
                    }}
                    className="text-xs text-water-600 hover:text-water-800"
                  >
                    清空 ({activeCount})
                  </button>
                )}
              </div>

              <FilterGroup label="场景">
                <FilterChip on={scene === 'all'} onClick={() => { setScene('all'); updateUrl({ scene: null }) }}>
                  全部
                </FilterChip>
                {SCENES.map((s) => (
                  <FilterChip
                    key={s.id}
                    on={scene === s.id}
                    onClick={() => { setScene(s.id); updateUrl({ scene: s.id }) }}
                  >
                    {s.icon} {s.short}
                  </FilterChip>
                ))}
              </FilterGroup>

              {new Set(TOOLS.map((t) => t.kind)).size > 1 && (
              <FilterGroup label="产品类型">
                <FilterChip on={kind === 'all'} onClick={() => { setKind('all'); updateUrl({ kind: null }) }}>
                  全部
                </FilterChip>
                {(['tool', 'expert', 'workflow'] as ProductKind[])
                  .filter((k) => TOOLS.some((t) => t.kind === k))
                  .map((k) => (
                    <FilterChip key={k} on={kind === k} onClick={() => { setKind(k); updateUrl({ kind: k }) }}>
                      {KIND_LABEL[k]}
                    </FilterChip>
                  ))}
              </FilterGroup>
              )}

              <FilterGroup label="积分区间">
                {CREDIT_BANDS.map((b) => (
                  <FilterChip key={b.id} on={band === b.id} onClick={() => setBand(b.id)}>
                    {b.label}
                  </FilterChip>
                ))}
              </FilterGroup>

              <FilterGroup label="创作者">
                <FilterChip on={creator === 'all'} onClick={() => setCreator('all')}>
                  全部
                </FilterChip>
                {CREATORS.filter((c) => TOOLS.some((t) => t.creatorId === c.id)).map((c) => (
                  <FilterChip key={c.id} on={creator === c.id} onClick={() => setCreator(c.id)}>
                    {c.avatar} {c.name}
                  </FilterChip>
                ))}
              </FilterGroup>

              <label className="mt-4 flex cursor-pointer items-center gap-2.5 rounded-xl border border-water-200/70 bg-white/60 px-3 py-2.5 transition-colors hover:border-water-400">
                <input
                  type="checkbox"
                  checked={favOnly}
                  onChange={(e) => {
                    setFavOnly(e.target.checked)
                    updateUrl({ fav: e.target.checked ? '1' : null })
                  }}
                  className="h-4 w-4 accent-[var(--color-water-500)]"
                />
                <span className="text-sm text-ink-700">
                  只看收藏 <span className="text-ink-300 tabular-nums">({favorites.length})</span>
                </span>
              </label>
            </div>
          </aside>

          {/* 结果区 */}
          <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-ink-500">
                {browsing ? (
                  <>
                    共 <span className="font-bold text-ink-900 tabular-nums">{results.length}</span> 个工具，按场景浏览，
                    同一件事的不同版本合在一张卡里
                  </>
                ) : (
                  <>找到 <span className="font-bold text-ink-900 tabular-nums">{results.length}</span> 个工具</>
                )}
                {q && (
                  <>
                    ，关键词「<span className="font-semibold text-water-700">{q}</span>」
                  </>
                )}
              </p>
              <div className="flex gap-1 rounded-full border border-water-200/70 bg-white/60 p-1 backdrop-blur">
                {SORTS.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSort(s.id)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-300 ${
                      sort === s.id
                        ? 'bg-gradient-to-r from-water-500 to-water-400 text-white shadow-[0_4px_14px_-4px_rgba(0,180,216,.9)]'
                        : 'text-ink-500 hover:text-water-700'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {searching ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={i} className="skeleton-water h-44 rounded-water" />
                ))}
              </div>
            ) : results.length === 0 ? (
              <Empty
                icon="🫧"
                title="这片水域暂时没有匹配的工具"
                sub="换个说法，或者放宽筛选条件试试。你也可以自己做一个——创作中心两小时就能发布。"
              />
            ) : browsing ? (
              <div key={`${sort}-${scene}`} className="space-y-10">
                {sections.map(({ scene: sc, cards, total }) => (
                  <section key={sc.id}>
                    <div className="mb-3 flex flex-wrap items-end justify-between gap-2 border-b border-water-100 pb-2.5">
                      <div className="min-w-0">
                        <h2 className="flex items-center gap-2 text-lg font-bold text-ink-900">
                          <span aria-hidden>{sc.icon}</span>
                          {sc.name}
                          <span className="text-xs font-medium text-ink-400 tabular-nums">{total} 个工具</span>
                        </h2>
                        <p className="mt-0.5 text-xs text-ink-500">{sc.tagline}</p>
                      </div>
                      {scene === 'all' && (
                        <button
                          onClick={() => { setScene(sc.id); updateUrl({ scene: sc.id }) }}
                          className="text-xs font-medium text-water-600 hover:text-water-800"
                        >
                          只看{sc.short} →
                        </button>
                      )}
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                      {cards.map(({ tool, variants }, i) => (
                        <ToolCard key={tool.id} tool={tool} variants={variants} showScene={false} index={Math.min(i, 11)} />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <div key={`${sort}-${scene}-${kind}`} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {results.map((t, i) => (
                  <ToolCard key={t.id} tool={t} index={Math.min(i, 11)} />
                ))}
              </div>
            )}

            {/* 收藏浮窗提示 */}
            {favorites.length > 0 && !favOnly && (
              <div className="mt-8">
                <SectionTitle title="你收藏的工具" sub="收藏后会同步到工作台，运行时可直接调用" />
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {TOOLS.filter((t) => isFavorite(t.id))
                    .slice(0, 3)
                    .map((t, i) => (
                      <ToolCard key={t.id} tool={t} index={i} />
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 first:mt-0">
      <p className="mb-2 text-xs font-semibold text-ink-400">{label}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}

function FilterChip({
  on,
  onClick,
  children,
}: {
  on: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button onClick={onClick} className={`chip ${on ? 'chip-on' : ''}`}>
      {children}
    </button>
  )
}
