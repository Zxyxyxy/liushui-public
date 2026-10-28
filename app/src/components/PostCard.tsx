import { Link } from 'react-router-dom'
import type { Post } from '../data/types'
import { SCENE_MAP } from '../data/scenes'
import { useSkills } from '../store/SkillsContext'
import { fmt, stag } from './ui/Ui'

export function PostCard({ post, index = 0 }: { post: Post; index?: number }) {
  const { skillsMap: TOOL_MAP } = useSkills()
  const scene = SCENE_MAP[post.scene]
  const tools = post.relatedToolIds.map((id) => TOOL_MAP[id]).filter(Boolean)

  return (
    <Link
      to={`/community/${post.id}`}
      className="glass lift stagger group flex h-full flex-col overflow-hidden"
      style={stag(index)}
    >
      {/* 封面：渐变水面 + 缓慢波浪 */}
      <div className="relative h-28 shrink-0 overflow-hidden" style={{ background: post.cover }}>
        <svg
          className="absolute bottom-0 left-0 h-8 w-[200%] animate-[wave_16s_linear_infinite]"
          viewBox="0 0 120 12"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path d="M0 7 C 15 1, 30 1, 45 7 S 75 13, 90 7 S 120 1, 120 7 V12 H0Z" fill="rgba(255,255,255,.35)" />
        </svg>
        <svg
          className="absolute bottom-0 left-0 h-6 w-[200%] animate-[wave_11s_linear_infinite_reverse]"
          viewBox="0 0 120 12"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path d="M0 8 C 20 3, 40 3, 60 8 S 100 13, 120 8 V12 H0Z" fill="rgba(255,255,255,.55)" />
        </svg>
        <span className="absolute left-3 top-3 rounded-full bg-white/85 px-2.5 py-1 text-[11px] font-semibold text-water-700 backdrop-blur">
          {scene.icon} {scene.name}
        </span>
        <span className="absolute right-3 top-3 rounded-full bg-white/25 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur tabular-nums">
          {fmt(post.views)} 浏览
        </span>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-2 font-bold leading-snug text-ink-900 transition-colors group-hover:text-water-700">
          {post.title}
        </h3>
        <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-ink-500">{post.excerpt}</p>

        {/* 关联工具 —— 文档 §9.1：帖子带动工具使用 */}
        {tools.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {tools.slice(0, 3).map((t) => (
              <span
                key={t.id}
                className="inline-flex items-center gap-1 rounded-md bg-water-50 px-2 py-0.5 text-[11px] text-water-700 ring-1 ring-water-200/80 ring-inset"
              >
                {t.icon} {t.name}
              </span>
            ))}
          </div>
        )}

        <div className="flex-1" />

        <div className="mt-3.5 flex items-center justify-between border-t border-water-100 pt-3 text-[11px] text-ink-400">
          <span className="flex min-w-0 items-center gap-1.5">
            <span aria-hidden>{post.avatar}</span>
            <span className="truncate">{post.author}</span>
            {post.authorBadge && (
              <span className="shrink-0 rounded bg-water-100 px-1.5 py-px text-[10px] text-water-700">
                {post.authorBadge}
              </span>
            )}
          </span>
          <span className="flex shrink-0 items-center gap-2.5 tabular-nums">
            <span>♥ {fmt(post.likes)}</span>
            <span>💬 {post.comments}</span>
          </span>
        </div>
      </div>
    </Link>
  )
}

/** 紧凑列表项 —— 工具详情页「相关帖子」 */
export function PostRow({ post }: { post: Post }) {
  return (
    <Link
      to={`/community/${post.id}`}
      className="group flex gap-3 rounded-2xl border border-transparent p-2.5 transition-all duration-300 hover:border-water-200 hover:bg-white/70"
    >
      <div className="h-12 w-12 shrink-0 rounded-xl" style={{ background: post.cover }} />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-semibold leading-snug text-ink-900 group-hover:text-water-700">
          {post.title}
        </p>
        <p className="mt-1 text-[11px] text-ink-400 tabular-nums">
          {post.author} · ♥ {fmt(post.likes)}
        </p>
      </div>
    </Link>
  )
}
