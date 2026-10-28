<script setup lang="ts">
/** 与前台 Tabs 同一观感：胶囊行，选中态是 water-500→400 渐变。后台把 py 从 2 收到 1.5。 */
export interface Tab {
  id: string
  label: string
  count?: number
}

defineProps<{ tabs: Tab[]; modelValue: string }>()
defineEmits<{ 'update:modelValue': [v: string] }>()
</script>

<template>
  <div
    class="no-scrollbar inline-flex gap-1 overflow-x-auto rounded-full border border-water-200/70 bg-white/60 p-1 backdrop-blur"
  >
    <button
      v-for="t in tabs"
      :key="t.id"
      type="button"
      class="shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-all duration-300"
      :class="
        modelValue === t.id
          ? 'bg-gradient-to-r from-water-500 to-water-400 text-white shadow-[0_6px_18px_-6px_rgba(0,180,216,.8)]'
          : 'text-ink-500 hover:bg-water-100/70 hover:text-water-700'
      "
      @click="$emit('update:modelValue', t.id)"
    >
      {{ t.label }}
      <span
        v-if="t.count !== undefined"
        class="ml-1.5 text-xs tabular-nums"
        :class="modelValue === t.id ? 'text-white/80' : 'text-ink-300'"
        >{{ t.count }}</span
      >
    </button>
  </div>
</template>
