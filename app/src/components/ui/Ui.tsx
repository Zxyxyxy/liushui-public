import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useApp } from '../../store/AppContext'
import { Drop } from '../water/Water'

export function SectionTitle({
  title,
  sub,
  action,
}: {
  title: string
  sub?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-ink-900 sm:text-2xl">{title}</h2>
        {sub && <p className="mt-1 text-sm text-ink-500">{sub}</p>}
        <div className="rule-water mt-2.5 w-14" />
      </div>
      {action}
    </div>
  )
}

export function CreditPill({
  credits,
  size = 'sm',
}: {
  credits: number
  size?: 'sm' | 'md'
}) {
  const free = credits === 0
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full font-semibold ${
        size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm'
      } ${
        free
          ? 'bg-accent-mint/12 text-accent-mint'
          : 'bg-gradient-to-r from-water-100 to-water-200/80 text-water-700'
      }`}
    >
      <Drop className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
      {free ? '免费' : `${credits} 积分`}
    </span>
  )
}

export function Stars({ rating, count }: { rating: number; count?: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-ink-500">
      <span className="text-accent-sun" aria-hidden>
        {'★'.repeat(Math.round(rating))}
        <span className="text-water-200">{'★'.repeat(5 - Math.round(rating))}</span>
      </span>
      <span className="font-semibold text-ink-700 tabular-nums">{rating.toFixed(1)}</span>
      {count !== undefined && <span className="text-ink-300">({fmt(count)})</span>}
    </span>
  )
}

export function Modal({
  open,
  onClose,
  children,
  width = 'max-w-lg',
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
  width?: string
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-100 grid place-items-center p-4">
      <div
        className="absolute inset-0 bg-water-900/35 backdrop-blur-sm"
        style={{ animation: 'rise .25s ease-out both' }}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={`glass-deep relative max-h-[calc(100dvh-2rem)] w-full ${width} overflow-y-auto overflow-x-hidden overscroll-contain p-6`}
        style={{ animation: 'rise .38s cubic-bezier(.22,1,.36,1) both' }}
      >
        {/* 弹窗顶部的水线 */}
        <svg
          className="pointer-events-none absolute -top-px left-0 h-3 w-[200%] animate-[wave_9s_linear_infinite]"
          viewBox="0 0 120 12"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path d="M0 6 C 15 0, 30 0, 45 6 S 75 12, 90 6 S 120 0, 120 6 V0 H0Z" fill="#00b4d8" opacity=".35" />
        </svg>
        {children}
      </div>
    </div>,
    document.body,
  )
}

export function Toasts() {
  const { toasts } = useApp()
  if (!toasts.length) return null

  return createPortal(
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-200 flex -translate-x-1/2 flex-col items-center gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="glass-deep flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium shadow-water-lg"
          style={{ animation: 'rise .3s cubic-bezier(.22,1,.36,1) both' }}
        >
          <span
            className="grid h-5 w-5 place-items-center rounded-full text-[11px] text-white"
            style={{
              background:
                t.tone === 'warn' ? 'var(--color-accent-coral)' : t.tone === 'info' ? 'var(--color-ink-400)' : 'var(--color-water-500)',
            }}
          >
            {t.tone === 'warn' ? '!' : '✓'}
          </span>
          <span className="text-ink-700">{t.text}</span>
        </div>
      ))}
    </div>,
    document.body,
  )
}

export function Empty({ icon = '💧', title, sub }: { icon?: string; title: string; sub?: string }) {
  return (
    <div className="glass flex flex-col items-center gap-2 px-6 py-16 text-center">
      <div className="text-4xl animate-[bob_6s_ease-in-out_infinite]">{icon}</div>
      <p className="font-semibold text-ink-700">{title}</p>
      {sub && <p className="max-w-sm text-sm text-ink-400">{sub}</p>}
    </div>
  )
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: T; label: string; count?: number }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-full border border-water-200/70 bg-white/60 p-1 backdrop-blur">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`relative shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-300 ${
            value === t.id
              ? 'bg-gradient-to-r from-water-500 to-water-400 text-white shadow-[0_6px_18px_-6px_rgba(0,180,216,.8)]'
              : 'text-ink-500 hover:bg-water-100/70 hover:text-water-700'
          }`}
        >
          {t.label}
          {t.count !== undefined && (
            <span className={`ml-1.5 text-xs tabular-nums ${value === t.id ? 'text-white/80' : 'text-ink-300'}`}>
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

/** 逐项入场延迟：配合 .stagger 使用的 --i 自定义属性 */
export function stag(i: number, extra?: React.CSSProperties): React.CSSProperties {
  return { '--i': i, ...extra } as React.CSSProperties
}

export function fmt(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1).replace(/\.0$/, '')} 万`
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`
  return String(n)
}
