<script setup lang="ts">
import { computed, ref } from 'vue'
import SectionTitle from '../components/ui/SectionTitle.vue'
import Tabs from '../components/ui/Tabs.vue'
import StatusChip from '../components/ui/StatusChip.vue'
import DataTable from '../components/ui/DataTable.vue'
import Drawer from '../components/ui/Drawer.vue'
import type { Col } from '../components/ui/table'
import type { Submission, SubmissionStatus } from '../data/types'
import { CREATOR_MAP, CREATORS, SCENE_ICON, SCENE_LABEL, KIND_LABEL } from '../data/creators'
import { checks, canApprove, blockers, creditsSum, REJECT_REASONS } from '../lib/contract'
import { useReviewStore } from '../stores/review'
import { useUiStore } from '../stores/ui'

const review = useReviewStore()
const ui = useUiStore()

/* ---------- 筛选 ---------- */
const tab = ref<SubmissionStatus | 'all'>('pending')
const scene = ref('')
const creator = ref('')

const STATUS_LABEL: Record<SubmissionStatus, string> = {
  pending: '待审',
  approved: '已通过',
  rejected: '已打回',
  'more-info': '待补充',
}
const STATUS_TONE: Record<SubmissionStatus, 'pending' | 'ok' | 'warn' | 'info'> = {
  pending: 'pending',
  approved: 'ok',
  rejected: 'warn',
  'more-info': 'info',
}

const tabs = computed(() => [
  { id: 'pending', label: '待审', count: review.items.filter((s) => s.status === 'pending').length },
  { id: 'approved', label: '已通过', count: review.items.filter((s) => s.status === 'approved').length },
  { id: 'rejected', label: '已打回', count: review.items.filter((s) => s.status === 'rejected').length },
  { id: 'more-info', label: '待补充', count: review.items.filter((s) => s.status === 'more-info').length },
  { id: 'all', label: '全部', count: review.items.length },
])

const rows = computed(() =>
  review.items.filter(
    (s) =>
      (tab.value === 'all' || s.status === tab.value) &&
      (!scene.value || s.scene === scene.value) &&
      (!creator.value || s.creatorId === creator.value),
  ),
)

const cols: Col<Submission>[] = [
  { key: 'toolName', label: '工具', sortable: true, width: '26%' },
  { key: 'scene', label: '场景', sortable: true, sortVal: (r) => SCENE_LABEL[r.scene] },
  { key: 'creatorId', label: '创作者', sortable: true, sortVal: (r) => CREATOR_MAP[r.creatorId]?.name ?? '' },
  { key: 'level', label: '接入', sortable: true, sortVal: (r) => r.contract.level },
  { key: 'credits', label: '标价', sortable: true, num: true },
  {
    key: 'gate',
    label: '契约闸门',
    sortable: true,
    sortVal: (r) => blockers(r).length,
    note: '六项',
  },
  { key: 'submittedAt', label: '提交', sortable: true },
  { key: 'status', label: '状态', sortable: true },
]

/* ---------- 抽屉 ---------- */
const openId = ref<string | null>(null)
const current = computed(() => review.items.find((s) => s.id === openId.value) ?? null)
const rejectReason = ref<string>('')

function open(s: Submission) {
  openId.value = s.id
  rejectReason.value = ''
}
function close() {
  openId.value = null
}

const currentChecks = computed(() => (current.value ? checks(current.value) : []))
const currentBlockers = computed(() => (current.value ? blockers(current.value) : []))
const approvable = computed(() => (current.value ? canApprove(current.value) : false))

const CHECK_TONE = { ok: 'ok', warn: 'pending', bad: 'bad' } as const
const CHECK_MARK = { ok: '✓', warn: '!', bad: '✗' } as const

function bumpCredits(index: number, delta: number) {
  if (!current.value) return
  const now = current.value.steps[index].credits
  review.setStepCredits(current.value.id, index, Math.max(0, now + delta))
}

function approve() {
  if (!current.value) return
  if (!approvable.value) {
    ui.toast('契约有硬性不合项，不能通过', 'warn')
    return
  }
  const warns = currentChecks.value.filter((c) => c.status === 'warn').length
  review.decide(current.value.id, 'approved', warns ? `通过，带 ${warns} 项提示未清` : '契约六项全过')
  ui.toast(`已通过「${current.value.toolName}」`)
  close()
}

