import type { Tool } from '../data/types'
import { relatedTools } from './relatedTools'

export interface NextStep {
  key: string
  /** 按钮上的文字，用动宾短语，像「猜你想问」那样让人一眼知道点了会发生什么 */
  label: string
  /** 点击后在会话里开哪个工具的表单 */
  skillId: string
  /** 从上一个结果里带过去的字段（如简历、目标岗位），省得用户再填一遍 */
  prefill?: Record<string, string>
}

// 每个工具做完之后，最自然的下一步是什么。是产品判断，不是模型生成：
// 求职链路 简历 → 匹配度 → 自我介绍 → 面试题 → 复盘；留学链路 背景 → 选校 → 文书；
// 考试链路 计划 / 资料 / 错题。没列到的工具退回「同场景相关工具」。
const FLOW: Record<string, { skillId: string; label: string }[]> = {
  'resume-fix': [
    { skillId: 'jd-match', label: '拿这份简历对一下目标岗位 JD，看匹配度' },
    { skillId: 'self-intro', label: '根据这份简历生成面试自我介绍' },
    { skillId: 'interview-q', label: '预测面试官会问的问题' },
  ],
  'resume-fix-story': [
    { skillId: 'jd-match', label: '拿这份简历对一下目标岗位 JD，看匹配度' },
    { skillId: 'self-intro', label: '根据这份简历生成面试自我介绍' },
    { skillId: 'interview-q', label: '预测面试官会问的问题' },
  ],
  'campus-plan': [
    { skillId: 'resume-fix', label: '按主投方向改一版简历' },
    { skillId: 'referral-msg', label: '找师兄师姐要个内推' },
  ],
  'referral-msg': [
    { skillId: 'cover-letter', label: '为这个岗位写一封求职信' },
  ],
  'story-bank': [
    { skillId: 'interview-q', label: '预测这场面试会问的问题' },
    { skillId: 'self-intro', label: '准备面试自我介绍' },
  ],
  'followup-msg': [
    { skillId: 'interview-review', label: '把这场面试做一次复盘' },
  ],
  'offer-compare': [
    { skillId: 'salary-talk', label: '准备和 HR 谈条件' },
  ],
  'salary-talk': [
    { skillId: 'offer-compare', label: '把几个 offer 放在一起对比' },
  ],
  'paper-read': [
    { skillId: 'lit-review-outline', label: '把读过的文献搭成综述提纲' },
    { skillId: 'ppt-outline', label: '把这篇论文做成组会汇报大纲' },
  ],
  'lit-review-outline': [
    { skillId: 'ref-format', label: '把参考文献整理成 GB/T 7714 格式' },
  ],
  'mind-map': [
    { skillId: 'feynman-check', label: '挑一个分支用费曼法自检' },
  ],
  'cheatsheet': [
    { skillId: 'feynman-check', label: '检验最核心的概念有没有真懂' },
  ],
  'feynman-check': [
    { skillId: 'mistake-cards', label: '把没懂的点做成记忆卡片' },
  ],
  'exam-forecast': [
    { skillId: 'study-plan', label: '按考点权重排一份复习计划' },
    { skillId: 'mock-exam', label: '按重点考点出一套模拟卷' },
  ],
  'mock-exam': [
    { skillId: 'mistake-book', label: '把做错的题整理出薄弱点' },
  ],
  'essay-grade': [
    { skillId: 'feynman-check', label: '把没答准的原理用费曼法自检' },
  ],
  'english-essay-grade': [
    { skillId: 'en-grammar', label: '改完后再查一遍语法' },
  ],
  'speaking-stories': [
    { skillId: 'english-essay-grade', label: '再练一篇写作' },
  ],
  'research-proposal': [
    { skillId: 'prof-email', label: '带着研究计划给导师写套磁信' },
    { skillId: 'ref-format', label: '整理参考文献格式' },
  ],
  'academic-cv': [
    { skillId: 'ps-draft', label: '开始写文书初稿' },
  ],
  'ps-adapt': [
    { skillId: 'en-polish', label: '润色英文表达' },
  ],
  'europe-offer': [
    { skillId: 'offer-compare', label: '把几个 offer 放在一起对比' },
  ],
  'jd-match': [
    { skillId: 'resume-fix', label: '按缺的关键词改简历' },
    { skillId: 'interview-q', label: '预测面试官会问的问题' },
  ],
  'jd-fit': [
    { skillId: 'jd-tailor', label: '值得投的话，按这份 JD 改简历' },
    { skillId: 'cover-letter', label: '为这个岗位写一封求职信' },
  ],
  'jd-tailor': [
    { skillId: 'cover-letter', label: '用改好的简历写求职信' },
    { skillId: 'interview-q', label: '预测面试官会问的问题' },
  ],
  'cover-letter': [
    { skillId: 'self-intro', label: '准备面试自我介绍' },
    { skillId: 'interview-q', label: '预测面试官会问的问题' },
  ],
  'self-intro': [
    { skillId: 'interview-q', label: '预测面试官会问的问题' },
    { skillId: 'interview-review', label: '面完后做一次复盘' },
  ],
  'self-intro-pitch': [
    { skillId: 'interview-q', label: '预测面试官会问的问题' },
    { skillId: 'interview-review', label: '面完后做一次复盘' },
  ],
  'interview-q': [
    { skillId: 'story-bank', label: '把经历整理成行为面试故事库' },
    { skillId: 'self-intro', label: '生成面试自我介绍' },
    { skillId: 'interview-review', label: '面完后做一次复盘' },
  ],
  'interview-review': [
    { skillId: 'thank-you-letter', label: '趁今天给面试官发一封感谢信' },
    { skillId: 'interview-q', label: '针对薄弱点再预测一轮问题' },
    { skillId: 'resume-fix', label: '把复盘发现的问题改进简历' },
  ],
  'thank-you-letter': [
    { skillId: 'followup-msg', label: '一直没消息时写一条跟进' },
    { skillId: 'interview-review', label: '把这场面试做一次复盘' },
  ],
  'resume-fix-campus': [
    { skillId: 'jd-match', label: '拿这份简历对一下目标岗位 JD，看匹配度' },
    { skillId: 'self-intro', label: '根据这份简历生成面试自我介绍' },
    { skillId: 'interview-q', label: '预测面试官会问的问题' },
  ],
  'school-pick-research': [
    { skillId: 'prof-email', label: '给感兴趣的导师写一封套磁信' },
    { skillId: 'reference-request', label: '给推荐人写一封请求邮件' },
  ],
  'prof-email': [
    { skillId: 'reference-request', label: '给推荐人写一封请求邮件' },
    { skillId: 'ps-draft', label: '为这个方向写文书初稿' },
  ],
  'reference-request': [
    { skillId: 'ps-draft', label: '开始写文书初稿' },
  ],
  'ps-humanize': [
    { skillId: 'ps-diagnose', label: '再查一遍文书的论证逻辑' },
  ],
  'material-frameworks': [
    { skillId: 'note-tidy', label: '把要点整理成可复习的笔记' },
  ],
  'bg-assess': [
    { skillId: 'school-pick', label: '按这个定位列出冲刺 / 匹配 / 保底学校' },
    { skillId: 'ps-draft', label: '开始写文书初稿' },
  ],
  'school-pick': [
    { skillId: 'ps-draft', label: '为目标项目写文书初稿' },
    { skillId: 'bg-assess', label: '再评估一次背景竞争力' },
  ],
  'ps-draft': [
    { skillId: 'ps-diagnose', label: '给这份初稿做一次逻辑诊断' },
    { skillId: 'ps-adapt', label: '把这篇改成适合其他项目的版本' },
    { skillId: 'en-polish', label: '润色英文表达' },
  ],
  'ps-diagnose': [
    { skillId: 'en-polish', label: '逻辑理顺后润色英文' },
    { skillId: 'ps-draft', label: '按诊断意见重写初稿' },
  ],
  'study-plan': [
    { skillId: 'exam-forecast', label: '用往年卷找出重点考点' },
    { skillId: 'mistake-book', label: '整理最近的错题' },
    { skillId: 'material-digest', label: '把复习资料合并成要点' },
  ],
  'mistake-book': [
    { skillId: 'mistake-cards', label: '把这些错题做成记忆卡片反复刷' },
    { skillId: 'study-plan', label: '按薄弱点重排复习计划' },
  ],
  'mistake-cards': [
    { skillId: 'mistake-book', label: '找出反复错的根本原因' },
    { skillId: 'study-plan', label: '按薄弱点重排复习计划' },
  ],
  'en-polish-academic': [
    { skillId: 'en-grammar', label: '交稿前最后查一遍语法' },
  ],
  'material-digest': [
    { skillId: 'study-plan', label: '据此排一份复习计划' },
    { skillId: 'mistake-book', label: '整理做错的题' },
  ],
  'pdf-digest': [
    { skillId: 'note-tidy', label: '把要点整理成可复习的笔记' },
    { skillId: 'ppt-outline', label: '把内容做成汇报大纲' },
  ],
  'note-tidy': [
    { skillId: 'study-plan', label: '据此排复习计划' },
  ],
  'ppt-outline': [
    { skillId: 'en-polish', label: '润色英文版讲稿' },
  ],
}

