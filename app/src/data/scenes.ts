import type { Scene, SceneId } from './types'

/** 文档 3.2：首期四大场景 */
export const SCENES: Scene[] = [
  {
    id: 'study',
    name: '学习提效',
    short: '提效',
    tagline: 'PPT、汇报、笔记、润色，把作业时间还给你',
    icon: '📚',
    accent: 'var(--color-water-500)',
    gradient: 'from-water-400/85 via-water-500/80 to-water-600/85',
  },
  {
    id: 'job',
    name: '求职实习',
    short: '求职',
    tagline: '简历、JD 匹配、面试模拟，一路陪到 offer',
    icon: '💼',
    accent: 'var(--color-accent-coral)',
    gradient: 'from-accent-coral/80 via-water-400/75 to-water-600/85',
  },
  {
    id: 'abroad',
    name: '留学申请',
    short: '留学',
    tagline: '选校、文书、时间线，把申请季理顺',
    icon: '🌏',
    accent: 'var(--color-accent-violet)',
    gradient: 'from-accent-violet/75 via-water-500/80 to-water-700/85',
  },
  {
    id: 'exam',
    name: '学习考试',
    short: '考试',
    tagline: '计划、总结、错题、进度，稳稳推进',
    icon: '🎯',
    accent: 'var(--color-accent-mint)',
    gradient: 'from-accent-mint/80 via-water-400/78 to-water-600/85',
  },
]

export const SCENE_MAP: Record<SceneId, Scene> = Object.fromEntries(
  SCENES.map((s) => [s.id, s]),
) as Record<SceneId, Scene>

export const KIND_LABEL: Record<string, string> = {
  tool: '单点工具',
  expert: 'AI 专家',
  workflow: '工作流',
}

export const KIND_ICON: Record<string, string> = {
  tool: '🧩',
  expert: '💬',
  workflow: '🔗',
}
