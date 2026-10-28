<script setup lang="ts">
/** 大面积流动的水色光斑背景 + 水下焦散光纹。后台只在总览页头出现。 */
</script>

<template>
  <div class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
    <div
      class="absolute -left-[10%] -top-[30%] h-[520px] w-[520px] rounded-full blur-3xl animate-[drift_24s_ease-in-out_infinite]"
      style="background: radial-gradient(circle, rgba(0, 180, 216, 0.35), transparent 65%)"
    />
    <div
      class="absolute -right-[8%] top-[8%] h-[460px] w-[460px] rounded-full blur-3xl animate-[drift_34s_ease-in-out_infinite_reverse]"
      style="background: radial-gradient(circle, rgba(144, 224, 239, 0.5), transparent 65%)"
    />
    <div
      class="absolute bottom-[-25%] left-[28%] h-[440px] w-[440px] rounded-full blur-3xl animate-[drift_28s_ease-in-out_infinite]"
      style="background: radial-gradient(circle, rgba(202, 240, 248, 0.65), transparent 68%)"
    />
    <div
      class="absolute inset-0 animate-[caustic_18s_ease-in-out_infinite] mix-blend-soft-light"
      style="
        background-image: repeating-radial-gradient(
            circle at 30% 20%,
            rgba(255, 255, 255, 0.5) 0 2px,
            transparent 2px 42px
          ),
          repeating-radial-gradient(circle at 72% 68%, rgba(255, 255, 255, 0.4) 0 2px, transparent 2px 56px);
      "
    />
  </div>
</template>
