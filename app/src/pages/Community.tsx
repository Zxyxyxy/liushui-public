import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { POSTS } from '../data/posts'
import { SCENES } from '../data/scenes'
import { useSkills } from '../store/SkillsContext'
import type { SceneId } from '../data/types'
import { PostCard } from '../components/PostCard'
import { ToolRow } from '../components/ToolCard'
import { Empty, SectionTitle, fmt, stag } from '../components/ui/Ui'
import { Bubbles, FlowField } from '../components/water/Water'

type Sort = 'hot' | 'new' | 'discussed'

export function Community() {
  const { skills: TOOLS } = useSkills()
  const [params, setParams] = useSearchParams()
  const [scene, setScene] = useState<SceneId | 'all'>((params.get('tab') as SceneId) ?? 'all')
  const [sort, setSort] = useState<Sort>('hot')
  const [q, setQ] = useState('')

  const list = useMemo(() => {
    const kw = q.trim()
    return POSTS.filter((p) => {
      if (scene !== 'all' && p.scene !== scene) return false
      if (!kw) return true
      return [p.title, p.excerpt, ...p.tags].join(' ').includes(kw)
    }).sort((a, b) => {
      if (sort === 'hot') return b.likes - a.likes
      if (sort === 'discussed') return b.comments - a.comments
      return b.date.localeCompare(a.date)
    })
  }, [scene, sort, q])

  // 帖子里被提到最多的工具
  const trending = useMemo(() => {
    const count = new Map<string, number>()
    for (const p of POSTS) for (const id of p.relatedToolIds) count.set(id, (count.get(id) ?? 0) + 1)
    return [...count.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => TOOLS.find((t) => t.id === id)!)
      .filter(Boolean)
  }, [])

  return (
    <div>
      <section className="relative overflow-hidden pb-6 pt-12">
        <FlowField />
        <Bubbles count={12} />
        <div className="relative mx-auto max-w-4xl px-5 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">
            别人是<span className="text-flow">怎么做成的</span>
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-ink-500">
            经验、攻略、结果前后对比和踩过的坑。每篇都关联了实际用到的工具，看完可以直接开始。
          </p>

          <div className="glass-deep mx-auto mt-6 flex max-w-xl items-center gap-2 p-2">
            <span className="pl-3 text-lg text-ink-300">⌕</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜经验、场景或工具名"
              className="flex-1 bg-transparent py-2.5 text-[15px] outline-none placeholder:text-ink-300"
            />
            <button className="btn-water shrink-0 px-4 py-2 text-sm">写帖子</button>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-5 pb-4">
        <div className="grid gap-6 lg:grid-cols-[1fr_288px]">
          <div className="min-w-0">
            {/* 筛选条 */}
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => {
                    setScene('all')
                    setParams({}, { replace: true })
                  }}
                  className={`chip ${scene === 'all' ? 'chip-on' : ''}`}
                >
                  全部
                </button>
                {SCENES.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setScene(s.id)
                      setParams({ tab: s.id }, { replace: true })
                    }}
                    className={`chip ${scene === s.id ? 'chip-on' : ''}`}
                  >
                    {s.icon} {s.name}
                  </button>
                ))}
              </div>

              <div className="flex gap-1 rounded-full border border-water-200/70 bg-white/60 p-1 backdrop-blur">
                {(
                  [
                    ['hot', '最热'],
                    ['new', '最新'],
                    ['discussed', '讨论最多'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => setSort(id)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-300 ${
                      sort === id
                        ? 'bg-gradient-to-r from-water-500 to-water-400 text-white shadow-[0_4px_14px_-4px_rgba(0,180,216,.9)]'
                        : 'text-ink-500 hover:text-water-700'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {list.length === 0 ? (
              <Empty icon="🫧" title="这里还很安静" sub="换个关键词，或者你来发第一篇。" />
            ) : (
              <div key={`${scene}-${sort}`} className="grid gap-4 sm:grid-cols-2">
                {list.map((p, i) => (
                  <PostCard key={p.id} post={p} index={i} />
                ))}
              </div>
            )}
          </div>

          {/* 侧栏 */}
          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <div className="glass p-4">
              <p className="mb-2 text-sm font-bold text-ink-900">帖子里最常被提到的工具</p>
              <p className="mb-2 text-[11px] text-ink-400">
                内容带动使用，使用又产出新内容——这是平台的信任层
              </p>
              <div className="space-y-1">
                {trending.map((t) => (
                  <ToolRow key={t.id} tool={t} />
                ))}
              </div>
            </div>

            <div className="glass p-4">
              <p className="mb-2.5 text-sm font-bold text-ink-900">发帖只要三步</p>
              <ol className="space-y-2.5">
                {[
                  ['运行工具拿到结果', '任何一次成功运行都可以发'],
                  ['一键生成案例帖', '自动出标题、摘要、标签并隐去隐私'],
                  ['预览后发布', '发布可获得 30 积分奖励'],
                ].map(([t, d], i) => (
                  <li key={t} className="flex gap-2.5">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-gradient-to-br from-water-400 to-water-600 text-[10px] font-bold text-white">
                      {i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold text-ink-900">{t}</span>
                      <span className="block text-[11px] text-ink-400">{d}</span>
                    </span>
                  </li>
                ))}
              </ol>
              <Link to="/market" className="btn-ghost mt-3.5 w-full justify-center">
                先去跑一个工具
              </Link>
            </div>

            <div className="glass p-4">
              <p className="mb-2 text-sm font-bold text-ink-900">社区范围</p>
              <p className="text-[11px] leading-relaxed text-ink-500">
                首期只服务学习提效、留学申请、求职实习和校园任务。不做泛生活社区，避免内容定位失焦。
              </p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {SCENES.map((s) => (
                  <span key={s.id} className="chip">
                    {s.icon} {s.short}
                  </span>
                ))}
              </div>
            </div>
          </aside>
        </div>

        {/* 底部数据 */}
        <div className="mt-10">
          <SectionTitle title="社区在发生什么" sub="每一次结果都可以变成别人的参考" />
          <div className="grid gap-4 sm:grid-cols-4">
            {[
              ['累计帖子', POSTS.length, '篇'],
              ['总浏览', POSTS.reduce((s, p) => s + p.views, 0), '次'],
              ['获赞', POSTS.reduce((s, p) => s + p.likes, 0), '次'],
              ['关联工具', new Set(POSTS.flatMap((p) => p.relatedToolIds)).size, '个'],
            ].map(([label, n, unit], i) => (
              <div
                key={label as string}
                className="glass stagger p-5 text-center"
                style={stag(i)}
              >
                <p className="text-2xl font-bold text-water-700 tabular-nums">{fmt(n as number)}</p>
                <p className="mt-1 text-xs text-ink-400">
                  {label as string}（{unit as string}）
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
