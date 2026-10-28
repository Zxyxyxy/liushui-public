import { Link } from 'react-router-dom'
import type { Tool } from '../data/types'
import { CREATOR_MAP } from '../data/creators'
import { SCENE_MAP } from '../data/scenes'
import { useApp } from '../store/AppContext'
import { CreditPill, fmt, stag } from './ui/Ui'
import { Ripple } from './water/Water'

export function ToolCard({
  tool,
  index = 0,
  variants = [],
  showScene = true,
}: {
  tool: Tool
  index?: number
  /** 同一件事的其他版本（同 group）：在卡片底部列出，点了进对应详情页 */
  variants?: Tool[]
  /** 按场景分区展示时，区块标题已经写了场景，卡片上就不再重复 */
  showScene?: boolean
}) {
  const { isFavorite, toggleFavorite } = useApp()
  const creator = CREATOR_MAP[tool.creatorId]
  const scene = SCENE_MAP[tool.scene]
  const fav = isFavorite(tool.id)

  return (
    <Ripple
      className="glass lift stagger group flex h-full flex-col p-4"
      style={stag(index)}
    >
      <Link to={`/tool/${tool.id}`} className="flex flex-1 flex-col">
        <div className="flex items-start gap-3">
          {/* 图标：悬停时像浸在水里轻微浮动 */}
          <div
            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-xl transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6"
            style={{
              background: 'linear-gradient(140deg, var(--color-water-100), var(--color-water-200))',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,.9)',
            }}
          >
            {tool.icon}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="truncate font-bold text-ink-900 transition-colors group-hover:text-water-700">
                {tool.name}
              </h3>
              {tool.isNew && (
                <span className="shrink-0 rounded-full bg-accent-mint/15 px-1.5 py-0.5 text-[10px] font-bold text-accent-mint">
                  新
                </span>
              )}
              {tool.isHot && (
                <span className="shrink-0 rounded-full bg-accent-coral/15 px-1.5 py-0.5 text-[10px] font-bold text-accent-coral">
                  热门
                </span>
              )}
            </div>
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-500">{tool.promise}</p>
          </div>
        </div>

        {/* 场景 / 类型 badge — 紧跟描述文字，固定间距 */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {showScene && (
            <span className="rounded-md bg-water-100/80 px-2 py-0.5 text-[11px] font-medium text-water-700">
              {scene.icon} {scene.name}
            </span>
          )}
          {variants.length > 0 && tool.variantLabel && (
            <span className="rounded-md bg-water-50 px-2 py-0.5 text-[11px] font-medium text-water-700 ring-1 ring-water-200/80 ring-inset">
              侧重：{tool.variantLabel}
            </span>
          )}
          {(tool.badge || tool.sourceInfo?.badge) && (
            <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-600 ring-1 ring-amber-200/70 ring-inset">
              {tool.badge || tool.sourceInfo?.badge}
            </span>
          )}
        </div>

        <div className="flex-1" />

        {/* 底部：作者 · 使用人数 · 积分 */}
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-water-100 pt-3">
          <div className="flex min-w-0 items-center gap-1.5 text-[11px] text-ink-400">
            <span aria-hidden>{creator.avatar}</span>
            <span className="truncate">{creator.name}</span>
            <span className="text-water-200">·</span>
            <span className="shrink-0 tabular-nums">{fmt(tool.users)} 人用过</span>
          </div>
          <CreditPill credits={tool.credits} />
        </div>
      </Link>

      {/* 同一件事的其他版本。放在主链接外面，免得链接套链接 */}
      {variants.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 rounded-xl bg-water-50/70 px-2.5 py-2 text-[11px]">
          <span className="text-ink-400">另有 {variants.length} 个版本：</span>
          {variants.map((v) => (
            <Link
              key={v.id}
              to={`/tool/${v.id}`}
              title={v.promise}
              className="rounded-md bg-white/90 px-1.5 py-0.5 font-medium text-water-700 ring-1 ring-water-200/80 ring-inset transition-colors hover:bg-water-100 hover:text-water-800"
            >
              {v.variantLabel || v.name}
            </Link>
          ))}
        </div>
      )}

      {/* 收藏：悬停浮出 */}
      <button
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          toggleFavorite(tool.id)
        }}
        aria-label={fav ? '取消收藏' : '收藏'}
        className={`absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full text-sm backdrop-blur transition-all duration-300 ${
          fav
            ? 'bg-water-500 text-white opacity-100 shadow-[0_4px_12px_-4px_rgba(0,180,216,.9)]'
            : 'bg-white/85 text-ink-300 opacity-0 group-hover:opacity-100 hover:text-water-500'
        }`}
      >
        {fav ? '♥' : '♡'}
      </button>
    </Ripple>
  )
}

/** 横向紧凑条目 —— 工作台、详情页侧栏用 */
export function ToolRow({ tool }: { tool: Tool }) {
  return (
    <Link
      to={`/tool/${tool.id}`}
      className="group flex items-center gap-3 rounded-2xl border border-transparent p-2.5 transition-all duration-300 hover:border-water-200 hover:bg-white/70"
    >
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-water-100 text-base transition-transform duration-400 group-hover:scale-110">
        {tool.icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink-900 group-hover:text-water-700">
          {tool.name}
        </p>
        <p className="truncate text-[11px] text-ink-400">{tool.promise}</p>
      </div>
      <CreditPill credits={tool.credits} />
    </Link>
  )
}
