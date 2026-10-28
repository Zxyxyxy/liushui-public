<script setup lang="ts">
import Placeholder from '../components/ui/Placeholder.vue'
import StatusChip from '../components/ui/StatusChip.vue'

/** 占位。高亮是预置的字符串区间，不是真实 NER —— 这一点必须在页面上说清。 */
const POSTS = [
  {
    id: 'p-01',
    title: '双非上岸字节的完整时间线',
    author: 'u-8f21',
    at: '2026-09-16 21:04',
    reason: '隐私字段疑似漏检',
    body: '三月开始准备，投了 27 家。我是 2023 级软件工程，手机 138****6621，简历里写的邮箱是 z***@bjtu.edu.cn。一面问了项目里的缓存设计……',
    marks: ['138****6621', 'z***@bjtu.edu.cn', '2023 级软件工程'],
  },
  {
    id: 'p-02',
    title: '选校清单分享（含往届录取案例）',
    author: 'u-4d17',
    at: '2026-09-16 15:22',
    reason: '引用往届案例未标年份',
    body: '学姐 GPA 3.41 录了 UCL，她本科是南京某双非。我的清单是：保底两所，冲刺三所……',
    marks: ['GPA 3.41', '南京某双非'],
  },
  {
    id: 'p-03',
    title: '实习转正失败复盘',
    author: 'u-77e3',
    at: '2026-09-15 09:48',
    reason: '含第三方员工姓名',
    body: '我的 mentor 姓陈，组里另一个实习生小李转正了。原因大概是我第二个月才开始独立提需求……',
    marks: ['姓陈', '小李'],
  },
]

function segments(body: string, marks: string[]) {
  let parts: { text: string; hit: boolean }[] = [{ text: body, hit: false }]
  for (const m of marks) {
    const next: typeof parts = []
    for (const p of parts) {
      if (p.hit || !p.text.includes(m)) {
        next.push(p)
        continue
      }
      const [head, ...rest] = p.text.split(m)
      next.push({ text: head, hit: false })
      next.push({ text: m, hit: true })
      next.push({ text: rest.join(m), hit: false })
    }
    parts = next.filter((p) => p.text)
  }
  return parts
}
</script>

<template>
  <Placeholder title="内容审核" sub="自动隐去之后的人工漏检复核">
    <div class="mb-3 flex items-center gap-2">
      <StatusChip tone="bad" label="高亮为预置区间" />
      <p class="note !text-ink-500">
        黄色标记写死在数据里，<span class="font-semibold">不是真实识别结果</span>
      </p>
    </div>

    <ul class="space-y-3">
      <li v-for="p in POSTS" :key="p.id" class="rounded-xl border border-water-100 bg-white/70 p-3.5">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="truncate text-[13px] font-bold text-ink-900">{{ p.title }}</p>
            <p class="mt-0.5 text-[11px] text-ink-300">{{ p.author }} · {{ p.at }}</p>
          </div>
          <StatusChip tone="pending" :label="p.reason" />
        </div>
        <p class="mt-2 text-[12px] leading-relaxed text-ink-700">
          <template v-for="(seg, i) in segments(p.body, p.marks)" :key="i">
            <mark v-if="seg.hit" class="rounded bg-accent-sun/35 px-0.5 text-ink-900">{{ seg.text }}</mark>
            <span v-else>{{ seg.text }}</span>
          </template>
        </p>
        <div class="mt-2.5 flex gap-2">
          <button type="button" class="btn-quiet !px-2.5 !py-1 text-xs" disabled>脱敏并通过</button>
          <button type="button" class="btn-quiet !px-2.5 !py-1 text-xs" disabled>打回修改</button>
        </div>
      </li>
    </ul>
  </Placeholder>
</template>
