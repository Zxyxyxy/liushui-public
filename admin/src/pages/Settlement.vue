<script setup lang="ts">
import { computed, ref } from 'vue'
import SectionTitle from '../components/ui/SectionTitle.vue'
import StatusChip from '../components/ui/StatusChip.vue'
import LiquidOrb from '../components/water/LiquidOrb.vue'
import CountUp from '../components/water/CountUp.vue'
import { CREATOR_MAP, BADGE_STYLE } from '../data/creators'
import { bill } from '../lib/settle'
import { num, yuan } from '../lib/fmt'
import { useSettleStore } from '../stores/settle'
import { useUiStore } from '../stores/ui'

const settle = useSettleStore()
const ui = useUiStore()

/** 默认展开「你」那条 —— 它的 412 人与 1.18× 要能和前台创作者中心对上 */
const openId = ref<string | null>('c-you')
function toggle(id: string) {
  openId.value = openId.value === id ? null : id
}

/** 展开到样本那一层的扣除项 */
const openDeduction = ref<string | null>(null)
function toggleDeduction(key: string) {
  openDeduction.value = openDeduction.value === key ? null : key
}

const rows = computed(() => settle.items.map((s) => ({ s, b: bill(s), c: CREATOR_MAP[s.creatorId] })))

const totalPayout = computed(() =>
  rows.value.filter((r) => !r.s.excluded).reduce((a, r) => a + r.b.payout, 0),
)

const ORB_TONES = [
  'var(--color-water-500)',
  'var(--color-accent-mint)',
  'var(--color-water-600)',
  'var(--color-accent-violet)',
  'var(--color-accent-mint)',
  'var(--color-accent-sun)',
]

function confirmOne(creatorId: string, name: string, payout: number) {
  settle.confirm(creatorId, name, payout)
  ui.toast(`已确认 ${name} 的 2026-08 结算`)
}
</script>

