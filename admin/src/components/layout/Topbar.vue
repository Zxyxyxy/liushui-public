<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { NAV } from '../../router'
import { resetAll } from '../../stores/persist'

const route = useRoute()

const crumb = computed(() => {
  for (const g of NAV) {
    const hit = g.items.find((i) => i.to === route.path)
    if (hit) return { group: g.label, label: hit.label, deep: hit.deep }
  }
  return { group: '', label: '', deep: false }
})

/** 清完直接重载。六个 store 都是在创建时 load() 一次种进内存的，只清 localStorage
 *  页面不会变，演示的人会以为按钮坏了（实测就是这样：计数还停在 待审 7）。
 *  给每个 store 加 reset() 也行，但漏掉一个就又回到「看着没反应」，重载是确定回到初始态的那条路。 */
function reset() {
  resetAll()
  location.reload()
}
</script>

<template>
  <header
    class="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-water-200/50 bg-white/60 px-6 backdrop-blur-xl"
  >
    <div class="flex min-w-0 items-center gap-2 text-[13px]">
      <span v-if="crumb.group" class="text-ink-300">{{ crumb.group }}</span>
      <span v-if="crumb.group" class="text-ink-300">/</span>
      <span class="truncate font-semibold text-ink-900">{{ crumb.label }}</span>
      <span v-if="crumb.deep === false" class="chip ml-1 !py-0.5 !text-[10px]">占位</span>
    </div>

    <div class="flex shrink-0 items-center gap-2">
      <button
        type="button"
        class="btn-quiet !text-xs"
        title="清空 localStorage 里的演示状态并重载回初始数据"
        @click="reset"
      >
        重置演示状态
      </button>
      <span class="hidden items-center gap-2 lg:flex">
        <span class="text-[11px] text-ink-400">运营 · 你</span>
        <span class="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-water-400 to-water-600 text-[13px]"
          >💧</span
        >
      </span>
    </div>
  </header>
</template>
