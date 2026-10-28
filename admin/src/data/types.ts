/* ============================================================
   后台类型

   前三个（SceneId / ProductKind / CreatorBadge）与前台
   app/src/data/types.ts 逐字相同 —— 两个 demo 并排打开时场景名、
   创作者徽标必须对得上。其余是后台独有的。
   ============================================================ */

export type SceneId = 'study' | 'job' | 'abroad' | 'exam'
export type ProductKind = 'tool' | 'expert' | 'workflow'

export interface CreatorBadge {
  label: string
  kind: 'personal' | 'pro' | 'org' | 'company' | 'official'
}

export interface Creator {
  id: string
  name: string
  avatar: string
  badge: CreatorBadge
  toolCount: number
  monthlyActiveUsers: number
}

/* ---------- 工具审核 ---------- */

export type AccessLevel = 'L0' | 'L1' | 'L2'

/** 外部数据申请。PRD §八：外部数据是权限，不是默认能力。 */
export interface ExternalDataReq {
  source: string
  /** 为什么需要 */
  why: string
  /** 取什么范围 */
  scope: string
  grant?: 'granted' | 'denied'
}

export interface RunStep {
  title: string
  detail: string
  credits: number
}

/** 难点 2 的工具契约：读取 / 产出 / 写回，三项都要声明 */
export interface Contract {
  /** 从工作台读哪些字段。空数组 = 未声明 */
  reads: string[]
  /** 产出的 artifact。D6：必须带类型，match.report 不叫 resume */
  produces: { type: string; label: string }[]
  /** 结果哪部分回写工作台 */
  writesBack: string[]
  level: AccessLevel
  external: ExternalDataReq[]
}

export type SubmissionStatus = 'pending' | 'approved' | 'rejected' | 'more-info'

export interface Submission {
  id: string
  toolName: string
  promise: string
  scene: SceneId
  kind: ProductKind
  creatorId: string
  icon: string
  submittedAt: string
  /** 首次提交 / v1.2 更新 */
  version: string
  credits: number
  steps: RunStep[]
  contract: Contract
  /** 平台侧填写的边界判断：不在四场景内、触及敏感领域等 */
  boundaryNote?: string
  status: SubmissionStatus
  decidedAt?: string
  reason?: string
}

/** 契约检查表的一行。由 lib/contract.ts 从 Submission 算出来，不存在数据里。 */
export interface Check {
  key: 'reads' | 'produces' | 'writeback' | 'level' | 'external' | 'credits'
  label: string
  declared: string
  status: 'ok' | 'warn' | 'bad'
  note: string
  /** 依据出处，审核页要能指回文档 */
  ref: string
}

/* ---------- 创作者结算 ---------- */

/** 有效使用者的一条扣除。PRD §七给了判定表，这里把它做成逐项可核的账单。 */
export interface Deduction {
  key: string
  label: string
  count: number
  /** 依据 */
  ref: string
  /** 被排除的样本，展开可看 */
  samples: { id: string; who: string; when: string; why: string }[]
}

export interface QualityMetric {
  label: string
  value: number
  note: string
}

export interface Settlement {
  creatorId: string
  month: string
  totalRuns: number
  deductions: Deduction[]
  /** 六项质量指标，与前台创作者中心同一批数 */
  metrics: QualityMetric[]
  /** 单用户补贴，元 */
  perUser: number
  bonuses: { label: string; amount: number; ref: string }[]
  /** 月度补贴上限，元 */
  cap: number
  status: 'draft' | 'confirmed' | 'paid'
  /** official 这类平台自营不参与补贴 */
  excluded?: string
}

/* ---------- 需求池（D9） ---------- */

export interface FallbackCluster {
  id: string
  intent: string
  count: number
  samples: string[]
  /** 已有 skill 覆盖？ */
  covered: string | null
  suggestion: string
  planned?: boolean
}

/** 待定事项第三条：黑话别名层当数据资产做，不用 prompt 解 */
export interface Alias {
  term: string
  means: string
  hits: number
}

/* ---------- 数据源台账 ---------- */

/** 难点 4 的数据新鲜度表 */
export type Cadence = '年更' | '季更' | '持续' | '事件驱动'

export interface DataSource {
  id: string
  name: string
  cadence: Cadence
  lastUpdated: string
  /** 允许多久不更新，天。事件驱动的没有固定周期，用 null */
  maxAgeDays: number | null
  /** 哪些工具在用 */
  usedBy: string[]
  /** PRD §八：授权状态 */
  grant: 'granted' | 'requested' | 'denied'
  /** 留学、招聘、政策类结果必须保留来源和更新时间 */
  mustShowDate: boolean
  owner: string
}

/* ---------- 操作审计 ---------- */

export interface AuditEntry {
  id: string
  at: string
  who: string
  action: string
  target: string
  detail: string
}
