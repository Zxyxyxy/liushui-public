<script setup lang="ts">
/** 水滴形积分图标，与前台逐字相同 */
withDefaults(defineProps<{ size?: number }>(), { size: 14 })
</script>

<template>
  <svg viewBox="0 0 24 24" :width="size" :height="size" fill="currentColor" aria-hidden="true" class="shrink-0">
    <path d="M12 2.2c3.6 4.6 6.6 8.3 6.6 11.7A6.6 6.6 0 0 1 12 20.5a6.6 6.6 0 0 1-6.6-6.6C5.4 10.5 8.4 6.8 12 2.2Z" />
  </svg>
</template>
