<script setup lang="ts">
import { computed, ref } from 'vue'
import SectionTitle from '../components/ui/SectionTitle.vue'
import StatusChip from '../components/ui/StatusChip.vue'
import Sparkline from '../components/water/Sparkline.vue'
import Metric from '../components/ui/Metric.vue'
import { FALLBACK_BREACH_NOTE, FALLBACK_THRESHOLD, FALLBACK_TREND, FALLBACK_WEEKS } from '../data/fallbacks'
import { num } from '../lib/fmt'
import { useQualityStore } from '../stores/quality'
import { useUiStore } from '../stores/ui'

const quality = useQualityStore()
const ui = useUiStore()

const now = FALLBACK_TREND[FALLBACK_TREND.length - 1]
const prev = FALLBACK_TREND[FALLBACK_TREND.length - 2]
const breached = computed(() => FALLBACK_TREND.filter((v) => v > FALLBACK_THRESHOLD).length)
const tailBreach = computed(() => {
  let n = 0
  for (let i = FALLBACK_TREND.length - 1; i >= 0; i--) {
    if (FALLBACK_TREND[i] > FALLBACK_THRESHOLD) n++
    else break
  }
  return n
})

const totalUncovered = computed(() => quality.clusters.reduce((a, c) => a + c.count, 0))
const plannedCount = computed(() => quality.clusters.filter((c) => c.planned).length)

const openCluster = ref<string | null>('fc-01')
function toggle(id: string) {
  openCluster.value = openCluster.value === id ? null : id
}

function plan(id: string, intent: string, next: boolean) {
  quality.togglePlan(id)
  ui.toast(next ? `已立项：${intent}` : `已取消立项：${intent}`, next ? 'default' : 'info')
}

/* ---------- 黑话别名层 ---------- */
const newTerm = ref('')
const newMeans = ref('')
function addAlias() {
  const t = newTerm.value.trim()
  const m = newMeans.value.trim()
  if (!t || !m) {
    ui.toast('词和释义都要填 —— 别名层是查表，释义就是表的值', 'warn')
    return
  }
  if (quality.aliases.some((a) => a.term === t)) {
    ui.toast('这个词已经在表里了', 'warn')
    return
  }
  quality.addAlias(t, m)
  newTerm.value = ''
  newMeans.value = ''
  ui.toast(`已加入别名层：${t}`)
}
</script>

