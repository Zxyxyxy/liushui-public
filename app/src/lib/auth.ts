/**
 * 登录态底层：令牌存取 + 带令牌的请求封装。
 *
 * 身份只认令牌，请求体里不再传 user_id——后端从令牌里解出当前用户。
 */

const API_BASE = import.meta.env.VITE_API_BASE || '/api'
const TOKEN_KEY = 'liushui.token'

/** 后端返回 401 auth_required 时派发，AuthProvider 监听后弹出登录框 */
export const AUTH_REQUIRED_EVENT = 'liushui:auth-required'

export interface AuthUser {
  id: string
  email: string
  nickname: string
}

export interface AuthResult {
  ok: boolean
  user?: AuthUser
  token?: string
  /** 后端给的错误码，用来分支；error 是直接展示给用户的文案 */
  code?: string
  error?: string
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* 隐私模式下写入失败：本次会话内仍可用内存态，刷新后需重新登录 */
  }
}

/**
 * 带令牌的 fetch。path 是 /api 之后的部分，如 '/chat'。
 * 401 时顺手派发全局事件，调用方不用每处都写「未登录就弹框」。
 */
export async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')

  const resp = await fetch(`${API_BASE}${path}`, { ...init, headers })
  if (resp.status === 401) {
    window.dispatchEvent(new Event(AUTH_REQUIRED_EVENT))
  }
  return resp
}

async function postAuth(path: string, body: Record<string, unknown>): Promise<AuthResult> {
  try {
    const resp = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await resp.json()
    if (!data.success) return { ok: false, code: data.code, error: data.error || '请求失败' }
    return { ok: true, user: data.user, token: data.token }
  } catch {
    return { ok: false, error: '连不上服务器，请稍后再试' }
  }
}

export const apiRegister = (p: {
  email: string
  password: string
  nickname: string
  invite_code: string
}) => postAuth('/auth/register', p)

export const apiLogin = (p: { email: string; password: string }) => postAuth('/auth/login', p)

/** 用本地令牌换当前用户。令牌失效/过期返回 null（不弹登录框，启动时静默校验用）。 */
export async function apiMe(): Promise<AuthUser | null> {
  const token = getToken()
  if (!token) return null
  try {
    const resp = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!resp.ok) return null
    const data = await resp.json()
    return data.success ? data.user : null
  } catch {
    // 网络问题不等于令牌失效，不能把用户登出；让上层按「未知」处理
    throw new Error('network')
  }
}
