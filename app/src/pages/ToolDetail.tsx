import { useState, useEffect, useCallback } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { CREATOR_MAP, BADGE_STYLE } from '../data/creators'
import { KIND_LABEL, SCENE_MAP } from '../data/scenes'
import { POSTS } from '../data/posts'
import type { Tool } from '../data/types'
import { useApp } from '../store/AppContext'
import { useSkills } from '../store/SkillsContext'
import { useAuth } from '../store/AuthContext'
import { ToolRow } from '../components/ToolCard'
import { PostRow } from '../components/PostCard'
import { Stars, Tabs, Modal, fmt, stag } from '../components/ui/Ui'
import { Bubbles, Drop, FlowField, LiquidBar, Ripple } from '../components/water/Water'
import { relatedTools } from '../lib/relatedTools'
import { fetchReviews, postReview, type BackendReview, type ReviewStats } from '../lib/api'

export function ToolDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const { isFavorite, toggleFavorite, credits } = useApp()
  const { skillsMap, skills, loading } = useSkills()
  const [tab, setTab] = useState<'about' | 'sample' | 'reviews'>('about')

  const tool = id ? skillsMap[id] : undefined
  // skills 是异步加载的。首帧 skillsMap 必然是空的，这时候不能判定「工具不存在」
  // 就跳走——那会让所有直接打开 /tool/:id 的链接（分享、刷新、收藏）都被踢回市场。
  if (loading) return <ToolDetailSkeleton />
  if (!tool) return <Navigate to="/market" replace />

  const creator = CREATOR_MAP[tool.creatorId]
  const scene = SCENE_MAP[tool.scene]
  const fav = isFavorite(tool.id)
  const related = relatedTools(tool, skills)
  const relatedPosts = POSTS.filter((p) => p.relatedToolIds.includes(tool.id))
  const enough = credits >= tool.credits

  return (
    <div>
      {/* 头部 */}
      <section className="relative overflow-hidden pb-3 pt-10">
        <FlowField />
        <Bubbles count={8} />

        <div className="relative mx-auto max-w-7xl px-5">
          <nav className="mb-5 flex items-center gap-1.5 text-xs text-ink-400">
            <Link to="/" className="hover:text-water-700">首页</Link>
            <span className="text-water-300">/</span>
            <Link to="/market" className="hover:text-water-700">找工具</Link>
            <span className="text-water-300">/</span>
            <Link to={`/market?scene=${scene.id}`} className="hover:text-water-700">{scene.name}</Link>
            <span className="text-water-300">/</span>
            <span className="text-ink-700">{tool.name}</span>
          </nav>

          <div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-4">
                <div
                  className="grid h-16 w-16 shrink-0 place-items-center rounded-3xl text-3xl animate-[bob_7s_ease-in-out_infinite]"
                  style={{
                    background: 'linear-gradient(140deg, var(--color-water-100), var(--color-water-300))',
                    boxShadow: '0 12px 30px -12px rgba(0,119,182,.6), inset 0 1px 0 rgba(255,255,255,.9)',
                  }}
                >
                  {tool.icon}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">
                      {tool.name}
                    </h1>
                    {tool.isHot && (
                      <span className="rounded-full bg-accent-coral/15 px-2 py-0.5 text-[11px] font-bold text-accent-coral">
                        热门
                      </span>
                    )}
                    {tool.isNew && (
                      <span className="rounded-full bg-accent-mint/15 px-2 py-0.5 text-[11px] font-bold text-accent-mint">
                        新上线
                      </span>
                    )}
                  </div>

                  {/* 一句话结果承诺 */}
                  <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink-500">{tool.promise}</p>

                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <Stars rating={tool.rating} count={tool.reviewCount} />
                    <span className="text-water-200">·</span>
                    <span className="text-xs text-ink-400 tabular-nums">{fmt(tool.users)} 人用过</span>
                    <span className="text-water-200">·</span>
                    <span className="rounded-md bg-water-100/80 px-2 py-0.5 text-[11px] font-medium text-water-700">
                      {KIND_LABEL[tool.kind]}
                    </span>
                    <Link
                      to={`/market?scene=${scene.id}`}
                      className="rounded-md bg-white/70 px-2 py-0.5 text-[11px] font-medium text-ink-500 ring-1 ring-water-200/70 ring-inset transition-colors hover:text-water-700"
                    >
                      {scene.icon} {scene.name}
                    </Link>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {tool.tags.map((t) => (
                      <Link key={t} to={`/market?q=${encodeURIComponent(t)}`} className="chip">
                        #{t}
                      </Link>
                    ))}
                  </div>

                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 正文 */}
      <div className="mx-auto max-w-7xl px-5 pb-4 pt-2">
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="min-w-0">
            {/* 来源可信度 —— 页面唯一的信任背书区，与下方内容左右对齐 */}
            {tool.sourceInfo && (
              <div
                className="mb-5 rounded-2xl border border-water-200/80 bg-gradient-to-br from-water-50 to-white/60 px-4 py-3.5"
                style={{ boxShadow: '0 6px 20px -12px rgba(0,119,182,.45)' }}
              >
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/80 px-2.5 py-1 text-xs font-semibold text-water-800 ring-1 ring-water-200/80 ring-inset">
                    <span className="text-sm">✓</span>
                    开源技能库驱动
                  </span>
                  {/* star 数没核实过的填 0，这时不显示，免得出现「0 收藏」 */}
                  {tool.sourceInfo.stars > 0 && (
                    <span className="flex items-baseline gap-1.5 text-sm text-ink-500">
                      <span className="text-[15px] leading-none">⭐</span>
                      <span className="text-base font-bold tabular-nums text-ink-900">
                        {tool.sourceInfo.stars >= 1000
                          ? `${(tool.sourceInfo.stars / 1000).toFixed(1)}k`
                          : tool.sourceInfo.stars}
                      </span>
                      <span className="text-xs">GitHub 收藏</span>
                    </span>
                  )}
                  <span className="flex items-baseline gap-1.5 text-sm text-ink-500">
                    <span className="text-[15px] leading-none">👥</span>
                    <span className="text-base font-bold tabular-nums text-ink-900">
                      {tool.users >= 10000
                        ? `${Math.round(tool.users / 10000)}w+`
                        : `${tool.users.toLocaleString()}+`}
                    </span>
                    <span className="text-xs">人使用过</span>
                  </span>
                </div>
                <p className="mt-2.5 text-[13px] leading-relaxed text-ink-600">
                  {tool.sourceInfo.origin}
                </p>
              </div>
            )}

            <Tabs
              tabs={[
                { id: 'about' as const, label: '工具说明' },
                { id: 'sample' as const, label: '示例输入输出' },
                { id: 'reviews' as const, label: '用户评价', count: tool.reviewCount },
              ]}
              value={tab}
              onChange={setTab}
            />

            <div key={tab} className="mt-5" style={{ animation: 'rise .4s cubic-bezier(.22,1,.36,1) both' }}>
              {tab === 'about' && <AboutTab tool={tool} />}
              {tab === 'sample' && <SampleTab tool={tool} />}
              {tab === 'reviews' && <ReviewsTab tool={tool} />}
            </div>

            {/* 发现区 —— 放在左栏底部，和右侧侧栏一起收口，避免右长左短 */}
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {/* 相关帖子 —— 文档 §9.1 反向展示 */}
              {relatedPosts.length > 0 && (
                <div className="glass p-4">
                  <p className="mb-2 text-sm font-bold text-ink-900">用过的人怎么说</p>
                  <div className="space-y-1">
                    {relatedPosts.slice(0, 3).map((p) => (
                      <PostRow key={p.id} post={p} />
                    ))}
                  </div>
                </div>
              )}

              {/* 相似工具与配套工作流 */}
              <div className="glass p-4">
                <p className="mb-2 text-sm font-bold text-ink-900">相似工具与配套工作流</p>
                <div className="space-y-1">
                  {related.map((t) => (
                    <ToolRow key={t.id} tool={t} />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 侧栏 */}
          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            {/* 运行卡片 —— 三件事：能做什么、要给什么、花多少 */}
            <div className="glass-deep p-5" style={{ boxShadow: 'var(--shadow-water-glow)' }}>
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-ink-500">本次预计消耗</span>
                <span className="flex items-baseline gap-1 text-3xl font-bold text-water-700">
                  <Drop className="h-5 w-5 self-center" />
                  {tool.credits}
                  <span className="text-sm font-medium text-ink-400">积分</span>
                </span>
              </div>

              <div className="mt-3">
                <LiquidBar
                  value={Math.min(100, Math.round((credits / Math.max(tool.credits, 1)) * 100))}
                  label={`当前余额 ${credits} 积分`}
                  tone={enough ? '#00b4d8' : '#ff8360'}
                />
              </div>

              <Ripple
                as="button"
                onClick={() => nav('/chat', { state: { openTool: tool.id } })}
                className="btn-water mt-4 w-full py-3 text-base"
              >
                开始使用 →
              </Ripple>

              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => toggleFavorite(tool.id)}
                  className={`btn-ghost flex-1 ${fav ? 'border-water-400 bg-water-100 text-water-800' : ''}`}
                >
                  {fav ? '♥ 已收藏' : '♡ 收藏'}
                </button>
                <button className="btn-ghost flex-1">分享</button>
              </div>

              <div className="mt-4 space-y-2 border-t border-water-100 pt-4 text-xs">
                <Declare label="支持文件" value={tool.fileTypes.length ? tool.fileTypes.join('、') : '无需文件'} />
                <Declare label="输出类型" value={tool.outputTypes.join('、')} />
                <Declare
                  label="外部数据"
                  value={tool.externalData.length ? tool.externalData.join('、') : '不访问外部数据'}
                  warn={tool.externalData.length > 0}
                />
                <Declare label="保存到工作台" value="可选" />
              </div>

              <p className="mt-3 rounded-xl bg-accent-mint/8 px-3 py-2 text-[11px] leading-relaxed text-accent-mint">
                文件上传、存储、预览和工作台保存均不扣积分。运行失败不扣积分。
              </p>
            </div>

            {/* 作者 */}
            <div className="glass p-4">
              <p className="mb-3 text-sm font-bold text-ink-900">工具作者</p>
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-water-100 to-water-300 text-xl">
                  {creator.avatar}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-bold text-ink-900">{creator.name}</p>
                  <span
                    className={`mt-0.5 inline-block rounded px-1.5 py-px text-[10px] font-semibold ${BADGE_STYLE[creator.badge.kind]}`}
                  >
                    ✓ {creator.badge.label}
                  </span>
                </div>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-ink-500">{creator.bio}</p>
              <div className="mt-3 flex items-center gap-3 border-t border-water-100 pt-3 text-[11px] text-ink-400 tabular-nums">
                <span>{creator.toolCount} 个工具</span>
                <span className="text-water-200">·</span>
                <span>{fmt(creator.followers)} 关注</span>
              </div>
            </div>

          </aside>
        </div>
      </div>
    </div>
  )
}

