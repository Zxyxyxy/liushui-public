/**
 * 后端 API 客户端
 *
 * 后端服务需先启动：cd ../backend && python3 simple_server.py
 */

import { AUTH_REQUIRED_EVENT, authFetch, getToken } from './auth'

// 默认走同源的 /api，由 Vite 转发给本机后端：本机打开和隧道分享都只需要前端这一个端口
const API_BASE = import.meta.env.VITE_API_BASE || '/api'

export interface SearchResult {
  skill_id: string
  skill_name: string
  score: number
  rank: number
  promise: string
  tags: string[]
  scene: string
  credits: number
  users: number
  rating: number
}

export interface SearchResponse {
  success: boolean
  query: string
  results: SearchResult[]
  error?: string
}

export interface SkillInfo {
  id: string
  name: string
  promise: string
  scene: string
  tags: string[]
  credits: number
  users: number
  rating: number
  is_executable: boolean
}

export interface ExecuteResponse {
  success: boolean
  skill_id?: string
  output?: string
  credits_used?: number
  error?: string
}

/** 编排图返回的工作台记录，字段对齐 data/types.ts 的 RunRecord / TimelineEvent */
export interface WorkspaceRecord {
  run?: {
    toolId: string
    toolName: string
    credits: number
    status: 'success' | 'failed' | 'skipped'
    summary: string
  }
  timeline_event?: { title: string; detail: string; kind: string }
  suggested_todos?: string[]
  scene?: string
}

export interface FlowResponse {
  success: boolean
  intent?: {
    scene?: string
    type?: 'simple' | 'multi' | 'longterm'
    matched_skills: string[]
    reason: string[]
  }
  chosen_skill?: string | null
  output?: string
  valid?: boolean
  validation_notes?: string[]
  retry_count?: number
  credits_used?: number
  workspace_record?: WorkspaceRecord
  error?: string
}

export interface SkillsResponse {
  success: boolean
  total: number
  executable: number
  skills: SkillInfo[]
  error?: string
}

export interface HealthResponse {
  status: string
  retrieval_ready: boolean
  executor_ready: boolean
  skills_loaded: number
  note?: string
}

/**
 * 检索 skills
 */
export async function searchSkills(query: string, topK: number = 5): Promise<SearchResponse> {
  const resp = await fetch(`${API_BASE}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, top_k: topK }),
  })

  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}: ${resp.statusText}`)
  }

  return resp.json()
}

/**
 * 获取所有 skills 列表
 */
export async function listSkills(): Promise<SkillsResponse> {
  const resp = await fetch(`${API_BASE}/skills`)

  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}: ${resp.statusText}`)
  }

  return resp.json()
}

// 旧的 executeSkill / runFlow 已删除：对应的 /api/execute、/api/flow 不扣积分，后端已下线。
// 运行工具一律走 sendChatStream 的 runSkill。

/**
 * 健康检查
 */
export async function checkHealth(): Promise<HealthResponse> {
  const resp = await fetch(`${API_BASE}/health`)

  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}: ${resp.statusText}`)
  }

  return resp.json()
}

// ── 评价 & 运行记录 ──────────────────────────────────────────────────────────

export interface BackendReview {
  id: string
  skill_id: string
  user_id: string
  nickname: string
  rating: number
  text: string
  verified: boolean
  created_at: string
}

export interface ReviewStats {
  avg_rating: number
  count: number
  dist_pct: number[]  // [5星%, 4星%, 3星%, 2星%, 1星%]
}

export interface ReviewsResponse {
  success: boolean
  skill_id: string
  reviews: BackendReview[]
  stats: ReviewStats | null
  error?: string
}

/** 拉取某 skill 的评价列表。后端未启动时返回空数据而非抛错。 */
export async function fetchReviews(skillId: string): Promise<ReviewsResponse> {
  try {
    const resp = await fetch(`${API_BASE}/reviews/${encodeURIComponent(skillId)}`)
    if (!resp.ok) return { success: false, skill_id: skillId, reviews: [], stats: null }
    return resp.json()
  } catch {
    return { success: false, skill_id: skillId, reviews: [], stats: null }
  }
}

