import { useMemo, useState } from 'react'
import { useSkills } from '../store/SkillsContext'
import { nextStepsFor } from '../lib/nextSteps'
import { Markdown } from '../lib/markdown'
import { DownloadMenu } from './DownloadMenu'
import type { ChatArtifact, ChatMessage, ChatSource } from '../lib/api'
import { StepList } from './StepList'
import { SkillChoice } from './SkillChoice'

/** 助手消息下方可以触发的动作，由对话页实现 */
export interface BubbleActions {
  /** 在会话里打开某个工具的参数表单 */
  openTool: (skillId: string, prefill?: Record<string, string>) => void
  /** 保存某个结果到工作台 */
  save: (a: ChatArtifact) => void
  /** 发布经验帖 */
  publish: (a: ChatArtifact) => void
  /** 用上一次的输入重新运行同一个工具（只有表单运行的才有） */
  rerun?: (skillId: string) => void
}

interface BubbleProps {
  message: ChatMessage
  /** 传入则在助手消息下方显示「重新生成」（只给最后一条、非表单运行的助手消息） */
  onRegenerate?: () => void
  actions: BubbleActions
  /** 这条是不是最后一条助手消息：只有最后一条才显示「猜你想做」，免得历史里堆满 */
  isLast: boolean
  busy: boolean
  /** 表单运行时用户手写的输入，用来给「猜你想做」预填 */
  lastInputs?: Record<string, string>
}

