import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  AUTH_REQUIRED_EVENT,
  apiLogin,
  apiMe,
  apiRegister,
  getToken,
  setToken,
  type AuthResult,
  type AuthUser,
} from '../lib/auth'

interface AuthValue {
  user: AuthUser | null
  /** 启动时的令牌校验是否完成。没完成前别急着判定「未登录」去拦人 */
  ready: boolean
  login: (email: string, password: string) => Promise<AuthResult>
  register: (p: {
    email: string
    password: string
    nickname: string
    invite_code: string
  }) => Promise<AuthResult>
  logout: () => void
  /** 已登录返回 true；未登录弹出登录框并返回 false。需要身份的操作入口先调它 */
  requireLogin: () => boolean
  modalOpen: boolean
  openAuth: () => void
  closeAuth: () => void
}

const Ctx = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [ready, setReady] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)

  // 启动时用本地令牌换用户。令牌过期/被撤销就静默清掉；
  // 网络错误则保留令牌——断网不等于登录失效，不能把人踢下线
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const u = await apiMe()
        if (cancelled) return
        if (u) setUser(u)
        else setToken(null)
      } catch {
        /* 网络问题：保持未知态，令牌留着，下次请求再说 */
      } finally {
        if (!cancelled) setReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // 任何接口回 401：令牌已失效，清掉登录态并弹登录框
  useEffect(() => {
    const onRequired = () => {
      if (getToken()) setToken(null)
      setUser(null)
      setModalOpen(true)
    }
    window.addEventListener(AUTH_REQUIRED_EVENT, onRequired)
    return () => window.removeEventListener(AUTH_REQUIRED_EVENT, onRequired)
  }, [])

  const finish = useCallback((r: AuthResult) => {
    if (r.ok && r.token && r.user) {
      setToken(r.token)
      setUser(r.user)
      setModalOpen(false)
    }
    return r
  }, [])

  const login = useCallback(
    async (email: string, password: string) => finish(await apiLogin({ email, password })),
    [finish],
  )
  const register = useCallback(
    async (p: Parameters<AuthValue['register']>[0]) => finish(await apiRegister(p)),
    [finish],
  )

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
  }, [])

  const requireLogin = useCallback(() => {
    if (user) return true
    setModalOpen(true)
    return false
  }, [user])

  const value = useMemo<AuthValue>(
    () => ({
      user,
      ready,
      login,
      register,
      logout,
      requireLogin,
      modalOpen,
      openAuth: () => setModalOpen(true),
      closeAuth: () => setModalOpen(false),
    }),
    [user, ready, login, register, logout, requireLogin, modalOpen],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
