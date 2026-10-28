import type { Tool, SceneId } from './types'

export function buildToolMap(tools: Tool[]): Record<string, Tool> {
  return Object.fromEntries(tools.map((t) => [t.id, t]))
}

export function toolsByScene(tools: Tool[], scene: SceneId): Tool[] {
  return tools.filter((t) => t.scene === scene)
}

export function relatedTools(tools: Tool[], tool: Tool, n = 4): Tool[] {
  return tools
    .filter((t) => t.id !== tool.id)
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
