import type { WorkspaceRecord } from './api'

/**
 * 一次运行的结果。内容全部来自后端编排图（/api/flow），前端不再造任何假结果——
 * 上架的 skill 现在都接了真实 LLM，运行失败会走退款路径而不是退化成演示数据。
 */
export interface RunResult {
  title: string
  /** 后端返回的 Markdown 正文 */
  markdown: string
  // 编排图的 validation_notes 不进这里：那是内部自检措辞（「已通过质量自检」
  // 之类），不该出现在产品 UI。需要排查时看 /api/flow 响应里的 validation_notes。
  /** 图产出的工作台记录，保存到工作台时用 */
  workspaceRecord?: WorkspaceRecord
}

/** 从 Markdown 正文里抽一段纯文本当摘要（发帖预览用），跳过标题和列表符号。 */
export function plainSummary(markdown: string, limit = 90): string {
  for (const raw of markdown.split('\n')) {
    const line = raw.trim().replace(/^[#>\-*+\s]+/, '').replace(/[*_`]/g, '').trim()
    if (line.length < 8 || line.startsWith('|') || line.startsWith('```')) continue
    return line.slice(0, limit)
  }
  return '本次运行的核心结论与关键步骤已自动提取。'
}
