<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue'

/** 右侧抽屉。后台的详情视图是抽屉而不是前台那种居中弹窗：
 *  审核时要一边看队列位置一边看详情，弹窗把上下文整块盖掉了。
 *  Escape 关闭 + body 滚动锁沿用前台 Modal 的行为。 */
const props = withDefaults(defineProps<{ open: boolean; width?: string; title?: string; sub?: string }>(), {
  width: 'max-w-3xl',
})
const emit = defineEmits<{ close: [] }>()

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      document.addEventListener('keydown', onKey)
      document.body.style.overflow = 'hidden'
    } else {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKey)
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-100 flex justify-end">
      <div class="absolute inset-0 bg-water-900/30 backdrop-blur-[2px] fade-in" @click="emit('close')" />
      <aside
        role="dialog"
        aria-modal="true"
        class="slide-in relative flex h-full w-full flex-col border-l border-white/70 bg-white/95 shadow-water-lg backdrop-blur-xl"
        :class="width"
      >
        <!-- 抽屉上沿的水线，与前台 Modal 同一条 path -->
        <svg
          class="pointer-events-none absolute -top-px left-0 h-3 w-[200%] animate-[wave_9s_linear_infinite]"
          viewBox="0 0 120 12"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d="M0 6 C 15 0, 30 0, 45 6 S 75 12, 90 6 S 120 0, 120 6 V0 H0Z" fill="#00b4d8" opacity=".35" />
        </svg>

        <header class="flex shrink-0 items-start justify-between gap-4 border-b border-water-100 px-6 py-4">
          <div class="min-w-0">
            <h3 v-if="title" class="truncate text-base font-bold text-ink-900">{{ title }}</h3>
            <p v-if="sub" class="mt-0.5 text-xs text-ink-400">{{ sub }}</p>
            <slot name="head" />
          </div>
          <button
            type="button"
            class="btn-quiet shrink-0 !px-2.5 !py-1 text-base"
            aria-label="关闭"
            @click="emit('close')"
          >
            ✕
          </button>
        </header>

        <div class="min-h-0 flex-1 overflow-y-auto px-6 py-5"><slot /></div>

        <footer
          v-if="$slots.footer"
          class="flex shrink-0 items-center justify-end gap-2 border-t border-water-100 bg-water-50/60 px-6 py-3.5"
        >
          <slot name="footer" />
        </footer>
      </aside>
    </div>
  </Teleport>
</template>

<style scoped>
@keyframes drawer-in {
  from {
    transform: translateX(28px);
    opacity: 0.4;
  }
}
@keyframes drawer-fade {
  from {
    opacity: 0;
  }
}
.slide-in {
  animation: drawer-in 0.32s cubic-bezier(0.22, 1, 0.36, 1) both;
}
.fade-in {
  animation: drawer-fade 0.22s ease-out both;
}
</style>
