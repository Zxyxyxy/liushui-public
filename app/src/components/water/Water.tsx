import { useEffect, useRef, useState, type ReactNode } from 'react'

/* ============================================================
   水的视觉元件：波浪、涟漪、液面、气泡、焦散光
   ============================================================ */

/** 分区之间的波浪分隔线，两层不同速度叠加，像真实水面 */
export function WaveDivider({
  flip = false,
  className = '',
  from = '#caf0f8',
  to = '#90e0ef',
}: {
  flip?: boolean
  className?: string
  from?: string
  to?: string
}) {
  return (
    <div
      className={`pointer-events-none relative h-16 w-full overflow-hidden ${className}`}
      style={{ transform: flip ? 'scaleY(-1)' : undefined }}
      aria-hidden
    >
      <svg
        className="absolute inset-x-0 bottom-0 h-full w-[200%] animate-[wave_18s_linear_infinite]"
        viewBox="0 0 1440 80"
        preserveAspectRatio="none"
        fill="none"
      >
        <path
          d="M0 40 C 120 10, 240 10, 360 40 S 600 70, 720 40 S 960 10, 1080 40 S 1320 70, 1440 40 V80 H0Z"
          fill={from}
          opacity="0.55"
        />
      </svg>
      <svg
        className="absolute inset-x-0 bottom-0 h-full w-[200%] animate-[wave_26s_linear_infinite_reverse]"
        viewBox="0 0 1440 80"
        preserveAspectRatio="none"
        fill="none"
      >
        <path
          d="M0 50 C 150 25, 300 25, 450 50 S 750 75, 900 50 S 1200 25, 1440 50 V80 H0Z"
          fill={to}
          opacity="0.4"
        />
      </svg>
    </div>
  )
}

/** 大面积流动的水色光斑背景，Hero 和空状态用 */
export function FlowField({ className = '' }: { className?: string }) {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden>
      <div
        className="absolute -left-[10%] -top-[30%] h-[520px] w-[520px] rounded-full blur-3xl animate-[drift_24s_ease-in-out_infinite]"
        style={{ background: 'radial-gradient(circle, rgba(0,180,216,.35), transparent 65%)' }}
      />
      <div
        className="absolute -right-[8%] top-[8%] h-[460px] w-[460px] rounded-full blur-3xl animate-[drift_34s_ease-in-out_infinite_reverse]"
        style={{ background: 'radial-gradient(circle, rgba(144,224,239,.5), transparent 65%)' }}
      />
      <div
        className="absolute bottom-[-25%] left-[28%] h-[440px] w-[440px] rounded-full blur-3xl animate-[drift_28s_ease-in-out_infinite]"
        style={{ background: 'radial-gradient(circle, rgba(202,240,248,.65), transparent 68%)' }}
      />
      {/* 水下焦散光纹 */}
      <div
        className="absolute inset-0 animate-[caustic_18s_ease-in-out_infinite] mix-blend-soft-light"
        style={{
          backgroundImage:
            'repeating-radial-gradient(circle at 30% 20%, rgba(255,255,255,.5) 0 2px, transparent 2px 42px), repeating-radial-gradient(circle at 72% 68%, rgba(255,255,255,.4) 0 2px, transparent 2px 56px)',
        }}
      />
    </div>
  )
}

/** 缓缓上升的气泡 */
export function Bubbles({ count = 14 }: { count?: number }) {
  const bubbles = useRef(
    Array.from({ length: count }, (_, i) => ({
      left: (i * 97) % 100,
      size: 4 + ((i * 13) % 14),
      dur: 9 + ((i * 7) % 12),
      delay: (i * 1.7) % 10,
      opacity: 0.18 + ((i * 11) % 30) / 100,
    })),
  ).current

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {bubbles.map((b, i) => (
        <span
          key={i}
          className="absolute rounded-full border border-white/60 bg-white/30"
          style={{
            left: `${b.left}%`,
            bottom: '-10%',
            width: b.size,
            height: b.size,
            opacity: b.opacity,
            animation: `bubble-up ${b.dur}s linear ${b.delay}s infinite`,
          }}
        />
      ))}
      <style>{`@keyframes bubble-up{
        0%{transform:translateY(0) translateX(0);opacity:0}
        12%{opacity:.7}
        50%{transform:translateY(-52vh) translateX(14px)}
        88%{opacity:.5}
        100%{transform:translateY(-105vh) translateX(-10px);opacity:0}
      }`}</style>
    </div>
  )
}