function Declare({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="shrink-0 text-ink-400">{label}</span>
      <span className={`text-right font-medium ${warn ? 'text-accent-coral' : 'text-ink-700'}`}>{value}</span>
    </div>
  )
}

function AboutTab({ tool }: { tool: Tool }) {
  return (
    <div className="space-y-4">
      <div className="glass p-5">
        <h3 className="text-sm font-bold text-ink-900">它能解决什么问题</h3>
        <p className="mt-2 text-sm leading-relaxed text-ink-500">{tool.promise}</p>
        {tool.goodFor.length > 0 && (
          <>
            <p className="mt-4 text-xs font-semibold text-ink-400">适用场景</p>
            <ul className="mt-2 space-y-1.5">
              {tool.goodFor.map((g) => (
                <li key={g} className="flex gap-2 text-sm text-ink-700">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-water-400" />
                  {g}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="glass p-5">
        <h3 className="text-sm font-bold text-ink-900">你需要提供什么</h3>
        <ul className="mt-2.5 space-y-1.5">
          {tool.needs.map((n) => (
            <li key={n} className="flex gap-2 text-sm text-ink-700">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-water-400" />
              {n}
            </li>
          ))}
        </ul>
        {tool.fileTypes.length > 0 && (
          <p className="mt-3 rounded-xl bg-water-50 px-3 py-2 text-xs text-ink-500">
            支持文件：{tool.fileTypes.join('、')} · 上传与存储不扣积分，解析费用包含在本次运行中
          </p>
        )}
      </div>

      {/* 运行步骤与逐步积分 —— 文档 §7.2 不隐藏实际步骤和费用 */}
      <div className="glass p-5">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-bold text-ink-900">运行步骤</h3>
          <span className="text-xs text-ink-400">
            合计 <span className="font-bold text-water-700 tabular-nums">{tool.credits}</span> 积分
          </span>
        </div>
        <ol className="mt-3.5 space-y-0">
          {tool.steps.map((s, i) => (
            <li key={s.title} className="relative flex gap-3.5 pb-4 last:pb-0">
              {/* 连接线：像一条水流 */}
              {i < tool.steps.length - 1 && (
                <span className="absolute left-[13px] top-7 h-full w-0.5 rounded-full bg-gradient-to-b from-water-300 to-water-100" />
              )}
              <span className="relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-water-400 to-water-600 text-xs font-bold text-white">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-semibold text-ink-900">{s.title}</p>
                  <span className="shrink-0 text-xs text-ink-400 tabular-nums">{s.credits} 积分</span>
                </div>
                <p className="mt-0.5 text-xs leading-relaxed text-ink-500">{s.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {tool.externalData.length > 0 && (
        <div className="glass border-accent-coral/30 p-5">
          <h3 className="flex items-center gap-2 text-sm font-bold text-ink-900">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-accent-coral/15 text-[11px] text-accent-coral">
              !
            </span>
            外部数据权限声明
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-ink-500">
            运行时本工具会访问以下外部数据源。平台会保留数据来源和更新时间，结果中会一并展示。
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {tool.externalData.map((d) => (
              <span key={d} className="rounded-lg bg-accent-coral/10 px-2.5 py-1 text-xs font-medium text-accent-coral">
                {d}
              </span>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}

function SampleTab({ tool }: { tool: Tool }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="glass p-5">
        <p className="mb-3 flex items-center gap-2 text-sm font-bold text-ink-900">
          <span className="grid h-6 w-6 place-items-center rounded-lg bg-water-100 text-xs">入</span>
          示例输入
        </p>
        <pre className="whitespace-pre-wrap rounded-2xl bg-water-50/80 p-4 font-sans text-sm leading-relaxed text-ink-700">
          {tool.sample.input}
        </pre>
      </div>
      <div className="glass p-5">
        <p className="mb-3 flex items-center gap-2 text-sm font-bold text-ink-900">
          <span className="grid h-6 w-6 place-items-center rounded-lg bg-gradient-to-br from-water-400 to-water-600 text-xs text-white">
            出
          </span>
          示例输出
        </p>
        <pre className="whitespace-pre-wrap rounded-2xl bg-gradient-to-b from-water-50 to-water-100/60 p-4 font-sans text-sm leading-relaxed text-ink-700">
          {tool.sample.output}
        </pre>
      </div>
    </div>
  )
}

function ReviewsTab({ tool }: { tool: Tool }) {
  const { toast } = useApp()
  const { user, requireLogin } = useAuth()
  const { reload: reloadSkills } = useSkills()
  const [reviews, setReviews] = useState<BackendReview[]>([])
  const [stats, setStats] = useState<ReviewStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [writeOpen, setWriteOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetchReviews(tool.id)
    setReviews(res.reviews)
    setStats(res.stats)
    setLoading(false)
  }, [tool.id])

  useEffect(() => { load() }, [load])

  // 星级分布：有后端数据用真实，否则留空
  const dist = stats ? stats.dist_pct : [0, 0, 0, 0, 0]
  const avgRating = stats ? stats.avg_rating : tool.rating
  const count = stats ? stats.count : 0

  return (
    <div className="space-y-4">
      <div className="glass flex flex-col gap-6 p-5 sm:flex-row sm:items-center">
        <div className="shrink-0 text-center">
          <p className="text-4xl font-bold text-ink-900 tabular-nums">{avgRating.toFixed(1)}</p>
          <Stars rating={avgRating} />
          <p className="mt-1 text-xs text-ink-400 tabular-nums">{count} 条评价</p>
        </div>
        <div className="flex-1 space-y-1.5">
          {dist.map((pct, i) => (
            <div key={i} className="flex items-center gap-2.5 text-xs">
              <span className="w-6 shrink-0 text-ink-400 tabular-nums">{5 - i}星</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-water-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-water-400 to-water-500 transition-[width] duration-1000"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-8 shrink-0 text-right text-ink-300 tabular-nums">{pct}%</span>
            </div>
          ))}
        </div>
      </div>

      {loading && (
        <div className="glass p-5 text-center text-sm text-ink-400">加载评价中…</div>
      )}

      {!loading && reviews.length === 0 && (
        <div className="glass p-5 text-center text-sm text-ink-400">
          还没有评价，成为第一个写评价的人吧
        </div>
      )}

      {reviews.map((r, i) => (
        <div key={r.id} className="glass stagger p-5" style={stag(i)}>
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-water-100 text-base">
              {r.nickname.slice(0, 1)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-ink-900">{r.nickname}</p>
                {r.verified && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-water-50 px-1.5 py-0.5 text-[10px] font-semibold text-water-700 ring-1 ring-water-200/70 ring-inset">
                    ✓ 已验证使用
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Stars rating={r.rating} />
                <span className="text-[11px] text-ink-300 tabular-nums">
                  {r.created_at.slice(0, 10)}
                </span>
              </div>
            </div>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-ink-700">{r.text}</p>
        </div>
      ))}

      <div className="glass flex items-center justify-between gap-4 p-5">
        <p className="text-sm text-ink-500">用过这个工具？写一条评价，帮别人少走弯路。</p>
        <button
          className="btn-ghost shrink-0"
          onClick={() => {
            // 评价要署名到账号，没登录先弹登录框
            if (requireLogin()) setWriteOpen(true)
          }}
        >
          写评价
        </button>
      </div>

      {/* 打开时才挂载：昵称默认值取的是此刻的登录用户，常驻挂载会停在登录前的空值 */}
      {writeOpen && <WriteReviewModal
        open
        onClose={() => setWriteOpen(false)}
        skillId={tool.id}
        defaultNickname={user?.nickname ?? ''}
        onSubmitted={(newReview) => {
          // 先把新评价插进列表，让用户立刻看到自己写的那条
          setReviews((prev) => [newReview, ...prev])
          toast('评价已发布，感谢你的反馈')
          // 评分、星级分布、Tab 上的计数都以后端为准，重新拉一次
          load()
          reloadSkills()
        }}
      />}
    </div>
  )
}

/* ── 写评价弹窗 ─────────────────────────────────────────────── */

function WriteReviewModal({
  open,
  onClose,
  skillId,
  defaultNickname,
  onSubmitted,
}: {
  open: boolean
  onClose: () => void
  skillId: string
  /** 默认署名取账号昵称，用户可以改成别的（身份仍由登录令牌决定） */
  defaultNickname: string
  onSubmitted: (r: BackendReview) => void
}) {
  const [nickname, setNickname] = useState(defaultNickname)
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const canSubmit = nickname.trim() && rating > 0 && text.trim() && !submitting

  async function handleSubmit() {
    if (!canSubmit) return
    setSubmitting(true)
    setError('')
    const result = await postReview({
      skill_id: skillId,
      nickname: nickname.trim(),
      rating,
      text: text.trim(),
    })
    setSubmitting(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    onSubmitted(result.review)
    onClose()
    setRating(0)
    setText('')
  }

  return (
    <Modal open={open} onClose={onClose} width="max-w-lg">
      <h3 className="text-lg font-bold text-ink-900">写评价</h3>
      <p className="mt-1 text-xs text-ink-400">真实的使用感受帮助大家少走弯路。</p>

      <div className="mt-5 space-y-4">
        {/* 昵称 */}
        <div>
          <label className="text-xs font-semibold text-ink-500">
            昵称 <span className="text-accent-coral">*</span>
          </label>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="你希望显示的名字"
            maxLength={20}
            className="field mt-1.5"
          />
        </div>

        {/* 星级 */}
        <div>
          <label className="text-xs font-semibold text-ink-500">
            评分 <span className="text-accent-coral">*</span>
          </label>
          <div className="mt-2 flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                className="text-2xl transition-transform hover:scale-110 focus-visible:outline-none"
                aria-label={`${star}星`}
              >
                <span className={(hoverRating || rating) >= star ? 'text-accent-sun' : 'text-water-200'}>
                  ★
                </span>
              </button>
            ))}
            {rating > 0 && (
              <span className="ml-2 text-xs text-ink-400">
                {['', '很一般', '还可以', '不错', '很好用', '非常棒'][rating]}
              </span>
            )}
          </div>
        </div>

        {/* 评价内容 */}
        <div>
          <label className="text-xs font-semibold text-ink-500">
            评价内容 <span className="text-accent-coral">*</span>
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            maxLength={500}
            placeholder="讲讲你的真实使用感受，比如解决了什么问题、哪里特别好用或需要改进…"
            className="field mt-1.5 resize-none"
          />
          <p className="mt-1 text-right text-[11px] text-ink-300 tabular-nums">
            {text.length} / 500
          </p>
        </div>

        {error && <p className="text-xs text-accent-coral">{error}</p>}
      </div>

      <div className="mt-5 flex gap-2">
        <button onClick={onClose} className="btn-ghost flex-1">取消</button>
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="btn-water flex-[1.4]"
        >
          {submitting ? '提交中…' : '发布评价'}
        </button>
      </div>
    </Modal>
  )
}
function ToolDetailSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-5 py-20">
      <div className="glass p-8 text-center">
        <span className="text-2xl">💧</span>
        <p className="mt-2 text-sm text-ink-400">正在加载工具…</p>
      </div>
    </div>
  )
}
