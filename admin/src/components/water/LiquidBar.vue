<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

/** 液面填充进度条。React 版是 useState + setTimeout(…, 60)，这里是 ref + onMounted，行为一致。 */
const props = withDefaults(
  defineProps<{
    value: number
    label?: string
    tone?: string
    height?: number
    /** 后台表格内联使用时不需要百分号文字 */
    bare?: boolean
  }>(),
  { tone: '#00b4d8', height: 10, bare: false },
)

const w = ref(0)
let timer: number | undefined

/** 前台传的是 `#00b4d8` 这类十六进制，直接拼 `aa` 就得到带透明度的色；
 *  但后台到处传的是 `var(--color-water-500)`，拼出来是非法 CSS，整条渐变会被丢掉（进度条看着就是空的）。
 *  用 color-mix 让两种写法都成立，67% ≈ 原来的 aa。 */
const soft = computed(() => `color-mix(in srgb, ${props.tone} 67%, transparent)`)

function animateTo(v: number) {
  window.clearTimeout(timer)
  timer = window.setTimeout(() => (w.value = v), 60)
}

onMounted(() => animateTo(props.value))
watch(() => props.value, animateTo)
</script>

<template>
  <div>
    <div v-if="label && !bare" class="mb-1.5 flex items-baseline justify-between text-xs">
      <span class="text-ink-500">{{ label }}</span>
      <span class="font-semibold tabular-nums" :style="{ color: tone }">{{ value }}%</span>
    </div>
    <div
      class="relative w-full overflow-hidden rounded-full bg-water-100/80"
      :style="{ height: `${height}px` }"
      role="progressbar"
      :aria-valuenow="value"
      :aria-valuemin="0"
      :aria-valuemax="100"
    >
      <div
        class="relative h-full rounded-full transition-[width] duration-1000 ease-out"
        :style="{ width: `${w}%`, background: `linear-gradient(90deg, ${soft}, ${tone})` }"
      >
        <!-- 液面上掠过的高光 -->
        <div
          class="absolute inset-0 rounded-full opacity-70"
          style="
            background-image: linear-gradient(100deg, transparent 20%, rgba(255, 255, 255, 0.75) 50%, transparent 80%);
            background-size: 200% 100%;
            animation: shimmer 2.4s linear infinite;
          "
        />
      </div>
    </div>
  </div>
</template>
