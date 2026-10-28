<script setup lang="ts">
import Placeholder from '../components/ui/Placeholder.vue'
import StatusChip from '../components/ui/StatusChip.vue'

const TICKETS = [
  {
    id: 't-01',
    type: '积分退回',
    at: '09-16 20:11',
    who: 'u-8f21',
    what: '错题整理跑出来的分类是错的，想退积分',
    state: '待处理',
    tone: 'pending' as const,
    link: '运行失败自动退；不满意属人工判定，看契约承诺',
  },
  {
    id: 't-02',
    type: '隐私申诉',
    at: '09-16 11:35',
    who: 'u-4d17',
    what: '我的帖子被脱敏掉了学校名，但那是我自愿写的',
    state: '待处理',
    tone: 'pending' as const,
    link: '脱敏过度也是问题 —— 这类申诉应回流成识别规则的负样本',
  },
  {
    id: 't-03',
    type: '工具投诉',
    at: '09-15 09:02',
    who: 'u-51bb',
    what: '简历改写把我原来的项目细节删了',
    state: '已处理',
    tone: 'ok' as const,
    link: '已计入林霖学姐 08 月结算的「已退款或投诉」扣除项',
  },
  {
    id: 't-04',
    type: '账号',
    at: '09-14 16:48',
    who: 'u-c0de',
    what: '为什么我的调用被限流了',
    state: '已处理',
    tone: 'ok' as const,
    link: '同设备 4 分钟 27 次，判定脚本调用。结算侧同步扣除',
  },
]
</script>

<template>
  <Placeholder title="用户与工单" sub="每类工单都连着一个模块的判定">
    <ul class="space-y-2.5">
      <li v-for="t in TICKETS" :key="t.id" class="rounded-xl border border-water-100 bg-white/70 p-3.5">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <span class="chip !py-0.5 !text-[10px]">{{ t.type }}</span>
              <p class="text-[11px] text-ink-300">{{ t.who }} · {{ t.at }}</p>
            </div>
            <p class="mt-1 text-[13px] text-ink-900">{{ t.what }}</p>
          </div>
          <StatusChip :tone="t.tone" :label="t.state" />
        </div>
        <p class="mt-2 border-l-2 border-water-200 pl-2.5 text-[11px] leading-relaxed text-ink-500">
          {{ t.link }}
        </p>
      </li>
    </ul>
  </Placeholder>
</template>
