<script setup lang="ts">
import SectionTitle from './SectionTitle.vue'
import StatusChip from './StatusChip.vue'

/** 只读页的统一外壳。
 *  「这一页该有什么」和「为什么这版先不做」是给开发看的 TODO，不进产品界面 ——
 *  运营打开一页只想看数据，不想读一份路线图。要追还缺什么回 README。 */
defineProps<{
  title: string
  sub: string
}>()
</script>

<template>
  <div class="px-6 pb-10 pt-6">
    <SectionTitle :title="title" :sub="sub">
      <template #action><StatusChip tone="muted" label="只读" /></template>
    </SectionTitle>

    <div class="panel animate-rise p-5">
      <slot />
    </div>
  </div>
</template>