/** 提交一条评价。身份取自令牌；失败时带回可直接展示的原因。 */
export async function postReview(payload: {
  skill_id: string
  nickname: string
  rating: number
  text: string
}): Promise<{ ok: true; review: BackendReview } | { ok: false; error: string }> {
  try {
    const resp = await authFetch('/reviews', { method: 'POST', body: JSON.stringify(payload) })
    const data = await resp.json()
    if (!data.success) return { ok: false, error: data.error || '提交失败' }
    return { ok: true, review: data.review as BackendReview }
  } catch {
    return { ok: false, error: '连不上服务器，请稍后再试' }
  }
}

/** 落一条运行记录到后端。fire-and-forget，不阻塞 UI。身份取自令牌。 */
export async function postRun(payload: {
  skill_id: string
  credits: number
  status: string
  summary: string
}): Promise<void> {
  try {
    await authFetch('/runs', { method: 'POST', body: JSON.stringify(payload) })
  } catch {
    // 静默失败，后端未启动时不影响前端
  }
}

// ── Agent 对话 ───────────────────────────────────────────────────────────────

export interface ChatArtifact {
  skill_id: string
  name: string
  credits: number
  output: string
  truncated?: boolean
  /** 这一版的侧重（有备选版本的工具才有） */
  variant?: string
  /** 方法依据；没填来源的工具是空对象，前端不显示 */
  source?: { repo?: string; badge?: string; origin?: string }
  /** 服务端已经把这份结果存进工作台：这是它的编号，用来归到某条投递 */
  output_id?: string
  scene?: string
  /** 表单里的公司正好对上工作台里的一条投递时，服务端自动归过去了 */
  target_org?: string
}

/** 从对话里识别出的一条求职进度，等用户确认后才写进工作台 */
export interface ProgressItem {
  type: 'target' | 'role' | 'stage' | 'event' | 'todo'
  /** 归到哪个工作台：求职投递还是留学申请 */
  ws?: 'job' | 'abroad'
  quote: string
  org?: string
  target_id?: string
  new_org?: string
  role?: string
  stage?: string
  stage_label?: string
  title?: string
  kind?: 'interview' | 'test' | 'deadline' | 'other'
  date?: string
  text?: string
  due?: string
}

/** 同类备选：等用户在几个侧重不同的版本里挑一个 */
export interface ChatChoice {
  skill_ids: string[]
  /** 模型已经问到的参数，选完版本后预填进表单 */
  prefill: Record<string, string>
}

/** 一步过程：让用户看到 AI 在做什么（读文件、选工具、生成） */
export interface ChatStep {
  id: string
  state: 'running' | 'done' | 'failed'
  label: string
  detail?: string
}

/** 助手消息里的「工具表单卡片」：点「开始使用」后，参数在会话里填，不跳页 */
export interface ChatForm {
  skillId: string
  prefill?: Record<string, string>
}

/** 来源分级：官方一手来源 / 权威媒体 / 其他 */
export type SourceTier = 'government' | 'authoritative_media' | 'secondary'

/** 联网搜索引用的网页 */
export interface ChatSource {
  title: string
  url: string
  site?: string
  date?: string
  tier?: SourceTier
}

/**
 * 联网研究里的一条原子事实。状态由服务端按「来源分级 + 是否逐字核实」判定：
 *   official 官方来源且已核实 / reported 媒体来源且已核实 / unknown 有网页提到但没能核实原文
 */
export interface ChatFact {
  claim: string
  /** 来源序号，对应 sources 的下标（从 1 开始），前端用它渲染「来源 N」标签 */
  source: number
  /** 支撑这条的网页原文片段，点开「来源 N」时展示 */
  quote: string
  status: 'official' | 'reported' | 'unknown'
  source_type?: SourceTier
  domain?: string
  published_at?: string
  /** status 为 unknown 时，说明为什么没能确认 */
  unverified_reason?: string
}