// 上一个工具的哪个输入，可以直接带给下一个工具的同义字段。
// 按「字段含义」配对而不是按 key 相等——不同工具给同一样东西起了不同的 key。
const CARRY: Record<string, string[]> = {
  resume: ['resume_content', 'resume', 'background', 'material'],
  target: ['target_role', 'position', 'jd'],
  program: ['program'],
  essay: ['essay', 'material'],
}

function carryOver(lastInputs: Record<string, string> | undefined, next: Tool): Record<string, string> | undefined {
  if (!lastInputs) return undefined
  const out: Record<string, string> = {}
  for (const keys of Object.values(CARRY)) {
    const src = keys.find((k) => lastInputs[k]?.trim())
    if (!src) continue
    for (const f of next.fields) {
      if (keys.includes(f.key) && !out[f.key]) out[f.key] = lastInputs[src]
    }
  }
  return Object.keys(out).length ? out : undefined
}

/** 「猜你想做」：最多 3 条。先用流程表，不够再用同场景相关工具补齐 */
export function nextStepsFor(
  skillId: string,
  skills: Tool[],
  lastInputs?: Record<string, string>,
): NextStep[] {
  const byId = Object.fromEntries(skills.map((s) => [s.id, s]))
  const out: NextStep[] = []
  const seen = new Set<string>([skillId])

  for (const s of FLOW[skillId] ?? []) {
    const t = byId[s.skillId]
    if (!t || seen.has(t.id)) continue
    seen.add(t.id)
    out.push({ key: t.id, label: s.label, skillId: t.id, prefill: carryOver(lastInputs, t) })
  }

  const cur = byId[skillId]
  if (cur && out.length < 3) {
    for (const t of relatedTools(cur, skills, 6)) {
      if (out.length >= 3) break
      if (seen.has(t.id) || (t.group && t.group === cur.group)) continue
      seen.add(t.id)
      out.push({ key: t.id, label: `用「${t.name}」：${t.promise}`, skillId: t.id, prefill: carryOver(lastInputs, t) })
    }
  }
  return out.slice(0, 3)
}
