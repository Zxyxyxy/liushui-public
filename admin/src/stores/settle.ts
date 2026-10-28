import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import type { Settlement } from '../data/types'
import { SETTLEMENTS } from '../data/settlements'
import { load, save } from './persist'
import { useAuditStore } from './audit'

export const useSettleStore = defineStore('settle', () => {
  const status = ref<Record<string, Settlement['status']>>(load('settle', {} as Record<string, Settlement['status']>))
  watch(status, (v) => save('settle', v), { deep: true })

  const items = computed<Settlement[]>(() =>
    SETTLEMENTS.map((s) => ({ ...s, status: status.value[s.creatorId] ?? s.status })),
  )

  /** 平台自营不参与补贴，不算待确认 */
  const pending = computed(() => items.value.filter((s) => s.status === 'draft' && !s.excluded))

  function confirm(creatorId: string, name: string, payout: number) {
    status.value[creatorId] = 'confirmed'
    useAuditStore().log('确认结算', `${name} · 2026-08`, `应付 ¥${payout.toFixed(2)}`)
  }

  function revert(creatorId: string, name: string) {
    status.value[creatorId] = 'draft'
    useAuditStore().log('撤销结算确认', `${name} · 2026-08`, '退回草稿，重新核对')
  }

  return { items, pending, confirm, revert }
})