<template>
  <div class="px-6 pb-10 pt-6">
    <SectionTitle
      title="需求池"
      sub="兜底率越过阈值当 bug 处理"
    />

    <!-- 阈值折线 -->
    <div class="panel animate-rise mb-3 p-5">
      <div class="mb-3 flex items-start justify-between gap-4">
        <div>
          <h3 class="text-sm font-bold text-ink-900">兜底率 · 近 12 周</h3>
          <p class="note mt-1.5">阈值 {{ FALLBACK_THRESHOLD }}%，越线当 bug 处理</p>
        </div>
        <StatusChip
          :tone="tailBreach ? 'bad' : 'ok'"
          :label="tailBreach ? `连续 ${tailBreach} 周越线` : '低于阈值'"
        />
      </div>

      <Sparkline
        :values="FALLBACK_TREND"
        :labels="FALLBACK_WEEKS"
        :threshold="FALLBACK_THRESHOLD"
        :height="150"
        tone="var(--color-water-500)"
      />

      <div v-if="tailBreach" class="mt-3 rounded-xl border border-accent-coral/30 bg-accent-coral/6 p-3">
        <p class="text-[12px] font-bold text-accent-coral">越线原因</p>
        <p class="mt-1 text-[11px] leading-relaxed text-ink-600">{{ FALLBACK_BREACH_NOTE }}</p>
      </div>
    </div>

    <div class="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Metric
        label="本周兜底率"
        :value="now"
        unit="%"
        :delta="now - prev"
        delta-unit="%"
        invert
        tone="var(--color-accent-coral)"
        :hint="`上周 ${prev}%，阈值 ${FALLBACK_THRESHOLD}%`"
      />
      <Metric label="12 周内越线" :value="breached" unit="周" tone="var(--color-accent-sun)" hint="占 12 周的一半" />
      <Metric
        label="未覆盖 query"
        :value="totalUncovered"
        unit="条"
        tone="var(--color-water-600)"
        hint="按意图聚成下面 8 簇"
      />
      <Metric
        label="已立项"
        :value="plannedCount"
        unit="簇"
        tone="var(--color-accent-mint)"
        hint="立项 ≠ 一定做，先进 roadmap 排队"
      />
    </div>

    <div class="grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <!-- 聚类 -->
      <section>
        <div class="mb-2 flex items-baseline justify-between">
          <h3 class="text-sm font-bold text-ink-900">未覆盖意图 · 按簇</h3>
          <p class="text-[11px] text-ink-300">条数降序</p>
        </div>

        <div class="space-y-2">
          <article
            v-for="(c, idx) in quality.clusters"
            :key="c.id"
            class="panel animate-rise stagger overflow-hidden"
            :style="{ '--i': idx }"
          >
            <button
              type="button"
              class="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-water-50/70"
              @click="toggle(c.id)"
            >
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <p class="truncate text-[13px] font-bold text-ink-900">{{ c.intent }}</p>
                  <StatusChip v-if="c.planned" tone="ok" label="已立项" />
                  <StatusChip v-if="c.covered" tone="info" :label="`已有 ${c.covered}`" />
                </div>
                <p class="mt-0.5 truncate text-[11px] text-ink-400">{{ c.suggestion }}</p>
              </div>
              <span class="shrink-0 text-base font-bold tabular-nums text-water-600">{{ num(c.count) }}</span>
              <span class="shrink-0 text-ink-300 transition-transform" :class="openCluster === c.id && 'rotate-90'"
                >›</span
              >
            </button>

            <div v-if="openCluster === c.id" class="border-t border-water-100 px-4 py-3">
              <p class="text-[10px] font-semibold tracking-wider text-ink-400">示例 query</p>
              <ul class="mt-1.5 space-y-1.5">
                <li v-for="s in c.samples" :key="s" class="quote">{{ s }}</li>
              </ul>
              <div class="mt-3 flex items-center justify-end">
                <button
                  type="button"
                  class="shrink-0"
                  :class="c.planned ? 'btn-quiet' : 'btn-water !py-1.5 text-xs'"
                  @click="plan(c.id, c.intent, !c.planned)"
                >
                  {{ c.planned ? '取消立项' : '标记立项' }}
                </button>
              </div>
            </div>
          </article>
        </div>
      </section>

      <!-- 别名层 -->
      <section>
        <div class="mb-2">
          <h3 class="text-sm font-bold text-ink-900">黑话别名层</h3>
          <p class="note mt-1.5">做成查表，不写进 prompt。可增删、可统计命中</p>
        </div>

        <div class="panel animate-rise overflow-hidden">
          <div class="panel-head">
            <p class="text-[12px] font-semibold text-ink-700">{{ quality.aliases.length }} 条</p>
            <p class="text-[10px] text-ink-300">命中数降序</p>
          </div>

          <div class="t-wrap max-h-96 overflow-y-auto">
            <table class="t">
              <thead>
                <tr>
                  <th>词</th>
                  <th>释义</th>
                  <th class="text-right">命中</th>
                  <th class="w-8"></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="a in [...quality.aliases].sort((x, y) => y.hits - x.hits)" :key="a.term">
                  <td class="whitespace-nowrap font-semibold text-ink-900">{{ a.term }}</td>
                  <td class="text-[12px] text-ink-500">{{ a.means }}</td>
                  <td class="num">{{ num(a.hits) }}</td>
                  <td>
                    <button
                      type="button"
                      class="text-ink-300 transition-colors hover:text-accent-coral"
                      title="删除"
                      @click="quality.removeAlias(a.term)"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="flex items-center gap-2 border-t border-water-100 bg-water-50/60 px-4 py-3">
            <input v-model="newTerm" class="field field-sm w-24 shrink-0" placeholder="词" />
            <input v-model="newMeans" class="field field-sm min-w-0 flex-1" placeholder="它实际指什么" />
            <button type="button" class="btn-water shrink-0 !py-1.5 text-xs" @click="addAlias">加入</button>
          </div>
        </div>

        <p class="note mt-2 !text-ink-300">「润」是歧义词，靠上下文消解，表里不定死</p>
      </section>
    </div>
  </div>
</template>
