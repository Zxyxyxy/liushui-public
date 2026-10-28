<script setup lang="ts">
import { useUiStore } from '../../stores/ui'

const ui = useUiStore()
</script>

<template>
  <Teleport to="body">
    <div
      v-if="ui.toasts.length"
      class="pointer-events-none fixed bottom-6 left-1/2 z-200 flex -translate-x-1/2 flex-col items-center gap-2"
    >
      <div
        v-for="t in ui.toasts"
        :key="t.id"
        class="glass-deep flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium shadow-water-lg"
        style="animation: rise 0.3s cubic-bezier(0.22, 1, 0.36, 1) both"
      >
        <span
          class="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] text-white"
          :style="{
            background:
              t.tone === 'warn'
                ? 'var(--color-accent-coral)'
                : t.tone === 'info'
                  ? 'var(--color-ink-400)'
                  : 'var(--color-water-500)',
          }"
          >{{ t.tone === 'warn' ? '!' : '✓' }}</span
        >
        <span class="text-ink-700">{{ t.text }}</span>
      </div>
    </div>
  </Teleport>
</template>
