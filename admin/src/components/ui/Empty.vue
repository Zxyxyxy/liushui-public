<script setup lang="ts">
withDefaults(defineProps<{ icon?: string; title: string; sub?: string }>(), { icon: '💧' })
</script>

<template>
  <div class="flex flex-col items-center gap-2 px-6 py-14 text-center">
    <div class="text-3xl animate-[bob_6s_ease-in-out_infinite]">{{ icon }}</div>
    <p class="text-sm font-semibold text-ink-700">{{ title }}</p>
    <p v-if="sub" class="max-w-sm text-xs leading-relaxed text-ink-400">{{ sub }}</p>
  </div>
</template>
