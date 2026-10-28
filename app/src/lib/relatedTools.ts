import type { Tool } from '../data/types'

export function relatedTools(tool: Tool, allTools: Tool[], n = 4): Tool[] {
  return allTools.filter((t) => t.id !== tool.id)
    .map((t) => {
      let score = 0
      if (t.scene === tool.scene) score += 3
      if (t.kind === tool.kind) score += 1
      score += t.tags.filter((tag) => tool.tags.includes(tag)).length * 2
      return { t, score }
    })
    .sort((a, b) => b.score - a.score || b.t.users - a.t.users)
    .slice(0, n)
    .map((x) => x.t)
}
