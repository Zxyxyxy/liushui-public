import type { Tool } from '../data/types'
import { searchSkills } from './api'
import { routeIntent as routeIntentLocal, type IntentResult } from './intent'

/**
 * 带后端检索增强的意图识别
 *
 * 策略：
 * 1. 先调用后端检索 API 获取匹配的 skill_id 列表
 * 2. 用传入的 skillsMap 查找对应的完整 Tool 对象
 * 3. 保留原有的意图分类逻辑（simple/multi/longterm）
 * 4. 如果后端调用失败，降级到纯前端关键词匹配
 */

/** 多步骤信号 */
const MULTI_HINTS = ['然后', '再', '整套', '一条龙', '全流程', '从头到尾', '准备好', '完整', '并且', '同时', '之后']

/** 长期目标信号 */
const LONGTERM_HINTS = ['规划', '长期', '一整个', '整个', '几个月', '半年', '一年', '倒计时', '天内', '持续', '跟进', '管理', '每天', '每周']

export async function routeIntentWithApi(input: string, skillsMap: Record<string, Tool>): Promise<IntentResult> {
  const q = input.trim()

  try {
    // 调用后端检索
    const response = await searchSkills(q, 8)

    if (response.success && response.results.length > 0) {
      // 将后端返回的 skill_id 映射到前端的 Tool 对象
      const tools: Tool[] = response.results
        .map((r) => skillsMap[r.skill_id])
        .filter((t): t is Tool => t !== undefined)
        .slice(0, 4)

      if (tools.length > 0) {
        // 意图分类
        const isLong = LONGTERM_HINTS.some((w) => q.includes(w))
        const isMulti = MULTI_HINTS.some((w) => q.includes(w)) || q.length > 34

        let type: IntentResult['type'] = 'simple'
        let read = ''
        const because: string[] = []

        // 显示后端匹配得分
        const topScore = response.results[0]?.score
        if (topScore !== undefined) {
          because.push(`后端检索匹配度：${(topScore * 100).toFixed(0)}%`)
        }

        if (isLong) {
          type = 'longterm'
          read = '这是一个需要持续推进的长期目标，建议建工作台管起来。'
          because.push('包含时间跨度或持续推进的表述')
        } else if (isMulti) {
          type = 'multi'
          read = '这件事需要好几步才能做完，推荐用工作流一次跑通。'
          because.push('包含多个连续动作，单个工具覆盖不全')
        } else {
          read = '这是一个边界清晰的任务，一个工具跑一次就能完成。'
          because.push('目标单一，一次运行即可交付结果')
        }

        // 检测场景
        const scene = tools[0].scene

        return {
          type,
          read,
          because,
          scene,
          tools,
          totalCredits: tools.reduce((s, t) => s + t.credits, 0),
        }
      }
    }
  } catch (error) {
    console.warn('后端检索失败，降级到本地匹配:', error)
  }

  // 降级到纯前端匹配
  const allTools = Object.values(skillsMap)
  return routeIntentLocal(input, allTools)
}
