import type { Tool } from '../data/types'
import { searchSkills } from './api'

/**
 * 带后端检索增强的工具搜索
 *
 * 用于 Market 页面的搜索框
 * - 优先调用后端检索 API
 * - 失败时降级到前端关键词匹配
 */

export async function searchToolsWithApi(
  query: string,
  localTools: Tool[],
  skillsMap: Record<string, Tool>,
  topK: number = 20
): Promise<Tool[]> {
  const q = query.trim()
  if (!q) return localTools

  try {
    // 调用后端检索
    const response = await searchSkills(q, topK)

    if (response.success && response.results.length > 0) {
      // 将后端返回的 skill_id 映射到前端的 Tool 对象
      const tools: Tool[] = response.results
        .map((r) => skillsMap[r.skill_id])
        .filter((t): t is Tool => t !== undefined)

      if (tools.length > 0) {
        return tools
      }
    }
  } catch (error) {
    console.warn('后端检索失败，使用前端匹配:', error)
  }

  // 降级到前端关键词匹配
  const kw = q.toLowerCase()
  return localTools.filter((t) => {
    const hay = [t.name, t.promise, ...t.tags, ...t.goodFor, ...t.needs].join(' ').toLowerCase()
    return hay.includes(kw)
  })
}