/** 点击时从触点扩散的水波纹 —— 包住任何可点击元素 */
export function Ripple({
  children,
  className = '',
  as: As = 'div',
  ...rest
}: {
  children: ReactNode
  className?: string
  as?: 'div' | 'button'
  [k: string]: unknown
}) {
  const [drops, setDrops] = useState<{ id: number; x: number; y: number }[]>([])

  function onPointerDown(e: React.PointerEvent<HTMLElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    const id = Date.now() + Math.random()
    setDrops((d) => [...d, { id, x: e.clientX - r.left, y: e.clientY - r.top }])
    setTimeout(() => setDrops((d) => d.filter((x) => x.id !== id)), 700)
  }

  return (
    <As
      {...rest}
      onPointerDown={onPointerDown}
      className={`relative overflow-hidden ${className}`}
    >
      {children}
      {drops.map((d) => (
        <span
          key={d.id}
          aria-hidden
          className="pointer-events-none absolute h-24 w-24 rounded-full animate-[ripple-out_.7s_ease-out_forwards]"
          style={{
            left: d.x - 48,
            top: d.y - 48,
            background: 'radial-gradient(circle, rgba(255,255,255,.85), rgba(144,224,239,.35) 45%, transparent 70%)',
          }}
        />
      ))}
    </As>
  )
}

/** 液面填充进度条 —— 工作台进度、匹配度都用它 */
export function LiquidBar({
  value,
  label,
  tone = '#00b4d8',
  height = 10,
}: {
  value: number
  label?: string
  tone?: string
  height?: number
}) {
  const [w, setW] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setW(value), 60)
    return () => clearTimeout(t)
  }, [value])

  return (
    <div>
      {label && (
        <div className="mb-1.5 flex items-baseline justify-between text-xs">
          <span className="text-ink-500">{label}</span>
          <span className="font-semibold tabular-nums" style={{ color: tone }}>
            {value}%
          </span>
        </div>
      )}
      <div
        className="relative w-full overflow-hidden rounded-full bg-water-100/80"
        style={{ height }}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="relative h-full rounded-full transition-[width] duration-1000 ease-out"
          style={{ width: `${w}%`, background: `linear-gradient(90deg, ${tone}aa, ${tone})` }}
        >
          {/* 液面上掠过的高光 */}
          <div
            className="absolute inset-0 rounded-full opacity-70"
            style={{
              backgroundImage:
                'linear-gradient(100deg, transparent 20%, rgba(255,255,255,.75) 50%, transparent 80%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 2.4s linear infinite',
            }}
          />
        </div>
      </div>
    </div>
  )
}

/** 圆形液面容器 —— 创作者中心的指标环 */
export function LiquidOrb({
  value,
  size = 92,
  tone = '#00b4d8',
  caption,
}: {
  value: number
  size?: number
  tone?: string
  caption?: string
}) {
  const [fill, setFill] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setFill(value), 80)
    return () => clearTimeout(t)
  }, [value])

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="relative overflow-hidden rounded-full border-2 border-white bg-water-50"
        style={{ width: size, height: size, boxShadow: `0 8px 26px -10px ${tone}` }}
      >
        <div
          className="absolute inset-x-0 bottom-0 transition-[height] duration-[1400ms] ease-out"
          style={{ height: `${fill}%`, background: `linear-gradient(180deg, ${tone}cc, ${tone})` }}
        >
          <svg
            className="absolute -top-2 left-0 h-4 w-[200%] animate-[wave_5s_linear_infinite]"
            viewBox="0 0 120 12"
            preserveAspectRatio="none"
          >
            <path d="M0 6 C 15 0, 30 0, 45 6 S 75 12, 90 6 S 120 0, 120 6 V12 H0Z" fill={tone} />
          </svg>
        </div>
        <div className="absolute inset-0 grid place-items-center">
          <span className="text-lg font-bold tabular-nums text-ink-900 mix-blend-luminosity">
            {value}%
          </span>
        </div>
      </div>
      {caption && <span className="text-xs text-ink-500">{caption}</span>}
    </div>
  )
}

/** 数字滚动到目标值，用于顶部积分余额 */
export function CountUp({ value, className = '' }: { value: number; className?: string }) {
  const [n, setN] = useState(value)
  const prev = useRef(value)

  useEffect(() => {
    const from = prev.current
    const to = value
    prev.current = value
    if (from === to) return
    const start = performance.now()
    const dur = 620
    let raf = 0
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur)
      const eased = 1 - Math.pow(1 - p, 3)
      setN(Math.round(from + (to - from) * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value])

  return <span className={`tabular-nums ${className}`}>{n.toLocaleString('zh-CN')}</span>
}

/** 水滴形积分图标 */
export function Drop({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 2.2c3.6 4.6 6.6 8.3 6.6 11.7A6.6 6.6 0 0 1 12 20.5a6.6 6.6 0 0 1-6.6-6.6C5.4 10.5 8.4 6.8 12 2.2Z" />
    </svg>
  )
}
