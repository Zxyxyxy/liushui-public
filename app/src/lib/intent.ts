import type { SceneId, Tool } from '../data/types'

export type IntentType = 'simple' | 'multi' | 'longterm'

export interface IntentResult {
  type: IntentType
  /** 给用户看的一句话判断 */
  read: string
  /** 判断依据，让推荐可解释 */
  because: string[]
  scene: SceneId
  tools: Tool[]
  totalCredits: number
}

/** 关键词 → 场景，命中越多权重越高 */
const SCENE_HINTS: Record<SceneId, string[]> = {
  job: ['简历', '求职', '实习', '面试', '秋招', '春招', 'offer', 'JD', '岗位', '投递', '自我介绍', '笔试', '校招', '转正'],
  abroad: ['留学', '申请', '选校', '文书', 'PS', '推荐信', '雅思', '托福', 'GPA', '研究生', '硕士', '英国', '美国', '香港', '新加坡', '澳洲', '专业'],
  exam: ['考研', '复习', '考试', '错题', '刷题', '备考', '计划', '期末', '背书', '进度', '上岸'],
  study: ['PPT', 'ppt', '汇报', '作业', 'Excel', 'excel', '表格', '公式', '笔记', '论文', '润色', '英文', '课件', '总结', '讲稿', '演讲', '答辩'],
}

/** 多步骤信号：出现这些词说明不是一次运行能完成的 */
const MULTI_HINTS = ['然后', '再', '整套', '一条龙', '全流程', '从头到尾', '准备好', '完整', '并且', '同时', '之后']

/** 长期目标信号 */
const LONGTERM_HINTS = ['规划', '长期', '一整个', '整个', '几个月', '半年', '一年', '倒计时', '天内', '持续', '跟进', '管理', '每天', '每周']

export function routeIntent(input: string, allTools: Tool[]): IntentResult {
  const q = input.trim()
  const scene = detectScene(q)
  const because: string[] = []

  // 直接匹配到的工具优先
  const scored = allTools.map((t) => {
    let s = 0
    if (t.scene === scene) s += 4
    for (const tag of t.tags) if (q.includes(tag)) s += 5
    if (q.includes(t.name)) s += 12
    for (const w of t.name) if (q.includes(w)) s += 0.4
    for (const g of t.goodFor) {
      const key = g.slice(0, 3)
      if (key && q.includes(key)) s += 3
    }
    return { t, s }
  })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || b.t.users - a.t.users)

  const hitWords = Object.values(SCENE_HINTS)
    .flat()
    .filter((w) => q.includes(w))
    .slice(0, 4)
  if (hitWords.length) because.push(`识别到关键词：${hitWords.join('、')}`)

  const isLong = LONGTERM_HINTS.some((w) => q.includes(w))
  const isMulti = MULTI_HINTS.some((w) => q.includes(w)) || q.length > 34

  let type: IntentType = 'simple'
  let read = ''

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

  // 按意图类型挑推荐
  let tools: Tool[]
  if (type === 'multi') {
    const wf = scored.filter((x) => x.t.kind === 'workflow').map((x) => x.t)
    const rest = scored.filter((x) => x.t.kind !== 'workflow').map((x) => x.t)
    const fallbackWf = allTools.filter((t) => t.kind === 'workflow' && t.scene === scene)
    tools = dedupe([...wf, ...fallbackWf, ...rest]).slice(0, 4)
  } else if (type === 'longterm') {
    const experts = scored.filter((x) => x.t.kind === 'expert').map((x) => x.t)
    const rest = scored.map((x) => x.t)
    const fallbackExpert = allTools.filter((t) => t.kind === 'expert' && t.scene === scene)
    tools = dedupe([...experts, ...fallbackExpert, ...rest]).slice(0, 4)
  } else {
    tools = dedupe(scored.map((x) => x.t)).slice(0, 4)
  }

  // 什么都没匹配上就给该场景的热门
  if (tools.length === 0) {
    tools = allTools.filter((t) => t.scene === scene)
      .sort((a, b) => b.users - a.users)
      .slice(0, 4)
    because.push('未识别到具体工具，先按场景热度推荐')
  }

  return {
    type,
    read,
    because,
    scene,
    tools,
    totalCredits: tools.reduce((s, t) => s + t.credits, 0),
  }
}

function detectScene(q: string): SceneId {
  let best: SceneId = 'study'
  let bestScore = 0
  for (const [id, words] of Object.entries(SCENE_HINTS) as [SceneId, string[]][]) {
    const score = words.reduce((s, w) => s + (q.includes(w) ? w.length : 0), 0)
    if (score > bestScore) {
      bestScore = score
      best = id
    }
  }
  return best
}

function dedupe(list: Tool[]): Tool[] {
  const seen = new Set<string>()
  return list.filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true)))
}

export const INTENT_LABEL: Record<IntentType, { label: string; icon: string; tone: string }> = {
  simple: { label: '单点任务', icon: '🧩', tone: 'var(--color-water-500)' },
  multi: { label: '多步骤任务', icon: '🔗', tone: 'var(--color-accent-violet)' },
  longterm: { label: '长期目标', icon: '🎯', tone: 'var(--color-accent-mint)' },
}

/** 首页示例需求，点一下直接填入 */
export const SAMPLE_INTENTS = [
  '下周要交一份 10 分钟的课程汇报，还没开始做 PPT',
  '想投字节的产品经理实习，但简历一直没有回音',
  'GPA 3.4 想申英国商业分析，不知道能上什么学校',
  '考研还有 100 天，三科并行不知道怎么排计划',
  '接手了学姐的社团账表，有条公式看不懂',
  '简历改完之后还要准备自我介绍和面试问题',
]
