<script setup lang="ts">
import { computed } from 'vue'
import FlowField from '../components/water/FlowField.vue'
import WaveDivider from '../components/water/WaveDivider.vue'
import LiquidBar from '../components/water/LiquidBar.vue'
import CountUp from '../components/water/CountUp.vue'
import Metric from '../components/ui/Metric.vue'
import SectionTitle from '../components/ui/SectionTitle.vue'
import StatusChip from '../components/ui/StatusChip.vue'
import { useReviewStore } from '../stores/review'
import { useSettleStore } from '../stores/settle'
import { useSourceStore } from '../stores/sources'
import { FALLBACK_THRESHOLD, FALLBACK_TREND } from '../data/fallbacks'

const review = useReviewStore()
const settle = useSettleStore()
const sources = useSourceStore()

/* PRD §十二 早期最该盯的四个数。构造数据。
   hint 一律压到一行以内 —— 四张卡并排，任何一张换行都会把整排撑高。 */
const NORTH_STAR = [
  {
    label: '有效工具数',
    value: 26,
    unit: '个',
    hint: '月运行 ≥ 100 且评分 ≥ 4.0',
    tone: 'var(--color-water-600)',
    delta: 3,
    deltaUnit: ' 个',
  },
  {
    label: '有效使用者数',
    value: 38420,
    unit: '人',
    hint: '逐项扣除后的余数，非运行次数',
    tone: 'var(--color-water-500)',
    delta: 12,
    deltaUnit: '%',
  },
  {
    label: '用户复用率',
    value: 34.2,
    unit: '%',
    decimals: 1,
    hint: '同人同工具跨月再次使用',
    tone: 'var(--color-accent-mint)',
    delta: 1.8,
    deltaUnit: '%',
  },
  {
    label: '创作者持续发布率',
    value: 62.5,
    unit: '%',
    decimals: 1,
    hint: '近两月各发过一个工具',
    tone: 'var(--color-accent-violet)',
    delta: -4.2,
    deltaUnit: '%',
  },
]

const fallbackNow = FALLBACK_TREND[FALLBACK_TREND.length - 1]
const overThreshold = fallbackNow > FALLBACK_THRESHOLD

const todo = computed(() => [
  {
    label: '待审工具',
    n: review.pending.length,
    to: '/review/tools',
    tone: review.pending.length > 5 ? ('warn' as const) : ('pending' as const),
    note: `其中 ${review.pending.filter((s) => s.boundaryNote).length} 条有边界疑问`,
  },
  { label: '待审帖子', n: 3, to: '/review/content', tone: 'pending' as const, note: '隐私字段漏检复核' },
  {
    label: '兜底越阈告警',
    n: overThreshold ? 3 : 0,
    to: '/quality/demand',
    tone: overThreshold ? ('bad' as const) : ('ok' as const),
    note: overThreshold ? `连续 3 周越 ${FALLBACK_THRESHOLD}% 阈值` : '低于阈值',
  },
  {
    label: '结算待确认',
    n: settle.pending.length,
    to: '/creators/settlement',
    tone: 'pending' as const,
    note: '2026-08 月度',
  },
  {
    label: '数据源过期',
    n: sources.stale.length,
    to: '/sources',
    tone: sources.stale.length ? ('bad' as const) : ('ok' as const),
    note: sources.stale.length ? '结果页必须带抓取日期' : '均在有效期内',
  },
])

/* 四场景供给分布，构造数据 */
const SCENE_SUPPLY = [
  { label: '学习提效', value: 78, tone: 'var(--color-water-500)', tools: 9 },
  { label: '求职实习', value: 92, tone: 'var(--color-accent-coral)', tools: 10 },
  { label: '留学申请', value: 64, tone: 'var(--color-accent-violet)', tools: 9 },
  { label: '学习考试', value: 41, tone: 'var(--color-accent-mint)', tools: 5 },
]
</script>

<template>
  <div>
    <!-- 唯一保留光斑与波浪的地方 -->
    <header class="relative overflow-hidden">
      <FlowField />
      <div class="relative px-6 pb-4 pt-8">
        <p class="text-[11px] font-semibold tracking-widest text-water-600">2026 年 9 月 17 日 · 数据截至昨日</p>
        <h1 class="mt-1.5 text-2xl font-bold text-ink-900">
          早期最该盯的<span class="text-flow"> 四个数</span>
        </h1>
      </div>
      <WaveDivider />
    </header>

    <div class="space-y-6 px-6 pb-10">
      <!-- 四个北极星 -->
      <div class="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Metric
          v-for="(m, i) in NORTH_STAR"
          :key="m.label"
          class="stagger animate-rise"
          :style="{ '--i': i }"
          :label="m.label"
          :value="m.value"
          :unit="m.unit"
          :decimals="m.decimals ?? 0"
          :hint="m.hint"
          :tone="m.tone"
          :delta="m.delta"
          :delta-unit="m.deltaUnit"
        />
      </div>

      <!-- 待处理聚合 -->
      <section>
        <SectionTitle title="待处理" />
        <div class="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
          <RouterLink
            v-for="(t, i) in todo"
            :key="t.label"
            :to="t.to"
            class="panel lift stagger animate-rise block p-3.5"
            :style="{ '--i': i }"
          >
            <p class="text-[11px] font-semibold text-ink-400">{{ t.label }}</p>
            <p class="mt-1 text-2xl font-bold leading-none tabular-nums text-ink-900">
              <CountUp :value="t.n" from-zero />
            </p>
            <div class="mt-2">
              <StatusChip :tone="t.tone" :label="t.n ? '待处理' : '已清空'" />
            </div>
            <p class="mt-1.5 text-[11px] leading-snug text-ink-300">{{ t.note }}</p>
          </RouterLink>
        </div>
      </section>

      <div class="grid gap-3 lg:grid-cols-2">
        <!-- 供给分布 -->
        <section class="panel p-5">
          <h3 class="text-sm font-bold text-ink-900">四场景供给健康度</h3>
          <p class="note mt-1.5">考试场景明显偏薄</p>
          <div class="mt-4 space-y-3.5">
            <div v-for="s in SCENE_SUPPLY" :key="s.label">
              <div class="mb-1 flex items-baseline justify-between text-[12px]">
                <span class="text-ink-700">{{ s.label }}</span>
                <span class="text-ink-300">{{ s.tools }} 个工具</span>
              </div>
              <LiquidBar :value="s.value" :tone="s.tone" :height="8" bare />
            </div>
          </div>
        </section>
      </div>

      <p class="note pt-3 text-center !text-ink-300">
        流水不争先，争的是滔滔不绝 · 形态 demo，上线仍按 README 推迟
      </p>
    </div>
  </div>
</template>
