import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'

/* 侧栏直接从这份结构生成，路由和导航只有一个事实来源。
   deep: true 是这一版做深的六个模块；其余是占位。 */

export interface NavEntry {
  to: string
  label: string
  icon: string
  deep?: boolean
  /** 徽标取哪个待处理计数，由 Sidebar 去 store 里查 */
  badge?: 'pendingTools' | 'pendingPosts' | 'pendingSettlements' | 'staleSources'
}

export interface NavGroup {
  label: string
  items: NavEntry[]
}

export const NAV: NavGroup[] = [
  {
    label: '',
    items: [{ to: '/', label: '总览', icon: '◎' }],
  },
  {
    label: '审核',
    items: [
      { to: '/review/tools', label: '工具审核', icon: '⬡', deep: true, badge: 'pendingTools' },
      { to: '/review/content', label: '内容审核', icon: '✎', badge: 'pendingPosts' },
    ],
  },
  {
    label: '创作者',
    items: [
      { to: '/creators', label: '创作者列表', icon: '☰' },
      { to: '/creators/settlement', label: '月度结算', icon: '₵', deep: true, badge: 'pendingSettlements' },
    ],
  },
  {
    label: '质量',
    items: [{ to: '/quality/demand', label: '需求池', icon: '◍', deep: true }],
  },
  {
    label: '供给',
    items: [{ to: '/supply/scenes', label: '场景配置', icon: '⚙' }],
  },
  {
    label: '数据',
    items: [{ to: '/sources', label: '数据源台账', icon: '⛁', deep: true, badge: 'staleSources' }],
  },
  {
    label: '系统',
    items: [
      { to: '/system/audit', label: '操作审计', icon: '⏱' },
      { to: '/system/users', label: '用户与工单', icon: '☺' },
    ],
  },
]

const routes: RouteRecordRaw[] = [
  { path: '/', name: 'dashboard', component: () => import('../pages/Dashboard.vue') },
  { path: '/review/tools', name: 'tool-review', component: () => import('../pages/ToolReview.vue') },
  { path: '/review/content', name: 'content-review', component: () => import('../pages/ContentReview.vue') },
  { path: '/creators', name: 'creators', component: () => import('../pages/CreatorList.vue') },
  { path: '/creators/settlement', name: 'settlement', component: () => import('../pages/Settlement.vue') },
  { path: '/quality/demand', name: 'demand', component: () => import('../pages/DemandPool.vue') },
  { path: '/supply/scenes', name: 'scenes', component: () => import('../pages/SceneConfig.vue') },
  { path: '/sources', name: 'sources', component: () => import('../pages/DataSources.vue') },
  { path: '/system/audit', name: 'audit', component: () => import('../pages/AuditLog.vue') },
  { path: '/system/users', name: 'users', component: () => import('../pages/Users.vue') },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

export const router = createRouter({
  // hash 模式：这版 demo 大概率被直接 `npm run build` 后用 file:// 或任意静态目录打开，
  // history 模式在没有 rewrite 的静态服务上刷新即 404。
  history: createWebHashHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})
