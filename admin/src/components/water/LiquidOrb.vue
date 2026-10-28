<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

/** 圆形液面容器。创作者中心用它显示质量系数六项，后台结算页必须用同一个元件同一批数。 */
const props = withDefaults(
  defineProps<{
    value: number
    size?: number
    tone?: string
    caption?: string
  }>(),
  { size: 92, tone: '#00b4d8' },
)

const fill = ref(0)
let timer: number | undefined

/** 同 LiquidBar：后台传的是 var(--color-…)，不能直接拼十六进制透明度。80% ≈ 原来的 cc。 */
const soft = computed(() => `color-mix(in srgb, ${props.tone} 80%, transparent)`)

function animateTo(v: number) {
  window.clearTimeout(timer)
  timer = window.setTimeout(() => (fill.value = v), 80)
}

onMounted(() => animateTo(props.value))
watch(() => props.value, animateTo)
</script>

<template>
  <div class="flex flex-col items-center gap-2">
    <div
      class="relative overflow-hidden rounded-full border-2 border-white bg-water-50"
      :style="{ width: `${size}px`, height: `${size}px`, boxShadow: `0 8px 26px -10px ${tone}` }"
    >
      <div
        class="absolute inset-x-0 bottom-0 transition-[height] duration-[1400ms] ease-out"
        :style="{ height: `${fill}%`, background: `linear-gradient(180deg, ${soft}, ${tone})` }"
      >
        <svg
          class="absolute -top-2 left-0 h-4 w-[200%] animate-[wave_5s_linear_infinite]"
          viewBox="0 0 120 12"
          preserveAspectRatio="none"
        >
          <path d="M0 6 C 15 0, 30 0, 45 6 S 75 12, 90 6 S 120 0, 120 6 V12 H0Z" :fill="tone" />
        </svg>
      </div>
      <div class="absolute inset-0 grid place-items-center">
        <span
          class="font-bold tabular-nums text-ink-900 mix-blend-luminosity"
          :style="{ fontSize: `${Math.max(12, Math.round(size / 5.2))}px` }"
          >{{ value }}%</span
        >
      </div>
    </div>
    <span v-if="caption" class="text-xs text-ink-500">{{ caption }}</span>
  </div>
</template>
