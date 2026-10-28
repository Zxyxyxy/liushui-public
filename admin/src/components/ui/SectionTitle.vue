<script setup lang="ts">
defineProps<{ title: string; sub?: string }>()
</script>

<template>
  <div class="mb-5 flex items-end justify-between gap-4">
    <div>
      <h2 class="text-xl font-bold text-ink-900">{{ title }}</h2>
      <!-- 副标题只放一句「这一页要干什么」。理由（PRD 章节、D 几、难点几）都回 README ——
           界面上每页顶一段说明，连着翻五页就没人看了。 -->
      <p v-if="sub" class="note mt-1.5 max-w-xl">{{ sub }}</p>
      <div class="rule-water mt-2.5 w-14" />
    </div>
    <div v-if="$slots.action" class="shrink-0"><slot name="action" /></div>
  </div>
</template>