<template>
  <div class="px-6 pb-10 pt-6">
    <SectionTitle
      title="月度结算 · 2026-08"
      sub="有效使用者逐项扣除，每项可展开核"
    >
      <template #action>
        <div class="text-right">
          <p class="text-[11px] text-ink-400">本月应付合计</p>
          <p class="text-xl font-bold tabular-nums text-water-700">{{ yuan(totalPayout) }}</p>
        </div>
      </template>
    </SectionTitle>

    <div class="space-y-3">
      <article v-for="({ s, b, c }, idx) in rows" :key="s.creatorId" class="panel animate-rise stagger overflow-hidden" :style="{ '--i': idx }">
        <!-- 折叠行 -->
        <button
          type="button"
          class="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-water-50/70"
          @click="toggle(s.creatorId)"
        >
          <span class="text-lg leading-none">{{ c?.avatar }}</span>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <p class="truncate text-sm font-bold text-ink-900">{{ c?.name }}</p>
              <span class="chip !py-0.5 !text-[10px]" :class="BADGE_STYLE[c?.badge.kind ?? 'personal']">
                {{ c?.badge.label }}
              </span>
            </div>
            <p class="mt-0.5 text-[11px] text-ink-400">
              总运行 {{ num(s.totalRuns) }} → 有效使用者 {{ num(b.effectiveUsers) }} · 质量系数
              {{ b.coefficient.toFixed(2) }}×
            </p>
          </div>

          <div v-if="s.excluded" class="shrink-0">
            <StatusChip tone="muted" label="不参与补贴" />
          </div>
          <template v-else>
            <div class="shrink-0 text-right">
              <p class="text-[11px] text-ink-400">应付</p>
              <p class="text-base font-bold tabular-nums text-ink-900">{{ yuan(b.payout) }}</p>
            </div>
            <div class="shrink-0">
              <StatusChip
                :tone="s.status === 'confirmed' ? 'ok' : s.status === 'paid' ? 'info' : 'pending'"
                :label="s.status === 'confirmed' ? '已确认' : s.status === 'paid' ? '已打款' : '待确认'"
              />
            </div>
          </template>
          <span class="shrink-0 text-ink-300 transition-transform" :class="openId === s.creatorId && 'rotate-90'">›</span>
        </button>

        <!-- 展开：账单 -->
        <div v-if="openId === s.creatorId" class="border-t border-water-100 px-5 py-4">
          <p v-if="s.excluded" class="quote">{{ s.excluded }}</p>

          <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <!-- 有效使用者账单 -->
            <div>
              <p class="text-[11px] font-semibold tracking-wider text-ink-400">有效使用者 · 逐项扣除</p>
              <table class="mt-2 w-full text-[13px]">
                <tbody>
                  <tr class="border-b border-water-100">
                    <td class="py-1.5 text-ink-700">总运行次数</td>
                    <td class="py-1.5 num font-semibold text-ink-900">{{ num(s.totalRuns) }}</td>
                  </tr>
                  <template v-for="d in s.deductions" :key="d.key">
                    <tr class="cursor-pointer border-b border-water-100 transition-colors hover:bg-water-50/70" @click="toggleDeduction(`${s.creatorId}-${d.key}`)">
                      <td class="py-1.5">
                        <span class="text-ink-500">− {{ d.label }}</span>
                        <span v-if="d.ref" class="ml-1.5 text-[10px] text-ink-300">{{ d.ref }}</span>
                      </td>
                      <td class="py-1.5 num text-accent-coral">−{{ num(d.count) }}</td>
                    </tr>
                    <tr v-if="openDeduction === `${s.creatorId}-${d.key}`">
                      <td colspan="2" class="bg-water-50/60 px-3 py-2">
                        <p class="mb-1 text-[10px] font-semibold tracking-wider text-ink-400">
                          被排除的样本（示例 {{ d.samples.length }} / {{ num(d.count) }}）
                        </p>
                        <ul class="space-y-1">
                          <li v-for="sm in d.samples" :key="sm.id" class="flex gap-2 text-[11px] leading-relaxed">
                            <span class="mono shrink-0">{{ sm.id }}</span>
                            <span class="shrink-0 text-ink-400">{{ sm.who }}</span>
                            <span class="shrink-0 text-ink-300">{{ sm.when }}</span>
                            <span class="min-w-0 text-ink-600">{{ sm.why }}</span>
                          </li>
                        </ul>
                      </td>
                    </tr>
                  </template>
                  <tr class="border-b-2 border-water-300">
                    <td class="py-2 font-bold text-ink-900">= 有效使用者</td>
                    <td class="py-2 num text-base font-bold text-water-700">
                      <CountUp :value="b.effectiveUsers" from-zero />
                    </td>
                  </tr>
                  <tr class="border-b border-water-100">
                    <td class="py-1.5 text-ink-700">× 单用户补贴</td>
                    <td class="py-1.5 num text-ink-900">{{ yuan(s.perUser) }}</td>
                  </tr>
                  <tr class="border-b border-water-100">
                    <td class="py-1.5 text-ink-700">
                      × 质量系数
                      <span class="ml-1 text-[10px] text-ink-300">六项均分 {{ b.metricAvg.toFixed(1) }}</span>
                    </td>
                    <td class="py-1.5 num font-semibold text-ink-900">{{ b.coefficient.toFixed(2) }}×</td>
                  </tr>
                  <tr class="border-b border-water-100">
                    <td class="py-1.5 text-ink-500">= 基础补贴</td>
                    <td class="py-1.5 num text-ink-700">{{ yuan(b.base) }}</td>
                  </tr>
                  <tr v-for="bo in s.bonuses" :key="bo.label" class="border-b border-water-100">
                    <td class="py-1.5">
                      <span class="text-ink-500">+ {{ bo.label }}</span>
                      <span v-if="bo.ref" class="ml-1.5 text-[10px] text-ink-300">{{ bo.ref }}</span>
                    </td>
                    <td class="py-1.5 num text-accent-mint">+{{ yuan(bo.amount) }}</td>
                  </tr>
                  <tr v-if="b.capped" class="border-b border-water-100">
                    <td class="py-1.5">
                      <span class="font-semibold text-accent-coral">受月度上限约束</span>
                      <span class="ml-1.5 text-[10px] text-ink-300">应发 {{ yuan(b.gross) }}，上限 {{ yuan(s.cap) }}</span>
                    </td>
                    <td class="py-1.5 num text-accent-coral">−{{ yuan(b.gross - s.cap) }}</td>
                  </tr>
                  <tr>
                    <td class="pt-2 font-bold text-ink-900">应付</td>
                    <td class="num pt-2 text-lg font-bold text-water-700">{{ yuan(b.payout) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- 质量系数六项 -->
            <div>
              <p class="text-[11px] font-semibold tracking-wider text-ink-400">
                工具质量系数 · 六项指标
                <span class="ml-1 font-normal text-ink-300">与创作者中心同一批数</span>
              </p>
              <div class="mt-3 grid grid-cols-3 gap-y-4">
                <div v-for="(m, i) in s.metrics" :key="m.label" class="flex flex-col items-center">
                  <LiquidOrb :value="m.value" :size="72" :tone="ORB_TONES[i]" :caption="m.label" />
                  <p v-if="m.note" class="mt-1 max-w-[9rem] text-center text-[10px] leading-snug text-ink-300">
                    {{ m.note }}
                  </p>
                </div>
              </div>

              <div class="mt-4 rounded-xl border border-water-200/70 bg-water-50/60 p-3">
                <p class="text-[11px] leading-relaxed text-ink-500">
                  六项均分 <span class="font-bold tabular-nums text-ink-900">{{ b.metricAvg.toFixed(1) }}</span> → 系数
                  <span class="font-bold tabular-nums text-water-700">{{ b.coefficient.toFixed(2) }}×</span>。
                  60 分为基准 1.00×，每高 1 分加 0.0075，夹在 [0.80, 1.30]。
                </p>
                <p class="note !text-accent-coral">⚠️ 这个映射是 demo 形状，不是已定稿的权重</p>
              </div>

              <div v-if="!s.excluded" class="mt-4 flex items-center justify-end gap-2">
                <button
                  v-if="s.status !== 'draft'"
                  type="button"
                  class="btn-quiet"
                  @click="settle.revert(s.creatorId, c?.name ?? s.creatorId)"
                >
                  撤销确认
                </button>
                <button
                  v-else
                  type="button"
                  class="btn-water"
                  @click="confirmOne(s.creatorId, c?.name ?? s.creatorId, b.payout)"
                >
                  确认结算 · {{ yuan(b.payout) }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </article>
    </div>

    <p class="note mt-5 text-center !text-ink-300">本页金额与运行次数为构造数据</p>
  </div>
</template>
