import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { SCENES } from '../data/scenes'
import { POSTS } from '../data/posts'
import { CREATORS } from '../data/creators'
import { useAuth } from '../store/AuthContext'
import { useSkills } from '../store/SkillsContext'
import { ToolCard } from '../components/ToolCard'
import { PostCard } from '../components/PostCard'
import { SectionTitle, fmt, stag } from '../components/ui/Ui'
import { Bubbles, FlowField, WaveDivider } from '../components/water/Water'
import { SAMPLE_INTENTS } from '../lib/intent'
import { fetchChatThreads, wsApi, type ChatThread, type WsFull, type WsOutput } from '../lib/api'
import { AiDigestSection } from '../components/AiDigest'

export function Home() {
  return (
    <div>
      <Hero />
      <AiDigestSection />
      <SceneRow />
      <RecentRow />
      <Recommended />
      <HotPosts />
      <CreatorRow />
    </div>
  )
}

/* ─────────────── 首屏：对话入口（发起后进入独立对话页） ─────────────── */

function Hero() {
  const { skills: TOOLS } = useSkills()
  const { user, openAuth } = useAuth()
  const nav = useNavigate()

  const [q, setQ] = useState('')
  const [ph, setPh] = useState(0)
  const [threads, setThreads] = useState<ChatThread[]>([])

  // 占位文案轮播
  useEffect(() => {
    if (q) return
    const t = setInterval(() => setPh((p) => (p + 1) % SAMPLE_INTENTS.length), 3600)
    return () => clearInterval(t)
  }, [q])

  // 清掉旧版首页对话遗留的缓存
  useEffect(() => {
    try { sessionStorage.removeItem('liushui.hero.chat') } catch { /* ignored */ }
  }, [])

  // 登录后预取最近一次对话，用于「继续上次对话」入口
  useEffect(() => {
    if (!user) { setThreads([]); return }
    let alive = true
    fetchChatThreads().then((t) => { if (alive) setThreads(t) })
    return () => { alive = false }
  }, [user])

  function start(text?: string) {
    const msg = (text ?? q).trim()
    if (!msg) return
    if (!user) { openAuth(); return }
    nav('/chat', { state: { initial: msg } })
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      start()
    }
  }

  return (
    <section className="relative overflow-hidden pb-6 pt-8 sm:pt-12">
      <FlowField />
      <Bubbles count={16} />

      <div className="relative mx-auto max-w-4xl px-5">
        <div className="text-center">
          <div
            className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/60 px-4 py-1.5 text-xs font-medium text-water-700 backdrop-blur"
            style={{ animation: 'rise .6s cubic-bezier(.22,1,.36,1) both' }}
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-water-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-water-500" />
            </span>
            学生 AI 目标达成平台 · 已上线 {TOOLS.length} 个工具
          </div>

          <h1
            className="mt-4 text-4xl font-bold leading-tight tracking-tight text-ink-900 sm:text-5xl"
            style={{ animation: 'rise .6s cubic-bezier(.22,1,.36,1) .08s both' }}
          >
            你现在想<span className="text-flow">完成什么</span>？
          </h1>

          <p
            className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-ink-500"
            style={{ animation: 'rise .6s cubic-bezier(.22,1,.36,1) .14s both' }}
          >
            直接说你想办的事，我帮你找对工具、对比、做出结果，可以接着聊。
          </p>
        </div>

        {/* 输入框 */}
        <div
          className="glass-deep mx-auto mt-5 max-w-2xl p-2"
          style={{
            animation: 'rise .6s cubic-bezier(.22,1,.36,1) .2s both',
            boxShadow: 'var(--shadow-water-glow)',
          }}
        >
          <div className="flex items-end gap-2">
            <textarea
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onKeyDown}
              rows={2}
              maxLength={20000}
              placeholder={SAMPLE_INTENTS[ph]}
              className="min-h-[44px] flex-1 resize-none bg-transparent px-4 py-3 text-[15px] leading-relaxed text-ink-900 outline-none placeholder:text-ink-300"
            />
            <button
              onClick={() => start()}
              disabled={!q.trim()}
              className="btn-water mb-1 mr-1 shrink-0 px-6 py-3"
            >
              去完成 →
            </button>
          </div>
        </div>

        {/* 示例 chips：保留「试试：」标签，pill 样式，文字完整显示 */}
        <div
          className="mx-auto mt-3 flex max-w-2xl flex-wrap items-start justify-center gap-2"
          style={{ animation: 'rise .6s cubic-bezier(.22,1,.36,1) .26s both' }}
        >
          <span className="mt-1 text-xs text-ink-300">试试：</span>
          {SAMPLE_INTENTS.slice(0, 4).map((s) => (
            <button key={s} onClick={() => start(s)} className="chip text-left">
              {s}
            </button>
          ))}
        </div>

        {/* 有历史对话：给一个直接继续的入口 */}
        {user && threads.length > 0 && (
          <div className="mt-3 flex justify-center">
            <Link
              to={`/chat/${threads[0].id}`}
              className="inline-flex max-w-full items-center gap-2 rounded-full border border-water-200 bg-white/70 px-4 py-1.5 text-xs text-ink-600 backdrop-blur transition-colors hover:border-water-300 hover:bg-white"
            >
              <span className="shrink-0 font-medium text-water-700">继续上次对话</span>
              <span className="truncate text-ink-400">{threads[0].title || '新对话'}</span>
              <span aria-hidden className="shrink-0 text-water-500">→</span>
            </Link>
          </div>
        )}
      </div>
    </section>
  )
}

