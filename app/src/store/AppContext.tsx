import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { LedgerEntry } from '../data/types'
import { fetchCredits, wsApi } from '../lib/api'
import { useAuth } from './AuthContext'

const STORAGE_KEY = 'liushui.v1'

// 工作台和运行记录已经搬到服务端（跟账号走），浏览器里只留收藏和点赞这类轻量偏好
interface Persisted {
  favorites: string[]
  likedPosts: string[]
  savedPosts: string[]
}

const INITIAL: Persisted = {
  favorites: [],
  likedPosts: [],
  savedPosts: [],
}

/** 旧版存在浏览器里的工作台数据：登录后搬到账号下一次，然后从浏览器删掉 */
const LEGACY_KEY = 'liushui.ws.legacy'
const MIGRATED_KEY = 'liushui.ws.migrated'

export interface Toast {
  id: number
  text: string
  tone: 'ok' | 'info' | 'warn'
}

interface AppValue extends Persisted {
  /** 积分以服务端账本为准：这里只是展示用的副本，不在前端加减 */
  credits: number
  spent: number
  ledger: LedgerEntry[]
  /** 重新向服务端取一次余额和流水（运行、退款之后调用） */
  refreshCredits: () => Promise<void>
  toggleFavorite: (toolId: string) => void
  isFavorite: (toolId: string) => boolean
  toggleLike: (postId: string) => void
  toggleSave: (postId: string) => void
  reset: () => void
  toasts: Toast[]
  toast: (text: string, tone?: Toast['tone']) => void
}

const Ctx = createContext<AppValue | null>(null)

function load(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return INITIAL
    const parsed = JSON.parse(raw) as Record<string, unknown>
    // 旧版的工作台数据先单独存起来：下面会把 STORAGE_KEY 改写成只含偏好的新格式，
    // 而用户可能还没登录，要等登录后才能搬到账号下
    if (Array.isArray(parsed.workspaces) || Array.isArray(parsed.runs)) {
      if (!localStorage.getItem(LEGACY_KEY)) {
        localStorage.setItem(LEGACY_KEY, JSON.stringify({ workspaces: parsed.workspaces, runs: parsed.runs }))
      }
    }
    return {
      favorites: Array.isArray(parsed.favorites) ? (parsed.favorites as string[]) : [],
      likedPosts: Array.isArray(parsed.likedPosts) ? (parsed.likedPosts as string[]) : [],
      savedPosts: Array.isArray(parsed.savedPosts) ? (parsed.savedPosts as string[]) : [],
    }
  } catch {
    return INITIAL
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [state, setState] = useState<Persisted>(load)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [credits, setCredits] = useState(0)
  const [spent, setSpent] = useState(0)
  const [ledger, setLedger] = useState<LedgerEntry[]>([])

  const refreshCredits = useCallback(async () => {
    const info = await fetchCredits()
    if (!info) return
    setCredits(info.balance)
    setSpent(info.spent)
    setLedger(
      info.ledger.map((l) => ({
        id: l.id,
        date: l.date,
        title: l.title,
        amount: l.amount,
        kind: l.amount > 0 ? ('earn' as const) : ('spend' as const),
      })),
    )
  }, [])

  // 登录、换账号、退出：余额跟着账号走。退出后清零，不留上一个人的余额
  useEffect(() => {
    if (!user) {
      setCredits(0)
      setSpent(0)
      setLedger([])
      return
    }
    refreshCredits()
  }, [user?.id, refreshCredits]) // eslint-disable-line react-hooks/exhaustive-deps

  // 旧版浏览器工作台：登录后把用户自己保存过的记录搬到账号下（演示数据由服务端过滤掉），只做一次
  useEffect(() => {
    if (!user) return
    let payload: Record<string, unknown> | null = null
    try {
      if (localStorage.getItem(MIGRATED_KEY) === user.id) return
      const raw = localStorage.getItem(LEGACY_KEY)
      payload = raw ? (JSON.parse(raw) as Record<string, unknown>) : null
    } catch { /* ignored */ }
    const done = () => {
      try { localStorage.setItem(MIGRATED_KEY, user.id); localStorage.removeItem(LEGACY_KEY) } catch { /* ignored */ }
    }
    if (!payload) { done(); return }
    wsApi.importLocal(payload).then((r) => {
      if (!r) return   // 失败就下次再试，不标记
      done()
      if (r.todos + r.runs > 0) toast(`已把浏览器里的 ${r.todos} 条待办、${r.runs} 条运行记录搬到你的账号下`, 'info')
    })
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      /* 隐私模式下写入失败不影响使用 */
    }
  }, [state])

  const toast = useCallback((text: string, tone: Toast['tone'] = 'ok') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, text, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200)
  }, [])

  const toggleFavorite = useCallback(
    (toolId: string) => {
      setState((s) => {
        const has = s.favorites.includes(toolId)
        toast(has ? '已取消收藏' : '已加入收藏', has ? 'info' : 'ok')
        return {
          ...s,
          favorites: has ? s.favorites.filter((f) => f !== toolId) : [toolId, ...s.favorites],
        }
      })
    },
    [toast],
  )

  const isFavorite = useCallback((toolId: string) => state.favorites.includes(toolId), [state.favorites])

  const toggleLike = useCallback((postId: string) => {
    setState((s) => ({
      ...s,
      likedPosts: s.likedPosts.includes(postId)
        ? s.likedPosts.filter((p) => p !== postId)
        : [...s.likedPosts, postId],
    }))
  }, [])

  const toggleSave = useCallback(
    (postId: string) => {
      setState((s) => {
        const has = s.savedPosts.includes(postId)
        toast(has ? '已取消收藏' : '帖子已收藏')
        return {
          ...s,
          savedPosts: has ? s.savedPosts.filter((p) => p !== postId) : [postId, ...s.savedPosts],
        }
      })
    },
    [toast],
  )

  const reset = useCallback(() => {
    setState(INITIAL)
    toast('本地偏好已重置', 'info')
  }, [toast])

  const value = useMemo<AppValue>(
    () => ({
      ...state,
      credits,
      spent,
      ledger,
      refreshCredits,
      toggleFavorite,
      isFavorite,
      toggleLike,
      toggleSave,
      reset,
      toasts,
      toast,
    }),
    [
      state,
      credits,
      spent,
      ledger,
      refreshCredits,
      toggleFavorite,
      isFavorite,
      toggleLike,
      toggleSave,
      reset,
      toasts,
      toast,
    ],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApp(): AppValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('useApp 必须在 AppProvider 内使用')
  return v
}
