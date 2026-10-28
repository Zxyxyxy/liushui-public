<!-- 约束是 object 而不是 Record<string, unknown>：data/types.ts 里全是 interface，
     而 interface 不会自动获得索引签名，写成 Record 的话每个页面都要 cast 一次。 -->
<script setup lang="ts" generic="T extends object">
import { computed, ref, watch } from 'vue'
import type { Col } from './table'
import Empty from './Empty.vue'

/** 手写表格：排序 + 分页。不引组件库（已确认的前提 1），demo 量级够用。
 *  行的渲染交给调用方（#row 插槽），因为每个页面的单元格差别太大，
 *  硬做成通用 cell 渲染器只会把逻辑挤进模板字符串里。 */
const props = withDefaults(
  defineProps<{
    cols: Col<T>[]
    rows: T[]
    pageSize?: number
    emptyTitle?: string
    emptySub?: string
    /** 初始排序列 */
    sort?: string
    sortDir?: 'asc' | 'desc'
  }>(),
  { pageSize: 0, emptyTitle: '这里是空的', sortDir: 'desc' },
)

const sortKey = ref<string | undefined>(props.sort)
const dir = ref<'asc' | 'desc'>(props.sortDir)
const page = ref(1)

// 筛选条件一变，行数组就换了新引用，此时停在第 5 页是个 bug
watch(
  () => props.rows,
  () => (page.value = 1),
)

function toggle(c: Col<T>) {
  if (!c.sortable) return
  if (sortKey.value === c.key) dir.value = dir.value === 'asc' ? 'desc' : 'asc'
  else {
    sortKey.value = c.key
    dir.value = 'desc'
  }
}

const sorted = computed(() => {
  const key = sortKey.value
  if (!key) return props.rows
  const col = props.cols.find((c) => c.key === key)
  if (!col) return props.rows
  const val = col.sortVal ?? ((r: T) => (r as Record<string, unknown>)[key] as string | number)
  const sign = dir.value === 'asc' ? 1 : -1
  return [...props.rows].sort((a, b) => {
    const x = val(a)
    const y = val(b)
    if (typeof x === 'number' && typeof y === 'number') return (x - y) * sign
    return String(x).localeCompare(String(y), 'zh-CN') * sign
  })
})

const pageCount = computed(() => (props.pageSize ? Math.max(1, Math.ceil(sorted.value.length / props.pageSize)) : 1))
const paged = computed(() =>
  props.pageSize ? sorted.value.slice((page.value - 1) * props.pageSize, page.value * props.pageSize) : sorted.value,
)
</script>

<template>
  <div>
    <div class="t-wrap">
      <table class="t">
        <thead>
          <tr>
            <th
              v-for="c in cols"
              :key="c.key"
              :style="c.width ? { width: c.width } : undefined"
              :class="[c.sortable && 'th-sort', c.num && 'text-right']"
              :aria-sort="sortKey === c.key ? (dir === 'asc' ? 'ascending' : 'descending') : undefined"
              @click="toggle(c)"
            >
              {{ c.label }}
              <span v-if="c.sortable" class="ml-0.5 inline-block w-2 text-water-500">{{
                sortKey === c.key ? (dir === 'asc' ? '↑' : '↓') : ''
              }}</span>
              <span v-if="c.note" class="ml-1 font-normal normal-case text-ink-300">{{ c.note }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <slot v-for="(row, i) in paged" :key="i" name="row" :row="row" :index="i" />
        </tbody>
      </table>
    </div>

    <Empty v-if="!sorted.length" :title="emptyTitle" :sub="emptySub" />

    <div
      v-if="pageSize && sorted.length"
      class="flex items-center justify-between gap-3 border-t border-water-100 px-4 py-2.5 text-[12px] text-ink-400"
    >
      <span class="tabular-nums">共 {{ sorted.length }} 条</span>
      <div v-if="pageCount > 1" class="flex items-center gap-1.5">
        <button type="button" class="btn-quiet !px-2 !py-1 text-xs" :disabled="page === 1" @click="page--">← 上一页</button>
        <span class="tabular-nums">{{ page }} / {{ pageCount }}</span>
        <button
          type="button"
          class="btn-quiet !px-2 !py-1 text-xs"
          :disabled="page === pageCount"
          @click="page++"
        >
          下一页 →
        </button>
      </div>
    </div>
  </div>
</template>
