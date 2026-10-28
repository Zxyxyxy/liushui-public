import { useEffect, useRef, useState } from 'react'

export interface SelectOption {
  value: string
  label: string
  /** 选项下面的一行灰字，如岗位、城市 */
  hint?: string
}

/**
 * 站内统一的下拉选择。替代浏览器原生 select：原生控件在 Safari 上是灰底双箭头，和站内的圆角输入框对不上。
 * 外观和 .field 输入框一致；展开的菜单是白底圆角浮层，当前项打勾。键盘：上下选择、回车确定、Esc 关闭。
 */
export function Select({
  value,
  onChange,
  options,
  placeholder = '请选择',
  size = 'md',
  className = '',
  title,
}: {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  size?: 'sm' | 'md'
  className?: string
  title?: string
}) {
  const [open, setOpen] = useState(false)
  const [hover, setHover] = useState(-1)
  const root = useRef<HTMLDivElement>(null)
  const current = options.find((o) => o.value === value)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  function pick(v: string) {
    onChange(v)
    setOpen(false)
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { setOpen(false); return }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) { setOpen(true); setHover(Math.max(0, options.findIndex((o) => o.value === value))); return }
      const d = e.key === 'ArrowDown' ? 1 : -1
      setHover((h) => (h + d + options.length) % options.length)
    }
    if (e.key === 'Enter' && open && hover >= 0) { e.preventDefault(); pick(options[hover].value) }
  }

  const pad = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'

  return (
    <div ref={root} className={`relative ${className}`}>
      <button
        type="button"
        title={title}
        onClick={() => { setOpen((o) => !o); setHover(options.findIndex((o) => o.value === value)) }}
        onKeyDown={onKey}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex w-full items-center gap-2 rounded-2xl border bg-white/80 text-left outline-none transition-all duration-200 ${pad} ${
          open ? 'border-water-400 bg-white shadow-[0_0_0_4px_rgb(144_224_239/0.35)]' : 'border-water-200/90 hover:border-water-300'
        }`}
      >
        <span className={`min-w-0 flex-1 truncate ${current ? 'text-ink-900' : 'text-ink-300'}`}>
          {current?.label ?? placeholder}
        </span>
        <svg viewBox="0 0 12 12" aria-hidden
          className={`h-3 w-3 shrink-0 text-water-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
          <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 z-30 mt-1.5 max-h-64 min-w-full overflow-y-auto rounded-2xl border border-water-200/80 bg-white/95 p-1.5 shadow-[0_14px_34px_-14px_rgba(0,119,182,.45)] backdrop-blur"
          style={{ animation: 'rise .18s ease-out both' }}
        >
          {options.map((o, i) => {
            const on = o.value === value
            return (
              <li key={o.value} role="option" aria-selected={on}>
                <button
                  type="button"
                  onMouseEnter={() => setHover(i)}
                  onClick={() => pick(o.value)}
                  className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                    on ? 'bg-water-50 font-semibold text-water-800' : hover === i ? 'bg-water-50/70 text-ink-900' : 'text-ink-700'
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{o.label}</span>
                    {o.hint && <span className="block truncate text-[11px] font-normal text-ink-400">{o.hint}</span>}
                  </span>
                  {on && <span className="shrink-0 text-xs text-water-600">✓</span>}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
