<script setup lang="ts">
import { computed } from 'vue'
import { NAV } from '../../router'
import { useReviewStore } from '../../stores/review'
import { useSettleStore } from '../../stores/settle'
import { useSourceStore } from '../../stores/sources'

const review = useReviewStore()
const settle = useSettleStore()
const sources = useSourceStore()

/** 徽标数全部从 store 实时算，不写死 */
const badges = computed<Record<string, number>>(() => ({
  pendingTools: review.pending.length,
  pendingPosts: 3,
  pendingSettlements: settle.pending.length,
  staleSources: sources.stale.length,
}))
</script>

<template>
  <aside class="flex h-full w-[212px] shrink-0 flex-col border-r border-water-200/50 bg-white/55 backdrop-blur-xl">
    <div class="flex items-center gap-2.5 px-4 py-4">
      <span class="text-xl leading-none">🌊</span>
      <div class="min-w-0">
        <p class="text-[15px] font-bold leading-tight text-ink-900">流水</p>
        <p class="text-[10px] leading-tight text-ink-400">管理后台</p>
      </div>
    </div>

    <nav class="no-scrollbar min-h-0 flex-1 overflow-y-auto px-2.5 pb-4">
      <div v-for="(g, gi) in NAV" :key="gi" class="mb-1">
        <p v-if="g.label" class="px-3 pb-1 pt-3 text-[10px] font-semibold tracking-widest text-ink-300">
          {{ g.label }}
        </p>
        <RouterLink
          v-for="it in g.items"
          :key="it.to"
          :to="it.to"
          class="nav-item"
          active-class="on"
          exact-active-class="on"
        >
          <span class="w-3.5 shrink-0 text-center text-[13px] opacity-80">{{ it.icon }}</span>
          <span class="min-w-0 flex-1 truncate">{{ it.label }}</span>
          <!-- 徽标数全部从 store 实时算 -->
          <span
            v-if="it.badge && badges[it.badge]"
            class="shrink-0 rounded-full bg-accent-coral px-1.5 text-[10px] font-bold leading-[16px] text-white tabular-nums"
            >{{ badges[it.badge] }}</span
          >
        </RouterLink>
      </div>
    </nav>

    <div class="border-t border-water-100 px-4 py-3">
      <p class="text-[10px] leading-relaxed text-ink-300">形态 demo，数据均为构造。</p>
    </div>
  </aside>
</template>
