<script setup lang="ts">
import { computed, ref } from 'vue'
import SectionTitle from '../components/ui/SectionTitle.vue'
import Empty from '../components/ui/Empty.vue'
import { useAuditStore } from '../stores/audit'

/** 这一页只读 audit store，自己不造任何数据 —— 否则审计就成了装饰。
 *  所以刚打开时它是空的：先去审核、结算、复核里点几下，记录才会出现。 */
const audit = useAuditStore()

const q = ref('')
const entries = computed(() =>
  audit.entries.filter((e) => {
    if (!q.value.trim()) return true
    const k = q.value.trim().toLowerCase()
    return [e.action, e.target, e.detail, e.who].some((v) => v.toLowerCase().includes(k))
  }),
)

function when(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

/** 动作名里带「打回」「驳回」「回收」「撤销」的标成警示色 —— 这几类最需要被看见 */
function tone(action: string): string {
  if (/打回|驳回|回收|撤销|删除/.test(action)) return 'text-accent-coral'
  if (/通过|确认|授予|立项/.test(action)) return 'text-accent-mint'
  return 'text-water-700'
}
</script>

<template>
  <div class="px-6 pb-10 pt-6">
    <SectionTitle
      title="操作审计"
      sub="四类写动作的落点。只读 audit store"
    >
      <template #action>
        <div class="flex items-center gap-2">
          <input v-model="q" class="field field-sm !w-56" placeholder="搜动作 / 对象 / 详情" />
          <span class="whitespace-nowrap text-[11px] text-ink-400">共 {{ audit.count }} 条</span>
        </div>
      </template>
    </SectionTitle>

    <div class="panel animate-rise overflow-hidden">
      <div class="t-wrap">
        <table class="t">
          <thead>
            <tr>
              <th class="w-44">时间</th>
              <th class="w-28">操作人</th>
              <th class="w-40">动作</th>
              <th class="w-56">对象</th>
              <th>详情</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="e in entries" :key="e.id">
              <td class="whitespace-nowrap tabular-nums text-ink-400">{{ when(e.at) }}</td>
              <td class="whitespace-nowrap">{{ e.who }}</td>
              <td class="whitespace-nowrap font-semibold" :class="tone(e.action)">{{ e.action }}</td>
              <td class="text-[12px]">{{ e.target }}</td>
              <td class="text-[12px] text-ink-500">{{ e.detail || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <Empty
        v-if="!entries.length"
        :title="audit.count ? '没有匹配的记录' : '还没有任何操作'"
        :sub="audit.count ? '换个关键词试试' : '去审核或结算里点一条，记录会实时出现在这里'"
      />
    </div>

    <p class="note mt-3 !text-ink-300">
      存在 localStorage 的 <span class="mono">liushui.admin.v1</span> 里。真实实现要落服务端且不可删
    </p>
  </div>
</template>
