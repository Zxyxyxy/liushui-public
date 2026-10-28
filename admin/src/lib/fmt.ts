/** 与前台 app/src/components/ui/Ui.tsx 的 fmt() 逐字相同，保证两边同一个数显示成同一个字符串 */
export function fmt(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1).replace(/\.0$/, '')} 万`
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`
  return String(n)
}

/** 千分位，账单里用 */
export function num(n: number): string {
  return n.toLocaleString('zh-CN')
}

/** 人民币元，结算金额用 */
export function yuan(n: number): string {
  return `¥${n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function pct(n: number, d = 1): string {
  return `${n.toFixed(d).replace(/\.0$/, '')}%`
}

/** 相对今天的天数差。数据源台账判新鲜度用，负数表示已过期。 */
export function daysUntil(iso: string, today = new Date()): number {
  const ms = new Date(`${iso}T00:00:00`).getTime() - new Date(today.toDateString()).getTime()
  return Math.round(ms / 86400000)
}

export function daysAgo(iso: string, today = new Date()): number {
  return -daysUntil(iso, today)
}
