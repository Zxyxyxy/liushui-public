import type { Settlement } from '../data/types'

/* ============================================================
   结算计算

   PRD §七的补贴公式：
     有效使用者数 × 单用户补贴 × 工具质量系数
     + 新工具冷启动奖励 + 配套内容奖励 + 用户留存奖励
     受月度补贴上限约束

   有效使用者不是一个给定的总数，是总运行次数逐项扣除后的余数 ——
   每一项扣除都要说得出依据，否则创作者没法核。
   ============================================================ */

/** 质量系数：六项指标均分映射到 [0.8, 1.3]。
 *  60 分是基准（系数 1.0），每高 1 分加 0.0075。
 *  ⚠️ 这个映射是 demo 为了让 1.18 可复算而定的形状，不是已定稿的权重。
 *  真实权重要等有了足够运行样本再定，见 README。 */
export function coefficient(metricValues: number[]): number {
  if (!metricValues.length) return 1
  const avg = metricValues.reduce((a, b) => a + b, 0) / metricValues.length
  const raw = 1 + (avg - 60) * 0.0075
  return Math.round(Math.min(1.3, Math.max(0.8, raw)) * 100) / 100
}

export interface Bill {
  totalRuns: number
  deducted: number
  effectiveUsers: number
  metricAvg: number
  coefficient: number
  base: number
  bonusTotal: number
  gross: number
  payout: number
  capped: boolean
}

export function bill(s: Settlement): Bill {
  const values = s.metrics.map((m) => m.value)
  const deducted = s.deductions.reduce((a, d) => a + d.count, 0)
  const effectiveUsers = s.totalRuns - deducted
  const coef = coefficient(values)
  const base = effectiveUsers * s.perUser * coef
  const bonusTotal = s.bonuses.reduce((a, b) => a + b.amount, 0)
  const gross = base + bonusTotal
  const payout = Math.min(gross, s.cap)
  return {
    totalRuns: s.totalRuns,
    deducted,
    effectiveUsers,
    metricAvg: values.reduce((a, b) => a + b, 0) / values.length,
    coefficient: coef,
    base,
    bonusTotal,
    gross,
    payout,
    capped: gross > s.cap,
  }
}
