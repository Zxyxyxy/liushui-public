import type { DataSource } from './types'

/* ============================================================
   数据源台账（构造数据）

   两条硬约束：
   - PRD §八：外部数据是权限，不是默认能力 —— 所以有 grant 列，默认不给
   - PRD §八 + 难点 4：留学、招聘、政策类结果必须保留数据来源和更新时间

   更新频率与展示要求照抄难点 4 的数据时效分级表。
   maxAgeDays 是「允许多久不更新」，超了就是过期，页面标红。
   签证政策是事件驱动，没有固定周期（maxAgeDays: null），改用强制展示日期兜底 ——
   拿不准新不新的时候，至少让用户看见这条是什么时候抓的。
   ============================================================ */

export const SOURCES: DataSource[] = [
  {
    id: 'ds-school',
    name: '学校与专业基础信息',
    cadence: '年更',
    lastUpdated: '2026-03-12',
    maxAgeDays: 365,
    usedBy: ['选校定位', '学校对比', '专业匹配'],
    grant: 'granted',
    mustShowDate: true,
    owner: '官网抓取 · 留学组',
  },
  {
    id: 'ds-deadline',
    name: '申请截止日期',
    cadence: '季更',
    lastUpdated: '2026-06-30',
    maxAgeDays: 92,
    usedBy: ['申请时间线', '材料清单', '选校定位'],
    grant: 'granted',
    mustShowDate: true,
    owner: '官网抓取 · 留学组',
  },
  {
    id: 'ds-admission',
    name: '录取要求（GPA、语言）',
    cadence: '年更',
    lastUpdated: '2025-09-02',
    maxAgeDays: 365,
    usedBy: ['背景评估', '选校定位'],
    grant: 'granted',
    mustShowDate: true,
    owner: '官网抓取 · 留学组',
  },
  {
    id: 'ds-cases',
    name: '往届录取案例',
    cadence: '持续',
    lastUpdated: '2026-09-16',
    maxAgeDays: 30,
    usedBy: ['背景评估', '选校定位'],
    grant: 'granted',
    mustShowDate: true,
    owner: '社区 + 内部案例库',
  },
  {
    id: 'ds-visa',
    name: '签证与政策',
    cadence: '事件驱动',
    lastUpdated: '2026-08-04',
    maxAgeDays: null,
    usedBy: ['材料清单', '签证材料核对（待审）'],
    grant: 'granted',
    mustShowDate: true,
    owner: '官方公告订阅 · 留学组',
  },
  {
    id: 'ds-jd',
    name: '招聘 JD 库',
    cadence: '持续',
    lastUpdated: '2026-09-17',
    maxAgeDays: 7,
    usedBy: ['简历与 JD 匹配', '面试问题生成', '目标公司情报卡（待审）'],
    grant: 'granted',
    mustShowDate: true,
    owner: 'WhatAJob 抓取',
  },
  {
    id: 'ds-corp',
    name: '企业工商与融资数据',
    cadence: '季更',
    lastUpdated: '—',
    maxAgeDays: 92,
    usedBy: ['目标公司情报卡（待审）'],
    grant: 'requested',
    mustShowDate: true,
    owner: '待定 · 第三方 API',
  },
  {
    id: 'ds-salary',
    name: '薪资水平数据',
    cadence: '季更',
    lastUpdated: '—',
    maxAgeDays: 92,
    usedBy: [],
    grant: 'denied',
    mustShowDate: true,
    owner: '第三方，可信度存疑',
  },
]

/** 台账上要显示的展示要求，照抄难点 4 的表 */
export const SHOW_RULE: Record<string, string> = {
  年更: '标注抓取日期',
  季更: '标注抓取日期，临近时校验',
  持续: '标注来源与年份',
  事件驱动: '强制展示日期',
}

export const GRANT_NOTE: Record<string, string> = {
  granted: '已授予，工具运行时可调用',
  requested: '创作者已申请，等平台逐项授予',
  denied: '已驳回',
}
