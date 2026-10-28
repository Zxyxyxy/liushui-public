<script setup lang="ts">
import { computed } from 'vue'

/** 后台新增元件：带阈值线的折线图。前台没有折线图（它只有 LiquidBar 柱状），
 *  但 D9 要求兜底率必须对着阈值看——"定阈值，越线当 bug 处理"，所以阈值线是必需品，不是装饰。
 *  面积填充沿用水色渐变，和 LiquidBar 同一套观感。 */
const props = withDefaults(
  defineProps<{
    values: number[]
    labels?: string[]
    /** 阈值线（与 values 同单位），越线的点标红 */
    threshold?: number
    tone?: string
    height?: number
    /** y 轴上界，不给则取数据与阈值的最大值 */
    max?: number
    unit?: string
  }>(),
  { tone: '#00b4d8', height: 120, unit: '%' },
)

const W = 600
const PAD_X = 8
const PAD_Y = 10

const top = computed(() => {
  const dataMax = Math.max(...props.values, props.threshold ?? 0)
  return props.max ?? Math.ceil(dataMax * 1.25)
})

const pts = computed(() =>
  props.values.map((v, i) => {
    const n = props.values.length
    const x = n === 1 ? W / 2 : PAD_X + (i * (W - PAD_X * 2)) / (n - 1)
    const y = PAD_Y + (1 - v / top.value) * (props.height - PAD_Y * 2)
    return { x, y, v, over: props.threshold !== undefined && v > props.threshold }
  }),
)

const line = computed(() => pts.value.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' '))

const area = computed(() => {
  if (!pts.value.length) return ''
  const first = pts.value[0]
  const last = pts.value[pts.value.length - 1]
  return `${line.value} L${last.x.toFixed(1)} ${props.height} L${first.x.toFixed(1)} ${props.height} Z`
})

const thresholdY = computed(() =>
  props.threshold === undefined
    ? 0
    : PAD_Y + (1 - props.threshold / top.value) * (props.height - PAD_Y * 2),
)

const gid = `spark-${Math.random().toString(36).slice(2, 8)}`
</script>

<template>
  <div>
    <svg
      :viewBox="`0 0 ${W} ${height}`"
      :style="{ height: `${height}px` }"
      class="w-full overflow-visible"
      preserveAspectRatio="none"
      role="img"
    >
      <defs>
        <linearGradient :id="gid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" :stop-color="tone" stop-opacity="0.28" />
          <stop offset="100%" :stop-color="tone" stop-opacity="0.02" />
        </linearGradient>
      </defs>

      <path :d="area" :fill="`url(#${gid})`" />
      <path :d="line" fill="none" :stroke="tone" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />

      <!-- 阈值线：越过它就是 bug，不是"稍微高了点" -->
      <template v-if="threshold !== undefined">
        <line
          :x1="0"
          :x2="W"
          :y1="thresholdY"
          :y2="thresholdY"
          stroke="var(--color-accent-coral)"
          stroke-width="1.5"
          stroke-dasharray="6 5"
          opacity="0.85"
        />
      </template>

      <circle
        v-for="(p, i) in pts"
        :key="i"
        :cx="p.x"
        :cy="p.y"
        :r="p.over ? 4 : 3"
        :fill="p.over ? 'var(--color-accent-coral)' : '#fff'"
        :stroke="p.over ? 'var(--color-accent-coral)' : tone"
        stroke-width="2"
      />
    </svg>

    <div v-if="labels?.length" class="mt-1.5 flex justify-between px-1 text-[10px] text-ink-300">
      <span v-for="(l, i) in labels" :key="i" class="tabular-nums">{{ l }}</span>
    </div>

    <div v-if="threshold !== undefined" class="mt-1 flex items-center gap-1.5 text-[11px] text-ink-400">
      <span class="inline-block h-0 w-4 border-t-[1.5px] border-dashed border-accent-coral" />
      阈值 {{ threshold }}{{ unit }}
    </div>
  </div>
</template>
