import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useSkills } from '../store/SkillsContext'
import { POST_MAP } from '../data/posts'
import { useApp } from '../store/AppContext'
import { useAuth } from '../store/AuthContext'
import { ToolRow } from '../components/ToolCard'
import { PostRow } from '../components/PostCard'
import { Empty, Modal, Tabs, stag } from '../components/ui/Ui'
import { Select } from '../components/ui/Select'
import { DownloadMenu } from '../components/DownloadMenu'
import { Bubbles, FlowField } from '../components/water/Water'
import { Markdown } from '../lib/markdown'
import { checkUploadable, uploadFile, wsApi, type WsEvent, type WsFull, type WsStats, type WsOutput, type WsSummary, type WsTarget } from '../lib/api'

type Tab = 'overview' | 'stats' | 'outputs' | 'saved'

const EVENT_KIND: Record<WsEvent['kind'], { label: string; icon: string }> = {
  deadline: { label: '截止', icon: '⏰' },
  test: { label: '笔试/测评', icon: '📝' },
  interview: { label: '面试', icon: '🎤' },
  other: { label: '其他', icon: '📌' },
}

const today = () => new Date().toISOString().slice(0, 10)
const shortDate = (iso: string) => iso.slice(0, 10)

type Kind = WsSummary['kind']
/** 求职和留学共用一套界面，只是叫法不同 */
const TERMS = {
  job: {
    item: '投递', org: '公司', role: '岗位', city: '城市', channel: '渠道：官网 / 内推 / 招聘 App',
    req: '岗位 JD（选填，之后用工具时可以直接带上）', doc: '简历', docUse: '投递用的简历',
    docEmpty: '还没有简历版本。上传或粘贴一份简历原文，之后用求职工具时会自动带上。', toolDoc: '优化报告',
    data: '求职数据', start: 'applied', eventPh: '如：字节二面', eventEmpty: '还没有笔试、面试或截止日期',
    emptyHint: '把在投或想投的公司加进来。在对话里用求职工具时，结果也能一键归到对应公司。',
    fill: '点开补充城市、渠道、JD', weekly: '投递量',
    outputsEmpty: '还没有工具结果。在对话里用简历、面试类工具，结果会自动出现在这里。',
    statsEmpty: '在「投递与日程」里记下投递，这里会算出各阶段的转化和用时。',
  },
  abroad: {
    item: '申请', org: '学校', role: '项目', city: '国家/地区', channel: '申请轮次，如 R1、R2',
    req: '项目要求：语言、GPA、需要的材料（选填，用文书工具时会一起带上）', doc: '文书', docUse: '这所学校用的文书',
    docEmpty: '还没有文书版本。上传或粘贴一份文书原文，之后用文书工具时会自动带上。', toolDoc: '工具生成',
    data: '申请数据', start: 'shortlist', eventPh: '如：UCL 截止', eventEmpty: '还没有截止日期、面试或考试安排',
    emptyHint: '把在考虑或已申请的学校项目加进来，会自动生成一份材料清单。在对话里用选校、文书工具时，结果也能归到对应学校。',
    fill: '点开补充国家、轮次、项目要求', weekly: '提交量',
    outputsEmpty: '还没有工具结果。在对话里用选校、文书类工具，结果会自动出现在这里。',
    statsEmpty: '在「申请与日程」里把申请推进到「已提交」，这里会算出录取率和各阶段用时。',
  },
} as const
const termsOf = (ws: { kind: Kind }) => TERMS[ws.kind] ?? TERMS.job

// 结果好的那几个阶段：用绿色
const WIN = new Set(['offer', 'admitted', 'enrolled'])

// 留学申请的选校梯度
const TIER: Record<string, { label: string; tone: string }> = {
  reach: { label: '冲刺', tone: 'bg-accent-coral/10 text-accent-coral' },
  match: { label: '主申', tone: 'bg-water-100 text-water-700' },
  safety: { label: '保底', tone: 'bg-accent-mint/10 text-accent-mint' },
}
function TierBadge({ tier }: { tier?: string }) {
  const t = tier ? TIER[tier] : undefined
  return t ? <span className={`shrink-0 rounded px-1.5 py-px text-[10px] font-semibold ${t.tone}`}>{t.label}</span> : null
}

