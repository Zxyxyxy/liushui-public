import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { COMMENTS, DEFAULT_COMMENTS, POSTS, POST_MAP } from '../data/posts'
import { SCENE_MAP } from '../data/scenes'
import { USER } from '../data/workspaces'
import type { Comment } from '../data/types'
import { useApp } from '../store/AppContext'
import { useSkills } from '../store/SkillsContext'
import { PostCard } from '../components/PostCard'
import { CreditPill, fmt, stag } from '../components/ui/Ui'
import { Bubbles, Ripple } from '../components/water/Water'

export function PostDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const { likedPosts, toggleLike, savedPosts, toggleSave, toast } = useApp()
  const { skillsMap } = useSkills()
  const [extra, setExtra] = useState<Comment[]>([])
  const [draft, setDraft] = useState('')

  const post = id ? POST_MAP[id] : undefined
  if (!post) return <Navigate to="/community" replace />

  const scene = SCENE_MAP[post.scene]
  const tools = post.relatedToolIds.map((t) => skillsMap[t]).filter(Boolean)
  const liked = likedPosts.includes(post.id)
  const saved = savedPosts.includes(post.id)
  const comments = [...extra, ...(COMMENTS[post.id] ?? DEFAULT_COMMENTS)]
  const more = POSTS.filter((p) => p.id !== post.id && p.scene === post.scene).slice(0, 3)

  return (
    <div>
      {/* 封面 */}
      <section className="relative h-56 overflow-hidden sm:h-64" style={{ background: post.cover }}>
        <Bubbles count={16} />
        <svg
          className="absolute bottom-0 left-0 h-16 w-[200%] animate-[wave_18s_linear_infinite]"
          viewBox="0 0 120 12"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path d="M0 7 C 15 1, 30 1, 45 7 S 75 13, 90 7 S 120 1, 120 7 V12 H0Z" fill="rgba(242,252,254,.55)" />
        </svg>
        <svg
          className="absolute bottom-0 left-0 h-12 w-[200%] animate-[wave_12s_linear_infinite_reverse]"
          viewBox="0 0 120 12"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path d="M0 8 C 20 3, 40 3, 60 8 S 100 13, 120 8 V12 H0Z" fill="#f2fcfe" />
        </svg>

        <div className="relative mx-auto flex h-full max-w-3xl flex-col justify-center px-5">
          <Link
            to="/community"
            className="mb-3 self-start rounded-full bg-white/25 px-3 py-1 text-xs font-medium text-white backdrop-blur transition-colors hover:bg-white/40"
          >
            ← 返回社区
          </Link>
          <span className="self-start rounded-full bg-white/85 px-2.5 py-1 text-[11px] font-semibold text-water-700 backdrop-blur">
            {scene.icon} {scene.name}
          </span>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-5 pb-4">
        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          <article className="min-w-0">
            <div className="glass-deep -mt-10 relative p-6 sm:p-8">
              <h1 className="text-2xl font-bold leading-snug tracking-tight text-ink-900 sm:text-3xl">
                {post.title}
              </h1>

              <div className="mt-4 flex flex-wrap items-center gap-3 border-b border-water-100 pb-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-water-100 to-water-300 text-lg">
                  {post.avatar}
                </span>
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-sm font-bold text-ink-900">
                    {post.author}
                    {post.authorBadge && (
                      <span className="rounded bg-water-100 px-1.5 py-px text-[10px] font-medium text-water-700">
                        {post.authorBadge}
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-ink-400 tabular-nums">
                    {post.date} · {fmt(post.views)} 浏览
                  </p>
                </div>
                <button className="btn-ghost ml-auto shrink-0 px-4 py-1.5 text-xs">关注</button>
              </div>

              {/* 正文 */}
              <div className="mt-5 space-y-4">
                {post.body.map((p, i) => (
                  <p key={i} className="text-[15px] leading-[1.9] text-ink-700">
                    {p}
                  </p>
                ))}
              </div>

              {/* 结果前后对比 */}
              {post.beforeAfter && (
                <div className="mt-6 rounded-2xl border border-water-200/70 bg-water-50/60 p-5">
                  <p className="mb-3 text-sm font-bold text-ink-900">结果前后对比</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-ink-300/8 p-4">
                      <p className="mb-1.5 text-[11px] font-bold text-ink-400">改之前</p>
                      <p className="text-sm leading-relaxed text-ink-500">{post.beforeAfter.before}</p>
                    </div>
                    <div className="rounded-2xl bg-gradient-to-br from-water-100 to-water-200/60 p-4">
                      <p className="mb-1.5 text-[11px] font-bold text-water-700">改之后</p>
                      <p className="text-sm leading-relaxed text-ink-900">{post.beforeAfter.after}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* 标签 */}
              <div className="mt-6 flex flex-wrap gap-1.5">
                {post.tags.map((t) => (
                  <Link key={t} to={`/market?q=${encodeURIComponent(t)}`} className="chip">
                    #{t}
                  </Link>
                ))}
              </div>

              {/* 互动 */}
              <div className="mt-6 flex items-center gap-2 border-t border-water-100 pt-5">
                <Ripple
                  as="button"
                  onClick={() => toggleLike(post.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-semibold transition-all duration-300 ${
                    liked
                      ? 'bg-gradient-to-r from-water-500 to-water-400 text-white shadow-[0_8px_20px_-8px_rgba(0,180,216,.9)]'
                      : 'border border-water-200 bg-white/70 text-ink-500 hover:border-water-400 hover:text-water-700'
                  }`}
                >
                  <span className={liked ? 'animate-[bob_1.2s_ease-in-out]' : ''}>♥</span>
                  <span className="tabular-nums">{post.likes + (liked ? 1 : 0)}</span>
                </Ripple>
                <button
                  onClick={() => toggleSave(post.id)}
                  className={`btn-ghost ${saved ? 'border-water-400 bg-water-100 text-water-800' : ''}`}
                >
                  {saved ? '★ 已收藏' : '☆ 收藏'}
                </button>
                <button onClick={() => toast('链接已复制（演示）')} className="btn-ghost">
                  分享
                </button>
              </div>
            </div>

            {/* 评论 */}
            <div className="glass mt-4 p-6">
              <p className="text-sm font-bold text-ink-900">
                评论 <span className="text-ink-300 tabular-nums">({comments.length})</span>
              </p>

              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!draft.trim()) return
                  setExtra((c) => [
                    {
                      id: `n${Date.now()}`,
                      user: USER.name,
                      avatar: USER.avatar,
                      text: draft.trim(),
                      date: new Date().toISOString().slice(0, 10),
                      likes: 0,
                    },
                    ...c,
                  ])
                  setDraft('')
                  toast('评论已发布')
                }}
                className="mt-4 flex gap-3"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-water-100 text-base">
                  {USER.avatar}
                </span>
                <div className="min-w-0 flex-1">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={2}
                    placeholder="说点什么，或者问作者一个具体的问题…"
                    className="field resize-none"
                  />
                  <div className="mt-2 flex justify-end">
                    <button type="submit" disabled={!draft.trim()} className="btn-water px-5 py-2 text-sm">
                      发布
                    </button>
                  </div>
                </div>
              </form>

              <div className="mt-5 space-y-4">
                {comments.map((c, i) => (
                  <div
                    key={c.id}
                    className="stagger flex gap-3"
                    style={stag(i)}
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-water-100 text-base">
                      {c.avatar}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <p className="text-sm font-bold text-ink-900">{c.user}</p>
                        <span className="text-[11px] text-ink-300 tabular-nums">{c.date}</span>
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-ink-700">{c.text}</p>
                      <div className="mt-1.5 flex gap-3 text-[11px] text-ink-400">
                        <button className="transition-colors hover:text-water-600">♥ {c.likes}</button>
                        <button className="transition-colors hover:text-water-600">回复</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </article>

          {/* 侧栏：帖子带动工具使用 */}
          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <div className="glass-deep p-5" style={{ boxShadow: 'var(--shadow-water-glow)' }}>
              <p className="text-sm font-bold text-ink-900">这篇用到的工具</p>
              <p className="mt-1 text-[11px] text-ink-400">看完直接开始，不用再去搜</p>

              <div className="mt-3.5 space-y-2.5">
                {tools.map((t, i) => (
                  <div
                    key={t.id}
                    className="rounded-2xl border border-water-200/70 bg-white/70 p-3.5 transition-all duration-300 hover:border-water-400 hover:shadow-water-sm"
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-water-100 text-base">
                        {t.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <Link
                            to={`/tool/${t.id}`}
                            className="truncate text-sm font-bold text-ink-900 hover:text-water-700"
                          >
                            {t.name}
                          </Link>
                          {i === 0 && (
                            <span className="shrink-0 rounded bg-water-500 px-1.5 py-px text-[10px] font-bold text-white">
                              主要
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-ink-500">
                          {t.promise}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2.5 flex items-center justify-between">
                      <CreditPill credits={t.credits} />
                      <button
                        onClick={() => nav('/chat', { state: { openTool: t.id } })}
                        className="rounded-full bg-gradient-to-r from-water-500 to-water-400 px-3.5 py-1.5 text-xs font-semibold text-white transition-all duration-300 hover:shadow-[0_6px_16px_-6px_rgba(0,180,216,.9)]"
                      >
                        直接运行 →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass p-4">
              <p className="text-xs font-bold text-ink-900">你也有类似经验？</p>
              <p className="mt-1.5 text-[11px] leading-relaxed text-ink-500">
                跑完任何一个工具，都可以一键生成案例帖。系统会自动隐去简历、成绩单和联系方式。
              </p>
              <Link to="/market" className="btn-ghost mt-3 w-full justify-center text-xs">
                去跑一个工具
              </Link>
            </div>
          </aside>
        </div>

        {/* 相关阅读 */}
        {more.length > 0 && (
          <div className="mt-12">
            <div className="mb-5">
              <h2 className="text-xl font-bold tracking-tight text-ink-900">同场景的其他经验</h2>
              <div className="rule-water mt-2.5 w-14" />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {more.map((p, i) => (
                <PostCard key={p.id} post={p} index={i} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
