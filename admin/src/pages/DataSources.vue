<script setup lang="ts">
import { computed, ref } from 'vue'
import SectionTitle from '../components/ui/SectionTitle.vue'
import StatusChip from '../components/ui/StatusChip.vue'
import DataTable from '../components/ui/DataTable.vue'
import type { Col } from '../components/ui/table'
import type { DataSource } from '../data/types'
import { GRANT_NOTE, SHOW_RULE } from '../data/sources'
import { freshness, useSourceStore } from '../stores/sources'
import { useUiStore } from '../stores/ui'

const sources = useSourceStore()
const ui = useUiStore()

const only = ref<'all' | 'stale' | 'requested'>('all')

const rows = computed(() =>
  sources.items.filter((s) =>
    only.value === 'stale'
      ? freshness(s).level === 'stale'
      : only.value === 'requested'
        ? s.grant === 'requested'
        : true,
  ),
)

const cols: Col<DataSource>[] = [
  { key: 'name', label: '数据源', sortable: true, width: '22%' },
  { key: 'cadence', label: '更新频率', sortable: true },
  { key: 'lastUpdated', label: '最近更新', sortable: true },
  { key: 'age', label: '新鲜度', sortable: true, sortVal: (r) => freshness(r).age ?? -1 },
  { key: 'show', label: '展示要求', width: '15%' },
  { key: 'usedBy', label: '在用工具', sortable: true, sortVal: (r) => r.usedBy.length },
  { key: 'grant', label: '授权', sortable: true },
  { key: 'act', label: '', width: '112px' },
]

const FRESH_TONE = { fresh: 'ok', due: 'pending', stale: 'bad', unknown: 'muted' } as const
const FRESH_LABEL = { fresh: '有效', due: '临近', stale: '已过期', unknown: '无周期' } as const

const CADENCE_TONE: Record<string, 'ok' | 'info' | 'pending' | 'warn'> = {
  年更: 'info',
  季更: 'pending',
  持续: 'ok',
  事件驱动: 'warn',
}

function grant(s: DataSource, g: 'granted' | 'denied') {
  sources.setGrant(s.id, g)
  ui.toast(g === 'granted' ? `已授予「${s.name}」` : `已回收「${s.name}」的授权`, g === 'granted' ? 'default' : 'warn')
}
</script>

<template>
  <div class="px-6 pb-10 pt-6">
    <SectionTitle
      title="数据源台账"
      sub="外部数据逐项授权，按类管新鲜度"
    >
      <template #action>
        <div class="flex items-center gap-2">
          <select v-model="only" class="field field-sm !w-auto">
            <option value="all">全部</option>
            <option value="stale">只看已过期</option>
            <option value="requested">只看待授予</option>
          </select>
        </div>
      </template>
    </SectionTitle>

    <div v-if="sources.stale.length" class="panel animate-rise mb-3 flex items-center gap-3 border-accent-coral/30 bg-accent-coral/6 px-4 py-3">
      <StatusChip tone="bad" :label="`${sources.stale.length} 个数据源已过期`" />
      <p class="note !text-ink-600">
        {{ sources.stale.map((s) => s.name).join('、') }} 仍在被调用，结果页必须带抓取日期
      </p>
    </div>

    <div class="panel animate-rise overflow-hidden">
      <DataTable
        :cols="cols"
        :rows="rows"
        sort="age"
        empty-title="这个筛选下没有数据源"
        empty-sub="切回全部看看"
      >
        <template #row="{ row }">
          <tr>
            <td>
              <p class="font-semibold text-ink-900">{{ row.name }}</p>
              <p class="text-[11px] text-ink-300">{{ row.owner }}</p>
            </td>
            <td>
              <StatusChip :tone="CADENCE_TONE[row.cadence]" :label="row.cadence" />
            </td>
            <td class="whitespace-nowrap tabular-nums">
              {{ row.lastUpdated }}
            </td>
            <td>
              <div class="flex items-center gap-1.5">
                <StatusChip :tone="FRESH_TONE[freshness(row).level]" :label="FRESH_LABEL[freshness(row).level]" />
                <span v-if="freshness(row).age !== null" class="whitespace-nowrap text-[11px] tabular-nums text-ink-300">
                  {{ freshness(row).age }} 天前<span v-if="row.maxAgeDays"> / 限 {{ row.maxAgeDays }}</span>
                </span>
              </div>
            </td>
            <td class="text-[11px]">
              <span :class="row.cadence === '事件驱动' && 'font-semibold text-accent-coral'">
                {{ SHOW_RULE[row.cadence] }}
              </span>
            </td>
            <td class="text-[11px] text-ink-500">
              <span v-if="row.usedBy.length">{{ row.usedBy.join('、') }}</span>
              <span v-else class="text-ink-300">暂无</span>
            </td>
            <td>
              <StatusChip
                :tone="row.grant === 'granted' ? 'ok' : row.grant === 'requested' ? 'pending' : 'warn'"
                :label="row.grant === 'granted' ? '已授予' : row.grant === 'requested' ? '待授予' : '已驳回'"
              />
            </td>
            <td>
              <div class="flex gap-1">
                <button
                  v-if="row.grant !== 'granted'"
                  type="button"
                  class="btn-quiet !px-2 !py-0.5 text-[11px]"
                  @click="grant(row, 'granted')"
                >
                  授予
                </button>
                <button
                  v-if="row.grant !== 'denied'"
                  type="button"
                  class="btn-quiet !px-2 !py-0.5 text-[11px]"
                  @click="grant(row, 'denied')"
                >
                  {{ row.grant === 'granted' ? '回收' : '驳回' }}
                </button>
              </div>
            </td>
          </tr>
        </template>
      </DataTable>
    </div>

    <div class="mt-3 grid gap-3 lg:grid-cols-2">
      <div class="panel p-4">
        <h3 class="text-[13px] font-bold text-ink-900">新鲜度按类分级</h3>
        <ul class="mt-2.5 space-y-2 text-[11.5px] leading-relaxed text-ink-500">
          <li>· <span class="font-semibold text-ink-700">学校专业信息</span> 年更</li>
          <li>· <span class="font-semibold text-ink-700">申请截止日期</span> 季更</li>
          <li>· <span class="font-semibold text-ink-700">往届案例</span> 持续，标来源与年份</li>
          <li>
            · <span class="font-semibold text-accent-coral">签证政策</span> 事件驱动，无周期，强制展示日期
          </li>
        </ul>
      </div>

      <div class="panel p-4">
        <h3 class="text-[13px] font-bold text-ink-900">授权状态的含义</h3>
        <ul class="mt-2.5 space-y-2">
          <li v-for="(note, k) in GRANT_NOTE" :key="k" class="flex items-start gap-2">
            <StatusChip
              :tone="k === 'granted' ? 'ok' : k === 'requested' ? 'pending' : 'warn'"
              :label="k === 'granted' ? '已授予' : k === 'requested' ? '待授予' : '已驳回'"
            />
            <p class="note min-w-0 flex-1 !text-ink-500">{{ note }}</p>
          </li>
        </ul>
        <p class="note mt-3 !text-ink-300">授予与回收都会落一条操作审计</p>
      </div>
    </div>
  </div>
</template>
