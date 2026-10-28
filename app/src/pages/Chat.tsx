import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useApp } from '../store/AppContext'
import { useAuth } from '../store/AuthContext'
import { useSkills } from '../store/SkillsContext'
import { ChatBubble, type BubbleActions } from '../components/ChatBubble'
import { ChatFormCard } from '../components/ChatForm'
import { SkillChoice } from '../components/SkillChoice'
import { SaveToWorkspace } from '../components/SaveToWorkspace'
import { ProgressConfirm } from '../components/ProgressConfirm'
import { PublishPost } from '../components/PublishPost'
import { SAMPLE_INTENTS } from '../lib/intent'
import {
  sendChatStream,
  fetchChatThreads,
  fetchChatHistory,
  deleteThread,
  renameThread,
  uploadFile,
  deleteUpload,
  checkUploadable,
  wsApi,
  fetchLiveTurn,
  followTurn,
  cancelTurn,
  type ChatArtifact,
  type LiveTurn,
  type ProgressItem,
  type ChatMessage,
  type ChatStep,
  type ChatThread,
  type FormSubmission,
  type StreamEvent,
} from '../lib/api'

/** 从首页带过来的首条消息，经路由 state 传递 */
interface ChatNavState {
  initial?: string
  /** 从首页日报卡片进来：直接展示今天的日报 */
  digest?: boolean
  /** 要在会话里直接打开哪个工具的参数表单 */
  openTool?: string
}

interface Attachment {
  key: string
  name: string
  progress: number
  /** 上传成功后服务端给的 id；没有就是还在传或已失败 */
  id?: string
  error?: string
}

const MAX_ATTACH = 3

interface Failure {
  error: string
  /** 发送失败时保留原文，点「重试」直接重发 */
  text: string
  atts?: Attachment[]
}

/** 按最近更新时间分组：今天 / 昨天 / 近 7 天 / 更早 */
function groupThreads(list: ChatThread[]): { label: string; items: ChatThread[] }[] {
  const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const today = dayStart(new Date())
  const groups = [
    { label: '今天', items: [] as ChatThread[] },
    { label: '昨天', items: [] as ChatThread[] },
    { label: '近 7 天', items: [] as ChatThread[] },
    { label: '更早', items: [] as ChatThread[] },
  ]
  for (const t of list) {
    const diff = Math.round((today - dayStart(new Date(t.updated_at))) / 86400000)
    groups[diff <= 0 ? 0 : diff === 1 ? 1 : diff <= 7 ? 2 : 3].items.push(t)
  }
  return groups.filter((g) => g.items.length > 0)
}