/** 一条对话消息：用户气泡，或助手回复 + 过程 + 结果卡片（带操作）+ 推荐 + 猜你想做 */
export function ChatBubble({ message, onRegenerate, actions, isLast, busy, lastInputs }: BubbleProps) {
  const { skillsMap, skills } = useSkills()
  const [copied, setCopied] = useState<string | null>(null)

  async function copy(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key + ':ok')
    } catch {
      setCopied(key + ':fail')
    }
    setTimeout(() => setCopied(null), 1600)
  }

  const steps = message.steps ?? []
  const lastArt = message.artifacts?.[message.artifacts.length - 1]
  const next = useMemo(
    () => (isLast && lastArt && !busy ? nextStepsFor(lastArt.skill_id, skills, lastInputs) : []),
    [isLast, lastArt, busy, skills, lastInputs],
  )

  // 推荐的工具如果有同类备选版本，把备选一起列出来，方便对比
  const recommendedIds = (() => {
    const out: string[] = []
    for (const sid of message.recommended ?? []) {
      const t = skillsMap[sid]
      if (!t) continue
      if (!out.includes(sid)) out.push(sid)
      if (t.group) {
        for (const o of skills) if (o.group === t.group && !out.includes(o.id)) out.push(o.id)
      }
    }
    return out
  })()

  if (message.role === 'user') {
    return (
      <div className="flex flex-col items-end gap-1.5">
        {message.attachments?.map((f) => (
          <div key={f.id} className="flex max-w-[85%] items-center gap-2 rounded-xl border border-water-200 bg-white/80 px-3 py-1.5 text-xs text-ink-700">
            <span aria-hidden>📄</span>
            <span className="truncate">{f.name}</span>
          </div>
        ))}
        {message.content && (
          // 复制按钮平时隐藏，鼠标停在这一行上才出现；触屏没有悬停，一直显示
          <div className="group flex w-full items-center justify-end gap-1.5">
            <button
              onClick={() => copy('user', message.content)}
              aria-label="复制这条消息"
              className={`shrink-0 rounded-lg px-2 py-1 text-xs text-ink-400 transition-opacity hover:bg-water-100/70 hover:text-water-700 focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100 ${
                copied?.startsWith('user:') ? 'opacity-100' : 'opacity-0'
              }`}
            >
              {copied === 'user:ok' ? '已复制' : copied === 'user:fail' ? '复制失败' : '复制'}
            </button>
            <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-md bg-gradient-to-br from-water-400 to-water-600 px-4 py-2.5 text-sm leading-relaxed text-white shadow-[0_8px_20px_-10px_rgba(0,119,182,.7)]">
              {message.content}
            </div>
          </div>
        )}
      </div>
    )
  }

  // 流式刚开始：还没有任何内容、步骤和结果，只显示光标占位
  if (!message.content && !message.artifacts?.length && steps.length === 0) {
    return (
      <div className="glass max-w-[90%] px-4 py-3">
        <span className="inline-block h-4 w-0.5 animate-pulse rounded-full bg-water-400" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {steps.length > 0 && <StepList steps={steps} running={isLast && busy} />}

      {message.sections || message.facts?.length ? (
        <ResearchCard message={message} />
      ) : (
        message.content && (
          <div className="glass max-w-[90%] px-4 py-3 text-sm leading-relaxed text-ink-700">
            <Markdown text={message.content} />
          </div>
        )
      )}

      {message.sources && message.sources.length > 0 && <Sources sources={message.sources} />}

      {message.artifacts?.map((a, i) => (
        <ResultCard
          key={i}
          art={a}
          copied={copied}
          onCopy={(t) => copy(`art${i}`, t)}
          copyKey={`art${i}`}
          actions={actions}
          showActions={!busy}
        />
      ))}

      {/* 没有结果卡片时的通用操作；有结果卡片时操作都在卡片里，这里只留「重新生成」 */}
      <div className="flex items-center gap-1 text-xs text-ink-400">
        {!message.artifacts?.length && (message.content || message.sections || message.facts?.length) && (
          <button
            onClick={() => copy('msg', researchAsText(message))}
            className="rounded-lg px-2 py-1 transition-colors hover:bg-water-100/70 hover:text-water-700"
          >
            {copied === 'msg:ok' ? '已复制' : copied === 'msg:fail' ? '复制失败' : '复制'}
          </button>
        )}
        {onRegenerate && (
          <button
            onClick={onRegenerate}
            className="rounded-lg px-2 py-1 transition-colors hover:bg-water-100/70 hover:text-water-700"
          >
            重新生成
          </button>
        )}
      </div>

      {/* 猜你想做 */}
      {next.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-ink-400">猜你想做</p>
          <div className="flex flex-wrap gap-2">
            {next.map((n) => (
              <button
                key={n.key}
                onClick={() => actions.openTool(n.skillId, n.prefill)}
                className="rounded-full border border-water-200 bg-white/80 px-3.5 py-1.5 text-left text-xs leading-relaxed text-ink-700 transition-colors hover:border-water-400 hover:bg-white hover:text-water-700"
              >
                {n.label} <span className="text-water-500">→</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 模型点名推荐的工具：一律带对比（推荐理由、侧重、适合谁、需要什么），选定后在会话里开表单 */}
      {recommendedIds.length > 0 && (
        <SkillChoice
          skillIds={recommendedIds}
          disabled={busy}
          onPick={(t) => actions.openTool(t.id)}
        />
      )}
    </div>
  )
}

/** 结果卡片：结果正文 + 方法依据 + 操作栏（归到投递、下载、重新运行、发布经验帖、复制）。结果本身已由服务端自动存进工作台 */
function ResultCard({
  art,
  copied,
  copyKey,
  onCopy,
  actions,
  showActions,
}: {
  art: ChatArtifact
  copied: string | null
  copyKey: string
  onCopy: (text: string) => void
  actions: BubbleActions
  showActions: boolean
}) {
  return (
    <div className="glass-deep overflow-hidden p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-mint/12 px-2.5 py-1 text-xs font-bold text-accent-mint">
            ✓ {art.name} 已完成
          </span>
          {art.variant && (
            <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-600 ring-1 ring-amber-200/70 ring-inset">
              侧重：{art.variant}
            </span>
          )}
        </div>
        <span className="text-xs text-ink-400 tabular-nums">消耗 {art.credits} 积分</span>
      </div>

      {art.source?.repo && (
        <p className="mt-2 text-[11px] leading-relaxed text-ink-400">
          方法依据：{art.source.origin}
        </p>
      )}

      <div className="mt-3">
        <Markdown text={art.output} />
      </div>
      {art.truncated && (
        <p className="mt-3 rounded-xl bg-accent-coral/10 px-3 py-2 text-xs text-accent-coral">
          内容较长，结尾可能被截断，可以让我分段重新生成。
        </p>
      )}

      {showActions && (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-water-100 pt-3">
          {art.output_id && art.target_org ? (
            <ActionBtn onClick={() => actions.save(art)}>✓ 已归到 {art.target_org} · 改</ActionBtn>
          ) : art.output_id && (art.scene === 'job' || art.scene === 'abroad' || !art.scene) ? (
            <ActionBtn primary onClick={() => actions.save(art)}>🗂️ 归到{art.scene === 'abroad' ? '申请' : '投递'}</ActionBtn>
          ) : art.output_id ? (
            <span className="self-center rounded-full bg-accent-mint/10 px-3 py-1.5 text-xs text-accent-mint">✓ 已存进运行历史</span>
          ) : null}
          <DownloadMenu
            up
            outputId={art.output_id}
            skillId={art.skill_id}
            name={art.name}
            text={art.output}
            className="rounded-full border border-water-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-ink-600 transition-colors hover:border-water-400 hover:text-water-700"
          />
          <ActionBtn onClick={() => onCopy(art.output)}>
            {copied === `${copyKey}:ok` ? '已复制' : copied === `${copyKey}:fail` ? '复制失败' : '📋 复制'}
          </ActionBtn>
          {actions.rerun && <ActionBtn onClick={() => actions.rerun!(art.skill_id)}>🔁 重新运行</ActionBtn>}
          <ActionBtn onClick={() => actions.publish(art)}>✍️ 发布经验帖</ActionBtn>
        </div>
      )}
    </div>
  )
}

function ActionBtn({ children, onClick, primary }: { children: React.ReactNode; onClick: () => void; primary?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        primary
          ? 'border-water-400 bg-water-100/70 text-water-800 hover:bg-water-100'
          : 'border-water-200 bg-white/80 text-ink-600 hover:border-water-400 hover:text-water-700'
      }`}
    >
      {children}
    </button>
  )
}

/** 回复引用的网页来源。链接只放行 http/https，并且不带 referrer、不给新页面操作原页面的权限 */
function Sources({ sources }: { sources: ChatSource[] }) {
  const safe = sources.filter((s) => /^https?:\/\//i.test(s.url))
  if (safe.length === 0) return null
  return (
    <div className="max-w-[90%] rounded-2xl border border-water-100 bg-white/60 px-4 py-3">
      <p className="text-[11px] font-semibold text-ink-400">参考来源 · 来自联网搜索，请以官方最新公告为准</p>
      <ol className="mt-1.5 space-y-1">
        {safe.map((s, i) => (
          <li key={s.url} className="flex gap-2 text-xs leading-relaxed">
            <span className="shrink-0 tabular-nums text-ink-300">{i + 1}.</span>
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              referrerPolicy="no-referrer"
              className="min-w-0 truncate text-water-700 hover:underline"
              title={s.url}
            >
              {s.title || s.url}
            </a>
            <span className="shrink-0 text-ink-300">{[s.site, s.date].filter(Boolean).join(' · ')}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

/** 复制联网研究回答时，把五段结构拼成纯文本 */
function researchAsText(m: ChatMessage): string {
  const s = m.sections
  const lines: string[] = []
  if (s?.conclusion) lines.push(s.conclusion)
  if (s?.confirmed?.length) {
    lines.push('已确认：')
    s.confirmed.forEach((t) => lines.push(`- ${t}`))
  }
  if (s?.unconfirmed?.length) {
    lines.push('未确认：')
    s.unconfirmed.forEach((t) => lines.push(`- ${t}`))
  }
  if (m.inferred?.length) {
    lines.push('往年规律（推测）：')
    m.inferred.forEach((t) => lines.push(`- ${t}`))
  }
  if (s?.judgement) lines.push(s.judgement)
  if (s?.next_steps?.length) {
    lines.push('下一步：')
    s.next_steps.forEach((t) => lines.push(`- ${t}`))
  }
  return lines.join('\n') || m.content
}

const TIER_LABEL: Record<string, string> = {
  government: '官方来源',
  authoritative_media: '权威媒体',
  secondary: '其他来源',
}
const STATUS_LABEL: Record<string, string> = {
  official: '官方已确认',
  reported: '媒体报道',
  unknown: '未能逐字核实',
}
const STATUS_COLOR: Record<string, string> = {
  official: 'bg-emerald-100 text-emerald-700',
  reported: 'bg-water-100 text-water-700',
  unknown: 'bg-amber-50 text-amber-600',
}

/** 联网研究的五段式展示：结论 / 历史时间线 / 估算 / 已确认 / 未确认 / 往年规律 / 综合判断 / 下一步 */
function ResearchCard({ message }: { message: ChatMessage }) {
  const [openFact, setOpenFact] = useState<number | null>(null)
  const s = message.sections ?? {}
  const facts = message.facts ?? []
  const inferred = message.inferred ?? []
  const est = s.estimate ?? {}

  return (
    <div className="glass max-w-[90%] space-y-3 px-4 py-3 text-sm leading-relaxed text-ink-700">
      {/* 结论 */}
      {s.conclusion && <p className="font-medium text-ink-900">{s.conclusion}</p>}

      {/* 官方状态 */}
      {s.official_status && (
        <p className="text-xs text-ink-500">
          <span className="font-medium text-ink-600">官方状态：</span>{s.official_status}
        </p>
      )}

      {/* 历史时间线 */}
      {s.historical_basis && s.historical_basis.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold text-ink-500">近年时间线</p>
          <ul className="space-y-0.5">
            {s.historical_basis.map((t, i) => (
              <li key={i} className="flex gap-1.5 text-xs text-ink-600">
                <span className="text-water-400 shrink-0">—</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 估算区间 */}
      {est.range && (
        <div className="rounded-xl bg-water-50/70 px-3 py-2">
          <div className="flex items-baseline gap-2">
            <p className="text-xs font-semibold text-water-700">预计时间</p>
            {est.confidence && (
              <span className="rounded-full bg-water-100 px-1.5 py-px text-[10px] text-water-600">
                置信度：{est.confidence}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-ink-700">{est.range}</p>
          {est.basis && <p className="mt-0.5 text-xs text-ink-400">{est.basis}</p>}
        </div>
      )}

      {/* 关键概念 */}
      {s.key_concept && (
        <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 px-3 py-2">
          <p className="text-xs font-semibold text-amber-700">注意</p>
          <p className="mt-0.5 text-xs text-ink-600">{s.key_concept}</p>
        </div>
      )}

      {/* 已确认 */}
      {s.confirmed && s.confirmed.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">已确认</p>
          <ul className="space-y-1.5">
            {s.confirmed.map((t, i) => {
              const fact = facts.find((f) => f.claim === t || f.claim.startsWith(t.slice(0, 15)))
              return (
                <li key={i} className="flex gap-2">
                  <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                  <div className="min-w-0 flex-1">
                    <span>{t}</span>
                    {fact && (
                      <button
                        onClick={() => setOpenFact(openFact === i ? null : i)}
                        title="查看依据的网页原文"
                        className={`ml-1.5 rounded px-1.5 py-px align-[1px] text-[11px] transition-colors ${STATUS_COLOR[fact.status] ?? 'bg-water-100 text-water-700'} hover:opacity-80`}
                      >
                        {STATUS_LABEL[fact.status]}{fact.published_at ? ` · ${fact.published_at}` : ''}
                      </button>
                    )}
                    {openFact === i && fact && (
                      <p className="mt-1 rounded-lg border-l-2 border-water-300 bg-white/70 px-2.5 py-1.5 text-xs leading-relaxed text-ink-500">
                        原文：{fact.quote}
                        <span className="text-ink-300"> （{TIER_LABEL[fact.source_type ?? ''] || fact.domain}）</span>
                      </p>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* 未确认 */}
      {s.unconfirmed && s.unconfirmed.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-600">未确认 / 存在争议</p>
          <ul className="space-y-1">
            {s.unconfirmed.map((t, i) => (
              <li key={i} className="flex gap-2 text-ink-500">
                <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300" />
                <span className="text-xs">{t}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 往年规律 */}
      {inferred.length > 0 && (
        <div className="rounded-xl bg-ink-50/40 px-3 py-2">
          <p className="mb-1 text-[11px] font-semibold text-ink-400">往年规律（推测，非本次查到的官方信息）</p>
          <ul className="space-y-0.5">
            {inferred.map((t, i) => (
              <li key={i} className="text-xs text-ink-500">— {t}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 综合判断 */}
      {s.judgement && (
        <p className="border-t border-water-100 pt-2.5 text-ink-600">{s.judgement}</p>
      )}

      {/* 下一步 */}
      {s.next_steps && s.next_steps.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-semibold text-ink-400">下一步</p>
          <ul className="space-y-1">
            {s.next_steps.map((t, i) => (
              <li key={i} className="flex gap-1.5 text-xs text-ink-600">
                <span className="text-water-400">›</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
