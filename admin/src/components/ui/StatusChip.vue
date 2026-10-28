<script setup lang="ts">
import { computed } from 'vue'

/** 后台状态标。色只用色板里已有的：水色=进行中/中性，mint=通过，coral=打回/告警，sun=待处理，violet=信息。 */
export type Tone = 'ok' | 'warn' | 'pending' | 'info' | 'muted' | 'bad'

const props = withDefaults(defineProps<{ tone?: Tone; label: string; dot?: boolean }>(), {
  tone: 'muted',
  dot: true,
})

const style = computed(
  () =>
    ({
      ok: { bg: 'bg-accent-mint/12', text: 'text-accent-mint', dot: 'bg-accent-mint' },
      warn: { bg: 'bg-accent-coral/12', text: 'text-accent-coral', dot: 'bg-accent-coral' },
      bad: { bg: 'bg-accent-coral/18', text: 'text-accent-coral', dot: 'bg-accent-coral' },
      pending: { bg: 'bg-accent-sun/18', text: 'text-[#a97a00]', dot: 'bg-accent-sun' },
      info: { bg: 'bg-accent-violet/12', text: 'text-accent-violet', dot: 'bg-accent-violet' },
      muted: { bg: 'bg-water-100/80', text: 'text-water-700', dot: 'bg-water-400' },
    })[props.tone],
)
</script>

<template>
  <span
    class="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold"
    :class="[style.bg, style.text]"
  >
    <span v-if="dot" class="dot" :class="style.dot" />
    {{ label }}
  </span>
</template>
