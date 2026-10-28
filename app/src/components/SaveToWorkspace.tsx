import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { wsApi, type ChatArtifact, type WsFull } from '../lib/api'
import { useApp } from '../store/AppContext'
import { Modal } from './ui/Ui'

/**
 * 工具结果在运行成功时已经由服务端存进工作台了。这里做的是「归到某条投递」：
 * 选一条已有投递，或者新建一条，结果就挂到它下面。
 */
export function SaveToWorkspace({ art, onClose }: { art: ChatArtifact | null; onClose: () => void }) {
  const { toast } = useApp()
  const nav = useNavigate()
  const [ws, setWs] = useState<WsFull | null>(null)
  const [picked, setPicked] = useState<string | null>(null)
  const [org, setOrg] = useState('')
  const [role, setRole] = useState('')
  const [busy, setBusy] = useState(false)
  // 留学工具的结果归到留学申请，其余的归到求职投递
  const kind = art?.scene === 'abroad' ? 'abroad' : 'job'
  const w = kind === 'abroad'
    ? { item: '申请', role: '项目', ws: '留学申请', where: '那所学校', orgPh: '学校，如：UCL', rolePh: '项目，如：Business Analytics MSc', stage: 'prep' }
    : { item: '投递', role: '岗位', ws: '秋招', where: '那家公司', orgPh: '公司，如：字节跳动', rolePh: '岗位，如：产品经理实习', stage: 'applied' }

  useEffect(() => {
    if (!art) return
    setPicked(null); setOrg(''); setRole('')
    let alive = true
    wsApi.create(kind).then(async (id) => {
      const full = id ? await wsApi.get(id) : null
      if (!alive) return
      setWs(full)
      const cur = full?.outputs.find((o) => o.id === art.output_id)?.target_id
      if (cur) setPicked(cur)
    })
    return () => { alive = false }
  }, [art, kind])

  if (!art) return null
  const stageLabel = (id: string) => ws?.stages.find((s) => s.id === id)?.label ?? id

  async function save() {
    if (!art?.output_id || !ws) return
    setBusy(true)
    let targetId = picked
    if (picked === 'new') {
      const t = await wsApi.addTarget(ws.id, { org: org.trim(), role: role.trim(), stage: w.stage })
      targetId = t?.id ?? null
    }
    const ok = targetId ? await wsApi.updateOutput(art.output_id, { target_id: targetId }) : null
    setBusy(false)
    if (!ok) { toast('没保存成功，稍后再试', 'warn'); return }
    toast(`${art.name} 的结果已归到这条${w.item}`)
    onClose()
    nav(`/workspace?id=${ws.id}&target=${targetId}`)
  }

  const canSave = !!art.output_id && (picked === 'new' ? !!org.trim() : !!picked)

  return (
    <Modal open onClose={onClose}>
      <h3 className="text-lg font-bold text-ink-900">归到哪条{w.item}？</h3>
      <p className="mt-1 text-xs leading-relaxed text-ink-400">
        {art.output_id
          ? `这份结果已经自动存进你的${w.ws}工作台。选一条${w.item}，它就会出现在${w.where}下面。`
          : '这份结果是旧版生成的，没有存进工作台。重新运行一次就会自动保存。'}
      </p>

      {art.output_id && (
        <div className="mt-4 max-h-[46vh] space-y-2 overflow-y-auto pr-1">
          {(ws?.targets ?? []).map((t) => (
            <button
              key={t.id}
              onClick={() => setPicked(t.id)}
              className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors ${
                picked === t.id ? 'border-water-400 bg-water-100/70' : 'border-water-200/70 bg-white/70 hover:border-water-400'
              }`}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-ink-900">{t.org}</span>
                <span className="block truncate text-[11px] text-ink-500">{[t.role, t.city].filter(Boolean).join(' · ') || `未填${w.role}`}</span>
              </span>
              <span className="shrink-0 rounded-md bg-water-50 px-1.5 py-0.5 text-[11px] text-water-700">{stageLabel(t.stage)}</span>
              {picked === t.id && <span className="shrink-0 text-water-600">✓</span>}
            </button>
          ))}

          <button
            onClick={() => setPicked('new')}
            className={`w-full rounded-2xl border border-dashed p-3 text-left text-sm transition-colors ${
              picked === 'new' ? 'border-water-400 bg-water-50 text-water-800' : 'border-water-300 text-ink-500 hover:border-water-500'
            }`}
          >
            + 新建一条{w.item}
          </button>
          {picked === 'new' && (
            <div className="grid gap-2 sm:grid-cols-2">
              <input value={org} onChange={(e) => setOrg(e.target.value)} placeholder={w.orgPh} className="field py-2 text-sm" />
              <input value={role} onChange={(e) => setRole(e.target.value)} placeholder={w.rolePh} className="field py-2 text-sm" />
            </div>
          )}
        </div>
      )}

      <div className="mt-5 flex gap-2">
        <button onClick={onClose} className="btn-ghost flex-1">{art.output_id ? '先不归类' : '知道了'}</button>
        {art.output_id && (
          <button disabled={!canSave || busy} onClick={save} className="btn-water flex-[1.4]">
            {busy ? '保存中…' : `归到这条${w.item}`}
          </button>
        )}
      </div>
    </Modal>
  )
}