export function Chat() {
  const { threadId } = useParams<{ threadId?: string }>()
  const loc = useLocation()
  const nav = useNavigate()
  const { user, ready, openAuth } = useAuth()
  const { toast, refreshCredits } = useApp()
  const { skillsMap } = useSkills()

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [q, setQ] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(false)
  const [missing, setMissing] = useState(false)
  const [failure, setFailure] = useState<Failure | null>(null)
  const [toolProgress, setToolProgress] = useState<string | null>(null)
  // 会话里正在填的工具表单；没有就是 null
  const [form, setForm] = useState<{ skillId: string; prefill?: Record<string, string> } | null>(null)
  // 最近一次表单里手写的输入：给「重新运行」「猜你想做」预填用
  const [lastInputs, setLastInputs] = useState<Record<string, string> | undefined>(undefined)
  const [saveArt, setSaveArt] = useState<ChatArtifact | null>(null)
  // 回答下面待确认的求职进度：只存在当前页面，处理完或换会话就没了，不落库
  const [progress, setProgress] = useState<{ thread: string; at: number; items: ProgressItem[] } | null>(null)
  const [publishArt, setPublishArt] = useState<ChatArtifact | null>(null)
  // 待发送的附件：上传中 / 已就绪 / 失败
  const [atts, setAtts] = useState<Attachment[]>([])
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const uploadsRef = useRef<Record<string, () => void>>({})
  const [threads, setThreads] = useState<ChatThread[]>([])
  // 新会话第一条消息发出后、服务端还没回来前，侧边栏先占一个位
  const [pendingTitle, setPendingTitle] = useState<string | null>(null)
  const [drawer, setDrawer] = useState(false)

  // 侧边栏条目操作
  const [menuId, setMenuId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renamingRef = useRef<string | null>(null)

  // 滚动：只在用户贴底时跟随新内容；上翻查看历史时不拽回，并给「回到底部」
  const scrollRef = useRef<HTMLDivElement>(null)
  const stickRef = useRef(true)
  // 一轮回答正常结束后，要把页面滚到这条回答的第一行
  const jumpToAnswerRef = useRef(false)
  const [showJump, setShowJump] = useState(false)
  const taRef = useRef<HTMLTextAreaElement>(null)

  // 当前正在看的会话（新会话记为 'new'）。回复回来时用它判断用户是否已经切走
  const viewRef = useRef<string>(threadId ?? 'new')
  // 本页刚创建的会话 id：路由从 /chat 换成 /chat/:id 时，消息已在内存里，不必重新拉取
  const ownThread = useRef<string | undefined>(undefined)
  // 首页带来的首条消息只发一次（StrictMode 下 effect 会跑两次）
  const startedRef = useRef(false)
  // 上一次载入的是哪个账号的哪个会话（`用户id|会话id或new`）：只有它变了才清空消息
  const loadedRef = useRef<string | null>(null)
  // 有「带着要打开的工具进来」的请求还没处理
  const pendingToolRef = useRef(false)

  // 路由（会话）变化：载入历史
  useEffect(() => {
    const key = threadId ?? 'new'
    if (viewRef.current !== key) {
      viewRef.current = key
      setSending(false)
      setFailure(null)
      // 带着 openTool 进来时，表单是紧接着由另一个 effect 打开的，这里不能把它清掉
      if (!pendingToolRef.current) setForm(null)
      setPendingTitle(null)
      stickRef.current = true
    }
    setMissing(false)

    if (threadId && threadId === ownThread.current) {
      ownThread.current = undefined
      loadedRef.current = `${user?.id}|${threadId}`
      setLoading(false)
      return
    }
    if (!user) return
    const sig = `${user.id}|${threadId ?? 'new'}`
    const same = loadedRef.current === sig
    loadedRef.current = sig
    if (!threadId) {
      // 同一个新对话里 effect 重跑时不能清空（开发模式 StrictMode 会把挂载时的 effect 跑两遍）：
      // 首页带来的首条消息这时已经发出、正在生成，清掉后回答无处可写，界面会停在欢迎页
      if (!same) {
        setMessages([])
        // 在新对话里发问后马上离开，服务端那一轮还没落库、没有对话编号：回来时接上它
        if (!startedRef.current) fetchLiveTurn().then((live) => { if (live && viewRef.current === 'new') resume(live) })
      }
      setLoading(false)
      return
    }

    let alive = true
    setMessages([])
    setLoading(true)
    Promise.all([fetchChatHistory(threadId), fetchLiveTurn(threadId)]).then(([h, live]) => {
      if (!alive) return
      setLoading(false)
      if (h.length === 0 && !live) setMissing(true)
      else {
        setMessages(h)
        // 上一轮停在「等用户确认表单」：刷新后把表单恢复出来
        const f = h[h.length - 1]?.form
        if (f && !live) setForm({ skillId: f.skillId, prefill: f.prefill })
        if (live) resume(live)
      }
    })
    return () => {
      alive = false
    }
  }, [threadId, user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // 会话列表
  useEffect(() => {
    if (!user) { setThreads([]); return }
    let alive = true
    fetchChatThreads().then((t) => { if (alive) setThreads(t) })
    return () => { alive = false }
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  function onScroll() {
    const el = scrollRef.current
    if (!el) return
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    stickRef.current = near
    setShowJump(!near)
  }

  function jumpToBottom() {
    const el = scrollRef.current
    if (!el) return
    stickRef.current = true
    setShowJump(false)
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }

  useEffect(() => {
    const el = scrollRef.current
    if (el && stickRef.current) el.scrollTop = el.scrollHeight
  }, [messages, sending, loading, failure, form])

  // 回答生成完：滚到这条回答的第一行，不用用户自己往上翻
  useEffect(() => {
    if (sending || !jumpToAnswerRef.current) return
    jumpToAnswerRef.current = false
    const root = scrollRef.current
    if (!root) return
    const idx = messages.map((m) => m.role).lastIndexOf('assistant')
    const el = root.querySelector<HTMLElement>(`[data-msg-idx="${idx}"]`)
    if (!el) return
    stickRef.current = false
    el.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [sending, messages])

  // 输入框随内容长高，最多 200px
  useEffect(() => {
    const el = taRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [q])

  // AbortController：用于中断当前生成
  const abortRef = useRef<AbortController | null>(null)
  // 当前这一轮在服务端的任务编号：点「停止」时取消用。离开页面只断开本地的读取，不取消服务端
  const jobRef = useRef<string | null>(null)

  function addFiles(list: File[]) {
    if (!user) { openAuth(); return }
    const room = MAX_ATTACH - atts.length
    if (list.length > room) toast(`一条消息最多带 ${MAX_ATTACH} 个文件`, 'warn')
    for (const f of list.slice(0, Math.max(room, 0))) {
      const bad = checkUploadable(f)
      if (bad) { toast(bad, 'warn'); continue }
      const key = `${Date.now()}-${Math.random()}`
      setAtts((a) => [...a, { key, name: f.name, progress: 0 }])
      const { promise, abort } = uploadFile(f, (pct) =>
        setAtts((a) => a.map((x) => (x.key === key ? { ...x, progress: pct } : x))))
      uploadsRef.current[key] = abort
      promise.then((r) => {
        delete uploadsRef.current[key]
        setAtts((a) => {
          if (!a.some((x) => x.key === key)) {
            // 上传期间用户已经移除了它：服务端那份也删掉
            if (r.ok) deleteUpload(r.file.id)
            return a
          }
          return a.map((x) => (x.key === key ? (r.ok ? { ...x, id: r.file.id, progress: 100 } : { ...x, error: r.error }) : x))
        })
      })
    }
  }

  // 离开对话页：还没发送的附件在服务端也一并删掉，不留残件
  const attsRef = useRef<Attachment[]>([])
  attsRef.current = atts
  useEffect(() => () => { abortRef.current?.abort() }, [])

  useEffect(() => () => {
    for (const a of attsRef.current) {
      uploadsRef.current[a.key]?.()
      if (a.id) deleteUpload(a.id)
    }
  }, [])

  function removeAtt(a: Attachment) {
    uploadsRef.current[a.key]?.()
    if (a.id) deleteUpload(a.id)
    setAtts((list) => list.filter((x) => x.key !== a.key))
  }

  const uploading = atts.some((a) => !a.id && !a.error)
  const readyIds = atts.filter((a) => a.id).map((a) => a.id!)

  /** 一轮运行出了结果：积分已由服务端扣好、结果已由服务端存进工作台，这里只刷新余额 */
  function settleArtifacts(_arts: ChatArtifact[]) {
    refreshCredits()
  }

  /**
   * 统一的流处理：发消息、重新生成、提交工具表单三种入口都走这里。
   * 先占一个空的助手气泡，之后按事件往里填：token 追加文字，step 更新过程，
   * tool_done 挂结果卡片，skill_choice 挂备选选择，done 收尾。
   */
  async function runStream(
    start: (signal: AbortSignal) => AsyncGenerator<StreamEvent>,
    opts: {
      /** 出错时怎么回滚界面 */
      onError: (message: string) => void
      /** 用户点停止时怎么回滚界面 */
      onAbort: () => void
      /** 新会话第一条的标题占位 */
      pendingTitle?: string
      /** 普通对话（不是表单运行、不是日报）：结束后识别这几轮里的求职进度 */
      checkProgress?: boolean
    },
  ) {
    setProgress(null)
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    // 新会话拿到 id 后页面标记会换成新 id，这里的 key 要跟着换，不然收尾时会误以为用户切走了
    let key = viewRef.current
    stickRef.current = true
    setSending(true)
    setToolProgress(null)
    if (opts.pendingTitle && !threadId) setPendingTitle(opts.pendingTitle)
    setMessages((m) => [...m, { role: 'assistant', content: '' }])

    const patchLast = (fn: (last: ChatMessage) => ChatMessage) =>
      setMessages((m) => {
        const last = m[m.length - 1]
        if (last?.role !== 'assistant') return m
        return [...m.slice(0, -1), fn(last)]
      })

    try {
      for await (const ev of start(ctrl.signal)) {
        if (viewRef.current !== key) { fetchChatThreads().then(setThreads); return }

        if (ev.type === 'job') {
          jobRef.current = ev.job_id ?? null
        } else if (ev.type === 'cancelled') {
          if (viewRef.current === key) opts.onAbort()
          return
        } else if (ev.type === 'token') {
          patchLast((l) => ({ ...l, content: l.content + (ev.text ?? '') }))
        } else if (ev.type === 'step' && ev.id) {
          const step: ChatStep = { id: ev.id, state: ev.state ?? 'running', label: ev.label ?? '', detail: ev.detail }
          patchLast((l) => {
            const cur = l.steps ?? []
            const has = cur.some((x) => x.id === step.id)
            return { ...l, steps: has ? cur.map((x) => (x.id === step.id ? { ...x, ...step, detail: step.detail ?? x.detail } : x)) : [...cur, step] }
          })
        } else if (ev.type === 'tool_start') {
          setToolProgress(`正在使用「${ev.name}」…`)
        } else if (ev.type === 'tool_done') {
          setToolProgress(null)
          if (ev.artifact) patchLast((l) => ({ ...l, artifacts: [...(l.artifacts ?? []), ev.artifact!] }))
        } else if (ev.type === 'research') {
          // 联网研究完成：接收五段结构 + 核对过的事实 + 往年规律
          patchLast((l) => ({
            ...l,
            content: l.content || '',
            sections: ev.sections ?? {},
            facts: ev.facts ?? [],
            inferred: ev.inferred ?? [],
          }))
        } else if (ev.type === 'skill_form' && ev.skill_id) {
          // 模型想用这个工具：不直接运行，把它问到的信息预填成表单，等用户检查后点运行
          setForm({ skillId: ev.skill_id, prefill: ev.prefill })
        } else if (ev.type === 'skill_choice') {
          patchLast((l) => ({ ...l, choice: { skill_ids: ev.skill_ids ?? [], prefill: ev.prefill ?? {} } }))
        } else if (ev.type === 'done') {
          patchLast((l) => ({
            ...l,
            // 步骤只是这一轮的过程，结果出来后留着当「做了什么」的记录，但不再转圈
            steps: l.steps?.map((x) => (x.state === 'running' ? { ...x, state: 'done' as const } : x)),
            artifacts: ev.artifacts?.length ? ev.artifacts : l.artifacts,
            recommended: ev.recommended?.length ? ev.recommended : undefined,
            sources: ev.sources?.length ? ev.sources : undefined,
          }))
          jumpToAnswerRef.current = true
          if (!threadId && ev.thread_id) {
            ownThread.current = ev.thread_id
            viewRef.current = ev.thread_id
            key = ev.thread_id
            nav(`/chat/${ev.thread_id}`, { replace: true })
          }
          fetchChatThreads().then((t) => { setThreads(t); setPendingTitle(null) })
          if (ev.artifacts?.length) settleArtifacts(ev.artifacts)
          // 回答已经显示出来了，再单独去识别进度：不拖慢回答。识别回来时用户已经切走就不显示
          const tid = ev.thread_id || threadId
          if (opts.checkProgress && tid) {
            const at = Date.now()
            wsApi.progress(tid).then((items) => {
              if (items.length && viewRef.current === tid) setProgress({ thread: tid, at, items })
            })
          }
        } else if (ev.type === 'error') {
          opts.onError(ev.message ?? '未知错误')
        }
      }
    } catch (e: unknown) {
      if ((e as Error)?.name === 'AbortError') {
        if (viewRef.current === key) opts.onAbort()
        return
      }
      opts.onError('连不上服务器，请稍后再试')
    } finally {
      if (viewRef.current === key) {
        setSending(false)
        setToolProgress(null)
        jobRef.current = null
      }
      // 不管成功、失败还是被停止：服务端可能扣了或退了积分，余额以服务端为准重新取一次
      refreshCredits()
    }
  }

  /** 回到一个还在生成的对话：问题还没落库，先补上显示；回答从服务端已产出的部分接着往下 */
  function resume(live: LiveTurn) {
    if (live.kind !== 'regenerate') {
      setMessages((m) => [...m, {
        role: 'user', content: live.display,
        attachments: live.attachments.length ? live.attachments : undefined,
        run: live.kind === 'run' ? 'resumed' : undefined,
      }])
    }
    runStream(
      (signal) => followTurn(live.id, signal),
      {
        checkProgress: live.kind === 'message',
        onError: (message) => {
          setMessages((m) => m.filter((x) => !(x.role === 'assistant' && x.content === '' && !x.steps?.length)))
          toast(message, 'warn')
        },
        onAbort: () => { setMessages((m) => m.slice(0, live.kind === 'regenerate' ? -1 : -2)) },
      },
    )
  }

  /** 看今天的 AI 日报：服务端直接回日报（已核对来源），不经过模型、不扣积分 */
  async function openDigest() {
    if (sending || loading) return
    if (!user) { openAuth(); return }
    setFailure(null)
    setForm(null)
    setMessages((m) => [...m, { role: 'user', content: '看看今天的 AI 日报' }])
    await runStream(
      (signal) => sendChatStream('', threadId, { signal, digest: true }),
      {
        pendingTitle: '今天的 AI 日报',
        onError: (message) => {
          setMessages((m) => m.filter((x) => !(x.role === 'assistant' && x.content === '' && !x.steps?.length)).slice(0, -1))
          setPendingTitle(null)
          toast(message, 'warn')
        },
        onAbort: () => {
          setMessages((m) => m.slice(0, -2))
          setPendingTitle(null)
        },
      },
    )
  }

  async function send(text?: string, retryAtts?: Attachment[]) {
    const msg = (text ?? q).trim()
    // 重试时沿用上一次的附件；正常发送用当前已就绪的附件
    const sentAtts = retryAtts ?? atts.filter((a) => a.id)
    if ((!msg && sentAtts.length === 0) || sending || loading || uploading) return
    if (!user) { setQ(msg); openAuth(); return }

    // 上一次发送失败遗留的那条用户消息没有落库，新一轮发出前先丢掉（重试也走这里）
    const dropFailed = failure !== null
    setFailure(null)
    setForm(null)
    setMessages((m) => [...(dropFailed ? m.slice(0, -1) : m), {
      role: 'user',
      content: msg,
      attachments: sentAtts.length ? sentAtts.map((a) => ({ id: a.id!, name: a.name })) : undefined,
    }])
    setQ('')
    setAtts([])

    await runStream(
      (signal) => sendChatStream(msg, threadId, { signal, attachments: sentAtts.map((a) => a.id!) }),
      {
        pendingTitle: (msg || `📎 ${sentAtts[0]?.name ?? ''}`).slice(0, 30),
        checkProgress: true,
        onError: (message) => {
          setMessages((m) => m.filter((x) => !(x.role === 'assistant' && x.content === '' && !x.steps?.length)))
          setPendingTitle(null)
          setFailure({ error: message, text: msg, atts: sentAtts })
        },
        // 用户点了停止：这一轮服务端不落库，界面同步回滚，原话放回输入框方便改了再发
        onAbort: () => {
          setMessages((m) => m.slice(0, -2))
          setQ(msg)
          setAtts(sentAtts)
          setPendingTitle(null)
        },
      },
    )
  }

  // 重新生成：regenerate 标志让服务端用最后一条用户消息重跑；失败或停止时原样恢复旧回复
  async function regenerate() {
    if (sending || loading || !threadId) return
    const lastUser = messages.map((m) => m.role).lastIndexOf('user')
    if (lastUser < 0) return
    const prev = messages
    setFailure(null)
    setForm(null)
    setMessages(messages.slice(0, lastUser + 1))
    await runStream(
      (signal) => sendChatStream('', threadId, { regenerate: true, signal }),
      {
        onError: (message) => { setMessages(prev); toast(message, 'warn') },
        onAbort: () => setMessages(prev),
      },
    )
  }

  // ── 在会话里使用工具 ─────────────────────────────────────────

  /**
   * 打开某个工具的参数表单（会话内，不跳页）。
   * 用户已经点名要用这个工具（详情页、工作台、「猜你想做」、「重新运行」、对比卡片里的「用这个」），
   * 一律直接开它的表单，不再弹对比让用户重选。对比只出现在「模型推荐工具」的那一刻。
   */
  async function openTool(skillId: string, prefill?: Record<string, string>) {
    if (!user) { openAuth(); return }
    if (sending) return
    if (!skillsMap[skillId]) return
    // 求职类工具：用户最近一句话对上工作台里的某条投递，就把它的简历、JD 带进表单（服务端判断，别的工具返回空）
    const hint = [...messages].reverse().find((m) => m.role === 'user' && !m.run)?.content ?? ''
    const ws = await wsApi.prefill(skillId, hint, prefill ?? {})
    const added = ws?.prefill ?? {}
    setForm({ skillId, prefill: Object.keys(added).length ? { ...(prefill ?? {}), ...added } : prefill })
    if (ws?.from) toast(`已从工作台带入${ws.from}，检查后再运行`, 'info')
    stickRef.current = true
  }

  /** 提交表单：直接运行这个工具，结果回到会话里 */
  async function submitForm(skillId: string, fields: FormSubmission) {
    const tool = skillsMap[skillId]
    if (!tool || sending) return
    // 手写部分记下来，给「猜你想做」预填；文件内容不回传前端，所以带不过去
    const typed: Record<string, string> = {}
    for (const [k, v] of Object.entries(fields)) if (v.text) typed[k] = v.text
    setLastInputs(typed)
    setForm(null)
    setFailure(null)
    const shown = tool.fields
      .map((f) => {
        const v = fields[f.key]
        if (!v?.text && !v?.uploads?.length) return null
        const val = v.uploads?.length ? '已上传文件' : (v.text ?? '').replace(/\s+/g, ' ').slice(0, 40)
        return `${f.label}：${val}`
      })
      .filter(Boolean)
      .join('\n')
    setMessages((m) => [...m, { role: 'user', content: `使用「${tool.name}」\n${shown}`, run: skillId }])

    await runStream(
      (signal) => sendChatStream('', threadId, { signal, runSkill: { skillId, fields } }),
      {
        pendingTitle: `使用「${tool.name}」`,
        onError: (message) => {
          setMessages((m) => m.filter((x) => !(x.role === 'assistant' && x.content === '' && !x.steps?.length)))
          setPendingTitle(null)
          toast(message, 'warn')
          // 失败不扣积分，表单留着让用户改完再来
          setMessages((m) => m.slice(0, -1))
          setForm({ skillId, prefill: typed })
        },
        onAbort: () => {
          setMessages((m) => m.slice(0, -2))
          setForm({ skillId, prefill: typed })
        },
      },
    )
  }

  const actions: BubbleActions = {
    openTool,
    save: (a) => setSaveArt(a),
    publish: (a) => setPublishArt(a),
    rerun: (sid) => openTool(sid, lastInputs),
  }

  // 从工具详情页 / 旧的运行页链接带着 openTool 进来：技能列表就绪后，在会话里展开该工具的表单。
  // Chat 是同一个组件实例，用户可以多次从不同工具点「开始使用」回来，所以不能用「只打开一次」的
  // 标记；每次路由 state 里带着新的请求就处理一次，处理完立刻清掉 state，既防刷新重开，也让下次生效。
  const wantTool = (loc.state as ChatNavState | null)?.openTool
  // 渲染期间就标记「有工具要打开」，让上面的路由载入 effect 知道别清表单
  pendingToolRef.current = !!wantTool
  useEffect(() => {
    if (!wantTool || !ready || Object.keys(skillsMap).length === 0) return
    pendingToolRef.current = false
    nav(loc.pathname, { replace: true, state: null })
    if (!user) { openAuth(); return }
    openTool(wantTool)
  }, [wantTool, ready, skillsMap]) // eslint-disable-line react-hooks/exhaustive-deps

  // 首页发起：登录态确认后自动发送首条消息，并立刻清掉路由 state（否则刷新会重发）
  const initial = (loc.state as ChatNavState | null)?.initial
  const wantDigest = !!(loc.state as ChatNavState | null)?.digest
  useEffect(() => {
    if ((!initial && !wantDigest) || !ready || startedRef.current) return
    startedRef.current = true
    nav(loc.pathname, { replace: true, state: null })
    if (wantDigest) { openDigest(); return }
    if (user) send(initial)
    else { setQ(initial!); openAuth() }
  }, [initial, wantDigest, ready]) // eslint-disable-line react-hooks/exhaustive-deps

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      send()
    }
  }

  // ── 侧边栏条目：重命名 / 删除 ──
  function startRename(t: ChatThread) {
    setMenuId(null)
    renamingRef.current = t.id
    setRenameValue(t.title || '')
    setRenamingId(t.id)
  }

  async function commitRename() {
    const id = renamingRef.current
    if (!id) return   // Enter 之后输入框卸载会再触发一次 blur，这里挡掉
    renamingRef.current = null
    setRenamingId(null)
    const v = renameValue.trim()
    const old = threads.find((t) => t.id === id)
    if (!v || !old || v === old.title) return
    setThreads((prev) => prev.map((t) => (t.id === id ? { ...t, title: v } : t)))
    const r = await renameThread(id, v)
    if (!r.ok) {
      setThreads((prev) => prev.map((t) => (t.id === id ? { ...t, title: old.title } : t)))
      toast(r.error, 'warn')
    }
  }

  function cancelRename() {
    renamingRef.current = null
    setRenamingId(null)
  }

  async function handleDelete(id: string) {
    if (deleting) return
    setDeleting(true)
    const r = await deleteThread(id)
    setDeleting(false)
    setConfirmDeleteId(null)
    if (!r.ok) { toast(r.error ?? '删除失败', 'warn'); return }
    setThreads((prev) => prev.filter((t) => t.id !== id))
    if (id === threadId) nav('/chat', { replace: true })
  }

  function renderThread(t: ChatThread) {
    const active = t.id === threadId
    const rowCls = `group relative flex items-center rounded-xl transition-colors ${
      active ? 'bg-water-100' : 'hover:bg-water-100/60'
    }`

    if (renamingId === t.id) {
      return (
        <div key={t.id} className={rowCls}>
          <input
            autoFocus
            value={renameValue}
            maxLength={60}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) commitRename()
              else if (e.key === 'Escape') cancelRename()
            }}
            className="mx-1.5 my-1 w-full rounded-lg border border-water-300 bg-white px-2 py-1 text-sm text-ink-900 outline-none"
          />
        </div>
      )
    }

    if (confirmDeleteId === t.id) {
      return (
        <div key={t.id} className={rowCls}>
          <div className="flex w-full items-center justify-between gap-1 px-3 py-2">
            <span className="truncate text-xs text-ink-500">确认删除？</span>
            <div className="flex shrink-0 gap-1">
              <button
                disabled={deleting}
                onClick={() => handleDelete(t.id)}
                className="rounded-lg bg-red-500 px-2 py-0.5 text-[11px] font-semibold text-white transition-opacity hover:bg-red-600 disabled:opacity-50"
              >
                {deleting ? '…' : '删除'}
              </button>
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="rounded-lg bg-ink-100 px-2 py-0.5 text-[11px] font-semibold text-ink-600 transition-colors hover:bg-ink-200"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div key={t.id} className={rowCls}>
        <Link
          to={`/chat/${t.id}`}
          onClick={() => setDrawer(false)}
          className={`min-w-0 flex-1 truncate px-3 py-2 text-sm ${
            active ? 'font-semibold text-water-800' : 'text-ink-700'
          }`}
        >
          {t.title || '新对话'}
        </Link>
        <button
          onClick={() => setMenuId(menuId === t.id ? null : t.id)}
          aria-label="更多操作"
          className={`mr-1.5 shrink-0 rounded-md px-1.5 py-0.5 text-base leading-none text-ink-400 transition-opacity hover:bg-white hover:text-ink-700 focus-visible:opacity-100 ${
            menuId === t.id || active ? 'opacity-100' : 'opacity-100 md:opacity-0 md:group-hover:opacity-100'
          }`}
        >
          ⋯
        </button>
        {menuId === t.id && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setMenuId(null)} />
            <div className="glass-deep absolute right-1 top-full z-40 mt-1 w-28 overflow-hidden p-1">
              <button
                onClick={() => startRename(t)}
                className="block w-full rounded-lg px-2.5 py-1.5 text-left text-xs text-ink-700 transition-colors hover:bg-water-100/70"
              >
                重命名
              </button>
              <button
                onClick={() => { setMenuId(null); setConfirmDeleteId(t.id) }}
                className="block w-full rounded-lg px-2.5 py-1.5 text-left text-xs text-red-500 transition-colors hover:bg-red-50"
              >
                删除
              </button>
            </div>
          </>
        )}
      </div>
    )
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="p-3">
        <Link
          to="/chat"
          onClick={() => setDrawer(false)}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-water-200 bg-white/80 px-3 py-2 text-sm font-medium text-water-700 transition-colors hover:border-water-300 hover:bg-white"
        >
          <span className="text-base leading-none">＋</span> 新对话
        </Link>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {!user && <p className="px-2 py-3 text-xs text-ink-300">登录后可查看历史对话</p>}
        {user && threads.length === 0 && !pendingTitle && (
          <p className="px-2 py-3 text-xs text-ink-300">暂无历史对话</p>
        )}
        {pendingTitle && !threadId && (
          <div className="mb-1 flex items-center gap-2 rounded-xl bg-water-100 px-3 py-2">
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-water-800">{pendingTitle}</span>
            <span className="inline-block h-3 w-3 shrink-0 animate-[spin_1s_linear_infinite] rounded-full border-2 border-water-200 border-t-water-500" />
          </div>
        )}
        {groupThreads(threads).map((g) => (
          <div key={g.label} className="mb-2">
            <p className="px-3 pb-1 pt-2 text-[11px] font-semibold text-ink-400">{g.label}</p>
            <div className="space-y-0.5">{g.items.map(renderThread)}</div>
          </div>
        ))}
      </div>
    </div>
  )

  // 有表单在填时也不算空：此时该让表单居中显示，而不是下面还挂着「你现在想完成什么」和示例问题
  const empty = messages.length === 0 && !sending && !loading && !missing && !form
  const lastIdx = messages.length - 1

  return (
    <div className="mx-auto flex h-full max-w-6xl gap-0 px-0 sm:px-3">
      {/* 左侧历史（桌面常驻，手机抽屉） */}
      <aside className="hidden w-64 shrink-0 border-r border-water-100 bg-white/40 md:block">{sidebar}</aside>
      {drawer && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-ink-900/30" onClick={() => setDrawer(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-white shadow-xl">{sidebar}</aside>
        </div>
      )}

      {/* 主对话区 */}
      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 px-4 py-2 md:hidden">
          <button
            onClick={() => setDrawer(true)}
            className="rounded-full border border-water-200 bg-white/80 px-3 py-1 text-xs font-medium text-water-700"
          >
            🕘 历史对话
          </button>
          <Link to="/chat" className="rounded-full border border-water-200 bg-white/80 px-3 py-1 text-xs font-medium text-ink-700">
            ＋ 新对话
          </Link>
        </div>

        <div className="relative min-h-0 flex-1">
          <div ref={scrollRef} onScroll={onScroll} className="h-full overflow-y-auto px-4 py-4">
            <div className="mx-auto max-w-3xl space-y-4">
              {ready && !user && (
                <div className="glass mx-auto mt-16 max-w-sm p-6 text-center">
                  <p className="font-bold text-ink-900">登录后开始对话</p>
                  <p className="mt-1.5 text-xs leading-relaxed text-ink-500">对话会保存在你的账号里，换设备也能接着聊。</p>
                  <button onClick={openAuth} className="btn-water mt-4 px-6 py-2.5">登录 / 注册</button>
                </div>
              )}

              {user && loading && (
                <div className="py-10 text-center text-sm text-ink-400">加载对话中…</div>
              )}

              {user && missing && (
                <div className="glass mx-auto mt-16 max-w-sm p-6 text-center">
                  <p className="font-bold text-ink-900">没有找到这个对话</p>
                  <p className="mt-1.5 text-xs leading-relaxed text-ink-500">它可能已不存在，或不属于当前账号。</p>
                  <Link to="/chat" className="btn-water mt-4 inline-block px-6 py-2.5">开始新对话</Link>
                </div>
              )}

              {user && empty && (
                <div className="mt-16 text-center">
                  <p className="text-xl font-bold text-ink-900">你现在想<span className="text-flow">完成什么</span>？</p>
                  <p className="mt-2 text-sm text-ink-500">直接说你想办的事，我帮你找对的工具、做出结果。</p>
                  <div className="mx-auto mt-6 grid max-w-xl gap-2 sm:grid-cols-2">
                    {SAMPLE_INTENTS.slice(0, 4).map((s) => (
                      <button
                        key={s}
                        onClick={() => send(s)}
                        className="glass rounded-2xl px-4 py-3 text-left text-sm leading-relaxed text-ink-700 transition-colors hover:border-water-300 hover:bg-white"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m, i) => (
                <div key={i} data-msg-idx={i} className="scroll-mt-3 space-y-3">
                  <ChatBubble
                    message={m}
                    actions={actions}
                    isLast={i === lastIdx}
                    busy={sending}
                    lastInputs={lastInputs}
                    onRegenerate={
                      // 表单运行出来的结果没有「重新生成」（那是重跑模型对话），只有「重新运行」
                      m.role === 'assistant' && i === lastIdx && !sending && !failure && threadId &&
                      !m.run && !messages[i - 1]?.run && !m.choice
                        ? regenerate
                        : undefined
                    }
                  />
                  {m.choice && (
                    <SkillChoice
                      skillIds={m.choice.skill_ids}
                      disabled={sending || i !== lastIdx}
                      onPick={(t) => {
                        setForm({ skillId: t.id, prefill: m.choice!.prefill })
                        stickRef.current = true
                      }}
                    />
                  )}
                </div>
              ))}

              {progress && progress.thread === threadId && !sending && (
                <ProgressConfirm
                  key={progress.at}
                  threadId={progress.thread}
                  items={progress.items}
                  onDone={() => setProgress(null)}
                />
              )}

              {form && skillsMap[form.skillId] && (
                <ChatFormCard
                  key={form.skillId + JSON.stringify(form.prefill ?? {})}
                  tool={skillsMap[form.skillId]}
                  prefill={form.prefill}
                  busy={sending}
                  onSubmit={(f) => submitForm(form.skillId, f)}
                  onCancel={() => setForm(null)}
                />
              )}

              {toolProgress && sending && (
                <div className="glass inline-flex items-center gap-2.5 px-4 py-3 text-sm text-water-700">
                  <span className="inline-block h-4 w-4 animate-[spin_1.2s_linear_infinite] rounded-full border-[3px] border-water-200 border-t-water-500" />
                  {toolProgress}
                </div>
              )}
              {!toolProgress && sending && (
                <div className="glass inline-flex items-center gap-2.5 px-4 py-3 text-sm text-ink-500">
                  <span className="inline-block h-4 w-4 animate-[spin_1.2s_linear_infinite] rounded-full border-[3px] border-water-200 border-t-water-500" />
                  正在思考…
                </div>
              )}

              {failure && !sending && (
                <div className="flex flex-wrap items-center gap-3 rounded-xl bg-accent-coral/10 px-4 py-3 text-sm text-accent-coral">
                  <span className="min-w-0 flex-1">{failure.error}</span>
                  <button
                    onClick={() => send(failure.text, failure.atts)}
                    className="shrink-0 rounded-lg bg-white/80 px-3 py-1 text-xs font-semibold text-accent-coral transition-colors hover:bg-white"
                  >
                    重试
                  </button>
                </div>
              )}
            </div>
          </div>

          {showJump && (
            <button
              onClick={jumpToBottom}
              className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-water-200 bg-white/95 px-3.5 py-1.5 text-xs font-medium text-water-700 shadow-md transition-colors hover:bg-white"
            >
              ↓ 回到底部
            </button>
          )}
        </div>

        {/* 底部输入框 */}
        <div className="px-4 pb-4 pt-2">
          <div
            className={`glass-deep mx-auto max-w-3xl p-2 transition-all ${dragOver ? 'ring-2 ring-water-400' : ''}`}
            style={{ boxShadow: 'var(--shadow-water-glow)' }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(Array.from(e.dataTransfer.files ?? [])) }}
          >
            {atts.length > 0 && (
              <div className="flex flex-wrap gap-2 px-2 pb-1 pt-1">
                {atts.map((a) => (
                  <div
                    key={a.key}
                    className={`flex max-w-[16rem] items-center gap-2 rounded-xl border px-2.5 py-1.5 text-xs ${
                      a.error ? 'border-accent-coral/40 bg-accent-coral/10' : 'border-water-200 bg-white/80'
                    }`}
                  >
                    <span aria-hidden>{a.error ? '⚠️' : a.id ? '📄' : '⏳'}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-ink-800">{a.name}</span>
                      <span className={`block truncate ${a.error ? 'text-accent-coral' : 'text-ink-400'}`}>
                        {a.error ?? (a.id ? '已读取' : `上传中 ${a.progress}%`)}
                      </span>
                    </span>
                    <button onClick={() => removeAtt(a)} aria-label="移除" className="shrink-0 text-base leading-none text-ink-300 hover:text-accent-coral">×</button>
                  </div>
                ))}
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              multiple
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={(e) => { addFiles(Array.from(e.target.files ?? [])); e.target.value = '' }}
            />
            <div className="flex items-end gap-2">
              <button
                onClick={() => (user ? fileRef.current?.click() : openAuth())}
                disabled={sending || atts.length >= MAX_ATTACH}
                title="上传 PDF / Word（10MB 以内）"
                aria-label="添加附件"
                className="mb-1 ml-1 grid h-10 w-10 shrink-0 place-items-center rounded-full text-lg text-ink-400 transition-colors hover:bg-water-100 hover:text-water-700 disabled:opacity-40"
              >
                📎
              </button>
              <textarea
                ref={taRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onKeyDown}
                rows={1}
                maxLength={20000}
                placeholder={empty ? '说说你想完成的事…' : '继续说…'}
                className="max-h-[200px] min-h-[44px] flex-1 resize-none bg-transparent px-4 py-2.5 text-[15px] leading-relaxed text-ink-900 outline-none placeholder:text-ink-300"
              />
              {sending ? (
                <button
                  onClick={() => {
                    // 先让服务端取消（退积分、不落库），再断开本地读取
                    if (jobRef.current) cancelTurn(jobRef.current)
                    abortRef.current?.abort()
                  }}
                  className="btn-water mb-1 mr-1 flex shrink-0 items-center gap-2 px-6 py-3"
                >
                  <span className="inline-block h-3 w-3 rounded-sm bg-white" />
                  停止
                </button>
              ) : (
                <button
                  onClick={() => send()}
                  disabled={(!q.trim() && !readyIds.length) || loading || uploading}
                  className="btn-water mb-1 mr-1 shrink-0 px-6 py-3"
                >
                  发送
                </button>
              )}
            </div>
          </div>
          <div className="mx-auto mt-1.5 flex max-w-3xl flex-wrap items-center justify-center gap-2 px-2 text-[11px] text-ink-300">
            <span>上传的文件仅用于本次对话中的分析，保存 7 天后自动删除，你也可以随时移除。</span>
          </div>
        </div>
      </section>

      <SaveToWorkspace art={saveArt} onClose={() => setSaveArt(null)} />
      {publishArt && skillsMap[publishArt.skill_id] && (
        <PublishPost
          open
          onClose={() => setPublishArt(null)}
          tool={skillsMap[publishArt.skill_id]}
          markdown={publishArt.output}
        />
      )}
    </div>
  )
}

/** 把对话里的一个结果转成工作台能归档的运行记录 */