function reject() {
  if (!current.value) return
  if (!rejectReason.value) {
    ui.toast('打回必须选理由 —— 理由要能聚合成创作者指引', 'warn')
    return
  }
  review.decide(current.value.id, 'rejected', rejectReason.value)
  ui.toast(`已打回「${current.value.toolName}」`, 'warn')
  close()
}

function askMore() {
  if (!current.value) return
  const why = currentBlockers.value.length
    ? currentBlockers.value.map((b) => b.label).join('、') + ' 需补充声明'
    : '需补充接入等级与写回声明'
  review.decide(current.value.id, 'more-info', why)
  ui.toast('已要求补充声明', 'info')
  close()
}

function undo() {
  if (!current.value) return
  review.reset(current.value.id)
  ui.toast('已退回待审，改动一并清除', 'info')
}
</script>

<template>
  <div class="px-6 pb-10 pt-6">
    <SectionTitle
      title="工具审核"
      sub="按工具契约六项逐条过闸"
    >
      <template #action>
        <div class="flex items-center gap-2">
          <select v-model="scene" class="field field-sm !w-auto">
            <option value="">全部场景</option>
            <option v-for="(label, id) in SCENE_LABEL" :key="id" :value="id">{{ label }}</option>
          </select>
          <select v-model="creator" class="field field-sm !w-auto">
            <option value="">全部创作者</option>
            <option v-for="c in CREATORS" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </div>
      </template>
    </SectionTitle>

    <Tabs :tabs="tabs" :model-value="tab" class="mb-3" @update:model-value="tab = $event as typeof tab" />

    <div class="panel animate-rise overflow-hidden">
      <DataTable
        :cols="cols"
        :rows="rows"
        :page-size="12"
        sort="submittedAt"
        empty-title="这个筛选下没有提交"
        empty-sub="换个状态页签或清掉场景筛选看看"
      >
        <template #row="{ row }">
          <tr :class="openId === row.id && 'on'" class="cursor-pointer" @click="open(row)">
            <td>
              <div class="flex items-center gap-2.5">
                <span class="text-base leading-none">{{ row.icon }}</span>
                <div class="min-w-0">
                  <p class="truncate font-semibold text-ink-900">{{ row.toolName }}</p>
                  <p class="truncate text-[11px] text-ink-300">{{ row.version }} · {{ KIND_LABEL[row.kind] }}</p>
                </div>
              </div>
            </td>
            <td>
              <span class="whitespace-nowrap">{{ SCENE_ICON[row.scene] }} {{ SCENE_LABEL[row.scene] }}</span>
            </td>
            <td class="whitespace-nowrap">
              {{ CREATOR_MAP[row.creatorId]?.avatar }} {{ CREATOR_MAP[row.creatorId]?.name }}
            </td>
            <td>
              <span class="mono">{{ row.contract.level }}</span>
            </td>
            <td class="num">{{ row.credits }}</td>
            <td>
              <span v-if="blockers(row).length" class="whitespace-nowrap font-semibold text-accent-coral">
                ✗ {{ blockers(row).length }} 项不合
              </span>
              <span v-else-if="checks(row).some((c) => c.status === 'warn')" class="whitespace-nowrap text-[#a97a00]">
                ! {{ checks(row).filter((c) => c.status === 'warn').length }} 项提示
              </span>
              <span v-else class="whitespace-nowrap text-accent-mint">✓ 六项全过</span>
            </td>
            <td class="whitespace-nowrap text-ink-400">{{ row.submittedAt.slice(5) }}</td>
            <td>
              <StatusChip :tone="STATUS_TONE[row.status]" :label="STATUS_LABEL[row.status]" />
            </td>
          </tr>
        </template>
      </DataTable>
    </div>

    <!-- ---------- 详情抽屉 ---------- -->
    <Drawer
      :open="!!current"
      width="max-w-5xl"
      :title="current ? `${current.icon} ${current.toolName}` : ''"
      :sub="
        current
          ? `${CREATOR_MAP[current.creatorId]?.name} · ${SCENE_LABEL[current.scene]} · ${current.version} · 提交于 ${current.submittedAt}`
          : ''
      "
      @close="close"
    >
      <div v-if="current" class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <!-- 左：创作者提交的内容 -->
        <div class="space-y-5">
          <div>
            <p class="text-[11px] font-semibold tracking-wider text-ink-400">承诺</p>
            <p class="quote mt-1.5">{{ current.promise }}</p>
          </div>

          <div>
            <div class="flex items-baseline justify-between">
              <p class="text-[11px] font-semibold tracking-wider text-ink-400">运行步骤与积分</p>
              <p class="text-[11px] tabular-nums" :class="creditsSum(current) === current.credits ? 'text-ink-300' : 'text-accent-coral font-semibold'">
                加总 {{ creditsSum(current) }} / 标价 {{ current.credits }}
              </p>
            </div>
            <ul class="mt-2 space-y-2">
              <li
                v-for="(st, i) in current.steps"
                :key="i"
                class="flex items-start gap-3 rounded-xl border border-water-100 bg-white/70 p-3"
              >
                <span
                  class="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-water-100 text-[11px] font-bold text-water-700"
                  >{{ i + 1 }}</span
                >
                <div class="min-w-0 flex-1">
                  <p class="text-[13px] font-semibold text-ink-900">{{ st.title }}</p>
                  <p class="mt-0.5 text-[11px] leading-relaxed text-ink-400">{{ st.detail }}</p>
                </div>
                <!-- 运营可现场改积分，用来验证闸门 -->
                <div class="flex shrink-0 items-center gap-1">
                  <button type="button" class="btn-quiet !px-1.5 !py-0.5 text-xs" @click="bumpCredits(i, -1)">−</button>
                  <span class="w-9 text-center text-[13px] font-bold tabular-nums text-water-700">{{ st.credits }}</span>
                  <button type="button" class="btn-quiet !px-1.5 !py-0.5 text-xs" @click="bumpCredits(i, 1)">+</button>
                </div>
              </li>
            </ul>
            <p class="note mt-2 !text-ink-300">改这里的数字：加总不等于标价，通过按钮会锁死</p>
          </div>

          <div>
            <p class="text-[11px] font-semibold tracking-wider text-ink-400">契约声明原文</p>
            <dl class="mt-2 space-y-1.5 text-[12px]">
              <div class="flex gap-2">
                <dt class="w-12 shrink-0 text-ink-400">读取</dt>
                <dd class="min-w-0 flex-1 text-ink-700">
                  <span v-for="r in current.contract.reads" :key="r" class="mono mr-1 inline-block">{{ r }}</span>
                  <span v-if="!current.contract.reads.length" class="text-accent-coral">未声明</span>
                </dd>
              </div>
              <div class="flex gap-2">
                <dt class="w-12 shrink-0 text-ink-400">产出</dt>
                <dd class="min-w-0 flex-1 text-ink-700">
                  <span v-for="p in current.contract.produces" :key="p.type" class="mono mr-1 inline-block"
                    >{{ p.type }}</span
                  >
                  <span v-if="!current.contract.produces.length" class="text-accent-coral">未声明</span>
                </dd>
              </div>
              <div class="flex gap-2">
                <dt class="w-12 shrink-0 text-ink-400">写回</dt>
                <dd class="min-w-0 flex-1 text-ink-700">
                  <span v-if="current.contract.writesBack.length">{{ current.contract.writesBack.join('；') }}</span>
                  <span v-else class="text-accent-coral">未声明</span>
                </dd>
              </div>
            </dl>
          </div>

          <!-- 外部数据逐项授予 -->
          <div v-if="current.contract.external.length">
            <p class="text-[11px] font-semibold tracking-wider text-ink-400">
              外部数据申请 · 逐项授予
              <span class="ml-1 font-normal text-ink-300">默认不给，逐项授予</span>
            </p>
            <ul class="mt-2 space-y-2">
              <li
                v-for="e in current.contract.external"
                :key="e.source"
                class="rounded-xl border border-water-100 bg-white/70 p-3"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <p class="text-[13px] font-semibold text-ink-900">{{ e.source }}</p>
                    <p class="mt-0.5 text-[11px] leading-relaxed text-ink-500">
                      用途：{{ e.why || '—— 未填' }}<br />
                      范围：{{ e.scope || '—— 未填' }}
                    </p>
                  </div>
                  <StatusChip
                    v-if="e.grant"
                    :tone="e.grant === 'granted' ? 'ok' : 'warn'"
                    :label="e.grant === 'granted' ? '已授予' : '已驳回'"
                  />
                </div>
                <div class="mt-2 flex gap-2">
                  <button
                    type="button"
                    class="btn-quiet !px-2.5 !py-1 text-xs"
                    :disabled="!e.why.trim() || !e.scope.trim()"
                    :title="!e.why.trim() || !e.scope.trim() ? '用途或范围没写清，不能授予' : ''"
                    @click="review.setGrant(current.id, e.source, 'granted')"
                  >
                    授予
                  </button>
                  <button
                    type="button"
                    class="btn-quiet !px-2.5 !py-1 text-xs"
                    @click="review.setGrant(current.id, e.source, 'denied')"
                  >
                    驳回
                  </button>
                </div>
              </li>
            </ul>
          </div>
        </div>

        <!-- 右：契约检查表 -->
        <div>
          <div class="mb-2 flex items-center justify-between">
            <p class="text-[11px] font-semibold tracking-wider text-ink-400">契约检查表</p>
            <StatusChip
              :tone="approvable ? 'ok' : 'bad'"
              :label="approvable ? '可通过' : `${currentBlockers.length} 项硬性不合`"
            />
          </div>

          <ul class="space-y-2">
            <li
              v-for="c in currentChecks"
              :key="c.key"
              class="rounded-xl border p-3"
              :class="
                c.status === 'bad'
                  ? 'border-accent-coral/35 bg-accent-coral/6'
                  : c.status === 'warn'
                    ? 'border-accent-sun/40 bg-accent-sun/8'
                    : 'border-water-100 bg-white/70'
              "
            >
              <div class="flex items-start gap-2.5">
                <span
                  class="mt-px grid h-5 w-5 shrink-0 place-items-center rounded-full text-[12px] font-bold text-white"
                  :class="
                    c.status === 'bad' ? 'bg-accent-coral' : c.status === 'warn' ? 'bg-accent-sun' : 'bg-accent-mint'
                  "
                  >{{ CHECK_MARK[c.status] }}</span
                >
                <div class="min-w-0 flex-1">
                  <div class="flex items-baseline justify-between gap-2">
                    <p class="text-[13px] font-bold text-ink-900">{{ c.label }}</p>
                    <StatusChip :tone="CHECK_TONE[c.status]" :dot="false" :label="c.ref" />
                  </div>
                  <p class="mt-1 break-words text-[12px] text-ink-700">{{ c.declared }}</p>
                  <p class="mt-1 text-[11px] leading-relaxed text-ink-400">{{ c.note }}</p>
                </div>
              </div>
            </li>
          </ul>

          <!-- 边界要人判：契约过了不代表边界过了 -->
          <div v-if="current.boundaryNote" class="mt-3 rounded-xl border border-accent-violet/30 bg-accent-violet/6 p-3">
            <p class="text-[12px] font-bold text-accent-violet">边界判断 · 需人工</p>
            <p class="mt-1 text-[11px] leading-relaxed text-ink-600">{{ current.boundaryNote }}</p>
          </div>

          <div v-if="current.status !== 'pending'" class="mt-3 rounded-xl border border-water-200/70 bg-water-50/70 p-3">
            <p class="text-[12px] font-bold text-ink-700">
              已{{ STATUS_LABEL[current.status] }}<span v-if="current.decidedAt"> · {{ current.decidedAt }}</span>
            </p>
            <p class="mt-1 text-[11px] leading-relaxed text-ink-500">{{ current.reason }}</p>
            <button type="button" class="btn-quiet mt-2 !px-2.5 !py-1 text-xs" @click="undo">退回待审</button>
          </div>
        </div>
      </div>

      <template #footer>
        <select v-model="rejectReason" class="field field-sm mr-auto !w-auto max-w-xs">
          <option value="">打回理由（必选）…</option>
          <option v-for="r in REJECT_REASONS" :key="r" :value="r">{{ r }}</option>
        </select>
        <button type="button" class="btn-quiet" @click="askMore">要求补充声明</button>
        <button type="button" class="btn-ghost" @click="reject">打回</button>
        <button
          type="button"
          class="btn-water"
          :disabled="!approvable"
          :title="approvable ? '' : '契约有硬性不合项'"
          @click="approve"
        >
          通过
        </button>
      </template>
    </Drawer>
  </div>
</template>
