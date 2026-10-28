<script setup lang="ts">
import Sidebar from './components/layout/Sidebar.vue'
import Topbar from './components/layout/Topbar.vue'
import Toasts from './components/ui/Toasts.vue'
</script>

<template>
  <div class="flex h-screen overflow-hidden">
    <Sidebar />
    <div class="flex min-w-0 flex-1 flex-col">
      <Topbar />
      <main class="no-scrollbar min-h-0 flex-1 overflow-y-auto">
        <RouterView v-slot="{ Component, route }">
          <!-- key 到路径：换页时重新入场，与前台的 animate-rise 一致 -->
          <component :is="Component" :key="route.path" />
        </RouterView>
      </main>
    </div>
    <Toasts />
  </div>
</template>
