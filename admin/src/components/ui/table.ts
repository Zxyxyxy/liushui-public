/** DataTable 的列定义。单独成文件而不是写在 SFC 里，是因为 <script setup> 里导出类型
 *  在不同 vue-tsc 版本上的支持不一致，拆出来最稳。 */
export interface Col<T> {
  key: string
  label: string
  /** 可点表头排序。需要同时给 sortVal，否则按 key 取值 */
  sortable?: boolean
  sortVal?: (r: T) => string | number
  /** 数字列：右对齐 + 等宽 */
  num?: boolean
  width?: string
  /** 表头右上角的小注，解释这列是怎么算的 */
  note?: string
}
