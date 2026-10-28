<script setup lang="ts">
import CountUp from '../water/CountUp.vue'

/** 指标卡。卡片保留 .lift 上浮（只有卡片能浮，表格行不能）。 */
withDefaults(
  defineProps<{
    label: string
    value: number
    unit?: string
    decimals?: number
    hint?: string
    tone?: string
    /** 与上月比较的变化量，正负号自己算好传进来 */
    delta?: number
    deltaUnit?: string
    /** true 时 delta 为正是坏事（比如兜底率、投诉率） */
    invert?: boolean
  }>(),
  { decimals: 0, tone: 'var(--color-water-600)', deltaUnit: '' },
)
</script>

<template>
  <div class="panel lift p-4">
    <p class="text-[11px] font-semibold tracking-wider text-ink-400">{{ label }}</p>
    <div class="mt-1.5 flex items-baseline gap-1">
      <span class="text-[26px] font-bold leading-none" :style="{ color: tone }">
        <CountUp :value="value" :decimals="decimals" from-zero />
      </span>
      <span v-if="unit" class="text-sm font-semibold text-ink-400">{{ unit }}</span>
      <span
        v-if="delta !== undefined"
        class="ml-1 text-[11px] font-semibold tabular-nums"
        :class="
          (invert ? delta < 0 : delta > 0) ? 'text-accent-mint' : delta === 0 ? 'text-ink-300' : 'text-accent-coral'
        "
      >
        {{ delta > 0 ? '↑' : delta < 0 ? '↓' : '–' }}{{ Math.abs(delta) }}{{ deltaUnit }}
      </span>
    </div>
    <p v-if="hint" class="note mt-2">{{ hint }}</p>
    <slot />
  </div>
</template>
