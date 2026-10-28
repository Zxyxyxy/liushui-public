import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { CLUSTERS, ALIASES } from '../data/fallbacks'
import type { Alias, FallbackCluster } from '../data/types'
import { load, save } from './persist'
import { useAuditStore } from './audit'

export const useQualityStore = defineStore('quality', () => {
  const planned = ref<Record<string, boolean>>(load('planned', {} as Record<string, boolean>))
  const aliasEdits = ref<Alias[] | null>(load('aliases', null as Alias[] | null))

  watch(planned, (v) => save('planned', v), { deep: true })
  watch(aliasEdits, (v) => save('aliases', v), { deep: true })

  /* ---------- 需求池 ---------- */

  const clusters = computed<FallbackCluster[]>(() =>
    CLUSTERS.map((c) => ({ ...c, planned: planned.value[c.id] ?? false })),
  )

  function togglePlan(id: string) {
    const c = CLUSTERS.find((x) => x.id === id)
    const next = !planned.value[id]
    planned.value[id] = next
    useAuditStore().log(next ? '需求立项' : '取消立项', c?.intent ?? id, c?.suggestion ?? '')
  }

  /* ---------- 黑话别名层 ---------- */

  const aliases = computed<Alias[]>(() => aliasEdits.value ?? ALIASES)

  function addAlias(term: string, means: string) {
    aliasEdits.value = [{ term, means, hits: 0 }, ...aliases.value]
    useAuditStore().log('新增别名', term, means)
  }

  function removeAlias(term: string) {
    aliasEdits.value = aliases.value.filter((a) => a.term !== term)
    useAuditStore().log('删除别名', term, '')
  }

  return { clusters, togglePlan, aliases, addAlias, removeAlias }
})