/** 联网研究的固定五段结构（扩展版：含历史时间线、估算、关键概念） */
export interface ResearchSections {
  official_status?: string
  conclusion?: string
  historical_basis?: string[]
  estimate?: { range?: string; basis?: string; confidence?: string }
  key_concept?: string
  confirmed?: string[]
  unconfirmed?: string[]
  judgement?: string
  next_steps?: string[]
  _value_gaps?: string[]
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  sources?: ChatSource[]
  /** 联网研究：通过核实的事实，由代码直接渲染（不经过模型改写） */
  facts?: ChatFact[]
  /** 联网研究：结论/判断/未确认/下一步这些需要组织的段落 */
  sections?: ResearchSections
  /** 往年规律，属于推测，单独成段标注 */
  inferred?: string[]
  /** 过程步骤（只在当前这一轮流式时有，不落库） */
  steps?: ChatStep[]
  /** 前端本地插入的表单卡片，不落库；刷新后消失，用户可再点开始使用 */
  form?: ChatForm
  artifacts?: ChatArtifact[]
  recommended?: string[]   // Agent 回复里点名推荐的 skill id 列表，前端渲染工具卡片
  attachments?: { id: string; name: string }[]   // 用户消息带的文件（只展示名字）
  choice?: ChatChoice
  /** 这一轮是用户在表单里提交运行的：没有「重新生成」，只有「重新运行」。值是 skill id */
  run?: string
}

/** 表单里每个字段的提交内容：手写文字，加上要用的上传文件 id（原文只留在服务端） */
export type FormSubmission = Record<string, { text?: string; uploads?: string[] }>

export interface ChatThread {
  id: string
  title: string
  updated_at: string
}

export interface StreamEvent {
  type: 'job' | 'token' | 'step' | 'tool_start' | 'tool_done' | 'skill_form' | 'skill_choice' | 'research' | 'done' | 'cancelled' | 'error'
  /** type=job：这一轮在服务端的任务编号。离开页面后回来用它接上，点停止用它取消 */
  job_id?: string
  text?: string
  name?: string
  artifact?: ChatArtifact | null
  id?: string
  state?: 'running' | 'done' | 'failed'
  label?: string
  detail?: string
  skill_id?: string
  skill_ids?: string[]
  prefill?: Record<string, string>
  // research：联网研究完成时一次性给出，替代旧版的 facts 事件
  sections?: ResearchSections
  facts?: ChatFact[]
  inferred?: string[]
  thread_id?: string
  reply?: string
  artifacts?: ChatArtifact[]
  recommended?: string[]
  sources?: ChatSource[]
  message?: string
}

/**
 * 流式发送消息。返回一个 AsyncGenerator，yield StreamEvent。
 * 调用方持有 AbortController 可以中断。
 */
export async function* sendChatStream(
  message: string,
  threadId?: string,
  opts?: {
    regenerate?: boolean
    signal?: AbortSignal
    attachments?: string[]
    /** 在会话里填完工具表单后提交：直接运行这个工具 */
    runSkill?: { skillId: string; fields: FormSubmission }
    /** 从首页日报卡片进来：服务端直接回今天的日报，不经过模型、不扣积分 */
    digest?: boolean
  },
): AsyncGenerator<StreamEvent> {
  const token = getToken()
  const API_BASE = import.meta.env.VITE_API_BASE || '/api'
  const resp = await fetch(`${API_BASE}/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      message,
      thread_id: threadId,
      regenerate: opts?.regenerate,
      attachments: opts?.attachments?.length ? opts.attachments : undefined,
      run_skill: opts?.runSkill ? { skill_id: opts.runSkill.skillId, fields: opts.runSkill.fields } : undefined,
      digest: opts?.digest || undefined,
    }),
    signal: opts?.signal,
  })

  if (resp.status === 401) {
    window.dispatchEvent(new Event(AUTH_REQUIRED_EVENT))
    yield { type: 'error', message: '请先登录' }
    return
  }
  if (!resp.ok || !resp.body) {
    yield { type: 'error', message: `服务器错误 ${resp.status}` }
    return
  }

  yield* readSse(resp.body)
}

async function* readSse(body: ReadableStream<Uint8Array>): AsyncGenerator<StreamEvent> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue   // 包括服务端的保活注释行
        const raw = line.slice(6).trim()
        if (!raw) continue
        try { yield JSON.parse(raw) as StreamEvent } catch { /* 跳过格式异常的行 */ }
      }
    }
    if (buf.startsWith('data: ')) {
      try { yield JSON.parse(buf.slice(6).trim()) as StreamEvent } catch { /* skip */ }
    }
  } finally {
    reader.releaseLock()
  }
}

export interface LiveTurn { id: string; display: string; kind: 'message' | 'run' | 'digest' | 'regenerate'; attachments: { id: string; name: string }[] }

/** 这个对话（不传就是「新对话」）有没有还在服务端生成的一轮：离开页面后回来时用 */
export async function fetchLiveTurn(threadId?: string): Promise<LiveTurn | null> {
  try {
    const resp = await authFetch(`/chat/live${threadId ? `?thread_id=${encodeURIComponent(threadId)}` : ''}`)
    const data = await resp.json()
    return data.success ? data.job : null
  } catch {
    return null
  }
}

/** 接上一个正在生成的任务：服务端先补发已经产出的部分，再继续推送到结束 */
export async function* followTurn(jobId: string, signal?: AbortSignal): AsyncGenerator<StreamEvent> {
  const token = getToken()
  const base = import.meta.env.VITE_API_BASE || '/api'
  const resp = await fetch(`${base}/chat/job/${encodeURIComponent(jobId)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal,
  })
  if (!resp.ok || !resp.body) {
    yield { type: 'error', message: `服务器错误 ${resp.status}` }
    return
  }
  yield* readSse(resp.body)
}