/* ─────────────── 场景入口 ─────────────── */

function SceneRow() {
  const { skills: TOOLS } = useSkills()
  return (
    <section className="mx-auto max-w-7xl px-5 pt-12">
      <SectionTitle
        title="从一个场景开始"
        sub="学习提效负责高频，求职和留学负责结果，工作台负责把它们连起来"
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {SCENES.map((s, i) => {
          const count = TOOLS.filter((t) => t.scene === s.id).length
          const users = TOOLS.filter((t) => t.scene === s.id).reduce((a, t) => a + t.users, 0)
          return (
            <Link
              key={s.id}
              to={`/market?scene=${s.id}`}
              className="stagger group relative overflow-hidden rounded-water p-5 text-white transition-all duration-500 hover:-translate-y-1.5"
              style={stag(i, { boxShadow: 'var(--shadow-water)' })}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${s.gradient}`} />
              {/* 悬停时水面上涌 */}
              <svg
                className="absolute inset-x-0 bottom-0 h-12 w-[200%] translate-y-4 opacity-0 transition-all duration-700 group-hover:translate-y-0 group-hover:opacity-100 animate-[wave_12s_linear_infinite]"
                viewBox="0 0 120 12"
                preserveAspectRatio="none"
                aria-hidden
              >
                <path d="M0 7 C 15 1, 30 1, 45 7 S 75 13, 90 7 S 120 1, 120 7 V12 H0Z" fill="rgba(255,255,255,.3)" />
              </svg>

              <div className="relative">
                <div className="text-3xl transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6">
                  {s.icon}
                </div>
                <h3 className="mt-3 text-lg font-bold">{s.name}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-white/85">{s.tagline}</p>
                <div className="mt-4 flex items-center justify-between text-[11px] text-white/80 tabular-nums">
                  <span>{count} 个工具</span>
                  <span className="transition-transform duration-300 group-hover:translate-x-1">
                    {fmt(users)} 人用过 →
                  </span>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}

/* ─────────────── 最近使用 ─────────────── */

function RecentRow() {
  const { skillsMap } = useSkills()
  const { user } = useAuth()
  const [ws, setWs] = useState<WsFull | null>(null)
  const [recent, setRecent] = useState<WsOutput[]>([])

  useEffect(() => {
    if (!user) { setWs(null); setRecent([]); return }
    let alive = true
    wsApi.list().then(async (list) => {
      const job = list?.find((w) => w.kind === 'job')
      const [full, outs] = await Promise.all([job ? wsApi.get(job.id) : null, wsApi.outputs()])
      if (!alive) return
      setWs(full)
      setRecent((outs ?? []).slice(0, 3))
    })
    return () => { alive = false }
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!user || !ws) return null
  const active = ws.targets.filter((t) => t.stage !== 'closed')
  const todayIso = new Date().toISOString().slice(0, 10)
  const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
  const orgOf = (id: string | null) => ws.targets.find((t) => t.id === id)?.org
  // 这周要做的：未来 7 天的日程和到期待办，过期未处理的也算
  const week = [
    ...ws.events.filter((e) => !e.done && e.date.slice(0, 10) <= weekEnd).map((e) => ({ id: e.id, date: e.date.slice(0, 10), title: e.title, org: orgOf(e.target_id) })),
    ...ws.todos.filter((t) => !t.done && t.due && t.due.slice(0, 10) <= weekEnd).map((t) => ({ id: t.id, date: t.due.slice(0, 10), title: t.text, org: orgOf(t.target_id) })),
  ].sort((a, b) => a.date.localeCompare(b.date))
  const stageLabel = (id: string) => ws.stages.find((s) => s.id === id)?.label ?? id

  return (
    <section className="mx-auto max-w-7xl px-5 pt-14">
      <SectionTitle
        title="接着上次继续"
        sub="你的投递进度、接下来的日程和最近的工具结果"
        action={<Link to="/workspace" className="btn-quiet shrink-0">打开工作台 →</Link>}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Link to="/workspace" className="glass lift stagger p-4" style={stag(0)}>
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-water-100 text-xl">{ws.icon}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold text-ink-900">{ws.name}</p>
              <p className="mt-0.5 line-clamp-1 text-xs text-ink-500">{ws.goal}</p>
            </div>
          </div>
          {active.length === 0 ? (
            <p className="mt-4 text-xs leading-relaxed text-ink-500">还没有投递记录，进工作台把在投的公司加进来。</p>
          ) : (
            <div className="mt-3 space-y-1">
              {active.slice(0, 3).map((t) => (
                <p key={t.id} className="flex items-center gap-2 text-xs">
                  <span className="min-w-0 flex-1 truncate text-ink-700">{t.org}{t.role ? ` · ${t.role}` : ''}</span>
                  <span className="shrink-0 rounded bg-water-50 px-1.5 py-px text-[11px] text-water-700">{stageLabel(t.stage)}</span>
                </p>
              ))}
              {active.length > 3 && <p className="text-[11px] text-ink-400">还有 {active.length - 3} 条</p>}
            </div>
          )}
        </Link>

        <Link to="/workspace" className="glass lift stagger p-4" style={stag(1)}>
          <p className="mb-2 text-sm font-bold text-ink-900">
            这周要做的
            {week.length > 0 && <span className="ml-1.5 text-xs font-normal text-ink-400">{week.length} 项</span>}
          </p>
          {week.length === 0 ? (
            <p className="text-xs leading-relaxed text-ink-500">这周没有笔试、面试、截止日期或到期待办。</p>
          ) : (
            <div className="space-y-1.5">
              {week.slice(0, 4).map((e) => (
                <p key={e.id} className="flex gap-1.5 text-xs text-ink-700">
                  <span className={`shrink-0 tabular-nums ${e.date < todayIso ? 'text-accent-coral' : 'text-water-700'}`}>
                    {e.date < todayIso ? '已过期' : e.date === todayIso ? '今天' : e.date.slice(5)}
                  </span>
                  <span className="min-w-0 truncate">{e.title}{e.org ? <span className="text-ink-400"> · {e.org}</span> : ''}</span>
                </p>
              ))}
              {week.length > 4 && <p className="text-[11px] text-ink-400">还有 {week.length - 4} 项</p>}
            </div>
          )}
        </Link>

        {recent.length > 0 ? (
          <div className="glass stagger p-4" style={stag(2)}>
            <p className="mb-2 text-sm font-bold text-ink-900">最近的工具结果</p>
            <div className="space-y-1">
              {recent.map((r) => (
                <Link
                  key={r.id}
                  to={r.thread_id ? `/chat/${r.thread_id}` : '/workspace'}
                  className="flex items-center gap-2.5 rounded-xl px-2 py-2 transition-colors hover:bg-water-50"
                >
                  <span className="text-base">{skillsMap[r.skill_id]?.icon ?? '💧'}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink-700">{r.skill_name}</span>
                    <span className="block truncate text-[11px] text-ink-300">{r.hint || r.created_at.slice(0, 10)}</span>
                  </span>
                  <span className="shrink-0 text-[11px] text-ink-400 tabular-nums">-{r.credits}</span>
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <div className="glass stagger flex flex-col justify-center p-5" style={stag(2)}>
            <p className="text-sm font-bold text-ink-900">还没有工具结果</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-500">
              在上面描述一件你想完成的事，或直接去工具市场逛逛。运行成功的结果会自动存进工作台。
            </p>
            <Link to="/market" className="btn-ghost mt-3 self-start">逛工具市场</Link>
          </div>
        )}
      </div>
    </section>
  )
}

/* ─────────────── 推荐工具 ─────────────── */

function Recommended() {
  const { skills: TOOLS } = useSkills()
  const [tab, setTab] = useState<'hot' | 'new' | 'workflow'>('hot')

  const list =
    tab === 'hot'
      ? [...TOOLS].sort((a, b) => b.users - a.users).slice(0, 8)
      : tab === 'new'
        ? TOOLS.filter((t) => t.isNew).concat([...TOOLS].sort((a, b) => b.rating - a.rating)).slice(0, 8)
        : TOOLS.filter((t) => t.kind !== 'tool').slice(0, 8)

  return (
    <section className="mx-auto max-w-7xl px-5 pt-14">
      <SectionTitle
        title="推荐给你的工具"
        sub="按你的浏览记录、场景热度和近期趋势排序"
        action={
          <div className="flex shrink-0 gap-1 rounded-full border border-water-200/70 bg-white/60 p-1 backdrop-blur">
            {(
              [
                ['hot', '最多人用'],
                ['new', '新上线'],
                ['workflow', '专家与工作流'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-300 ${
                  tab === id
                    ? 'bg-gradient-to-r from-water-500 to-water-400 text-white shadow-[0_4px_14px_-4px_rgba(0,180,216,.9)]'
                    : 'text-ink-500 hover:text-water-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        }
      />
      <div key={tab} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {list.map((t, i) => (
          <ToolCard key={t.id} tool={t} index={i} />
        ))}
      </div>
      <div className="mt-6 text-center">
        <Link to="/market" className="btn-ghost">
          浏览全部 {TOOLS.length} 个工具 →
        </Link>
      </div>
    </section>
  )
}

/* ─────────────── 热门帖子 ─────────────── */

function HotPosts() {
  const top = [...POSTS].sort((a, b) => b.likes - a.likes).slice(0, 3)

  return (
    <section className="relative mt-16">
      <WaveDivider from="#caf0f8" to="#ade8f4" />
      <div className="bg-gradient-to-b from-water-100/60 to-transparent pb-8 pt-4">
        <div className="mx-auto max-w-7xl px-5">
          <SectionTitle
            title="别人是怎么做成的"
            sub="真实经验、结果前后对比和踩过的坑——每篇都能直接跳到用到的工具"
            action={
              <Link to="/community" className="btn-quiet shrink-0">
                进入社区 →
              </Link>
            }
          />
          <div className="grid gap-4 md:grid-cols-3">
            {top.map((p, i) => (
              <PostCard key={p.id} post={p} index={i} />
            ))}
          </div>
        </div>
      </div>
      <WaveDivider flip from="#ade8f4" to="#caf0f8" />
    </section>
  )
}

/* ─────────────── 创作者与专题 ─────────────── */

function CreatorRow() {
  const featured = CREATORS.filter((c) => c.id !== 'c-you').slice(0, 4)

  return (
    <section className="mx-auto max-w-7xl px-5 pt-6">
      <SectionTitle
        title="工具背后的人"
        sub="学生、老师、顾问、机构和企业都可以在这里发布工具"
        action={
          <Link to="/creator" className="btn-quiet shrink-0">
            我也要发布 →
          </Link>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {featured.map((c, i) => (
          <div
            key={c.id}
            className="glass lift stagger p-4"
            style={stag(i)}
          >
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-water-100 to-water-300 text-xl">
                {c.avatar}
              </span>
              <div className="min-w-0">
                <p className="truncate font-bold text-ink-900">{c.name}</p>
                <span className="mt-0.5 inline-block rounded bg-water-100 px-1.5 py-px text-[10px] font-medium text-water-700">
                  {c.badge.label}
                </span>
              </div>
            </div>
            <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-ink-500">{c.bio}</p>
            <div className="mt-3 flex items-center gap-3 border-t border-water-100 pt-3 text-[11px] text-ink-400 tabular-nums">
              <span>{c.toolCount} 个工具</span>
              <span className="text-water-200">·</span>
              <span>{fmt(c.monthlyActiveUsers)} 月活用户</span>
            </div>
          </div>
        ))}
      </div>

      {/* 与录途AI 的导流位 —— 文档 §1.3 */}
      <div className="glass-deep mt-8 flex flex-col items-start gap-4 overflow-hidden p-6 sm:flex-row sm:items-center">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-accent-violet/20 to-water-200 text-2xl">
          🎓
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-ink-900">在做机构、学校或顾问业务？</p>
          <p className="mt-1 text-sm leading-relaxed text-ink-500">
            录途AI 面向留学机构、学校和顾问提供完整解决方案。品牌与账户独立，不共享用户数据。
          </p>
        </div>
        <button className="btn-ghost shrink-0">了解录途AI →</button>
      </div>
    </section>
  )
}
