import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useApp } from '../../store/AppContext'
import { useSkills } from '../../store/SkillsContext'
import { useAuth } from '../../store/AuthContext'
import { CountUp, Drop } from '../water/Water'
import { Modal } from '../ui/Ui'
import { fetchPrefs, setDigestOff } from '../../lib/api'

const NAV = [
  { to: '/', label: '首页' },
  { to: '/chat', label: '对话' },
  { to: '/market', label: '找工具' },
  { to: '/community', label: '社区' },
  { to: '/workspace', label: '工作台' },
  { to: '/creator', label: '创作中心' },
]

export function TopNav() {
  const { credits, favorites } = useApp()
  const { user, openAuth, logout } = useAuth()
  const { skills } = useSkills()
  const [scrolled, setScrolled] = useState(false)
  const [walletOpen, setWalletOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  // 每日开屏卡片（AI 日报 + 今日日程）是否已取消订阅；打开头像菜单时现取，null 表示还没取到
  const [digestOff, setDigestOffState] = useState<boolean | null>(null)
  useEffect(() => {
    if (!menuOpen || !user) return
    let alive = true
    fetchPrefs().then((p) => { if (alive && p) setDigestOffState(p.digest_off) })
    return () => { alive = false }
  }, [menuOpen, user])
  const [q, setQ] = useState('')
  const [sugOpen, setSugOpen] = useState(false)
  const nav = useNavigate()
  const loc = useLocation()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    setMenuOpen(false)
    setSugOpen(false)
  }, [loc.pathname])

  const suggestions = q.trim()
    ? skills.filter(
        (t) =>
          t.name.includes(q) ||
          t.promise.includes(q) ||
          t.tags.some((tag) => tag.includes(q)),
      ).slice(0, 5)
    : []

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    nav(`/market?q=${encodeURIComponent(q.trim())}`)
    setSugOpen(false)
  }

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'border-b border-water-200/60 bg-white/78 shadow-[0_4px_24px_-12px_rgba(0,119,182,.35)] backdrop-blur-xl'
          : 'border-b border-transparent bg-transparent'
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-5">
        {/* Logo */}
        <Link to="/" className="group flex shrink-0 items-center gap-2.5">
          <div className="relative grid h-9 w-9 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-water-400 to-water-700 shadow-[0_6px_18px_-6px_rgba(0,119,182,.8)]">
            <svg viewBox="0 0 32 32" className="h-full w-full">
              <path
                d="M-4 19c3.4 0 3.4-4 6.8-4s3.4 4 6.8 4 3.4-4 6.8-4 3.4 4 6.8 4 3.4-4 6.8-4 3.4 4 6.8 4"
                fill="none"
                stroke="#fff"
                strokeWidth="2.4"
                strokeLinecap="round"
                className="animate-[wave_4s_linear_infinite]"
              />
              <path
                d="M-4 25c3.4 0 3.4-4 6.8-4s3.4 4 6.8 4 3.4-4 6.8-4 3.4 4 6.8 4 3.4-4 6.8-4 3.4 4 6.8 4"
                fill="none"
                stroke="#caf0f8"
                strokeWidth="2"
                strokeLinecap="round"
                opacity=".85"
                className="animate-[wave_6s_linear_infinite_reverse]"
              />
            </svg>
          </div>
          <div className="hidden leading-tight sm:block">
            <div className="text-[15px] font-bold tracking-tight text-ink-900">流水</div>
            <div className="text-[10px] text-ink-400">不争先，争滔滔不绝</div>
          </div>
        </Link>

        {/* 主导航 */}
        <nav className="hidden items-center gap-0.5 md:flex">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) =>
                `relative rounded-full px-3.5 py-2 text-sm font-semibold transition-colors duration-300 ${
                  isActive ? 'text-water-700' : 'text-ink-500 hover:text-water-600'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {n.label}
                  {isActive && (
                    <span className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-gradient-to-r from-water-400 to-water-600" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* 搜索 */}
        <form onSubmit={submitSearch} className="relative ml-auto hidden max-w-xs flex-1 lg:block">
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setSugOpen(true)
            }}
            onFocus={() => setSugOpen(true)}
            onBlur={() => setTimeout(() => setSugOpen(false), 150)}
            placeholder="搜工具、场景或关键词"
            className="w-full rounded-full border border-water-200/80 bg-white/70 py-2 pl-9 pr-3 text-sm outline-none backdrop-blur transition-all duration-300 placeholder:text-ink-300 focus:border-water-400 focus:bg-white focus:shadow-[0_0_0_4px_rgba(144,224,239,.3)]"
          />
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-300">
            ⌕
          </span>

          {sugOpen && suggestions.length > 0 && (
            <div
              className="glass-deep absolute left-0 right-0 top-full mt-2 overflow-hidden p-1.5"
              style={{ animation: 'rise .25s ease-out both' }}
            >
              {suggestions.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onMouseDown={() => nav(`/tool/${t.id}`)}
                  className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-water-100/70"
                >
                  <span className="text-base">{t.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink-900">{t.name}</span>
                    <span className="block truncate text-[11px] text-ink-400">{t.promise}</span>
                  </span>
                  <span className="shrink-0 text-[11px] font-semibold text-water-600 tabular-nums">
                    {t.credits} 积分
                  </span>
                </button>
              ))}
            </div>
          )}
        </form>

        {/* 右侧：积分余额 · 工作台 · 头像 */}
        <div className="ml-auto flex shrink-0 items-center gap-2 lg:ml-0">
          <button
            onClick={() => setWalletOpen(true)}
            className="group relative flex items-center gap-1.5 overflow-hidden rounded-full border border-water-200/80 bg-white/75 px-3 py-1.5 text-sm font-bold text-water-700 backdrop-blur transition-all duration-300 hover:border-water-400 hover:shadow-[0_6px_18px_-8px_rgba(0,180,216,.9)]"
            title="积分余额"
          >
            <Drop className="h-3.5 w-3.5 text-water-500 transition-transform duration-500 group-hover:scale-125" />
            <CountUp value={credits} />
            <span className="hidden text-[11px] font-medium text-ink-400 sm:inline">积分</span>
          </button>

          <Link
            to="/workspace"
            className="hidden rounded-full border border-water-200/80 bg-white/75 px-3 py-1.5 text-sm font-semibold text-ink-500 backdrop-blur transition-all duration-300 hover:border-water-400 hover:text-water-700 sm:inline-block"
          >
            工作台
          </Link>

          {!user ? (
            <button onClick={openAuth} className="btn-water px-4 py-1.5 text-sm">
              登录
            </button>
          ) : (
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-water-300 to-water-500 text-sm font-bold text-white shadow-[0_6px_16px_-6px_rgba(0,119,182,.9)] ring-2 ring-white transition-transform duration-300 hover:scale-105"
              aria-label="账户"
            >
              {user.nickname.slice(0, 1).toUpperCase()}
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div
                  className="glass-deep absolute right-0 top-full z-20 mt-2 w-60 overflow-hidden p-2"
                  style={{ animation: 'rise .25s ease-out both' }}
                >
                  <div className="border-b border-water-100 px-2.5 pb-2.5 pt-1.5">
                    <p className="truncate text-sm font-bold text-ink-900">{user.nickname}</p>
                    <p className="truncate text-[11px] text-ink-400">{user.email}</p>
                  </div>
                  <MenuItem to="/workspace" label="我的工作台" icon="🗂️" />
                  <MenuItem to="/market?fav=1" label={`我的收藏 (${favorites.length})`} icon="♥" />
                  <MenuItem to="/creator" label="创作者中心" icon="✍️" />
                  <button
                    onClick={() => {
                      setWalletOpen(true)
                      setMenuOpen(false)
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm text-ink-700 transition-colors hover:bg-water-100/70"
                  >
                    <span className="w-4 text-center">💧</span> 积分与账单
                  </button>
                  {digestOff !== null && (
                    <button
                      onClick={async () => {
                        const next = !digestOff
                        if (await setDigestOff(next)) setDigestOffState(next)
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm text-ink-700 transition-colors hover:bg-water-100/70"
                    >
                      <span className="w-4 text-center">📰</span>
                      每日开屏日报
                      <span className={`ml-auto text-[11px] font-semibold ${digestOff ? 'text-ink-400' : 'text-water-600'}`}>
                        {digestOff ? '已关闭' : '已开启'}
                      </span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      logout()
                      setMenuOpen(false)
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm text-ink-400 transition-colors hover:bg-water-100/70"
                  >
                    <span className="w-4 text-center">⎋</span> 退出登录
                  </button>
                </div>
              </>
            )}
          </div>
          )}
        </div>
      </div>

      {/* 移动端导航 */}
      <div className="no-scrollbar flex gap-1 overflow-x-auto border-t border-water-100/70 px-5 py-2 md:hidden">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === '/'}
            className={({ isActive }) =>
              `shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
                isActive ? 'bg-water-500 text-white' : 'text-ink-500'
              }`
            }
          >
            {n.label}
          </NavLink>
        ))}
      </div>

      <WalletModal open={walletOpen} onClose={() => setWalletOpen(false)} />
    </header>
  )
}

function MenuItem({ to, label, icon }: { to: string; label: string; icon: string }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm text-ink-700 transition-colors hover:bg-water-100/70"
    >
      <span className="w-4 text-center">{icon}</span> {label}
    </Link>
  )
}

function WalletModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { credits, ledger, spent, refreshCredits } = useApp()

  // 打开时取一次最新余额和流水
  useEffect(() => {
    if (open) refreshCredits()
  }, [open, refreshCredits])

  return (
    <Modal open={open} onClose={onClose}>
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-lg font-bold text-ink-900">积分账户</h3>
          <p className="mt-0.5 text-xs text-ink-400">
            文件上传、存储、预览和工作台保存均不扣积分
          </p>
        </div>
        <button onClick={onClose} className="text-xl leading-none text-ink-300 hover:text-ink-500">
          ×
        </button>
      </div>

      {/* 余额：一池水 */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-water-500 to-water-700 p-5 text-white">
        <svg
          className="absolute bottom-0 left-0 h-10 w-[200%] animate-[wave_14s_linear_infinite]"
          viewBox="0 0 120 12"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path d="M0 7 C 15 1, 30 1, 45 7 S 75 13, 90 7 S 120 1, 120 7 V12 H0Z" fill="rgba(255,255,255,.18)" />
        </svg>
        <p className="text-xs opacity-80">当前余额</p>
        <p className="mt-1 flex items-baseline gap-1.5 text-4xl font-bold">
          <CountUp value={credits} />
          <span className="text-base font-medium opacity-80">积分</span>
        </p>
        <p className="mt-2 text-xs opacity-70 tabular-nums">累计消耗 {spent} 积分</p>
      </div>

      <p className="mt-3 text-center text-[11px] text-ink-300">
        积分不足时请联系管理员补充；运行失败会自动退回。
      </p>

      <div className="mt-4">
        <p className="mb-2 text-xs font-semibold text-ink-500">消费记录</p>
        <div className="no-scrollbar max-h-52 space-y-1 overflow-y-auto">
          {ledger.slice(0, 12).map((l) => (
            <div
              key={l.id}
              className="flex items-center justify-between rounded-xl px-2.5 py-2 text-sm transition-colors hover:bg-water-50"
            >
              <div className="min-w-0">
                <p className="truncate text-ink-700">{l.title}</p>
                <p className="text-[11px] text-ink-300 tabular-nums">{l.date}</p>
              </div>
              <span
                className={`shrink-0 font-bold tabular-nums ${
                  l.amount > 0 ? 'text-accent-mint' : 'text-ink-500'
                }`}
              >
                {l.amount > 0 ? '+' : ''}
                {l.amount}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  )
}
