import type { Check, Submission } from '../data/types'

/* ============================================================
   工具契约检查

   难点 2 的结论：契约同时是准入门槛和质量筛子。所以这里的六项
   是算出来的，不是数据里写死的状态位 —— 审核页上改一个步骤积分，
   闸门要当场变红。这也是这版 demo 唯一有真实判定逻辑的地方。
   ============================================================ */

/** D6：artifact 类型必须是 <域>.<类>，且 <类> 在白名单里。
 *  match.report 合法；resume 不合法 —— 诊断报告在结构上就不能当简历喂给下游。 */
const ARTIFACT_KINDS = [
  'report',
  'plan',
  'list',
  'draft',
  'score',
  'timeline',
  'checklist',
  'outline',
  'summary',
  'deck',
  'sheet',
  'qa',
]

export function checkArtifactType(type: string): { ok: boolean; why: string } {
  const parts = type.split('.')
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { ok: false, why: `「${type}」没有 <域>.<类> 结构` }
  }
  if (!ARTIFACT_KINDS.includes(parts[1])) {
    return { ok: false, why: `「${parts[1]}」不在 artifact 类白名单里` }
  }
  return { ok: true, why: '' }
}

/** 步骤积分加总必须等于总价。前台 tools.ts 的 distribute() 已保证这条恒等，
 *  后台把它做成显式闸门：不平就不能通过。 */
export function creditsSum(s: Submission): number {
  return s.steps.reduce((a, b) => a + b.credits, 0)
}

export function checks(s: Submission): Check[] {
  const c = s.contract
  const out: Check[] = []

  /* 1. 读取 */
  if (c.reads.length) {
    out.push({
      key: 'reads',
      label: '读取',
      declared: c.reads.join('、'),
      status: 'ok',
      note: `声明了 ${c.reads.length} 个工作台字段`,
      ref: '契约三项之一',
    })
  } else if (c.level === 'L0') {
    out.push({
      key: 'reads',
      label: '读取',
      declared: '未声明（纯手动上传）',
      status: 'warn',
      note: 'L0 可以不读，代价是用户每次重新传',
      ref: '三级接入',
    })
  } else {
    out.push({
      key: 'reads',
      label: '读取',
      declared: '未声明',
      status: 'bad',
      note: `声明了 ${c.level} 却没说读哪些字段，自动接入无从实现`,
      ref: '契约三项之一',
    })
  }

  /* 2. 产出（D6） */
  if (!c.produces.length) {
    out.push({
      key: 'produces',
      label: '产出',
      declared: '未声明',
      status: 'bad',
      note: '没有 artifact 类型，下游工具无法判断能不能接',
      ref: 'artifact 必须带类型',
    })
  } else {
    const bad = c.produces.map((p) => checkArtifactType(p.type)).filter((r) => !r.ok)
    out.push({
      key: 'produces',
      label: '产出',
      declared: c.produces.map((p) => `${p.type}（${p.label}）`).join('、'),
      status: bad.length ? 'bad' : 'ok',
      note: bad.length ? bad.map((b) => b.why).join('；') : '类型合法，下游可做类型校验',
      ref: 'artifact 必须带类型',
    })
  }

  /* 3. 写回 */
  if (c.writesBack.length) {
    out.push({
      key: 'writeback',
      label: '写回',
      declared: c.writesBack.join('、'),
      status: 'ok',
      note: '结果进工作台，工作台是运行的副产物',
      ref: '工作台冷启动',
    })
  } else {
    out.push({
      key: 'writeback',
      label: '写回',
      declared: '未声明',
      status: c.level === 'L2' ? 'bad' : 'warn',
      note:
        c.level === 'L2'
          ? '不写回就不是 L2'
          : '不写回，工作台攒不起来',
      ref: 'L2 定义',
    })
  }

  /* 4. 接入等级 */
  out.push({
    key: 'level',
    label: '接入等级',
    declared: c.level,
    status: c.level === 'L0' ? 'warn' : 'ok',
    note:
      c.level === 'L0'
        ? 'L0 是过渡形态，建议补 L1 声明'
        : c.level === 'L2'
          ? 'L2 名额有限，确认值得占一个'
          : 'L1 自动喂入已有文件，是目标形态',
    ref: '三级接入',
  })

  /* 5. 外部数据（PRD §八） */
  if (!c.external.length) {
    out.push({
      key: 'external',
      label: '外部数据',
      declared: '不申请',
      status: 'ok',
      note: '无外部依赖，不涉及权限授予',
      ref: '外部数据是权限',
    })
  } else {
    const vague = c.external.filter((e) => !e.why.trim() || !e.scope.trim())
    out.push({
      key: 'external',
      label: '外部数据',
      declared: c.external.map((e) => e.source).join('、'),
      status: vague.length ? 'bad' : 'warn',
      note: vague.length
        ? `${vague.map((v) => v.source).join('、')} 没说清用途或范围，不能授予`
        : `${c.external.length} 项待逐项授予`,
      ref: '外部数据是权限',
    })
  }

  /* 6. 积分明细 */
  const sum = creditsSum(s)
  out.push({
    key: 'credits',
    label: '积分明细',
    declared: `${s.steps.map((x) => x.credits).join(' + ')} = ${sum}，标价 ${s.credits}`,
    status: sum === s.credits ? 'ok' : 'bad',
    note:
      sum === s.credits
        ? '加总等于标价'
        : `差 ${Math.abs(sum - s.credits)} 分。详情页逐步显示积分，加不上就是 bug`,
    ref: '前台 distribute() 恒等',
  })

  return out
}

/** 有 bad 就不能通过。warn 可以通过，但审核人得看见。 */
export function canApprove(s: Submission): boolean {
  return !checks(s).some((c) => c.status === 'bad')
}

export function blockers(s: Submission): Check[] {
  return checks(s).filter((c) => c.status === 'bad')
}

/** 打回理由集合。必须选，不能只写自由文本 —— 理由要能聚合成创作者指引。 */
export const REJECT_REASONS = [
  '契约声明不清（读取/产出/写回缺项）',
  '产出类型不合命名规范（<域>.<类>）',
  '积分明细不平',
  '超出四场景边界',
  '外部数据用途或范围不明',
  '与已上线工具重复，无增量',
  '承诺与实际产出不符',
] as const