/** 点「停止」：取消服务端这一轮（不落库、退积分）。只是离开页面不需要调用，生成会继续 */
export async function cancelTurn(jobId: string): Promise<void> {
  try { await authFetch('/chat/cancel', { method: 'POST', body: JSON.stringify({ job_id: jobId }) }) } catch { /* ignored */ }
}

export async function sendChat(
  message: string,
  threadId?: string,
  opts?: { regenerate?: boolean },
): Promise<
  | { ok: true; threadId: string; reply: string; artifacts: ChatArtifact[]; recommended: string[] }
  | { ok: false; error: string }
> {
  try {
    const resp = await authFetch('/chat', {
      method: 'POST',
      body: JSON.stringify({ message, thread_id: threadId, regenerate: opts?.regenerate }),
    })
    const data = await resp.json()
    if (!data.success) return { ok: false, error: data.error || '发送失败' }
    return {
      ok: true,
      threadId: data.thread_id,
      reply: data.reply,
      artifacts: data.artifacts,
      recommended: data.recommended ?? [],
    }
  } catch {
    return { ok: false, error: '连不上服务器，请稍后再试' }
  }
}

export async function fetchChatThreads(): Promise<ChatThread[]> {
  try {
    const resp = await authFetch('/chat/threads')
    const data = await resp.json()
    return data.success ? data.threads : []
  } catch {
    return []
  }
}

export async function fetchChatHistory(threadId: string): Promise<ChatMessage[]> {
  try {
    const resp = await authFetch(`/chat/${encodeURIComponent(threadId)}`)
    const data = await resp.json()
    return data.success ? data.messages : []
  } catch {
    return []
  }
}

