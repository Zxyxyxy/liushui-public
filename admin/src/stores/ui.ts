import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface Toast {
  id: number
  text: string
  tone: 'default' | 'warn' | 'info'
}

/** 与前台 AppContext 的 toast 行为一致：底部居中，2.4s 自动消失 */
export const useUiStore = defineStore('ui', () => {
  const toasts = ref<Toast[]>([])
  let seq = 0

  function toast(text: string, tone: Toast['tone'] = 'default') {
    const id = ++seq
    toasts.value.push({ id, text, tone })
    window.setTimeout(() => {
      toasts.value = toasts.value.filter((t) => t.id !== id)
    }, 2400)
  }

  return { toasts, toast }
})
