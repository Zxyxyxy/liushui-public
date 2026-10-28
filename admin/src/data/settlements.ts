import type { QualityMetric, Settlement } from './types'

/* ============================================================
   月度结算（构造数据，除 c-you 的六项质量指标外）

   c-you 的这一份必须与前台创作者中心逐字一致：
     app/src/pages/Creator.tsx —— 质量系数 1.18×、有效使用者 412、
     总运行 1284、六项指标 96/92/74/61/98/83。
   后台是这些数被算出来的地方，两边不一致 demo 就自相矛盾了。
   ============================================================ */

/** 与前台创作者中心同一批数、同一顺序 */
const YOU_METRICS: QualityMetric[] = [
  { label: '成功运行率', value: 96, note: '失败不扣分也不计人' },
  { label: '用户评分', value: 92, note: '加权近 90 天' },
  { label: '结果保存率', value: 74, note: '运行后保存到工作台的比例' },
  { label: '用户复用率', value: 61, note: '同人再次使用，北极星指标之一' },
  { label: '投诉退款率', value: 98, note: '反向指标，已换算成正向分' },
  { label: '成本控制', value: 83, note: '单次运行 token 成本相对同类' },
]

export const SETTLEMENTS: Settlement[] = [
  {
    creatorId: 'c-you',
    month: '2026-08',
    totalRuns: 1284,
    deductions: [
      {
        key: 'anon',
        label: '未登录用户',
        count: 312,
        ref: '',
        samples: [
          { id: 'r-9f02', who: '匿名会话 a7c1', when: '08-03 14:22', why: '无账号，无法判定是否同一人' },
          { id: 'r-9f18', who: '匿名会话 b210', when: '08-07 09:41', why: '无账号' },
          { id: 'r-a031', who: '匿名会话 3e8f', when: '08-19 21:07', why: '无账号' },
        ],
      },
      {
        key: 'failed',
        label: '运行失败',
        count: 86,
        ref: '失败不扣分也不计人',
        samples: [
          { id: 'r-9c55', who: 'u-8f21', when: '08-05 10:12', why: '上传图片 OCR 超时，已退回积分' },
          { id: 'r-9d71', who: 'u-2b04', when: '08-11 16:38', why: '模型返回非法 JSON，运行中断' },
          { id: 'r-a1c9', who: 'u-77e3', when: '08-24 19:55', why: '文件超过 20MB 限制' },
        ],
      },
      {
        key: 'self',
        label: '创作者自运行',
        count: 41,
        ref: '',
        samples: [
          { id: 'r-9a01', who: 'c-you（本人）', when: '08-01 11:02', why: '上线前自测' },
          { id: 'r-9a02', who: 'c-you（本人）', when: '08-01 11:09', why: '上线前自测' },
          { id: 'r-9e40', who: 'c-you（本人）', when: '08-14 20:31', why: '回归验证' },
        ],
      },
      {
        key: 'repeat',
        label: '同月重复',
        count: 398,
        ref: '同人同工具每月只计一次',
        samples: [
          { id: 'r-9b12', who: 'u-8f21', when: '08-06 09:20', why: '本月第 2 次，首次已计入' },
          { id: 'r-9b13', who: 'u-8f21', when: '08-06 09:44', why: '本月第 3 次' },
          { id: 'r-9f90', who: 'u-4d17', when: '08-18 22:10', why: '本月第 7 次' },
        ],
      },
      {
        key: 'burst',
        label: '同设备异常批量',
        count: 27,
        ref: '',
        samples: [
          { id: 'r-a200', who: 'u-c0de', when: '08-22 03:11', why: '同设备 4 分钟内 27 次，判定脚本调用' },
        ],
      },
      {
        key: 'refund',
        label: '已退款或投诉',
        count: 8,
        ref: '',
        samples: [
          { id: 'r-a0aa', who: 'u-51bb', when: '08-16 13:02', why: '结果与承诺不符，已全额退积分' },
          { id: 'r-a0ab', who: 'u-9e2c', when: '08-27 17:44', why: '投诉成立：错题归类错误' },
        ],
      },
    ],
    metrics: YOU_METRICS,
    perUser: 1.2,
    bonuses: [
      { label: '新工具冷启动奖励', amount: 200, ref: '错题整理 08-29 上线，首月一次性' },
      { label: '配套内容奖励', amount: 80, ref: '2 篇过审使用攻略 × 40' },
      { label: '用户留存奖励', amount: 120, ref: '次月留存 38%，达 35% 档' },
    ],
    cap: 1500,
    status: 'draft',
  },

  {
    creatorId: 'c-linlin',
    month: '2026-08',
    totalRuns: 41280,
    deductions: [
      {
        key: 'anon',
        label: '未登录用户',
        count: 6420,
        ref: '',
        samples: [{ id: 'r-l001', who: '匿名会话 ×6420', when: '08 全月', why: '简历类工具搜索进来直接试用的占比高' }],
      },
      {
        key: 'failed',
        label: '运行失败',
        count: 1180,
        ref: '',
        samples: [
          { id: 'r-l110', who: 'u-3a91', when: '08-09 15:20', why: 'PDF 加密无法解析' },
          { id: 'r-l144', who: 'u-b7c2', when: '08-20 11:03', why: 'JD 粘贴为空' },
        ],
      },
      { key: 'self', label: '创作者自运行', count: 96, ref: '', samples: [{ id: 'r-l900', who: 'c-linlin（本人）', when: '08 全月', why: '新版本自测 96 次' }] },
      {
        key: 'repeat',
        label: '同月重复',
        count: 22840,
        ref: '同人同工具每月只计一次',
        samples: [{ id: 'r-l500', who: 'u-8f21 等 4127 人', when: '08 全月', why: '秋招期间同一份简历反复改，重复率天然高' }],
      },
      { key: 'burst', label: '同设备异常批量', count: 610, ref: '', samples: [{ id: 'r-l777', who: 'u-dead', when: '08-13 02:30', why: '疑似简历代写工作室批量调用，已限流' }] },
      { key: 'refund', label: '已退款或投诉', count: 142, ref: '', samples: [{ id: 'r-l800', who: 'u-1f4e', when: '08-25 10:15', why: '投诉：改写后丢失原有项目细节' }] },
    ],
    metrics: [
      { label: '成功运行率', value: 98, note: '' },
      { label: '用户评分', value: 96, note: '4.8 / 5 换算' },
      { label: '结果保存率', value: 88, note: '' },
      { label: '用户复用率', value: 79, note: '秋招期反复修改，复用天然高' },
      { label: '投诉退款率', value: 99, note: '' },
      { label: '成本控制', value: 76, note: '长简历 token 消耗偏高' },
    ],
    perUser: 1.2,
    bonuses: [
      { label: '配套内容奖励', amount: 200, ref: '5 篇过审攻略 × 40' },
      { label: '用户留存奖励', amount: 600, ref: '次月留存 52%，达 50% 档' },
    ],
    cap: 12000,
    status: 'draft',
  },

  {
    creatorId: 'c-atlas',
    month: '2026-08',
    totalRuns: 18640,
    deductions: [
      { key: 'anon', label: '未登录用户', count: 3210, ref: '', samples: [{ id: 'r-t001', who: '匿名会话 ×3210', when: '08 全月', why: '选校定位是搜索入口大头' }] },
      { key: 'failed', label: '运行失败', count: 520, ref: '', samples: [{ id: 'r-t100', who: 'u-6b21', when: '08-12 14:40', why: '学校专业库查询超时' }] },
      { key: 'self', label: '创作者自运行', count: 64, ref: '', samples: [{ id: 'r-t900', who: 'c-atlas（本人）', when: '08 全月', why: '' }] },
      { key: 'repeat', label: '同月重复', count: 9880, ref: '', samples: [{ id: 'r-t500', who: 'u-2c88 等 1840 人', when: '08 全月', why: '选校反复调参数，重复率高' }] },
      { key: 'burst', label: '同设备异常批量', count: 288, ref: '', samples: [{ id: 'r-t777', who: 'u-beef', when: '08-18 01:12', why: '疑似中介机构批量跑选校' }] },
      { key: 'refund', label: '已退款或投诉', count: 96, ref: '', samples: [{ id: 'r-t800', who: 'u-9a13', when: '08-21 16:02', why: '投诉：录取要求引用了过期年份' }] },
    ],
    metrics: [
      { label: '成功运行率', value: 95, note: '外部数据源超时是主因' },
      { label: '用户评分', value: 94, note: '' },
      { label: '结果保存率', value: 81, note: '' },
      { label: '用户复用率', value: 44, note: '留学低频，一轮申请季用一次' },
      { label: '投诉退款率', value: 97, note: '' },
      { label: '成本控制', value: 71, note: '选校要拉大量外部数据' },
    ],
    perUser: 1.2,
    bonuses: [
      { label: '配套内容奖励', amount: 160, ref: '4 篇过审攻略 × 40' },
      { label: '用户留存奖励', amount: 340, ref: '次月留存 41%' },
    ],
    cap: 12000,
    status: 'draft',
  },

  {
    creatorId: 'c-kelvin',
    month: '2026-08',
    totalRuns: 9860,
    deductions: [
      { key: 'anon', label: '未登录用户', count: 1640, ref: '', samples: [{ id: 'r-k001', who: '匿名会话 ×1640', when: '08 全月', why: '' }] },
      { key: 'failed', label: '运行失败', count: 284, ref: '', samples: [{ id: 'r-k100', who: 'u-4f02', when: '08-08 10:22', why: 'PPT 文件版本过旧无法解析' }] },
      { key: 'self', label: '创作者自运行', count: 112, ref: '', samples: [{ id: 'r-k900', who: 'c-kelvin（本人）', when: '08 全月', why: '课堂演示用' }] },
      { key: 'repeat', label: '同月重复', count: 5210, ref: '', samples: [{ id: 'r-k500', who: 'u-7d31 等 980 人', when: '08 全月', why: '一门课多次汇报' }] },
      { key: 'burst', label: '同设备异常批量', count: 96, ref: '', samples: [{ id: 'r-k777', who: 'u-f00d', when: '08-15 23:50', why: '同设备 96 次，疑似机房共用 IP，待人工确认' }] },
      { key: 'refund', label: '已退款或投诉', count: 38, ref: '', samples: [{ id: 'r-k800', who: 'u-3e51', when: '08-23 09:30', why: '' }] },
    ],
    metrics: [
      { label: '成功运行率', value: 97, note: '' },
      { label: '用户评分', value: 91, note: '' },
      { label: '结果保存率', value: 69, note: '讲稿多是即用即走' },
      { label: '用户复用率', value: 52, note: '' },
      { label: '投诉退款率', value: 98, note: '' },
      { label: '成本控制', value: 88, note: '' },
    ],
    perUser: 1.2,
    bonuses: [
      { label: '新工具冷启动奖励', amount: 200, ref: '课程汇报工作流 08-12 上线' },
      { label: '配套内容奖励', amount: 40, ref: '1 篇过审攻略' },
      { label: '用户留存奖励', amount: 180, ref: '次月留存 37%' },
    ],
    cap: 12000,
    status: 'draft',
  },

  {
    creatorId: 'c-nimbus',
    month: '2026-08',
    totalRuns: 12420,
    deductions: [
      { key: 'anon', label: '未登录用户', count: 2180, ref: '', samples: [{ id: 'r-n001', who: '匿名会话 ×2180', when: '08 全月', why: '公式解释类工具试用门槛低' }] },
      { key: 'failed', label: '运行失败', count: 340, ref: '', samples: [{ id: 'r-n100', who: 'u-5c12', when: '08-10 13:14', why: 'xlsx 含宏，解析拒绝' }] },
      { key: 'self', label: '创作者自运行', count: 48, ref: '', samples: [{ id: 'r-n900', who: 'c-nimbus（本人）', when: '08 全月', why: '' }] },
      { key: 'repeat', label: '同月重复', count: 6920, ref: '', samples: [{ id: 'r-n500', who: 'u-9f77 等 1260 人', when: '08 全月', why: '公式解释是高频小工具，同人一天问好几次' }] },
      { key: 'burst', label: '同设备异常批量', count: 410, ref: '', samples: [{ id: 'r-n777', who: 'u-cafe', when: '08-19 04:20', why: '疑似接口被薅，已加频控' }] },
      { key: 'refund', label: '已退款或投诉', count: 62, ref: '', samples: [{ id: 'r-n800', who: 'u-2d90', when: '08-26 11:08', why: '' }] },
    ],
    metrics: [
      { label: '成功运行率', value: 99, note: '' },
      { label: '用户评分', value: 93, note: '' },
      { label: '结果保存率', value: 58, note: '公式解释看完就走，不保存' },
      { label: '用户复用率', value: 42, note: '' },
      { label: '投诉退款率', value: 99, note: '' },
      { label: '成本控制', value: 95, note: '单次 token 消耗极低' },
    ],
    perUser: 1.2,
    bonuses: [{ label: '用户留存奖励', amount: 160, ref: '次月留存 36%' }],
    cap: 12000,
    status: 'draft',
  },

  {
    creatorId: 'official',
    month: '2026-08',
    totalRuns: 486200,
    deductions: [],
    metrics: [],
    perUser: 0,
    bonuses: [],
    cap: 0,
    status: 'confirmed',
    excluded: '平台自营，不参与创作者补贴。运行数只用于北极星指标口径核对。',
  },
]
