import type { Creator } from './types'

export const CREATORS: Creator[] = [
  {
    id: 'official',
    name: '流水官方',
    avatar: '🌊',
    badge: { label: '平台认证', kind: 'official' },
    bio: '平台自营工具，覆盖学习提效、求职、留学、考试四大场景，稳定可用。',
    followers: 128400,
    toolCount: 18,
    monthlyActiveUsers: 96200,
  },
  {
    id: 'c-linlin',
    name: '林霖学姐',
    avatar: '🐬',
    badge: { label: '专业人士', kind: 'pro' },
    bio: '前字节 HRBP，看过三万份简历。做的都是能真正过筛的求职工具。',
    followers: 34200,
    toolCount: 7,
    monthlyActiveUsers: 21800,
  },
  {
    id: 'c-atlas',
    name: 'Atlas 留学工作室',
    avatar: '🧭',
    badge: { label: '机构创作者', kind: 'org' },
    bio: '十年英美申请经验，专注选校定位与文书逻辑诊断。',
    followers: 18900,
    toolCount: 6,
    monthlyActiveUsers: 12400,
  },
  {
    id: 'c-kelvin',
    name: 'Kelvin 老师',
    avatar: '🦑',
    badge: { label: '专业人士', kind: 'pro' },
    bio: '高校教师，负责本科课程设计。做课堂与汇报相关的提效工具。',
    followers: 9600,
    toolCount: 5,
    monthlyActiveUsers: 7300,
  },
  {
    id: 'c-you',
    name: '你',
    avatar: '💧',
    badge: { label: '个人创作者', kind: 'personal' },
    bio: '刚起步的创作者。先把一个工具做扎实，再谈第二个。',
    followers: 268,
    toolCount: 3,
    monthlyActiveUsers: 412,
  },
  {
    id: 'c-nimbus',
    name: 'Nimbus Data',
    avatar: '☁️',
    badge: { label: '企业创作者', kind: 'company' },
    bio: '数据分析团队出品，Excel 与表格自动化方向。',
    followers: 15300,
    toolCount: 4,
    monthlyActiveUsers: 11100,
  },
]

export const CREATOR_MAP: Record<string, Creator> = Object.fromEntries(
  CREATORS.map((c) => [c.id, c]),
)

export const BADGE_STYLE: Record<string, string> = {
  official: 'bg-water-600 text-white',
  pro: 'bg-accent-violet/15 text-accent-violet',
  org: 'bg-water-100 text-water-700',
  company: 'bg-accent-mint/15 text-accent-mint',
  personal: 'bg-water-100/70 text-ink-500',
}
