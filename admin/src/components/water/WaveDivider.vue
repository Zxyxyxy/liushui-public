<script setup lang="ts">
/** 分区之间的波浪分隔线，两层不同速度叠加。后台只在总览页头出现。 */
withDefaults(
  defineProps<{
    flip?: boolean
    from?: string
    to?: string
  }>(),
  { flip: false, from: '#caf0f8', to: '#90e0ef' },
)
</script>

<template>
  <div
    class="pointer-events-none relative h-16 w-full overflow-hidden"
    :style="{ transform: flip ? 'scaleY(-1)' : undefined }"
    aria-hidden="true"
  >
    <svg
      class="absolute inset-x-0 bottom-0 h-full w-[200%] animate-[wave_18s_linear_infinite]"
      viewBox="0 0 1440 80"
      preserveAspectRatio="none"
      fill="none"
    >
      <path
        d="M0 40 C 120 10, 240 10, 360 40 S 600 70, 720 40 S 960 10, 1080 40 S 1320 70, 1440 40 V80 H0Z"
        :fill="from"
        opacity="0.55"
      />
    </svg>
    <svg
      class="absolute inset-x-0 bottom-0 h-full w-[200%] animate-[wave_26s_linear_infinite_reverse]"
      viewBox="0 0 1440 80"
      preserveAspectRatio="none"
      fill="none"
    >
      <path
        d="M0 50 C 150 25, 300 25, 450 50 S 750 75, 900 50 S 1200 25, 1440 50 V80 H0Z"
        :fill="to"
        opacity="0.4"
      />
    </svg>
  </div>
</template>
