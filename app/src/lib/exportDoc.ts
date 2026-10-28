import { authFetch } from './auth'

/** full 完整结果 / resume 只要「完整优化版简历」/ practice 每题留作答框 */
export type ExportMode = 'full' | 'resume' | 'practice'
export type ExportFormat = 'docx' | 'pdf'

async function errorOf(resp: Response, fallback: string) {
  try { return (await resp.json()).error || fallback } catch { return fallback }
}

/** 下载 Word / PDF：点了才让服务端现转。返回错误文案，成功返回 null */
export async function downloadExport(outputId: string, format: ExportFormat, mode: ExportMode): Promise<string | null> {
  try {
    const resp = await authFetch(`/ws-outputs/${encodeURIComponent(outputId)}/export?format=${format}&mode=${mode}`)
    if (!resp.ok) return await errorOf(resp, '下载失败，稍后再试')
    const m = resp.headers.get('Content-Disposition')?.match(/filename\*=UTF-8''([^;]+)/i)
    let name = `结果.${format}`
    try { if (m) name = decodeURIComponent(m[1]) } catch { /* 用默认名 */ }
    const url = URL.createObjectURL(await resp.blob())
    const a = document.createElement('a')
    a.href = url
    a.download = name
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    return null
  } catch {
    return '连不上服务器，稍后再试'
  }
}
