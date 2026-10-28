import type { Alias, FallbackCluster } from './types'

/* ============================================================
   需求池（D9 · qa_skill 兜底必须埋点）

   「qa_skill 的日志就是 skill roadmap」—— 这是内测前最值钱的那份数据。
   反面风险写得很明白：兜底很容易变成一个舒服的垃圾桶，把低覆盖率盖住。
   所以这一页的主角是阈值线，不是折线本身。

   构造数据。内测还没开始，真实兜底日志一条都没有 —— 这一页展示的是
   埋点该长什么样，不是已经观测到的分布。
   ============================================================ */

/** 兜底率阈值，越线当 bug 处理，不是「稍微高了点」 */
export const FALLBACK_THRESHOLD = 15

/** 近 12 周兜底率 %，最后三周越线 */
export const FALLBACK_TREND = [31, 28, 24, 22, 19, 17, 14, 12, 11, 16, 18, 21]

export const FALLBACK_WEEKS = ['W27', 'W28', 'W29', 'W30', 'W31', 'W32', 'W33', 'W34', 'W35', 'W36', 'W37', 'W38']

/** 越线三周的解释 —— 阈值告警必须能回答「为什么」，否则就是个红点 */
export const FALLBACK_BREACH_NOTE =
  'W36 起连续越线。新增兜底 72% 落在「投递进度管理」和「实习转正」两簇 —— 秋招到了，是缺 skill，不是识别变差。'

export const CLUSTERS: FallbackCluster[] = [
  {
    id: 'fc-01',
    intent: '投递进度管理',
    count: 412,
    samples: [
      '我投了 27 家现在完全乱了，怎么理一下',
      '哪几家已经挂了哪几家还在流程里',
      '帮我看看这周该催哪几家 HR',
    ],
    covered: null,
    suggestion: '工具有，路由没走过去。先查路由',
  },
  {
    id: 'fc-02',
    intent: '实习转正评估',
    count: 268,
    samples: ['实习快结束了想知道能不能留下来', '转正答辩要准备什么', '留用率低的组该不该赌'],
    covered: null,
    suggestion: '缺 skill。与「面试复盘」同源，输入不同',
  },
  {
    id: 'fc-03',
    intent: '多意图混合',
    count: 203,
    samples: [
      '帮我改简历然后顺便看看能投哪些岗',
      '先诊断一下再改，改完再对一遍 JD',
      '选校和文书一起弄',
    ],
    covered: null,
    suggestion: '拆成单步引导，不做全链路，也不是新 skill',
  },
  {
    id: 'fc-04',
    intent: '薪资与 offer 比较',
    count: 156,
    samples: ['两个 offer 怎么选', '这个薪资在上海算什么水平', '签三方前要注意什么'],
    covered: null,
    suggestion: '缺 skill。需外部薪资数据且可信度存疑，先放后面',
  },
  {
    id: 'fc-05',
    intent: '黑话与术语解释',
    count: 134,
    samples: ['双非有影响吗', '什么叫对标岗位', 'HR 说「保持联系」是什么意思'],
    covered: null,
    suggestion: '别名层该覆盖的，不做成 skill',
  },
  {
    id: 'fc-06',
    intent: '简历润色（已覆盖但未命中）',
    count: 97,
    samples: ['帮我把这段写得好看点', '这句话读起来太干了', '润一下'],
    covered: 'resume-fix（简历修改）',
    suggestion: '工具有，「润」没进别名层。加词即可',
  },
  {
    id: 'fc-07',
    intent: '心理与情绪支持',
    count: 88,
    samples: ['秋招压力太大了', '被拒了七次有点撑不住', '同学都上岸了就我没有'],
    covered: null,
    suggestion: '明确不做。但兜底回复要得体，并给外部求助渠道',
  },
  {
    id: 'fc-08',
    intent: '课程与考试安排',
    count: 61,
    samples: ['这学期怎么排课', '期末周三门一起考怎么复习', '缓考要怎么申请'],
    covered: 'study-plan（学习计划）',
    suggestion: '部分覆盖。流程性问题引导到学校教务',
  },
]

/* ============================================================
   黑话别名层（待定事项第三条）

   结论是：当数据资产做，不用 prompt 解。
   理由——写进 prompt 就是每条 query 都付一次 token，而且改一个词要重跑全套 eval；
   做成别名层是查表，可增删可统计命中。
   ============================================================ */

export const ALIASES: Alias[] = [
  { term: '双非', means: '非 985 非 211 院校', hits: 1840 },
  { term: '海本', means: '海外本科', hits: 620 },
  { term: '保底校', means: '录取概率高的备选学校', hits: 1120 },
  { term: '冲刺校', means: '录取概率低但值得一试的学校', hits: 980 },
  { term: '一面 / 二面', means: '第一轮 / 第二轮面试', hits: 2410 },
  { term: '对标', means: '与某岗位/某人的水平做对比参照', hits: 740 },
  { term: '润', means: '润色（也可能指出国，需看上下文）', hits: 530 },
  { term: '上岸', means: '拿到 offer 或考试通过', hits: 1360 },
  { term: '三方', means: '三方就业协议', hits: 410 },
  { term: 'oc', means: 'offer call，口头录用通知', hits: 290 },
]
