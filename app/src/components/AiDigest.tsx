import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { fetchAiDigest, fetchPrefs, setDigestOff, wsApi, type AiDigest, type WsUpcoming } from '../lib/api'
import { useAuth } from '../store/AuthContext'
import { useApp } from '../store/AppContext'

const SEEN_KEY = 'liushui.aiDigest.seen'
const KIND_ICON: Record<string, string> = { interview: '🎤', test: '📝', deadline: '⏰', other: '📌', todo: '☑️' }

/** 弹窗里的「今日日程」：只有登录用户才有 */
interface Agenda { items: WsUpcoming[]; overdue: number }

function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

function todayIso() {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** 取今天的日报。弹窗和卡片共用一次请求 */
function useDigest() {
  const [digest, setDigest] = useState<AiDigest | null>(null)
  useEffect(() => {
    let alive = true
    fetchAiDigest().then((r) => { if (alive && r.ok) setDigest(r.digest) })
    return () => { alive = false }
  }, [])
  return digest
}

/** 点卡片：登录后进对话页看完整日报（服务端直接回日报，不扣积分）；没登录先弹登录框 */
function useOpenDigest() {
  const nav = useNavigate()
  const { user, openAuth } = useAuth()
  return () => {
    if (!user) { openAuth(); return }
    nav('/chat', { state: { digest: true } })
  }
}

/**
 * 首页的日报区块：当天第一次进来先弹窗（日报 + 登录用户的今日日程），点任意位置关掉后，概述留在首页框里。
 * 用户在弹窗里取消订阅后不再弹，首页框照常显示。
 */
export function AiDigestSection() {
  const digest = useDigest()
  const open = useOpenDigest()
  const { user, ready } = useAuth()
  const { toast } = useApp()
  const [popup, setPopup] = useState(false)
  const [agenda, setAgenda] = useState<Agenda | null>(null)

  useEffect(() => {
    // 等登录态确认完再决定：否则已取消订阅的人会先被当成游客弹一次
    if (!digest || !ready) return
    let seen = ''
    try { seen = localStorage.getItem(SEEN_KEY) ?? '' } catch { /* ignored */ }
    if (seen === todayKey()) return
    let alive = true
    ;(async () => {
      if (user) {
        const prefs = await fetchPrefs()
        if (!alive || prefs?.digest_off) return
        const up = await wsApi.upcoming()
        if (!alive) return
        const t = todayIso()
        setAgenda({ items: (up?.items ?? []).filter((i) => i.date === t), overdue: up?.overdue ?? 0 })
      }
      if (alive) setPopup(true)
    })()
    return () => { alive = false }
  }, [digest, ready, user])

  async function close(unsubscribe: boolean) {
    setPopup(false)
    try { localStorage.setItem(SEEN_KEY, todayKey()) } catch { /* ignored */ }
    if (unsubscribe) {
      const ok = await setDigestOff(true)
      toast(ok ? '已取消订阅，之后不再弹出。可在头像菜单里重新开启' : '取消订阅没保存成功，稍后再试', ok ? 'ok' : 'warn')
    }
  }

  if (!digest?.preview) return null
  const p = digest.preview
  const date = digest.feed_generated_at?.slice(0, 10)

  return (
    <>
      <section className="mx-auto max-w-4xl px-5 pt-4">
        <button
          onClick={open}
          className="glass group block w-full px-5 py-4 text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_-14px_rgba(0,119,182,.55)]"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-water-500 px-2 py-0.5 text-[11px] font-bold text-white">AI 日报</span>
            {date && <span className="text-[11px] text-ink-400">{date}</span>}
            <span className="text-[11px] text-ink-400">· 今天 {p.count} 条动态</span>
            <span className="ml-auto text-xs font-medium text-water-600 group-hover:text-water-800">看完整日报 →</span>
          </div>
          {p.headline && <p className="mt-2 text-sm font-semibold text-ink-900">{p.headline}</p>}
          <ul className="mt-2 space-y-1">
            {p.highlights.slice(0, 3).map((h, i) => (
              <li key={i} className="flex gap-1.5 text-xs leading-relaxed text-ink-600">
                <span className="shrink-0 text-water-400">›</span>
                <span className="min-w-0 truncate">
                  {h.who && <span className="font-medium text-ink-800">{h.who}：</span>}
                  {h.text}
                </span>
              </li>
            ))}
          </ul>
          {digest.concept?.term && (
            <p className="mt-2 text-xs text-ink-500">
              <span className="font-semibold text-amber-600">今日概念</span> {digest.concept.term}
            </p>
          )}
        </button>
      </section>

      {popup && <DigestPopup digest={digest} agenda={user ? agenda : null} onClose={close} />}
    </>
  )
}

/** 当天首次进入的弹窗：点任意位置关闭；登录用户能看到今日日程、能取消订阅 */
function DigestPopup({ digest, agenda, onClose }: {
  digest: AiDigest
  agenda: Agenda | null
  onClose: (unsubscribe: boolean) => void
}) {
  const p = digest.preview!
  const date = digest.feed_generated_at?.slice(0, 10)
  const [off, setOff] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(off) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, off])

  // 页面 <main> 带入场动画（transform），fixed 元素会相对 main 定位而不是视口：
  // 遮罩铺满整个长页面、卡片居中到屏幕外。挂到 body 上才能盖住当前视口。
  return createPortal(
    <div
      onClick={() => onClose(off)}
      role="dialog"
      aria-label="今天的 AI 日报"
      className="fixed inset-0 z-[60] grid cursor-pointer place-items-center bg-ink-900/30 px-5 backdrop-blur-sm"
      style={{ animation: 'rise .35s ease-out both' }}
    >
      <div className="glass-deep w-full max-w-lg px-6 py-5" style={{ boxShadow: 'var(--shadow-water-glow)' }}>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-water-500 px-2 py-0.5 text-[11px] font-bold text-white">AI 日报</span>
          {date && <span className="text-[11px] text-ink-400">{date}</span>}
        </div>
        <p className="mt-3 text-lg font-bold leading-snug text-ink-900">
          {p.headline || '今天 AI 一线的人在说什么'}
        </p>
        <ul className="mt-3 space-y-2">
          {p.highlights.map((h, i) => (
            <li key={i} className="text-sm leading-relaxed text-ink-700">
              {h.who && <span className="font-semibold text-ink-900">{h.who}：</span>}
              {h.text}
            </li>
          ))}
        </ul>
        {digest.concept?.term && (
          <div className="mt-4 rounded-xl border border-amber-200/80 bg-amber-50/70 px-3 py-2">
            <p className="text-xs font-semibold text-amber-700">今日概念 · {digest.concept.term}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-ink-600">{digest.concept.plain}</p>
          </div>
        )}
        {agenda && (
          <div className="mt-3 rounded-xl border border-water-200/80 bg-water-100/40 px-3 py-2">
            <p className="text-xs font-semibold text-water-700">今日日程</p>
            {agenda.items.length ? (
              <ul className="mt-1 space-y-0.5">
                {agenda.items.slice(0, 4).map((it) => (
                  <li key={it.type + it.id} className="truncate text-xs leading-relaxed text-ink-700">
                    {KIND_ICON[it.kind] ?? '📌'}{' '}
                    {it.org && !it.title.includes(it.org) && <span className="font-medium text-ink-900">{it.org} · </span>}
                    {it.title}
                  </li>
                ))}
                {agenda.items.length > 4 && (
                  <li className="text-[11px] text-ink-400">还有 {agenda.items.length - 4} 项，去工作台看</li>
                )}
              </ul>
            ) : (
              <p className="mt-0.5 text-xs text-ink-500">今天没有安排</p>
            )}
            {agenda.overdue > 0 && (
              <p className="mt-1 text-[11px] text-amber-600">另有 {agenda.overdue} 项已过期未处理</p>
            )}
          </div>
        )}
        <div className="mt-4 flex items-center gap-2">
          {agenda && (
            <button
              onClick={(e) => { e.stopPropagation(); setOff((v) => !v) }}
              className="flex items-center gap-1.5 text-[11px] text-ink-500 hover:text-ink-700"
            >
              <span
                className={`grid h-[14px] w-[14px] place-items-center rounded border text-[9px] text-white transition-colors ${
                  off ? 'border-water-500 bg-water-500' : 'border-water-300 bg-white'
                }`}
              >
                {off && '✓'}
              </span>
              取消订阅日报
            </button>
          )}
          <p className={`text-[11px] text-ink-400 ${agenda ? 'ml-auto' : 'mx-auto'}`}>点击任意位置关闭</p>
        </div>
      </div>
    </div>,
    document.body,
  )
}
