import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import type { AuditEntry } from '../data/types'
import { load, save } from './persist'

/** 所有写动作的落点。审核、结算、复核、授权都往这里追加一条。
 *  「操作审计」页只读这个 store，不自己造数据 —— 否则审计就成了装饰。 */
export const useAuditStore = defineStore('audit', () => {
  const entries = ref<AuditEntry[]>(load('audit', [] as AuditEntry[]))

  watch(entries, (v) => save('audit', v), { deep: true })

  function log(action: string, target: string, detail: string) {
    entries.value.unshift({
      id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      at: new Date().toISOString(),
      who: '运营 · 你',
      action,
      target,
      detail,
    })
  }

  const count = computed(() => entries.value.length)

  return { entries, count, log }
})
