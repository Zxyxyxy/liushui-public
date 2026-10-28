/** 场景：对应文档 3.2 首期四大场景 */
export type SceneId = 'study' | 'job' | 'abroad' | 'exam'

/** 产品类型：文档 2.1–2.3 三类可运行产品 */
export type ProductKind = 'tool' | 'expert' | 'workflow'

export interface Scene {
  id: SceneId
  name: string
  short: string
  tagline: string
  icon: string
  accent: string
  /** 用于场景卡的水色渐变 */
  gradient: string
}

export interface CreatorBadge {
  label: string
  kind: 'personal' | 'pro' | 'org' | 'company' | 'official'
}

export interface Creator {
  id: string
  name: string
  avatar: string
  badge: CreatorBadge
  bio: string
  followers: number
  toolCount: number
  monthlyActiveUsers: number
}

export interface ToolField {
  key: string
  label: string
  type: 'text' | 'textarea' | 'select' | 'file'
  placeholder?: string
  options?: string[]
  required?: boolean
  hint?: string
  /** 文本框支持「上传 PDF / Word 自动填入」 */
  upload?: boolean
}

export interface RunStep {
  title: string
  detail: string
  credits: number
}

export interface Review {
  id: string
  user: string
  avatar: string
  rating: number
  date: string
  text: string
  verified?: boolean  // 该用户有对应 skill 的运行记录
}

export interface Tool {
  id: string
  name: string
  /** 一句话结果承诺 */
  promise: string
  scene: SceneId
  kind: ProductKind
  creatorId: string
  credits: number
  users: number
  rating: number
  reviewCount: number
  tags: string[]
  /** 适用场景 */
  goodFor: string[]
  /** 需要用户提供什么 */
  needs: string[]
  fields: ToolField[]
  steps: RunStep[]
  fileTypes: string[]
  outputTypes: string[]
  externalData: string[]
  sample: { input: string; output: string }
  /** 卡片图标 emoji */
  icon: string
  isNew?: boolean
  isHot?: boolean
  isOfficial?: boolean
  /** 后端是否已接入真实执行（LLM）。false/undefined 时走前端模拟结果 */
  is_executable?: boolean
  /** 同类备选：group 相同的是同一件事、侧重不同的版本；同组里排最前的是默认推荐 */
  group?: string
  /** 这一版的侧重，一词概括，如「量化成果」 */
  variantLabel?: string
  recommendReason?: string
  /** 对比维度，如 { 侧重, 适合, 输出, 注意 } */
  compareDims?: Record<string, string>
  /** 卡片上的推荐词，如「按时长分页」。和 sourceInfo 分开：没有开源来源的工具也可以有 */
  badge?: string
  /** 开源来源信息，用于 ToolDetail 可靠性展示 */
  sourceInfo?: {
    repo: string    // 开源项目名，如 "essay-skills"
    stars: number   // GitHub star 数（真实值）
    origin: string  // 一句话来源说明
    badge: string   // 卡片 badge 文字
  }
}

export interface Post {
  id: string
  title: string
  excerpt: string
  body: string[]
  author: string
  avatar: string
  authorBadge?: string
  scene: SceneId
  tags: string[]
  likes: number
  comments: number
  views: number
  date: string
  cover: string
  relatedToolIds: string[]
  /** 结果前后对比 */
  beforeAfter?: { before: string; after: string }
}

export interface Comment {
  id: string
  user: string
  avatar: string
  text: string
  date: string
  likes: number
}

export interface Todo {
  id: string
  text: string
  done: boolean
  due?: string
}

export interface TimelineEvent {
  id: string
  date: string
  title: string
  detail: string
  kind: 'run' | 'file' | 'note' | 'milestone'
}

export interface WorkspaceFile {
  id: string
  name: string
  size: string
  kind: string
  date: string
}

export interface RunRecord {
  id: string
  toolId: string
  toolName: string
  credits: number
  date: string
  status: 'success' | 'running' | 'failed'
  summary: string
}

export interface Workspace {
  id: string
  name: string
  goal: string
  scene: SceneId
  icon: string
  progress: number
  deadline: string
  files: WorkspaceFile[]
  todos: Todo[]
  timeline: TimelineEvent[]
  runs: RunRecord[]
  toolIds: string[]
  postIds: string[]
}

export interface LedgerEntry {
  id: string
  date: string
  title: string
  amount: number
  kind: 'spend' | 'earn'
}
