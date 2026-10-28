import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import type { DataSource } from '../data/types'
import { SOURCES } from '../data/sources'
import { daysAgo } from '../lib/fmt'
import { load, save } from './persist'
import { useAuditStore } from './audit'

export type Freshness = 'fresh' | 'due' | 'stale' | 'unknown'

/** 新鲜度判定。事件驱动的没有固定周期，永远是 unknown ——
 *  它靠「强制展示日期」兜底，不靠周期判断。 */
export function freshness(s: DataSource): { level: Freshness; age: number | null } {
  if (s.lastUpdated === '—') return { level: 'unknown', age: null }
  const age = daysAgo(s.lastUpdated)
  if (s.maxAgeDays === null) return { level: 'unknown', age }
  if (age > s.maxAgeDays) return { level: 'stale', age }
  if (age > s.maxAgeDays * 0.8) return { level: 'due', age }
  return { level: 'fresh', age }
}

export const useSourceStore = defineStore('sources', () => {
  const grants = ref<Record<string, DataSource['grant']>>(load('grants', {} as Record<string, DataSource['grant']>))
  watch(grants, (v) => save('grants', v), { deep: true })

  const items = computed<DataSource[]>(() => SOURCES.map((s) => ({ ...s, grant: grants.value[s.id] ?? s.grant })))

  const stale = computed(() => items.value.filter((s) => freshness(s).level === 'stale'))

  function setGrant(id: string, grant: DataSource['grant']) {
    const s = SOURCES.find((x) => x.id === id)
    grants.value[id] = grant
    useAuditStore().log(
      grant === 'granted' ? '授予数据源' : grant === 'denied' ? '回收数据源授权' : '标记为待授予',
      s?.name ?? id,
      grant === 'granted' ? '默认不给，逐项授予' : '',
    )
  }

  return { items, stale, setGrant }
})
