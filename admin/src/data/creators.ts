import type { Creator } from './types'

/** id / name / avatar / badge 与前台 app/src/data/creators.ts 完全一致 */
export const CREATORS: Creator[] = [
  {
    id: 'official',
    name: '流水官方',
    avatar: '🌊',
    badge: { label: '平台认证', kind: 'official' },
    toolCount: 18,
    monthlyActiveUsers: 96200,
  },
  {
    id: 'c-linlin',
    name: '林霖学姐',
    avatar: '🐬',
    badge: { label: '专业人士', kind: 'pro' },
    toolCount: 7,
    monthlyActiveUsers: 21800,
  },
  {
    id: 'c-atlas',
    name: 'Atlas 留学工作室',
    avatar: '🧭',
    badge: { label: '机构创作者', kind: 'org' },
    toolCount: 6,
    monthlyActiveUsers: 12400,
  },
  {
    id: 'c-kelvin',
    name: 'Kelvin 老师',
    avatar: '🦑',
    badge: { label: '专业人士', kind: 'pro' },
    toolCount: 5,
    monthlyActiveUsers: 7300,
  },
  {
    id: 'c-you',
    name: '你',
    avatar: '💧',
    badge: { label: '个人创作者', kind: 'personal' },
    toolCount: 3,
    monthlyActiveUsers: 412,
  },
  {
    id: 'c-nimbus',
    name: 'Nimbus Data',
    avatar: '☁️',
    badge: { label: '企业创作者', kind: 'company' },
    toolCount: 4,
    monthlyActiveUsers: 11100,
  },
]

export const CREATOR_MAP: Record<string, Creator> = Object.fromEntries(CREATORS.map((c) => [c.id, c]))

export const BADGE_STYLE: Record<string, string> = {
  official: 'bg-water-600 text-white',
  pro: 'bg-accent-violet/15 text-accent-violet',
  org: 'bg-water-100 text-water-700',
  company: 'bg-accent-mint/15 text-accent-mint',
  personal: 'bg-water-100/70 text-ink-500',
}

/* 场景元数据也与前台同源 */
export const SCENE_LABEL: Record<string, string> = {
  study: '学习提效',
  job: '求职实习',
  abroad: '留学申请',
  exam: '学习考试',
}

export const SCENE_ICON: Record<string, string> = {
  study: '📚',
  job: '💼',
  abroad: '🌏',
  exam: '🎯',
}

export const SCENE_ACCENT: Record<string, string> = {
  study: 'var(--color-water-500)',
  job: 'var(--color-accent-coral)',
  abroad: 'var(--color-accent-violet)',
  exam: 'var(--color-accent-mint)',
}

export const KIND_LABEL: Record<string, string> = {
  tool: '单点工具',
  expert: 'AI 专家',
  workflow: '工作流',
}
