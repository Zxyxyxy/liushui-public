import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import type { Submission, SubmissionStatus } from '../data/types'
import { SUBMISSIONS } from '../data/submissions'
import { load, save } from './persist'
import { useAuditStore } from './audit'

/** 审核决定与外部数据授权。只存「被改过的部分」，
 *  基础数据仍从 submissions.ts 读 —— 这样改数据文件不用清 localStorage。 */
interface Patch {
  status?: SubmissionStatus
  reason?: string
  decidedAt?: string
  /** 步骤积分被运营改过（用来现场验证积分闸门） */
  steps?: number[]
  /** 外部数据逐项授予结果，按 source 名索引 */
  grants?: Record<string, 'granted' | 'denied'>
}

export const useReviewStore = defineStore('review', () => {
  const patches = ref<Record<string, Patch>>(load('review', {} as Record<string, Patch>))
  watch(patches, (v) => save('review', v), { deep: true })

  /** 把 patch 合并回基础数据，页面只看这个 */
  const items = computed<Submission[]>(() =>
    SUBMISSIONS.map((s) => {
      const p = patches.value[s.id]
      if (!p) return s
      return {
        ...s,
        status: p.status ?? s.status,
        reason: p.reason ?? s.reason,
        decidedAt: p.decidedAt ?? s.decidedAt,
        steps: p.steps ? s.steps.map((st, i) => ({ ...st, credits: p.steps![i] ?? st.credits })) : s.steps,
        contract: {
          ...s.contract,
          external: s.contract.external.map((e) => ({ ...e, grant: p.grants?.[e.source] ?? e.grant })),
        },
      }
    }),
  )

  const pending = computed(() => items.value.filter((s) => s.status === 'pending'))

  function patch(id: string, p: Patch) {
    patches.value[id] = { ...patches.value[id], ...p }
  }

  function decide(id: string, status: SubmissionStatus, reason: string) {
    const s = items.value.find((x) => x.id === id)
    patch(id, { status, reason, decidedAt: new Date().toISOString().slice(0, 10) })
    const verb = status === 'approved' ? '通过工具' : status === 'rejected' ? '打回工具' : '要求补充声明'
    useAuditStore().log(verb, s ? s.toolName : id, reason)
  }

  /** 改某一步的积分。审核页用它现场验证「加总 ≠ 标价」的闸门。 */
  function setStepCredits(id: string, index: number, credits: number) {
    const s = items.value.find((x) => x.id === id)
    if (!s) return
    const next = s.steps.map((st) => st.credits)
    next[index] = credits
    patch(id, { steps: next })
  }

  function setGrant(id: string, source: string, grant: 'granted' | 'denied') {
    const s = items.value.find((x) => x.id === id)
    patch(id, { grants: { ...patches.value[id]?.grants, [source]: grant } })
    useAuditStore().log(
      grant === 'granted' ? '授予外部数据' : '驳回外部数据申请',
      `${s?.toolName ?? id} · ${source}`,
      grant === 'granted' ? '已授予，工具运行时可调用' : '用途或范围不明，未授予',
    )
  }

  function reset(id: string) {
    delete patches.value[id]
  }

  return { items, pending, decide, setStepCredits, setGrant, reset }
})
