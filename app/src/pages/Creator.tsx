import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CREATOR_MAP } from '../data/creators'
import { useSkills } from '../store/SkillsContext'
import { POSTS } from '../data/posts'
import { SCENES } from '../data/scenes'
import { useApp } from '../store/AppContext'
import { Modal, Tabs, fmt, stag } from '../components/ui/Ui'
import { Bubbles, Drop, FlowField, LiquidBar, LiquidOrb, Ripple } from '../components/water/Water'

type Tab = 'overview' | 'tools' | 'income' | 'publish'

const ME = 'c-you'

export function Creator() {
  const { skills: TOOLS } = useSkills()
  const [tab, setTab] = useState<Tab>('overview')
  const me = CREATOR_MAP[ME]
  const myTools = TOOLS.filter((t) => t.creatorId === ME)

  return (
    <div>
      <section className="relative overflow-hidden pb-6 pt-10">
        <FlowField />
        <Bubbles count={12} />
        <div className="relative mx-auto max-w-7xl px-5">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-3xl bg-gradient-to-br from-water-300 to-water-500 text-3xl ring-4 ring-white/70">
              {me.avatar}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">
                  创作者<span className="text-flow">中心</span>
                </h1>
                <span className="rounded-full bg-water-100 px-2.5 py-1 text-[11px] font-semibold text-water-700">
                  ✓ {me.badge.label}
                </span>
              </div>
              <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-ink-500">
                不用懂提示词工程，也不用会写代码。描述清楚工具要解决什么问题，平台帮你生成初稿。
              </p>
            </div>
            <button onClick={() => setTab('publish')} className="btn-water shrink-0 px-6 py-3">
              + 发布新工具
            </button>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-5 pb-4">
        <Tabs
          tabs={[
            { id: 'overview' as const, label: '数据总览' },
            { id: 'tools' as const, label: '我的工具', count: myTools.length },
            { id: 'income' as const, label: '激励与结算' },
            { id: 'publish' as const, label: '发布工具' },
          ]}
          value={tab}
          onChange={setTab}
        />

        <div key={tab} className="mt-6" style={{ animation: 'rise .4s cubic-bezier(.22,1,.36,1) both' }}>
          {tab === 'overview' && <Overview />}
          {tab === 'tools' && <MyTools tools={myTools} onPublish={() => setTab('publish')} />}
          {tab === 'income' && <Income />}
          {tab === 'publish' && <PublishFlow />}
        </div>
      </div>
    </div>
  )
}

/* ─────────────── 数据总览 ─────────────── */