export async function renameThread(
  threadId: string,
  title: string,
): Promise<{ ok: true; title: string } | { ok: false; error: string }> {
  try {
    const resp = await authFetch(`/chat/${encodeURIComponent(threadId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ title }),
    })
    const data = await resp.json()
    if (!data.success) return { ok: false, error: data.error || '重命名失败' }
    return { ok: true, title: data.title }
  } catch {
    return { ok: false, error: '连不上服务器，请稍后再试' }
  }
}

export async function deleteThread(threadId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const resp = await authFetch(`/chat/${encodeURIComponent(threadId)}`, { method: 'DELETE' })
    const data = await resp.json()
    if (!data.success) return { ok: false, error: data.error || '删除失败' }
    return { ok: true }
  } catch {
    return { ok: false, error: '连不上服务器，请稍后再试' }
  }
}


// ── 文件上传 ─────────────────────────────────────────────────────────────────

export interface UploadedDoc {
  id: string
  name: string
  kind: 'pdf' | 'docx'
  size: number
  chars: number
  truncated: boolean
  expires_at: string
}

/** 上传一个文件。用 XHR 是为了拿到真实的上传进度（fetch 做不到）。 */
export function uploadFile(
  file: File,
  onProgress?: (pct: number) => void,
): { promise: Promise<{ ok: true; file: UploadedDoc } | { ok: false; error: string }>; abort: () => void } {
  const xhr = new XMLHttpRequest()
  const promise = new Promise<{ ok: true; file: UploadedDoc } | { ok: false; error: string }>((resolve) => {
    const base = import.meta.env.VITE_API_BASE || '/api'
    xhr.open('POST', `${base}/upload`)
    const token = getToken()
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.min(99, Math.round((e.loaded / e.total) * 100)))
    }
    xhr.onload = () => {
      if (xhr.status === 401) window.dispatchEvent(new Event(AUTH_REQUIRED_EVENT))
      try {
        const data = JSON.parse(xhr.responseText)
        if (data.success) { onProgress?.(100); resolve({ ok: true, file: data.file }) }
        else resolve({ ok: false, error: data.error || '上传失败' })
      } catch {
        resolve({ ok: false, error: xhr.status === 413 ? '文件超过 10MB，请压缩或精简后再传' : '上传失败，请稍后再试' })
      }
    }
    xhr.onerror = () => resolve({ ok: false, error: '连不上服务器，请稍后再试' })
    xhr.onabort = () => resolve({ ok: false, error: '已取消' })
    const fd = new FormData()
    fd.append('file', file)
    xhr.send(fd)
  })
  return { promise, abort: () => xhr.abort() }
}

export async function deleteUpload(id: string): Promise<void> {
  try { await authFetch(`/upload/${encodeURIComponent(id)}`, { method: 'DELETE' }) } catch { /* 静默：到期会自动清理 */ }
}

/** 浏览器端先拦一道，省得白传；后端仍会按内容再校验 */
export function checkUploadable(file: File): string | null {
  if (file.size > 10 * 1024 * 1024) return `「${file.name}」超过 10MB，请压缩或精简后再传`
  if (!/\.(pdf|docx)$/i.test(file.name)) return `「${file.name}」格式不支持，目前只支持 PDF 和 Word（.docx）`
  return null
}

// ── 积分（以服务端账本为准）──────────────────────────────────────────────────

export interface CreditsInfo {
  balance: number
  spent: number
  ledger: { id: string; amount: number; kind: string; title: string; date: string }[]
}

/** 取当前余额和最近流水。未登录或网络失败返回 null，由调用方保持原样 */
export async function fetchCredits(): Promise<CreditsInfo | null> {
  try {
    const resp = await authFetch('/credits')
    if (!resp.ok) return null
    const data = await resp.json()
    return data.success ? { balance: data.balance, spent: data.spent, ledger: data.ledger } : null
  } catch {
    return null
  }
}

// ── 偏好 ─────────────────────────────────────────────────────────────────────

/** 账号偏好：choose_variant「同类工具让我自己挑」；digest_off「不再弹每日开屏卡片」。都存在账号里 */
export interface Prefs { choose_variant: boolean; digest_off: boolean }

export async function fetchPrefs(): Promise<Prefs | null> {
  try {
    const resp = await authFetch('/prefs')
    if (!resp.ok) return null
    const data = await resp.json()
    return data.success ? { choose_variant: !!data.choose_variant, digest_off: !!data.digest_off } : null
  } catch {
    return null
  }
}

export async function setDigestOff(value: boolean): Promise<boolean> {
  try {
    const resp = await authFetch('/prefs', { method: 'PUT', body: JSON.stringify({ digest_off: value }) })
    const data = await resp.json()
    return !!data.success
  } catch {
    return false
  }
}

export async function setChooseVariant(value: boolean): Promise<boolean> {
  try {
    const resp = await authFetch('/prefs', { method: 'PUT', body: JSON.stringify({ choose_variant: value }) })
    const data = await resp.json()
    return !!data.success
  } catch {
    return false
  }
}


// ── AI 日报（免费、不需要登录）────────────────────────────────────────────────

export interface AiDigest {
  markdown: string
  sources: ChatSource[]
  concept?: { term: string; plain: string; why: string } | null
  /** 首页弹窗和卡片用的概述 */
  preview?: { headline: string; highlights: { who: string; text: string }[]; count: number }
  /** 数据源的生成时间：CDN 有缓存，可能是前一天的 */
  feed_generated_at?: string
}

export async function fetchAiDigest(): Promise<{ ok: true; digest: AiDigest } | { ok: false; error: string }> {
  try {
    const resp = await fetch(`${API_BASE}/ai-digest`)
    const data = await resp.json()
    if (!data.success) return { ok: false, error: data.error || '暂时取不到' }
    return { ok: true, digest: data as AiDigest }
  } catch {
    return { ok: false, error: '连不上服务器，请稍后再试' }
  }
}

// ── 工作台（服务端存储，跟账号走）──────────────────────────────────────────────

export interface WsStage { id: string; label: string }
export interface WsTarget {
  id: string; ws_id: string; org: string; role: string; city: string; channel: string
  stage: string; jd: string; note: string; created_at: string; updated_at: string
  /** 这条投递用的哪版简历（工作台里的一份简历类工具结果） */
  resume_output_id: string | null
  /** 留学申请的选校梯度：reach 冲刺 / match 主申 / safety 保底；求职投递为空 */
  tier: string
}
export interface WsStageLog { id: string; target_id: string; from_stage: string; to_stage: string; at: string }
export interface WsUpcoming {
  type: 'event' | 'todo'; id: string; ws_id: string; title: string; date: string
  kind: WsEvent['kind'] | 'todo'; target_id: string | null; org: string; role: string; overdue: boolean
}
export interface WsEvent {
  id: string; ws_id: string; target_id: string | null; title: string; date: string
  kind: 'deadline' | 'test' | 'interview' | 'other'; done: boolean
}
export interface WsTodo { id: string; ws_id: string; target_id: string | null; text: string; due: string; done: boolean }
export interface WsOutput {
  id: string; ws_id: string | null; target_id: string | null; skill_id: string; skill_name: string
  credits: number; thread_id: string | null; hint: string; created_at: string; preview: string
  output?: string
}
export interface WsSummary {
  id: string; kind: 'job' | 'abroad'; name: string; icon: string; goal: string; deadline: string
  target_count: number; open_todos: number; updated_at: string
}
export interface WsThread { target_id: string; thread_id: string; summary: string; updated_at: string; title: string }
export interface WsFull extends WsSummary {
  stages: WsStage[]; targets: WsTarget[]; events: WsEvent[]; todos: WsTodo[]; outputs: WsOutput[]
  stage_log: WsStageLog[]; threads: WsThread[]
}

async function wsCall<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    const resp = await authFetch(path, init)
    if (!resp.ok) return null
    const data = await resp.json()
    return data.success ? (data as T) : null
  } catch {
    return null
  }
}
const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) })

/** 「求职数据」页：口径见后端 workspace_stats。rate 为 null 表示样本不到 min_sample 条，不给比例 */
export interface WsStatsStep {
  id: string; label: string; reached: number; passed: number | null; rate: number | null
  ended: number; avg_days: number | null; days_n: number
}
export interface WsStats {
  kind: 'job' | 'abroad'; enrolled: number | null
  total: number; active: number; closed: number; interviews: number; offers: number
  interview_rate: number | null; offer_rate: number | null; steps: WsStatsStep[]
  stuck: { id: string; label: string; count: number } | null
  weekly: { week: string; count: number }[]; min_sample: number
}

export const wsApi = {
  list: () => wsCall<{ workspaces: WsSummary[] }>('/workspaces').then((d) => d?.workspaces ?? null),
  /** 开启某一类工作台（已经有就返回那个）。返回工作台 id */
  create: (kind: 'job' | 'abroad') => wsCall<{ id: string }>('/workspaces', json('POST', { kind })).then((d) => d?.id ?? null),
  upcoming: () => wsCall<{ items: WsUpcoming[]; overdue: number }>('/workspaces/upcoming'),
  stats: (id: string) => wsCall<{ stats: WsStats }>(`/workspaces/${encodeURIComponent(id)}/stats`).then((d) => d?.stats ?? null),
  /** 存一份简历原文作为简历版本：粘贴文字，或用刚上传的文件 */
  addResume: async (body: { name: string; text?: string; upload_id?: string; kind?: 'job' | 'abroad' }): Promise<{ ok: true; output: WsOutput } | { ok: false; error: string }> => {
    try {
      const resp = await authFetch('/workspaces/resumes', json('POST', body))
      const data = await resp.json()
      return data.success ? { ok: true, output: data.output } : { ok: false, error: data.error || '没保存成功，稍后再试' }
    } catch {
      return { ok: false, error: '连不上服务器，请稍后再试' }
    }
  },
  /** 打开求职类工具表单前：对上工作台里的投递就带入简历、JD、岗位。from 是来源投递，没带入为空 */
  prefill: (skillId: string, hint: string, given: Record<string, string>) =>
    wsCall<{ prefill: Record<string, string>; from: string }>('/workspaces/prefill', json('POST', { skill_id: skillId, hint, given })),
  get: (id: string) => wsCall<{ workspace: WsFull }>(`/workspaces/${encodeURIComponent(id)}`).then((d) => d?.workspace ?? null),
  update: (id: string, f: Partial<Pick<WsSummary, 'name' | 'goal' | 'deadline'>>) =>
    wsCall(`/workspaces/${encodeURIComponent(id)}`, json('PATCH', f)),
  addTarget: (wsId: string, f: Partial<WsTarget>) =>
    wsCall<{ target: WsTarget }>(`/workspaces/${encodeURIComponent(wsId)}/targets`, json('POST', f)).then((d) => d?.target ?? null),
  updateTarget: (id: string, f: Partial<WsTarget>) =>
    wsCall<{ target: WsTarget }>(`/ws-targets/${encodeURIComponent(id)}`, json('PATCH', f)).then((d) => d?.target ?? null),
  deleteTarget: (id: string) => wsCall(`/ws-targets/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  addEvent: (wsId: string, f: { title: string; date: string; kind?: WsEvent['kind']; target_id?: string | null }) =>
    wsCall<{ event: WsEvent }>(`/workspaces/${encodeURIComponent(wsId)}/events`, json('POST', f)).then((d) => d?.event ?? null),
  updateEvent: (id: string, f: Partial<WsEvent>) => wsCall(`/ws-events/${encodeURIComponent(id)}`, json('PATCH', f)),
  deleteEvent: (id: string) => wsCall(`/ws-events/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  addTodo: (wsId: string, f: { text: string; due?: string; target_id?: string | null }) =>
    wsCall<{ todo: WsTodo }>(`/workspaces/${encodeURIComponent(wsId)}/todos`, json('POST', f)).then((d) => d?.todo ?? null),
  updateTodo: (id: string, f: Partial<WsTodo>) => wsCall(`/ws-todos/${encodeURIComponent(id)}`, json('PATCH', f)),
  deleteTodo: (id: string) => wsCall(`/ws-todos/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  outputs: () => wsCall<{ outputs: WsOutput[] }>('/ws-outputs').then((d) => d?.outputs ?? null),
  output: (id: string) => wsCall<{ output: WsOutput }>(`/ws-outputs/${encodeURIComponent(id)}`).then((d) => d?.output ?? null),
  updateOutput: (id: string, f: { target_id: string | null }) => wsCall(`/ws-outputs/${encodeURIComponent(id)}`, json('PATCH', f)),
  deleteOutput: (id: string) => wsCall(`/ws-outputs/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  progress: (threadId: string) =>
    wsCall<{ items: ProgressItem[] }>(`/chat/${encodeURIComponent(threadId)}/progress`, { method: 'POST' }).then((d) => d?.items ?? []),
  applyProgress: (threadId: string, items: ProgressItem[]) =>
    wsCall<{ targets: number; roles: number; stages: number; events: number; todos: number }>(
      `/chat/${encodeURIComponent(threadId)}/progress/apply`, json('POST', { items })),
  importLocal: (payload: unknown) =>
    wsCall<{ todos: number; runs: number }>('/workspaces/import-local', json('POST', payload)),
}
