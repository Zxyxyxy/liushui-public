<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

/** 数字滚动到目标值。requestAnimationFrame + 三次缓出，620ms，与前台顶部积分余额同一实现。
 *  前台只在余额变化时滚；总览页的四个北极星指标要进场就滚，所以多一个 fromZero。 */
const props = withDefaults(
  defineProps<{
    value: number
    decimals?: number
    fromZero?: boolean
  }>(),
  { decimals: 0, fromZero: false },
)

const n = ref(props.fromZero ? 0 : props.value)
let prev = n.value
let raf = 0

function run(to: number) {
  const from = prev
  prev = to
  if (from === to) return
  cancelAnimationFrame(raf)
  const start = performance.now()
  const dur = 620
  const tick = (t: number) => {
    const p = Math.min(1, (t - start) / dur)
    const eased = 1 - Math.pow(1 - p, 3)
    n.value = from + (to - from) * eased
    if (p < 1) raf = requestAnimationFrame(tick)
    else n.value = to
  }
  raf = requestAnimationFrame(tick)
}

onMounted(() => {
  if (props.fromZero) run(props.value)
})
watch(() => props.value, run)
onBeforeUnmount(() => cancelAnimationFrame(raf))

function show(v: number): string {
  return props.decimals > 0
    ? v.toLocaleString('zh-CN', {
        minimumFractionDigits: props.decimals,
        maximumFractionDigits: props.decimals,
      })
    : Math.round(v).toLocaleString('zh-CN')
}
</script>

<template>
  <span class="tabular-nums">{{ show(n) }}</span>
</template>