function Overview() {
  const { skills: TOOLS } = useSkills()
  const myTools = TOOLS.filter((t) => t.creatorId === ME)
  const effective = 412
  const runs = 1284

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="有效使用者（本月）" value={effective} unit="人" hint="登录用户完成一次成功运行才计入" accent />
        <Metric label="累计运行次数" value={runs} unit="次" hint="含重复运行，不重复计入人数" />
        <Metric label="已上线工具" value={myTools.length} unit="个" hint="全部通过审核" />
        <Metric label="配套帖子" value={POSTS.filter((p) => p.author === '你').length} unit="篇" hint="发布帖子可获额外奖励" />
      </div>

      {/* 质量系数 */}
      <div className="glass p-6">
        <div className="mb-1 flex items-baseline justify-between">
          <h3 className="text-sm font-bold text-ink-900">工具质量系数</h3>
          <span className="text-sm font-bold text-water-700 tabular-nums">1.18×</span>
        </div>
        <p className="mb-5 text-xs text-ink-400">
          质量系数直接影响激励金额。以下六项按月计算，规则和明细每月公开。
        </p>

        <div className="grid gap-6 sm:grid-cols-3 lg:grid-cols-6">
          {[
            ['成功运行率', 96],
            ['用户评分', 92],
            ['结果保存率', 74],
            ['用户复用率', 61],
            ['投诉退款率', 98],
            ['成本控制', 83],
          ].map(([label, v]) => (
            <LiquidOrb key={label as string} value={v as number} size={78} caption={label as string} />
          ))}
        </div>
      </div>

      {/* 近 8 周有效使用者 */}
      <div className="glass p-6">
        <h3 className="text-sm font-bold text-ink-900">近 8 周有效使用者</h3>
        <p className="mt-1 text-xs text-ink-400">同一用户对同一工具每个自然月只计入一次基础人数</p>

        <div className="mt-6 flex h-40 items-end gap-2.5">
          {[38, 52, 47, 66, 81, 94, 108, 126].map((v, i) => (
            <div key={i} className="group flex flex-1 flex-col items-center gap-2">
              <span className="text-[11px] font-semibold text-ink-400 tabular-nums opacity-0 transition-opacity group-hover:opacity-100">
                {v}
              </span>
              <div
                className="relative w-full overflow-hidden rounded-t-xl transition-all duration-500 group-hover:brightness-110"
                style={{
                  height: `${(v / 126) * 100}%`,
                  background: 'linear-gradient(180deg, var(--color-water-300), var(--color-water-600))',
                  animation: `fill 1.2s cubic-bezier(.22,1,.36,1) ${i * 70}ms both`,
                }}
              >
                {/* 柱顶的水面 */}
                <svg
                  className="absolute -top-1 left-0 h-3 w-[200%] animate-[wave_6s_linear_infinite]"
                  viewBox="0 0 120 12"
                  preserveAspectRatio="none"
                  aria-hidden
                >
                  <path d="M0 6 C 15 0, 30 0, 45 6 S 75 12, 90 6 S 120 0, 120 6 V12 H0Z" fill="var(--color-water-300)" />
                </svg>
              </div>
              <span className="text-[10px] text-ink-300">W{i + 1}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 防刷说明 */}
      <div className="glass p-6">
        <h3 className="text-sm font-bold text-ink-900">什么不计入有效使用者</h3>
        <p className="mt-1 text-xs text-ink-400">提前说清边界，避免结算时产生分歧</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {[
            '仅打开详情页，没有实际运行',
            '运行失败或未返回结果',
            '创作者本人反复运行自己的工具',
            '同设备、同账号或异常批量账号',
            '已退款、已投诉的运行记录',
            '违规内容、侵权资料或虚假结果',
          ].map((t) => (
            <div key={t} className="flex gap-2.5 rounded-xl bg-white/60 px-3.5 py-2.5">
              <span className="mt-0.5 shrink-0 text-accent-coral">×</span>
              <span className="text-xs leading-relaxed text-ink-700">{t}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 rounded-xl bg-water-50 px-3.5 py-2.5 text-[11px] leading-relaxed text-ink-500">
          每个工具设有月度补贴上限。新工具可获得固定期限的冷启动保护，期间不受上限限制。
        </p>
      </div>
    </div>
  )
}

function Metric({
  label,
  value,
  unit,
  hint,
  accent,
}: {
  label: string
  value: number
  unit: string
  hint: string
  accent?: boolean
}) {
  return (
    <div
      className={`relative overflow-hidden p-5 ${
        accent ? 'rounded-water bg-gradient-to-br from-water-500 to-water-700 text-white' : 'glass'
      }`}
    >
      {accent && (
        <svg
          className="pointer-events-none absolute bottom-0 left-0 h-8 w-[200%] animate-[wave_16s_linear_infinite]"
          viewBox="0 0 120 12"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path d="M0 8 C 20 3, 40 3, 60 8 S 100 13, 120 8 V12 H0Z" fill="rgba(255,255,255,.18)" />
        </svg>
      )}
      <p className={`relative text-xs ${accent ? 'text-white/80' : 'text-ink-400'}`}>{label}</p>
      <p className="relative mt-1.5 flex items-baseline gap-1">
        <span className={`text-3xl font-bold tabular-nums ${accent ? '' : 'text-ink-900'}`}>{value}</span>
        <span className={`text-sm ${accent ? 'text-white/70' : 'text-ink-400'}`}>{unit}</span>
      </p>
      <p className={`relative mt-1.5 text-[11px] leading-relaxed ${accent ? 'text-white/70' : 'text-ink-400'}`}>
        {hint}
      </p>
    </div>
  )
}

/* ─────────────── 我的工具 ─────────────── */

function MyTools({ tools, onPublish }: { tools: any[]; onPublish: () => void }) {
  return (
    <div className="space-y-3">
      {tools.map((t: any, i: number) => (
        <div
          key={t.id}
          className="glass stagger p-5"
          style={stag(i)}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-water-100 to-water-200 text-2xl">
              {t.icon}
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Link to={`/tool/${t.id}`} className="font-bold text-ink-900 hover:text-water-700">
                  {t.name}
                </Link>
                <span className="rounded bg-accent-mint/12 px-1.5 py-px text-[10px] font-semibold text-accent-mint">
                  已上线
                </span>
                {t.isNew && (
                  <span className="rounded bg-water-100 px-1.5 py-px text-[10px] font-semibold text-water-700">
                    冷启动保护中
                  </span>
                )}
              </div>
              <p className="mt-1 line-clamp-1 text-xs text-ink-500">{t.promise}</p>
            </div>

            <div className="flex shrink-0 gap-5 text-center">
              <div>
                <p className="text-lg font-bold text-ink-900 tabular-nums">{fmt(t.users)}</p>
                <p className="text-[10px] text-ink-400">使用人数</p>
              </div>
              <div>
                <p className="text-lg font-bold text-ink-900 tabular-nums">{t.rating.toFixed(1)}</p>
                <p className="text-[10px] text-ink-400">评分</p>
              </div>
              <div>
                <p className="flex items-center justify-center gap-0.5 text-lg font-bold text-water-700 tabular-nums">
                  <Drop className="h-3.5 w-3.5" />
                  {t.credits}
                </p>
                <p className="text-[10px] text-ink-400">定价</p>
              </div>
            </div>

            <div className="flex shrink-0 gap-2">
              <Link to={`/tool/${t.id}`} className="btn-quiet text-xs">
                查看
              </Link>
              <button className="btn-ghost px-4 py-2 text-xs">编辑</button>
            </div>
          </div>

          <div className="mt-4 border-t border-water-100 pt-3">
            <LiquidBar
              value={Math.round((t.rating / 5) * 100)}
              label={`成功运行率 ${Math.round((t.rating / 5) * 100)}% · 本月有效使用者 ${Math.round(t.users / 35)} 人`}
              height={6}
            />
          </div>
        </div>
      ))}

      <button
        onClick={onPublish}
        className="flex w-full flex-col items-center gap-2 rounded-water border-2 border-dashed border-water-300 p-10 text-center transition-all duration-300 hover:border-water-500 hover:bg-water-50/60"
      >
        <span className="text-3xl animate-[bob_6s_ease-in-out_infinite]">💧</span>
        <span className="font-bold text-ink-700">发布你的下一个工具</span>
        <span className="max-w-sm text-xs leading-relaxed text-ink-400">
          从模板开始，或者用一段自然语言描述你要解决的问题。平均两小时可以走完从想法到上线。
        </span>
      </button>
    </div>
  )
}

/* ─────────────── 激励与结算 ─────────────── */

function Income() {
  const rows = [
    ['有效使用者补贴', '412 人 × 0.8 元', 329.6],
    ['工具质量系数', '× 1.18', 59.3],
    ['新工具冷启动奖励', '错题整理（上线 2 周内）', 120.0],
    ['配套内容奖励', '1 篇经验帖', 50.0],
    ['用户留存奖励', '30 日复用率 34%', 68.0],
  ] as const
  const total = rows.reduce((s, r) => s + r[2], 0)

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <div className="space-y-5">
        <div className="glass p-6">
          <h3 className="text-sm font-bold text-ink-900">本月激励构成</h3>
          <p className="mt-1 text-xs text-ink-400">
            早期采用平台补贴，不抽取用户收入分成。规则与结算明细每月公开。
          </p>

          <div className="mt-4 space-y-2">
            {rows.map(([label, detail, amount], i) => (
              <div
                key={label}
                className="stagger flex items-center justify-between gap-4 rounded-2xl bg-white/60 px-4 py-3"
                style={stag(i)}
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink-900">{label}</p>
                  <p className="text-[11px] text-ink-400 tabular-nums">{detail}</p>
                </div>
                <span className="shrink-0 font-bold text-water-700 tabular-nums">
                  ¥{amount.toFixed(2)}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-baseline justify-between border-t border-water-100 pt-4">
            <span className="text-sm font-bold text-ink-900">本月合计</span>
            <span className="text-2xl font-bold text-water-700 tabular-nums">¥{total.toFixed(2)}</span>
          </div>
        </div>

        <div className="glass p-6">
          <h3 className="text-sm font-bold text-ink-900">激励公式</h3>
          <pre className="mt-3 overflow-x-auto rounded-2xl bg-water-50/80 p-4 font-mono text-xs leading-relaxed text-ink-700">
{`创作者激励
= 有效使用者数 × 单用户补贴
  × 工具质量系数
  + 新工具冷启动奖励
  + 配套内容奖励
  + 用户留存奖励`}
          </pre>
          <p className="mt-3 text-[11px] leading-relaxed text-ink-500">
            平台早期把收入全部用于运营、模型成本和创作者补贴。后续根据用户付费与成本情况，再调整为「补贴 + 分成」。调整前会提前公告。
          </p>
        </div>
      </div>

      <aside className="space-y-4">
        <div className="glass-deep relative overflow-hidden p-5">
          <svg
            className="pointer-events-none absolute bottom-0 left-0 h-10 w-[200%] animate-[wave_18s_linear_infinite]"
            viewBox="0 0 120 12"
            preserveAspectRatio="none"
            aria-hidden
          >
            <path d="M0 8 C 20 3, 40 3, 60 8 S 100 13, 120 8 V12 H0Z" fill="rgba(144,224,239,.4)" />
          </svg>
          <p className="relative text-xs text-ink-400">待结算金额</p>
          <p className="relative mt-1 text-3xl font-bold text-ink-900 tabular-nums">¥{total.toFixed(2)}</p>
          <p className="relative mt-1.5 text-[11px] text-ink-400">预计 10 月 5 日发放</p>
          <button className="btn-water relative mt-4 w-full">查看结算明细</button>
        </div>

        <div className="glass p-5">
          <p className="text-sm font-bold text-ink-900">怎么把激励做上去</p>
          <ol className="mt-3 space-y-2.5">
            {[
              ['提高成功运行率', '失败的运行不计入有效使用者'],
              ['给出清晰的输入说明', '用户填对了，结果才有用'],
              ['写配套帖子', '内容带来的转化比群发链接高'],
              ['做能复用的工具', '一次性工具留不住人'],
            ].map(([t, d], i) => (
              <li key={t} className="flex gap-2.5">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-gradient-to-br from-water-400 to-water-600 text-[10px] font-bold text-white">
                  {i + 1}
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold text-ink-900">{t}</span>
                  <span className="block text-[11px] leading-relaxed text-ink-400">{d}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </aside>
    </div>
  )
}

/* ─────────────── 发布流程 ─────────────── */

const ENTRIES = [
  {
    id: 'template',
    icon: '📋',
    title: '从模板创建',
    desc: '从简历修改、文书检查、资料总结等模板开始，改改就能用',
    tag: '最快',
  },
  {
    id: 'describe',
    icon: '💬',
    title: '用一段话描述',
    desc: '说清楚工具要解决什么问题，平台自动生成初稿',
    tag: '推荐',
  },
  {
    id: 'advanced',
    icon: '⚙️',
    title: '高级创建',
    desc: '自己配置提示词、知识库、输入字段、输出格式和外部数据权限',
    tag: '完全控制',
  },
]

const STEPS = [
  { title: '选择模板或描述需求', detail: '决定从哪里起步' },
  { title: '填写工具目标', detail: '一句话说清楚它能交付什么结果' },
  { title: '上传参考资料或知识库', detail: '可选。有资料的工具输出更稳定' },
  { title: '设置输入、输出和积分', detail: '定价参考同类工具区间' },
  { title: '在线测试', detail: '至少跑通三次再提交' },
  { title: '平台自动生成介绍', detail: '标题、介绍、标签和示例都会自动生成' },
  { title: '提交审核', detail: '通常 1 个工作日内完成' },
  { title: '发布上线', detail: '自动生成配套帖子草稿' },
]

function PublishFlow() {
  const { toast } = useApp()
  const [entry, setEntry] = useState<string | null>(null)
  const [step, setStep] = useState(0)
  const [desc, setDesc] = useState('')
  const [name, setName] = useState('')
  const [credits, setCredits] = useState(12)
  const [scene, setScene] = useState('exam')
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState(false)
  const [doneOpen, setDoneOpen] = useState(false)

  function generate() {
    setGenerating(true)
    setTimeout(() => {
      setGenerating(false)
      setGenerated(true)
      if (!name) setName(guessName(desc))
      toast('平台已生成工具初稿')
    }, 1400)
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
      <div className="space-y-5">
        {/* 三个入口 */}
        <div className="glass p-6">
          <h3 className="text-sm font-bold text-ink-900">选择创建方式</h3>
          <p className="mt-1 text-xs text-ink-400">
            发布工具不需要理解 Skill 或 Agent 配置。三个入口，任选一个。
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {ENTRIES.map((e) => (
              <Ripple
                key={e.id}
                as="button"
                onClick={() => {
                  setEntry(e.id)
                  setStep(1)
                }}
                className={`rounded-2xl border p-4 text-left transition-all duration-300 hover:-translate-y-1 ${
                  entry === e.id
                    ? 'border-water-400 bg-gradient-to-br from-water-100 to-water-200/50 shadow-water'
                    : 'border-water-200/70 bg-white/70 hover:border-water-400'
                }`}
              >
                <div className="flex items-start justify-between">
                  <span className="text-2xl">{e.icon}</span>
                  <span className="rounded-full bg-water-100 px-2 py-0.5 text-[10px] font-semibold text-water-700">
                    {e.tag}
                  </span>
                </div>
                <p className="mt-2.5 text-sm font-bold text-ink-900">{e.title}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-ink-500">{e.desc}</p>
              </Ripple>
            ))}
          </div>
        </div>

        {/* 描述创建表单 */}
        {entry && (
          <div className="glass p-6" style={{ animation: 'rise .4s cubic-bezier(.22,1,.36,1) both' }}>
            <h3 className="text-sm font-bold text-ink-900">
              {entry === 'describe' ? '描述你的工具' : entry === 'template' ? '从模板开始' : '高级配置'}
            </h3>

            <div className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-ink-500">
                  这个工具帮用户解决什么问题？<span className="text-accent-coral">*</span>
                </label>
                <textarea
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  rows={3}
                  placeholder="用大白话说。例：把学生拍的错题照片按知识点归类，看出自己反复错在哪一类"
                  className="field mt-1.5 resize-none"
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="text-[11px] text-ink-300">试试：</span>
                  {[
                    '把错题照片按知识点归类，找出反复错的同一类问题',
                    '检查小组作业里的引用格式，标出不规范的地方',
                  ].map((s) => (
                    <button key={s} onClick={() => setDesc(s)} className="chip max-w-[18rem] truncate">
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={generate}
                disabled={!desc.trim() || generating}
                className="btn-water w-full py-3"
              >
                {generating ? (
                  <>
                    <span className="inline-block h-3.5 w-3.5 animate-[spin_1s_linear_infinite] rounded-full border-2 border-white/40 border-t-white" />
                    平台正在生成初稿…
                  </>
                ) : (
                  '生成工具初稿'
                )}
              </button>

              {generating && (
                <div className="space-y-2">
                  <div className="skeleton-water h-3 w-1/3 rounded-full" />
                  <div className="skeleton-water h-3 w-full rounded-full" />
                  <div className="skeleton-water h-3 w-3/4 rounded-full" />
                </div>
              )}

              {generated && !generating && (
                <div className="space-y-4 rounded-2xl bg-water-50/70 p-4" style={{ animation: 'rise .4s ease-out both' }}>
                  <p className="text-xs font-bold text-water-700">✓ 平台已自动生成以下内容，可以直接改</p>

                  <div>
                    <label className="text-xs font-semibold text-ink-500">工具名称</label>
                    <input value={name} onChange={(e) => setName(e.target.value)} className="field mt-1.5" />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-ink-500">自动生成的标签</label>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {['错题', '归因', '知识点', '复习'].map((t) => (
                        <span key={t} className="chip chip-on">
                          #{t}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-ink-500">场景</label>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {SCENES.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => setScene(s.id)}
                          className={`chip ${scene === s.id ? 'chip-on' : ''}`}
                        >
                          {s.icon} {s.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="flex items-baseline justify-between text-xs font-semibold text-ink-500">
                      <span>定价（积分）</span>
                      <span className="font-bold text-water-700 tabular-nums">{credits} 积分</span>
                    </label>
                    <input
                      type="range"
                      min={5}
                      max={60}
                      step={1}
                      value={credits}
                      onChange={(e) => setCredits(Number(e.target.value))}
                      className="mt-2.5 w-full accent-[var(--color-water-500)]"
                    />
                    <p className="mt-1.5 text-[11px] text-ink-400">
                      同类工具区间 8–20 积分。定价过高会明显影响首次使用转化。
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      setStep(8)
                      setDoneOpen(true)
                    }}
                    className="btn-water w-full py-3"
                  >
                    在线测试并提交审核
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 流程侧栏 */}
      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <div className="glass p-5">
          <p className="mb-3 text-sm font-bold text-ink-900">发布流程</p>
          <ol className="relative">
            <span className="absolute left-[11px] top-2 h-[calc(100%-1.5rem)] w-0.5 rounded-full bg-water-100" />
            {STEPS.map((s, i) => (
              <li key={s.title} className="relative flex gap-3 pb-3.5 last:pb-0">
                <span
                  className={`relative z-10 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-bold transition-all duration-500 ${
                    i < step
                      ? 'bg-gradient-to-br from-water-400 to-water-600 text-white'
                      : 'bg-water-100 text-ink-300'
                  }`}
                >
                  {i < step ? '✓' : i + 1}
                </span>
                <span className="min-w-0 pt-0.5">
                  <span className={`block text-xs font-semibold ${i < step ? 'text-ink-900' : 'text-ink-400'}`}>
                    {s.title}
                  </span>
                  <span className="block text-[11px] leading-relaxed text-ink-300">{s.detail}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="glass p-5">
          <p className="text-xs font-bold text-ink-900">发布后自动生成帖子草稿</p>
          <ul className="mt-2 space-y-1.5">
            {['工具解决什么问题', '适合什么人', '使用前后对比', '使用案例', '常见问题'].map((t) => (
              <li key={t} className="flex gap-2 text-[11px] text-ink-500">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-water-400" />
                {t}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <Modal open={doneOpen} onClose={() => setDoneOpen(false)}>
        <div className="text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-water-400 to-water-600 text-3xl text-white animate-[bob_3s_ease-in-out_infinite]">
            ✓
          </div>
          <h3 className="mt-4 text-lg font-bold text-ink-900">已提交审核</h3>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-500">
            「{name || '你的新工具'}」已进入审核队列，通常 1 个工作日内出结果。通过后会自动生成配套帖子草稿，你可以修改后发布。
          </p>
          <div className="mt-4 rounded-2xl bg-water-50/80 p-4 text-left text-xs">
            <p className="font-semibold text-ink-700">新工具冷启动保护</p>
            <p className="mt-1 leading-relaxed text-ink-500">
              上线后 30 天内不受月度补贴上限限制，且享有首页「新上线」曝光位。
            </p>
          </div>
          <button onClick={() => setDoneOpen(false)} className="btn-water mt-5 w-full">
            知道了
          </button>
        </div>
      </Modal>
    </div>
  )
}

function guessName(desc: string): string {
  if (desc.includes('错题')) return '错题知识点归类'
  if (desc.includes('引用')) return '引用格式检查'
  return desc.slice(0, 8) || '我的新工具'
}