export function Workspace() {
  const { user, ready, openAuth } = useAuth()
  const [params, setParams] = useSearchParams()
  const [list, setList] = useState<WsSummary[] | null>(null)
  const [ws, setWs] = useState<WsFull | null>(null)
  const [tab, setTab] = useState<Tab>('overview')
  const [loadFailed, setLoadFailed] = useState(false)

  const activeId = params.get('id') ?? list?.[0]?.id

  useEffect(() => {
    if (!user) { setList(null); setWs(null); return }
    wsApi.list().then((l) => { if (l) setList(l); else setLoadFailed(true) })
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const reload = useCallback(async () => {
    if (!activeId) return
    const full = await wsApi.get(activeId)
    if (full) setWs(full)
    else setLoadFailed(true)
  }, [activeId])

  useEffect(() => { setWs(null); reload() }, [reload])

  async function openAbroad() {
    const id = await wsApi.create('abroad')
    if (!id) return
    const l = await wsApi.list()
    if (l) setList(l)
    setParams({ id }, { replace: true })
  }

  if (ready && !user) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-20">
        <Empty icon="🗂️" title="登录后才能使用工作台" sub="工作台里存的是你的投递、简历版本和面试记录，跟着账号走，换设备也能看到。" />
        <div className="mt-4 flex justify-center">
          <button onClick={openAuth} className="btn-water px-5 py-2">登录</button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <section className="relative overflow-hidden pb-4 pt-6">
        <FlowField />
        <Bubbles count={8} />
        <div className="relative mx-auto max-w-7xl px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">
                {user?.nickname ? `${user.nickname}的` : '我的'}<span className="text-flow">工作台</span>
              </h1>
            </div>
            {ws && <HeaderStats ws={ws} />}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-5 pb-10">
        {loadFailed && !ws ? (
          <Empty icon="🫧" title="工作台暂时打不开" sub="连不上服务器，稍后刷新试试。" />
        ) : !ws ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }, (_, i) => <div key={i} className="skeleton-water h-24 rounded-water" />)}
          </div>
        ) : (
          <>
            {list && (
              <div className="mb-4 flex flex-wrap gap-2">
                {list.map((w) => (
                  <button
                    key={w.id}
                    onClick={() => setParams({ id: w.id }, { replace: true })}
                    className={`chip ${w.id === ws.id ? 'chip-on' : ''}`}
                  >
                    {w.icon} {w.name}
                  </button>
                ))}
                {!list.some((w) => w.kind === 'abroad') && (
                  <button onClick={openAbroad} className="chip border-dashed text-water-700">＋ 开启留学申请</button>
                )}
              </div>
            )}

            <GoalBar ws={ws} onSaved={reload} />

            <div className="mt-5">
              <Tabs
                tabs={[
                  { id: 'overview' as const, label: `${termsOf(ws).item}与日程`, count: ws.targets.length },
                  { id: 'stats' as const, label: termsOf(ws).data },
                  { id: 'outputs' as const, label: '工具结果', count: ws.outputs.length },
                  { id: 'saved' as const, label: '收藏' },
                ]}
                value={tab}
                onChange={setTab}
              />
            </div>

            <div key={tab} className="mt-5" style={{ animation: 'rise .4s cubic-bezier(.22,1,.36,1) both' }}>
              {tab === 'overview' && <Overview ws={ws} reload={reload} focus={params.get('target')} />}
              {tab === 'stats' && <Stats ws={ws} />}
              {tab === 'outputs' && <Outputs ws={ws} reload={reload} />}
              {tab === 'saved' && <Saved />}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// 积分余额顶部导航栏里已经有了，这里不重复
function HeaderStats({ ws }: { ws: WsFull }) {
  const active = ws.targets.filter((t) => t.stage !== 'closed').length
  const upcoming = ws.events.filter((e) => !e.done && e.date >= today()).length
  const open = ws.todos.filter((t) => !t.done).length
  return (
    <div className="flex shrink-0 gap-3">
      <Stat label={`进行中的${termsOf(ws).item}`} value={active} />
      <Stat label="待办日程" value={upcoming} />
      <Stat label="待办" value={open} />
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="glass min-w-[76px] rounded-2xl px-3.5 py-2 text-center">
      <p className="text-xl font-bold tabular-nums text-ink-900">{value}</p>
      <p className="text-[11px] text-ink-400">{label}</p>
    </div>
  )
}

/** 工作台目标：一句话目标 + 截止日期，可直接编辑 */
function GoalBar({ ws, onSaved }: { ws: WsFull; onSaved: () => void }) {
  const [editing, setEditing] = useState(false)
  const [goal, setGoal] = useState(ws.goal)
  const [deadline, setDeadline] = useState(ws.deadline)
  const days = ws.deadline ? Math.ceil((new Date(ws.deadline).getTime() - Date.now()) / 86400000) : null

  async function save() {
    await wsApi.update(ws.id, { goal: goal.trim(), deadline })
    setEditing(false)
    onSaved()
  }

  return (
    <div className="glass-deep flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
      <span className="text-2xl">{ws.icon}</span>
      {editing ? (
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row">
          <input value={goal} onChange={(e) => setGoal(e.target.value)} className="field flex-1 py-2 text-sm" placeholder={ws.kind === 'abroad' ? '目标，如：拿到 UCL BA 的录取' : '目标，如：12 月前拿到一份产品岗 offer'} />
          <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="field py-2 text-sm sm:w-44" />
          <button onClick={save} className="btn-water shrink-0 px-4 py-2 text-sm">保存</button>
        </div>
      ) : (
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold text-ink-900">{ws.name}</p>
          <p className="mt-0.5 text-sm text-ink-500">
            <span className="font-semibold text-ink-700">目标：</span>{ws.goal || '还没写目标'}
            {days !== null && <span className="ml-2 text-xs text-ink-400">· {days >= 0 ? `距截止 ${days} 天` : '已过截止日期'}（{ws.deadline}）</span>}
          </p>
        </div>
      )}
      {!editing && <button onClick={() => setEditing(true)} className="btn-quiet shrink-0 px-3 py-1.5 text-xs">编辑目标</button>}
    </div>
  )
}

/* ─────────────── 投递与日程 ─────────────── */

type View = 'pipeline' | 'list'
type ListFilter = 'active' | 'closed' | 'all'
const VIEW_KEY = 'liushui.ws.view'

/** 结束态：已拿 offer 和已结束。看板上照样占一列，列表默认不显示「已结束」 */
const isClosed = (stage: string) => stage === 'closed'

function stageTone(stage: string) {
  if (WIN.has(stage)) return 'bg-accent-mint/15 text-accent-mint'
  if (stage === 'closed') return 'bg-ink-100 text-ink-400'
  return 'bg-water-100 text-water-700'
}

function Overview({ ws, reload, focus }: { ws: WsFull; reload: () => Promise<void>; focus: string | null }) {
  const { toast } = useApp()
  const [adding, setAdding] = useState<string | null>(null)   // 新建时预选的阶段
  const terms = termsOf(ws)
  const [editing, setEditing] = useState<WsTarget | null>(null)
  const [view, setView] = useState<View>(() => (localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'pipeline'))
  const [flash, setFlash] = useState<string | null>(null)   // 刚移动的卡片短暂高亮
  const [filter, setFilter] = useState<ListFilter>('active')
  // 拖动中：先在本地改阶段，界面马上跟手；服务端失败再刷回来
  const [moved, setMoved] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!focus) return
    const t = ws.targets.find((x) => x.id === focus)
    if (t) setEditing(t)
  }, [focus]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { try { localStorage.setItem(VIEW_KEY, view) } catch { /* ignored */ } }, [view])

  const targets = ws.targets.map((t) => (moved[t.id] ? { ...t, stage: moved[t.id] } : t))

  async function moveTo(t: WsTarget, stage: string) {
    if (t.stage === stage) return
    setMoved((m) => ({ ...m, [t.id]: stage }))
    const ok = await wsApi.updateTarget(t.id, { stage })
    if (!ok) toast('没改成功，稍后再试', 'warn')
    else {
      toast(`「${t.org}」已移到「${ws.stages.find((x) => x.id === stage)?.label ?? stage}」`)
      setFlash(t.id)
      setTimeout(() => setFlash((f) => (f === t.id ? null : f)), 1600)
    }
    await reload()
    // 服务端的数据回来了，本地的临时改动就不需要了（失败时这一步也把卡片放回原位）
    setMoved((m) => { const n = { ...m }; delete n[t.id]; return n })
  }

  return (
    <div className="space-y-4">
      <WeekStrip ws={ws} />

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="glass min-w-0 p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-ink-900">我的{terms.item}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex gap-1 rounded-full border border-water-200/70 bg-white/60 p-1">
                {([['pipeline', '流程'], ['list', '列表']] as const).map(([k, l]) => (
                  <button key={k} onClick={() => setView(k)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${view === k ? 'bg-water-500 text-white' : 'text-ink-500 hover:text-water-700'}`}>
                    {l}
                  </button>
                ))}
              </div>
              <button onClick={() => setAdding(terms.start)} className="btn-water shrink-0 px-4 py-1.5 text-xs">+ 新建{terms.item}</button>
            </div>
          </div>

          {targets.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-water-200 px-4 py-8 text-center">
              <p className="text-sm text-ink-600">还没有{terms.item}记录</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-400">{terms.emptyHint}</p>
            </div>
          ) : view === 'pipeline' ? (
            <Pipeline ws={ws} targets={targets} onOpen={setEditing} onMove={moveTo} onAdd={setAdding} flash={flash} />
          ) : (
            <TargetList ws={ws} targets={targets} filter={filter} setFilter={setFilter} onOpen={setEditing} />
          )}
        </div>

        <div className="space-y-4">
          <Events ws={ws} reload={reload} />
          <Todos ws={ws} reload={reload} />
        </div>
      </div>

      {adding && <TargetModal ws={ws} initialStage={adding} onClose={() => setAdding(null)} onSaved={() => { setAdding(null); reload() }} />}
      {editing && <TargetModal ws={ws} target={editing} reload={reload} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload() }} />}
    </div>
  )
}

/** 卡片上的小字：下一个日程、简历版本、挂了几份结果。
 *  已拿 offer、已结束的投递不再显示日程：拖到这里后还挂着「三面」的日期，会让人以为它还在三面 */
function useTargetMeta(ws: WsFull) {
  return (t: WsTarget) => {
    const finished = t.stage === 'offer' || t.stage === 'enrolled' || t.stage === 'closed'
    const open = finished ? [] : ws.events.filter((e) => e.target_id === t.id && !e.done)
    const next = open.filter((e) => e.date >= today()).sort((a, b) => a.date.localeCompare(b.date))[0]
    const overdue = open.filter((e) => e.date < today()).length
    const outputs = ws.outputs.filter((o) => o.target_id === t.id).length
    const resume = t.resume_output_id ? ws.outputs.find((o) => o.id === t.resume_output_id) : undefined
    return { next, overdue, outputs, resume }
  }
}

/**
 * 漏斗：每个阶段「到达过」多少条。口径和后端 workspace_stats 一致：按阶段记录回放，
 * 往回拖视为纠正，退回去之后走过的那几步作废；已结束的按结束前停在哪一轮算；退回「想投」等于没投过。
 */
// 不算漏斗一层的阶段，那一行只显示当前有几条：求职的「想投」还没投出去；留学的「选校中」「准备材料」还没提交，
// 「面试」很多项目没有；「已结束」是出口。退回到 PRE 里的阶段等于没投过 / 没提交过
const OUTSIDE_FUNNEL: Record<Kind, Set<string>> = {
  job: new Set(['wish', 'closed']),
  abroad: new Set(['shortlist', 'prep', 'interview', 'closed']),
}
const PRE_FUNNEL: Record<Kind, Set<string>> = { job: new Set(['wish']), abroad: new Set(['shortlist', 'prep']) }
// 样本不到这么多条时不给比例，免得 1/1=100% 这种数字误导人
const MIN_SAMPLE = 5

function useFunnel(ws: WsFull, targets: WsTarget[]) {
  const order = ws.stages.filter((s) => !OUTSIDE_FUNNEL[ws.kind].has(s.id)).map((s) => s.id)
  const furthest = new Map<string, number>()
  for (const t of targets) {
    const logs = ws.stage_log.filter((l) => l.target_id === t.id)
    const path: number[] = []
    const enter = (stage: string) => {
      if (PRE_FUNNEL[ws.kind].has(stage)) { path.length = 0; return }
      const i = order.indexOf(stage)
      if (i < 0) return
      while (path.length && path[path.length - 1] > i) path.pop()
      if (!path.length || path[path.length - 1] < i) path.push(i)
    }
    if (logs.length && logs[0].from_stage) enter(logs[0].from_stage)
    else if (!logs.length) enter(t.stage)
    for (const l of logs) if (l.to_stage !== 'closed') enter(l.to_stage)
    if (t.stage !== 'closed') enter(t.stage)
    furthest.set(t.id, path.length ? path[path.length - 1] : -1)
  }
  const reached = order.map((_, i) => targets.filter((t) => (furthest.get(t.id) ?? -1) >= i).length)
  return { order, reached }
}

/** 竖向流程：每个阶段一行，左边是漏斗条（到达数和上一步的转化率），右边是现在停在这一步的投递。可以在行之间拖动 */
function Pipeline({ ws, targets, onOpen, onMove, onAdd, flash }: {
  ws: WsFull; targets: WsTarget[]; onOpen: (t: WsTarget) => void
  onMove: (t: WsTarget, stage: string) => void; onAdd: (stage: string) => void; flash: string | null
}) {
  const meta = useTargetMeta(ws)
  const terms = termsOf(ws)
  const { order, reached } = useFunnel(ws, targets)
  const [drag, setDrag] = useState<string | null>(null)
  const [over, setOver] = useState<string | null>(null)
  const top = Math.max(1, reached[0] ?? 0)

  return (
    <div className="space-y-1.5">
      {ws.stages.map((st) => {
        const here = targets.filter((t) => t.stage === st.id)
        const i = order.indexOf(st.id)
        const closed = OUTSIDE_FUNNEL[ws.kind].has(st.id)
        const n = closed ? here.length : reached[i]
        const prev = i > 0 ? reached[i - 1] : null
        const rate = !closed && prev && prev >= MIN_SAMPLE ? Math.round((n / prev) * 100) : null
        return (
          <div
            key={st.id}
            onDragOver={(e) => { e.preventDefault(); setOver(st.id) }}
            onDragLeave={() => setOver((o) => (o === st.id ? null : o))}
            onDrop={(e) => {
              e.preventDefault()
              const t = targets.find((x) => x.id === e.dataTransfer.getData('text/plain'))
              if (t) onMove(t, st.id)
              setDrag(null); setOver(null)
            }}
            className={`grid gap-3 rounded-2xl border p-2.5 transition-colors sm:grid-cols-[176px_1fr] ${
              over === st.id && drag ? 'border-water-400 bg-water-50'
                : closed ? 'border-dashed border-water-100 bg-white/30' : 'border-water-100/80 bg-white/40'
            }`}
          >
            {/* 漏斗条 */}
            <div className="flex flex-col justify-center gap-1 px-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${stageTone(st.id)}`}>{st.label}</span>
                <span className="text-[11px] text-ink-400 tabular-nums">
                  {closed ? `${n} 条` : <>到达 <b className="font-semibold text-ink-700">{n}</b></>}
                  {rate !== null && <span className={`ml-1 ${rate < 50 ? 'text-accent-coral' : 'text-accent-mint'}`}>{rate}%</span>}
                </span>
              </div>
              {!closed && (
                <div className="h-2 overflow-hidden rounded-full bg-water-50">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${WIN.has(st.id) ? 'bg-accent-mint' : 'bg-gradient-to-r from-water-300 to-water-500'}`}
                    style={{ width: `${(n / top) * 100}%` }}
                  />
                </div>
              )}
            </div>

            {/* 现在停在这一步的投递 */}
            <div className="flex min-h-11 flex-wrap items-center gap-2">
              {here.map((t) => {
                const m = meta(t)
                return (
                  <div
                    key={t.id}
                    draggable
                    title="拖到另一行可以改阶段"
                    onDragStart={(e) => { e.dataTransfer.setData('text/plain', t.id); e.dataTransfer.effectAllowed = 'move'; setDrag(t.id) }}
                    onDragEnd={() => { setDrag(null); setOver(null) }}
                    onClick={() => onOpen(t)}
                    className={`w-48 cursor-grab rounded-xl border bg-white px-3 py-2 text-left shadow-[0_4px_14px_-10px_rgba(0,119,182,.6)] transition-all active:cursor-grabbing ${
                      drag === t.id ? 'border-water-400 opacity-50'
                        : flash === t.id ? 'border-water-500 ring-4 ring-water-200/70'
                        : 'border-water-200/70 hover:border-water-400'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <p className="min-w-0 flex-1 truncate text-sm font-bold text-ink-900">{t.org}</p>
                      <span className={`shrink-0 rounded px-1.5 py-px text-[10px] font-semibold ${stageTone(t.stage)}`}>{st.label}</span>
                    </div>
                    {(t.role || t.tier) && (
                      <div className="flex items-center gap-1.5">
                        <p className="min-w-0 flex-1 truncate text-[11px] text-ink-500">{t.role}</p>
                        <TierBadge tier={t.tier} />
                      </div>
                    )}
                    {m.next ? (
                      <p className="mt-1 truncate text-[11px] text-water-700">{EVENT_KIND[m.next.kind].icon} {m.next.date.slice(5)} {m.next.title}</p>
                    ) : m.overdue > 0 ? (
                      <p className="mt-1 truncate text-[11px] text-accent-coral">{m.overdue} 个日程已过期，记得更新</p>
                    ) : null}
                    {(m.resume || m.outputs > 0) && (
                      <p className="mt-0.5 truncate text-[10px] text-ink-400">
                        {[m.resume ? `📄 已选${terms.doc}` : '', m.outputs ? `${m.outputs} 份结果` : ''].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                )
              })}
              <button onClick={() => onAdd(st.id)}
                className="rounded-xl border border-dashed border-water-200 px-3 py-2 text-[11px] text-ink-400 transition-colors hover:border-water-400 hover:text-water-700">
                + 添加
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function TargetList({ ws, targets, filter, setFilter, onOpen }: {
  ws: WsFull; targets: WsTarget[]; filter: ListFilter; setFilter: (f: ListFilter) => void; onOpen: (t: WsTarget) => void
}) {
  const meta = useTargetMeta(ws)
  const terms = termsOf(ws)
  const stageLabel = (id: string) => ws.stages.find((s) => s.id === id)?.label ?? id
  const shown = targets
    .filter((t) => filter === 'all' || (filter === 'closed' ? isClosed(t.stage) : !isClosed(t.stage)))
    .map((t) => ({ t, m: meta(t) }))
    // 有日程的按日期排在前，没日程的按最近更新排在后
    .sort((a, b) => (a.m.next && b.m.next ? a.m.next.date.localeCompare(b.m.next.date)
      : a.m.next ? -1 : b.m.next ? 1 : b.t.updated_at.localeCompare(a.t.updated_at)))
  const counts = {
    active: targets.filter((t) => !isClosed(t.stage)).length,
    closed: targets.filter((t) => isClosed(t.stage)).length,
    all: targets.length,
  }

  return (
    <>
      <div className="mb-3 flex gap-1.5">
        {([['active', '进行中'], ['closed', '已结束'], ['all', '全部']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className={`chip ${filter === k ? 'chip-on' : ''}`}>
            {l} <span className="tabular-nums opacity-70">{counts[k]}</span>
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="py-6 text-center text-xs text-ink-400">这里还没有{terms.item}</p>
      ) : (
        <div className="space-y-2">
          {shown.map(({ t, m }, i) => (
            <button
              key={t.id}
              onClick={() => onOpen(t)}
              className="stagger flex w-full items-center gap-3 rounded-2xl border border-water-200/60 bg-white/60 p-3.5 text-left transition-all duration-300 hover:border-water-400 hover:bg-white"
              style={stag(i)}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-ink-900">
                  {t.org} {t.role && <span className="font-medium text-ink-500">· {t.role}</span>} <TierBadge tier={t.tier} />
                </p>
                <p className="mt-0.5 truncate text-[11px] text-ink-400">
                  {[t.city, t.channel, m.resume ? `已选${terms.doc}` : '', m.outputs ? `${m.outputs} 份工具结果` : ''].filter(Boolean).join(' · ') || terms.fill}
                  {m.next && (
                    <span className={`ml-1 ${m.next.date < today() ? 'text-accent-coral' : 'text-water-700'}`}>
                      · {EVENT_KIND[m.next.kind].icon} {m.next.date} {m.next.title}
                    </span>
                  )}
                </p>
              </div>
              <span className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium ${stageTone(t.stage)}`}>{stageLabel(t.stage)}</span>
            </button>
          ))}
        </div>
      )}
    </>
  )
}

/** 工作台顶部的「这周要做的」：未来 7 天的日程和到期待办，过期的标红 */
function WeekStrip({ ws }: { ws: WsFull }) {
  const end = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
  const orgOf = (id: string | null) => ws.targets.find((t) => t.id === id)?.org
  const items = [
    ...ws.events.filter((e) => !e.done && e.date.slice(0, 10) <= end)
      .map((e) => ({ id: e.id, date: e.date.slice(0, 10), icon: EVENT_KIND[e.kind].icon, title: e.title, org: orgOf(e.target_id) })),
    ...ws.todos.filter((t) => !t.done && t.due && t.due.slice(0, 10) <= end)
      .map((t) => ({ id: t.id, date: t.due.slice(0, 10), icon: '☑️', title: t.text, org: orgOf(t.target_id) })),
  ].sort((a, b) => a.date.localeCompare(b.date))
  if (items.length === 0) return null
  const overdue = items.filter((x) => x.date < today()).length

  return (
    <div className="glass p-4">
      <div className="mb-2.5 flex items-baseline gap-2">
        <p className="text-sm font-bold text-ink-900">这周要做的</p>
        <span className="text-xs text-ink-400">{items.length} 项{overdue ? <span className="text-accent-coral"> · {overdue} 项已过期</span> : ''}</span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {items.map((x) => <WeekItem key={x.id} {...x} />)}
      </div>
    </div>
  )
}

function WeekItem({ date, icon, title, org }: { date: string; icon: string; title: string; org?: string }) {
  const d = new Date(date + 'T00:00:00')
  const diff = Math.round((d.getTime() - new Date(today() + 'T00:00:00').getTime()) / 86400000)
  const when = diff < 0 ? `过期 ${-diff} 天` : diff === 0 ? '今天' : diff === 1 ? '明天' : `周${'日一二三四五六'[d.getDay()]}`
  return (
    <div className={`w-44 shrink-0 rounded-xl border px-3 py-2 ${diff < 0 ? 'border-accent-coral/40 bg-accent-coral/5' : diff <= 1 ? 'border-water-300 bg-water-50' : 'border-water-100 bg-white/70'}`}>
      <p className={`text-[11px] font-semibold ${diff < 0 ? 'text-accent-coral' : 'text-water-700'}`}>{when} · {date.slice(5)}</p>
      <p className="mt-0.5 truncate text-sm text-ink-800">{icon} {title}</p>
      {org && <p className="truncate text-[11px] text-ink-400">{org}</p>}
    </div>
  )
}

/** 新建或编辑一条投递；编辑时下面列出它的日期、待办和工具结果 */
// 能当作「投递用的简历」的：用户自己存的原文，加上简历类工具的结果（那些是优化报告，不是能直接投的简历）
// 留学这边是文书：用户存的原文，加上文书类工具生成的版本
const DOC_SOURCE: Record<Kind, string> = { job: 'resume-source', abroad: 'essay-source' }
const DOC_SKILLS: Record<Kind, Set<string>> = {
  job: new Set(['resume-fix', 'resume-fix-story', 'resume-fix-campus', 'jd-tailor']),
  abroad: new Set(['ps-draft', 'ps-adapt', 'ps-humanize']),
}

/** 投递弹窗里新增简历原文：上传 PDF / Word，或直接粘贴文字。存好后交给外面选中 */
function ResumeAdd({ kind, onAdded, onCancel }: { kind: Kind; onAdded: (o: WsOutput) => void; onCancel: () => void }) {
  const { toast } = useApp()
  const noun = kind === 'abroad' ? '文书' : '简历'
  const [name, setName] = useState('')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function finish(r: Awaited<ReturnType<typeof wsApi.addResume>>) {
    setBusy(null)
    if (!r.ok) { toast(r.error, 'warn'); return }
    toast(`已存为${noun}版本「${r.output.skill_name}」`, 'ok')
    onAdded(r.output)
  }
  async function pickFile(file?: File) {
    if (!file) return
    const bad = checkUploadable(file)
    if (bad) { toast(bad, 'warn'); return }
    setBusy('上传中…')
    const up = await uploadFile(file, (pct) => setBusy(`上传中 ${pct}%`)).promise
    if (!up.ok) { setBusy(null); toast(up.error, 'warn'); return }
    setBusy('读取中…')
    await finish(await wsApi.addResume({ name: name.trim(), upload_id: up.file.id, kind }))
  }
  async function savePaste() {
    setBusy('保存中…')
    await finish(await wsApi.addResume({ name: name.trim() || `${noun}原文`, text, kind }))
  }

  return (
    <div className="mt-2 space-y-2 rounded-xl border border-water-200/80 bg-white/70 p-3">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder={kind === 'abroad' ? '版本名，如：通用 PS、UCL 版（上传时不填就用文件名）' : '版本名，如：通用版、AI 产品版（上传时不填就用文件名）'}
        className="field py-1.5 text-xs" />
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder={`把${noun}全文粘贴到这里，或者上传文件`}
        className="field py-2 text-xs" />
      <input ref={fileRef} type="file" accept=".pdf,.docx" className="hidden"
        onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = '' }} />
      <div className="flex items-center gap-2">
        <button type="button" disabled={!!busy} onClick={() => fileRef.current?.click()} className="btn-ghost px-3 py-1.5 text-xs">
          📎 上传 PDF / Word
        </button>
        <span className="text-[11px] text-ink-400">{busy}</span>
        <div className="flex-1" />
        <button type="button" onClick={onCancel} className="btn-quiet px-3 py-1.5 text-xs">取消</button>
        <button type="button" disabled={!!busy || text.trim().length < 50} onClick={savePaste} className="btn-water px-3 py-1.5 text-xs">
          保存粘贴的内容
        </button>
      </div>
    </div>
  )
}

function TargetModal({ ws, target, initialStage, onClose, onSaved, reload }: {
  ws: WsFull; target?: WsTarget; initialStage?: string; onClose: () => void; onSaved: () => void
  /** 弹窗里勾材料清单后刷新工作台，弹窗保持打开 */
  reload?: () => void
}) {
  const { toast } = useApp()
  const terms = termsOf(ws)
  const [f, setF] = useState({
    org: target?.org ?? '', role: target?.role ?? '', city: target?.city ?? '', channel: target?.channel ?? '',
    stage: target?.stage ?? initialStage ?? terms.start, jd: target?.jd ?? '', note: target?.note ?? '',
    resume_output_id: target?.resume_output_id ?? '', tier: target?.tier ?? '',
  })
  // 弹窗里新存的简历原文：工作台数据要等保存后才刷新，先在这里补上
  const [added, setAdded] = useState<WsOutput[]>([])
  const [adding, setAdding] = useState(false)
  const all = [...added, ...ws.outputs]
  const resumes = [...all.filter((o) => o.skill_id === DOC_SOURCE[ws.kind]), ...all.filter((o) => DOC_SKILLS[ws.kind].has(o.skill_id))]
  const log = target ? ws.stage_log.filter((l) => l.target_id === target.id) : []
  const stageLabel = (id: string) => ws.stages.find((s) => s.id === id)?.label ?? id
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF((x) => ({ ...x, [k]: e.target.value }))

  async function save() {
    if (!f.org.trim()) return
    const body = { ...f, resume_output_id: f.resume_output_id || null }
    const ok = target ? await wsApi.updateTarget(target.id, body) : await wsApi.addTarget(ws.id, body)
    if (!ok) { toast('没保存成功，稍后再试', 'warn'); return }
    onSaved()
  }
  async function remove() {
    if (!target || !confirm(ws.kind === 'abroad'
      ? `删除「${target.org}」这条申请？挂在它下面的日期和自动生成的材料清单会一起删掉，工具结果会保留。`
      : `删除「${target.org}」这条投递？挂在它下面的日期会一起删掉，工具结果和待办会保留。`)) return
    await wsApi.deleteTarget(target.id)
    onSaved()
  }

  const outputs = target ? ws.outputs.filter((o) => o.target_id === target.id) : []
  const events = target ? ws.events.filter((e) => e.target_id === target.id) : []
  const threads = target ? ws.threads.filter((x) => x.target_id === target.id) : []
  const todos = target ? ws.todos.filter((x) => x.target_id === target.id) : []

  return (
    <Modal open onClose={onClose}>
      <h3 className="text-lg font-bold text-ink-900">{target ? `${terms.item}详情` : `新建${terms.item}`}</h3>
      {!target && ws.kind === 'abroad' && (
        <p className="mt-1 text-xs text-ink-400">保存后会自动生成材料清单：PS、CV、推荐信、成绩单、语言成绩，用不上的可以删。</p>
      )}
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <input value={f.org} onChange={set('org')} placeholder={`${terms.org}（必填）`} className="field py-2 text-sm" />
        <input value={f.role} onChange={set('role')} placeholder={terms.role} className="field py-2 text-sm" />
        <input value={f.city} onChange={set('city')} placeholder={terms.city} className="field py-2 text-sm" />
        <input value={f.channel} onChange={set('channel')} placeholder={terms.channel} className="field py-2 text-sm" />
      </div>
      <div className="mt-3">
        <p className="mb-1.5 text-xs font-semibold text-ink-500">当前阶段</p>
        <div className="flex flex-wrap gap-1.5">
          {ws.stages.map((s) => (
            <button key={s.id} type="button" onClick={() => setF((x) => ({ ...x, stage: s.id }))}
              className={`chip ${f.stage === s.id ? 'chip-on' : ''}`}>
              {s.label}
            </button>
          ))}
        </div>
      </div>
      {ws.kind === 'abroad' && (
        <div className="mt-3">
          <p className="mb-1.5 text-xs font-semibold text-ink-500">选校梯度</p>
          <div className="flex flex-wrap gap-1.5">
            {[['', '未定'], ...Object.entries(TIER).map(([k, v]) => [k, v.label])].map(([k, l]) => (
              <button key={k} type="button" onClick={() => setF((x) => ({ ...x, tier: k }))}
                className={`chip ${f.tier === k ? 'chip-on' : ''}`}>
                {l}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="mt-3">
        <div className="mb-1.5 flex items-center">
          <p className="text-xs font-semibold text-ink-500">{terms.docUse}</p>
          {!adding && (
            <button type="button" onClick={() => setAdding(true)} className="ml-auto text-[11px] font-medium text-water-600 hover:text-water-800">
              ＋ 上传或粘贴原文
            </button>
          )}
        </div>
        {resumes.length === 0 && !adding ? (
          <p className="rounded-xl bg-water-50/70 px-3 py-2 text-xs text-ink-400">
            {terms.docEmpty}
          </p>
        ) : resumes.length > 0 && (
          <Select
            value={f.resume_output_id}
            onChange={(v) => setF((x) => ({ ...x, resume_output_id: v }))}
            options={[{ value: '', label: '还没选（用工具时默认带最近存的原文）' },
              ...resumes.map((o) => ({
                value: o.id,
                label: o.skill_id === DOC_SOURCE[ws.kind]
                  ? `📄 ${o.skill_name} · 原文 · ${shortDate(o.created_at)}`
                  : `${o.skill_name}（${terms.toolDoc}）· ${shortDate(o.created_at)}`,
                hint: o.hint || undefined,
              }))]}
          />
        )}
        {adding && (
          <ResumeAdd
            kind={ws.kind}
            onCancel={() => setAdding(false)}
            onAdded={(o) => {
              setAdded((xs) => [o, ...xs])
              setF((x) => ({ ...x, resume_output_id: o.id }))
              setAdding(false)
            }}
          />
        )}
      </div>
      <div className="mt-3 grid gap-2">
        <textarea value={f.jd} onChange={set('jd')} rows={3} placeholder={terms.req} className="field py-2 text-sm" />
        <textarea value={f.note} onChange={set('note')} rows={2} placeholder="备注（选填）" className="field py-2 text-sm" />
      </div>

      {target && (events.length > 0 || outputs.length > 0 || log.length > 0 || threads.length > 0 || todos.length > 0) && (
        <div className="mt-4 space-y-3 rounded-2xl bg-water-50/70 p-3">
          {todos.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-ink-600">
                {ws.kind === 'abroad' ? '材料清单' : '待办'}
                <span className="ml-1.5 font-normal text-ink-400 tabular-nums">{todos.filter((x) => x.done).length} / {todos.length}</span>
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {todos.map((x) => (
                  <button key={x.id} type="button" title={x.done ? '点一下改回未完成' : '点一下标记完成'}
                    onClick={async () => { await wsApi.updateTodo(x.id, { done: !x.done }); reload?.() }}
                    className={`chip ${x.done ? 'chip-on' : ''}`}>
                    {x.done ? '✓ ' : ''}{x.text}
                  </button>
                ))}
              </div>
            </div>
          )}
          {log.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-ink-600">进度记录</p>
              <ol className="mt-1 space-y-0.5">
                {log.map((l) => (
                  <li key={l.id} className="text-xs text-ink-600">
                    <span className="mr-1.5 text-ink-400 tabular-nums">{shortDate(l.at)}</span>
                    {l.from_stage ? <>{stageLabel(l.from_stage)} → <b className="font-semibold">{stageLabel(l.to_stage)}</b></> : <>建立{terms.item}，阶段「{stageLabel(l.to_stage)}」</>}
                  </li>
                ))}
              </ol>
            </div>
          )}
          {events.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-ink-600">日程</p>
              {events.map((e) => (
                <p key={e.id} className={`mt-1 text-xs ${e.done ? 'text-ink-300 line-through' : 'text-ink-600'}`}>
                  {EVENT_KIND[e.kind].icon} {e.date} {e.title}
                </p>
              ))}
            </div>
          )}
          {threads.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-ink-600">相关对话</p>
              {threads.map((x) => (
                <Link key={x.thread_id} to={`/chat/${x.thread_id}`} className="mt-1 block text-xs text-ink-600 hover:text-water-700">
                  💬 {x.title || '对话'}
                  {x.summary && <span className="text-ink-400"> · {x.summary}</span>}
                  <span className="ml-1 text-water-600">接着聊 →</span>
                </Link>
              ))}
            </div>
          )}
          {outputs.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-ink-600">工具结果</p>
              {outputs.map((o) => (
                <p key={o.id} className="mt-1 text-xs text-ink-600">
                  {o.skill_name} <span className="text-ink-400">· {shortDate(o.created_at)}</span>
                  {o.thread_id && <Link to={`/chat/${o.thread_id}`} className="ml-1.5 text-water-600 hover:underline">回到对话 →</Link>}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 进度记录、日程多了弹窗要滚动：按钮行贴在弹窗底部，滚到哪都能直接保存 */}
      <div className="sticky -bottom-6 z-10 -mx-6 -mb-6 mt-5 flex gap-2 border-t border-water-100/80 bg-white/90 px-6 pb-6 pt-3 backdrop-blur">
        {target && <button onClick={remove} className="btn-quiet px-3 text-xs text-accent-coral">删除</button>}
        <div className="flex-1" />
        <button onClick={onClose} className="btn-ghost">取消</button>
        <button onClick={save} disabled={!f.org.trim()} className="btn-water px-5">保存</button>
      </div>
    </Modal>
  )
}

function Events({ ws, reload }: { ws: WsFull; reload: () => void }) {
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [kind, setKind] = useState<WsEvent['kind']>(ws.kind === 'abroad' ? 'deadline' : 'interview')
  const terms = termsOf(ws)
  const [targetId, setTargetId] = useState('')
  const upcoming = ws.events.filter((e) => !e.done)
  const orgOf = (id: string | null) => ws.targets.find((t) => t.id === id)?.org

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !date) return
    await wsApi.addEvent(ws.id, { title: title.trim(), date, kind, target_id: targetId || null })
    setTitle(''); setDate('')
    reload()
  }

  return (
    <div className="glass p-5">
      <p className="text-sm font-bold text-ink-900">接下来的日程</p>
      <div className="mt-3 space-y-1.5">
        {upcoming.length === 0 && <p className="py-2 text-xs text-ink-400">{terms.eventEmpty}</p>}
        {upcoming.map((e) => {
          const overdue = e.date < today()
          return (
            <div key={e.id} className="group flex items-start gap-2 rounded-xl px-2 py-1.5 hover:bg-water-50">
              <button onClick={async () => { await wsApi.updateEvent(e.id, { done: true }); reload() }} title="标记完成"
                className="mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-md border-2 border-water-300 hover:border-water-500" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-ink-700">{EVENT_KIND[e.kind].icon} {e.title}</p>
                <p className={`text-[11px] tabular-nums ${overdue ? 'text-accent-coral' : 'text-ink-400'}`}>
                  {e.date}{overdue ? ' · 已过期' : ''}{orgOf(e.target_id) ? ` · ${orgOf(e.target_id)}` : ''}
                </p>
              </div>
              <button onClick={async () => { await wsApi.deleteEvent(e.id); reload() }} className="shrink-0 text-xs text-ink-300 opacity-0 group-hover:opacity-100 hover:text-accent-coral">删除</button>
            </div>
          )
        })}
      </div>
      <form onSubmit={add} className="mt-3 space-y-2 border-t border-water-100 pt-3">
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(EVENT_KIND) as WsEvent['kind'][]).map((k) => (
            <button key={k} type="button" onClick={() => setKind(k)} className={`chip ${kind === k ? 'chip-on' : ''}`}>
              {EVENT_KIND[k].icon} {ws.kind === 'abroad' && k === 'test' ? '语言考试' : EVENT_KIND[k].label}
            </button>
          ))}
        </div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={terms.eventPh} className="field py-2 text-sm" />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="field py-2 text-sm" />
        {ws.targets.length > 0 && (
          <Select
            value={targetId}
            onChange={setTargetId}
            options={[{ value: '', label: `不关联${terms.item}` },
              ...ws.targets.map((t) => ({ value: t.id, label: t.org, hint: t.role || undefined }))]}
          />
        )}
        <button type="submit" disabled={!title.trim() || !date} className="btn-water w-full py-2 text-xs">添加日程</button>
      </form>
    </div>
  )
}

function Todos({ ws, reload }: { ws: WsFull; reload: () => void }) {
  const [draft, setDraft] = useState('')
  // 留学每所学校都有一份同名清单（推荐信、成绩单……），后面标上是哪一所
  const orgOf = (id: string | null) => ws.targets.find((x) => x.id === id)?.org
  return (
    <div className="glass p-5">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-bold text-ink-900">待办</p>
        <span className="text-xs text-ink-400 tabular-nums">{ws.todos.filter((t) => t.done).length} / {ws.todos.length}</span>
      </div>
      <div className="mt-3 space-y-1">
        {ws.todos.map((t) => (
          <div key={t.id} className="group flex items-start gap-2 rounded-xl px-2 py-1.5 hover:bg-water-50">
            <button onClick={async () => { await wsApi.updateTodo(t.id, { done: !t.done }); reload() }}
              className={`mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-md border-2 text-[10px] text-white ${
                t.done ? 'border-water-500 bg-gradient-to-br from-water-400 to-water-600' : 'border-water-300 hover:border-water-500'
              }`}>
              {t.done && '✓'}
            </button>
            <span className={`min-w-0 flex-1 text-sm leading-snug ${t.done ? 'text-ink-300 line-through' : 'text-ink-700'}`}>
              {t.text}
              {orgOf(t.target_id) && <span className="ml-1.5 text-[11px] text-ink-400">· {orgOf(t.target_id)}</span>}
              {t.due && !t.done && <span className="ml-1.5 text-[11px] text-accent-coral tabular-nums">截止 {t.due}</span>}
            </span>
            <button onClick={async () => { await wsApi.deleteTodo(t.id); reload() }} className="shrink-0 text-xs text-ink-300 opacity-0 group-hover:opacity-100 hover:text-accent-coral">删除</button>
          </div>
        ))}
      </div>
      <form
        onSubmit={async (e) => { e.preventDefault(); if (!draft.trim()) return; await wsApi.addTodo(ws.id, { text: draft.trim() }); setDraft(''); reload() }}
        className="mt-3 flex gap-2"
      >
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="添加一项待办…" className="field py-2 text-sm" />
        <button type="submit" disabled={!draft.trim()} className="btn-water shrink-0 px-4 py-2 text-xs">添加</button>
      </form>
    </div>
  )
}

/* ─────────────── 工具结果 ─────────────── */

function Outputs({ ws, reload }: { ws: WsFull; reload: () => void }) {
  const { skillsMap } = useSkills()
  const nav = useNavigate()
  const [all, setAll] = useState<WsOutput[] | null>(null)
  const [scope, setScope] = useState<'ws' | 'all'>('ws')
  const [open, setOpen] = useState<WsOutput | null>(null)

  useEffect(() => { if (scope === 'all' && !all) wsApi.outputs().then((o) => setAll(o ?? [])) }, [scope, all])
  const items = scope === 'ws' ? ws.outputs : all ?? []
  const orgOf = (id: string | null) => ws.targets.find((t) => t.id === id)

  async function show(o: WsOutput) {
    const full = await wsApi.output(o.id)
    if (full) setOpen(full)
  }

  return (
    <div className="glass p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-ink-900">工具结果</p>
        </div>
        <div className="flex gap-1 rounded-full border border-water-200/70 bg-white/60 p-1">
          {([['ws', '这个工作台'], ['all', '全部运行历史']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setScope(k)} className={`rounded-full px-3 py-1 text-xs font-semibold ${scope === k ? 'bg-water-500 text-white' : 'text-ink-500'}`}>{l}</button>
          ))}
        </div>
      </div>

      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-400">
          {scope === 'ws' ? termsOf(ws).outputsEmpty : '还没有运行记录'}
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((o, i) => {
            const t = orgOf(o.target_id)
            return (
              <div key={o.id} className="stagger flex items-center gap-3 rounded-2xl border border-water-200/60 bg-white/60 p-3.5" style={stag(i)}>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-water-100 text-lg">{skillsMap[o.skill_id]?.icon ?? '💧'}</span>
                <button onClick={() => show(o)} className="min-w-0 flex-1 text-left">
                  <p className="truncate text-sm font-bold text-ink-900">
                    {o.skill_name}
                    {t && <span className="ml-1.5 rounded bg-water-50 px-1.5 py-px text-[11px] font-medium text-water-700">{t.org}</span>}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-ink-500">{o.hint || o.preview.replace(/[#*>\n]+/g, ' ').trim()}</p>
                  <p className="mt-0.5 text-[11px] text-ink-300 tabular-nums">{shortDate(o.created_at)} · {o.credits} 积分</p>
                </button>
                <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
                  {o.thread_id && <button onClick={() => nav(`/chat/${o.thread_id}`)} className="btn-quiet px-2.5 py-1.5 text-xs">回到对话</button>}
                  {scope === 'ws' && ws.targets.length > 0 && (
                    <Select
                      size="sm"
                      className="w-36"
                      title={`归到哪条${termsOf(ws).item}`}
                      value={o.target_id ?? ''}
                      onChange={async (v) => { await wsApi.updateOutput(o.id, { target_id: v || null }); reload() }}
                      options={[{ value: '', label: '未归类' },
                        ...ws.targets.map((x) => ({ value: x.id, label: x.org, hint: x.role || undefined }))]}
                    />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {open && (
        <Modal open onClose={() => setOpen(null)}>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-bold text-ink-900">{open.skill_name}</h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-ink-400">{shortDate(open.created_at)}</span>
              <DownloadMenu outputId={open.id} skillId={open.skill_id} name={open.skill_name} text={open.output ?? ''}
                className="btn-ghost px-3 py-1.5 text-xs" />
            </div>
          </div>
          <div className="mt-3 max-h-[60vh] overflow-y-auto pr-1 text-sm">
            <Markdown text={open.output ?? ''} />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={async () => {
                if (!confirm('删除这份工具结果？对话记录不受影响。')) return
                await wsApi.deleteOutput(open.id); setOpen(null); setAll(null); reload()
              }}
              className="btn-quiet px-3 text-xs text-accent-coral"
            >
              删除
            </button>
            <button onClick={() => setOpen(null)} className="btn-ghost">关闭</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function Saved() {
  const { skillsMap } = useSkills()
  const { favorites, savedPosts } = useApp()
  const tools = favorites.map((id) => skillsMap[id]).filter(Boolean)
  const posts = savedPosts.map((id) => POST_MAP[id]).filter(Boolean)
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="glass p-5">
        <p className="mb-2 text-sm font-bold text-ink-900">收藏的工具 <span className="text-ink-300 tabular-nums">({tools.length})</span></p>
        {tools.length === 0 ? <p className="py-6 text-center text-sm text-ink-400">还没有收藏的工具</p> : (
          <div className="space-y-1">{tools.map((t) => <ToolRow key={t.id} tool={t} />)}</div>
        )}
      </div>
      <div className="glass p-5">
        <p className="mb-2 text-sm font-bold text-ink-900">收藏的帖子 <span className="text-ink-300 tabular-nums">({posts.length})</span></p>
        {posts.length === 0 ? <p className="py-6 text-center text-sm text-ink-400">还没有收藏的帖子</p> : (
          <div className="space-y-1">{posts.map((p) => <PostRow key={p.id} post={p} />)}</div>
        )}
      </div>
    </div>
  )
}


/** 求职数据：转化、在哪一轮结束、每一步用时、近 8 周投递量。服务端算好，这里只展示 */
function Stats({ ws }: { ws: WsFull }) {
  const terms = termsOf(ws)
  const [s, setS] = useState<WsStats | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let alive = true
    wsApi.stats(ws.id).then((r) => { if (!alive) return; if (r) setS(r); else setFailed(true) })
    return () => { alive = false }
  }, [ws])

  if (!s && failed) return <Empty icon="🫧" title="数据暂时算不出来" sub="连不上服务器，稍后刷新试试。" />
  if (!s) {
    return <div className="space-y-3">{Array.from({ length: 3 }, (_, i) => <div key={i} className="skeleton-water h-24 rounded-water" />)}</div>
  }
  if (!s.total) {
    return <Empty icon="📊" title={`还没有${terms.item}数据`} sub={terms.statsEmpty} />
  }

  const few = `不到 ${s.min_sample} 条，暂不算比例`
  const pct = (r: number | null) => (r === null ? null : `${Math.round(r * 100)}%`)
  const top = Math.max(1, s.steps[0]?.reached ?? 0)
  const wmax = Math.max(1, ...s.weekly.map((w) => w.count))
  const days = (d: number | null) => (d === null ? '—' : d < 1 ? '不到 1 天' : `${d} 天`)
  const cards = s.kind === 'abroad' ? [
    { label: '已提交', value: s.total, sub: `进行中 ${s.active} · 已结束 ${s.closed}` },
    { label: '收到面试', value: s.interviews, sub: pct(s.interview_rate) ? `面试率 ${pct(s.interview_rate)}` : few },
    { label: '录取', value: s.offers, sub: `${pct(s.offer_rate) ? `录取率 ${pct(s.offer_rate)}` : few} · 已确认入读 ${s.enrolled ?? 0}` },
  ] : [
    { label: '投递', value: s.total, sub: `进行中 ${s.active} · 已结束 ${s.closed}` },
    { label: '进入面试', value: s.interviews, sub: pct(s.interview_rate) ? `进面率 ${pct(s.interview_rate)}` : few },
    { label: '拿到 offer', value: s.offers, sub: pct(s.offer_rate) ? `offer 率 ${pct(s.offer_rate)}` : few },
  ]

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {cards.map((c, i) => (
          <div key={c.label} className="stagger glass px-4 py-3.5" style={stag(i)}>
            <p className="text-xs font-semibold text-ink-500">{c.label}</p>
            <p className="mt-1 text-2xl font-bold text-ink-900 tabular-nums">{c.value}</p>
            <p className="mt-0.5 text-[11px] text-ink-400">{c.sub}</p>
          </div>
        ))}
      </div>

      {s.stuck && s.stuck.count >= 2 && (
        <p className="rounded-2xl border border-amber-200/80 bg-amber-50/70 px-4 py-2.5 text-sm text-ink-700">
          在<b className="font-semibold text-amber-700">「{s.stuck.label}」</b>这一轮结束的最多（{s.stuck.count} 条），可以重点准备这一关。
        </p>
      )}

      <div className="glass px-4 py-4">
        <p className="text-sm font-bold text-ink-900">各阶段转化</p>
        <div className="mt-3 overflow-x-auto">
          <div className="min-w-[560px]">
            <div className="grid grid-cols-[88px_1fr_116px_76px_84px] gap-3 border-b border-water-100 pb-1.5 text-[11px] font-semibold text-ink-400">
              <span>阶段</span><span>到达</span><span>进入下一轮</span><span>在这轮结束</span><span>平均停留</span>
            </div>
            {s.steps.map((st) => (
              <div key={st.id} className="grid grid-cols-[88px_1fr_116px_76px_84px] items-center gap-3 border-b border-water-50 py-2 text-xs last:border-0">
                <span className={`justify-self-start rounded-md px-2 py-0.5 text-[11px] font-semibold ${stageTone(st.id)}`}>{st.label}</span>
                <div className="flex items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-water-50">
                    <div className={`h-full rounded-full ${WIN.has(st.id) ? 'bg-accent-mint' : 'bg-gradient-to-r from-water-300 to-water-500'}`}
                      style={{ width: `${(st.reached / top) * 100}%` }} />
                  </div>
                  <span className="w-6 text-right font-semibold text-ink-700 tabular-nums">{st.reached}</span>
                </div>
                <span className="text-ink-600 tabular-nums" title={st.passed !== null && st.rate === null ? few : undefined}>
                  {st.passed === null ? '—' : <>
                    {st.passed} 条
                    {st.rate !== null && <span className={`ml-1 font-semibold ${st.rate < 0.5 ? 'text-accent-coral' : 'text-accent-mint'}`}>{pct(st.rate)}</span>}
                  </>}
                </span>
                <span className={`tabular-nums ${st.ended ? 'font-semibold text-accent-coral' : 'text-ink-300'}`}>{st.ended || '—'}</span>
                <span className="text-ink-600" title={st.days_n ? `根据 ${st.days_n} 条记录` : undefined}>{days(st.avg_days)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="glass px-4 py-4">
        <p className="text-sm font-bold text-ink-900">近 8 周{terms.weekly}</p>
        <div className="mt-4 flex h-36 items-end gap-2">
          {s.weekly.map((w) => (
            <div key={w.week} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              <span className="text-[11px] font-semibold text-ink-600 tabular-nums">{w.count || ''}</span>
              <div className="w-full max-w-10 rounded-t-lg bg-gradient-to-t from-water-400 to-water-200"
                style={{ height: `${(w.count / wmax) * 100}%`, minHeight: w.count ? 4 : 2, opacity: w.count ? 1 : 0.35 }} />
              <span className="text-[10px] text-ink-400 tabular-nums">{w.week.slice(5).replace('-', '/')}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
