import { useEffect } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { TopNav } from './TopNav'
import { Toasts } from '../ui/Ui'
import { WaveDivider } from '../water/Water'

export function Layout() {
  const { pathname } = useLocation()

  // 路由切换回到顶部
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [pathname])

  // 对话页：占满一屏、不要页脚；会话切换（/chat → /chat/:id）不能重挂载，key 固定
  if (pathname === '/chat' || pathname.startsWith('/chat/')) {
    return (
      <div className="flex h-dvh flex-col">
        <TopNav />
        <main key="chat" className="min-h-0 flex-1">
          <Outlet />
        </main>
        <Toasts />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <TopNav />
      <main key={pathname} className="flex-1" style={{ animation: 'rise .45s cubic-bezier(.22,1,.36,1) both' }}>
        <Outlet />
      </main>
      <Footer />
      <Toasts />
    </div>
  )
}

function Footer() {
  return (
    <footer className="relative mt-20">
      <WaveDivider from="#90e0ef" to="#00b4d8" />
      <div className="bg-gradient-to-b from-water-500 to-water-800 pb-8 pt-10 text-white">
        <div className="mx-auto max-w-7xl px-5">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="flex items-center gap-2 text-lg font-bold">
                <span aria-hidden>🌊</span> 流水
              </div>
              <p className="mt-2 max-w-xs text-sm leading-relaxed text-water-100/85">
                流水不争先，争的是滔滔不绝。
                <br />
                一次做完一件事，长期做成一个目标。
              </p>
            </div>

            <FooterCol
              title="产品"
              links={[
                { to: '/market', label: '工具市场' },
                { to: '/market?kind=expert', label: 'AI 专家' },
                { to: '/market?kind=workflow', label: '工作流' },
                { to: '/workspace', label: '个人工作台' },
              ]}
            />
            <FooterCol
              title="社区"
              links={[
                { to: '/community', label: '经验帖' },
                { to: '/community?tab=job', label: '求职经验' },
                { to: '/community?tab=abroad', label: '留学记录' },
                { to: '/creator', label: '成为创作者' },
              ]}
            />
            <div>
              <p className="text-sm font-bold text-water-100">关于</p>
              <ul className="mt-3 space-y-2 text-sm text-water-100/75">
                <li>帮助中心</li>
                <li>创作者激励规则</li>
                <li>隐私与数据说明</li>
                <li>录途AI（B 端留学解决方案）</li>
              </ul>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-2 border-t border-white/15 pt-5 text-xs text-water-100/60 sm:flex-row sm:items-center sm:justify-between">
            <span>© 2026 流水 · 学生 AI 目标达成平台</span>
            <span>本页面为产品原型演示，所有数据与运行结果均为模拟，未接入真实 AI 接口</span>
          </div>
        </div>
      </div>
    </footer>
  )
}

function FooterCol({ title, links }: { title: string; links: { to: string; label: string }[] }) {
  return (
    <div>
      <p className="text-sm font-bold text-water-100">{title}</p>
      <ul className="mt-3 space-y-2 text-sm">
        {links.map((l) => (
          <li key={l.to + l.label}>
            <Link to={l.to} className="text-water-100/75 transition-colors hover:text-white">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
