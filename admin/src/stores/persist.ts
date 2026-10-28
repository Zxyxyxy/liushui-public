/** localStorage 读写。key 用 liushui.admin.v1，对齐前台的 liushui.v1。
 *  刷新后审核决定、结算确认、复核判定都还在 —— 这是前台原型定下的标准
 *  （app/README.md：「不是静态 HTML 页面，而是一个真实的应用：有路由、有状态、有持久化」）。 */

const KEY = 'liushui.admin.v1'

type Blob = Record<string, unknown>

function readAll(): Blob {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Blob) : {}
  } catch {
    // 手改坏了或换了 schema，直接当空处理，不要让整个后台白屏
    return {}
  }
}

export function load<T>(slice: string, fallback: T): T {
  const all = readAll()
  return (all[slice] as T) ?? fallback
}

export function save(slice: string, value: unknown): void {
  try {
    const all = readAll()
    all[slice] = value
    localStorage.setItem(KEY, JSON.stringify(all))
  } catch {
    // 无痕模式 / 配额满，功能降级但不报错
  }
}

export function resetAll(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* 同上 */
  }
}
