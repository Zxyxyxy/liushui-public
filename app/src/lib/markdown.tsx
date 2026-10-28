import { Fragment, type ReactNode } from 'react'

/**
 * 轻量 Markdown 渲染器（无第三方依赖）。
 * 支持：标题 h1-h4、无序/有序列表、表格、代码块 ```、行内 `code`、**粗体**、
 * 水平线、空行分段。样式套用项目现有 ink/water tailwind 类。
 *
 * 真实 LLM 输出即 Markdown，够用即可；不追求完整 CommonMark。
 *
 * 表格不是可选项：几乎所有 skill 的 prompt 都要求输出对比表（选材说明、
 * 修改建议清单、逐段拆解……）。缺表格分支时整张表会掉进段落分支，压成一行
 * 满屏的 `|`——这是之前线上看到的样子。
 */
export function Markdown({ text }: { text: string }) {
  return <div className="space-y-3">{renderBlocks(text)}</div>
}

function renderBlocks(text: string): ReactNode[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const out: ReactNode[] = []
  let i = 0
  let key = 0

  while (i < lines.length) {
    const line = lines[i]

    // 代码块
    if (line.trimStart().startsWith('```')) {
      const buf: string[] = []
      i++
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        buf.push(lines[i])
        i++
      }
      i++ // 跳过结束的 ```
      out.push(
        <pre
          key={key++}
          className="overflow-x-auto rounded-2xl bg-ink-900/90 p-4 text-xs leading-relaxed text-water-100"
        >
          <code>{buf.join('\n')}</code>
        </pre>,
      )
      continue
    }

    // 空行
    if (line.trim() === '') {
      i++
      continue
    }

    // 水平线
    if (/^\s*(---|\*\*\*|___)\s*$/.test(line)) {
      out.push(<hr key={key++} className="border-water-100" />)
      i++
      continue
    }

    // 表格
    if (isTableStart(lines, i)) {
      const head = splitRow(lines[i])
      const align = splitRow(lines[i + 1]).map(alignOf)
      i += 2
      const rows: string[][] = []
      while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
        rows.push(splitRow(lines[i]))
        i++
      }
      // 序号这类很短的列（表头和每一格都不超过 3 个字）收窄到刚好装下内容，
      // 把宽度让给正文列；其余列给个最小宽度，免得被挤成一字一行的竖排。
      const narrow = head.map((h, ci) => [h, ...rows.map((r) => r[ci] ?? '')].every((c) => c.trim().length <= 3))
      out.push(
        // 外层可横向滚动：列多的表在窄栏里宁可滑动，也不要把单元格挤成竖排。
        <div key={key++} className="overflow-x-auto rounded-2xl border border-water-200/70 bg-white/60">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-water-50/80">
                {head.map((c, idx) => (
                  <th
                    key={idx}
                    className={`border-b border-water-200/70 px-3 py-2 font-semibold text-ink-900 ${
                      narrow[idx] ? 'w-px whitespace-nowrap' : 'min-w-[8rem]'
                    } ${align[idx] ?? 'text-left'}`}
                  >
                    {renderInline(c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                // 分隔线画在整行的每个单元格上；「最后一行不要下边线」要选中最后一个 tr 里的所有
                // 单元格。写在 td 上的 last: 选的是每行的最后一列，会让最后一列所有行都没有线。
                <tr key={ri} className="align-top odd:bg-white/40 [&:last-child>td]:border-b-0">
                  {/* 按表头列数补齐：LLM 偶尔少写一格，少了就空着，不要整行错位 */}
                  {head.map((_, ci) => (
                    <td
                      key={ci}
                      className={`border-b border-water-100 px-3 py-2 leading-relaxed text-ink-700 ${
                        narrow[ci] ? 'whitespace-nowrap' : ''
                      } ${align[ci] ?? 'text-left'}`}
                    >
                      {renderInline(r[ci] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      )
      continue
    }

    // 标题
    const h = line.match(/^(#{1,4})\s+(.*)$/)
    if (h) {
      const level = h[1].length
      const cls = {
        1: 'text-lg font-bold text-ink-900',
        2: 'text-base font-bold text-ink-900',
        3: 'text-sm font-bold text-ink-900',
        4: 'text-sm font-semibold text-ink-700',
      }[level as 1 | 2 | 3 | 4]
      out.push(
        <p key={key++} className={`${cls} mt-1`}>
          {renderInline(h[2])}
        </p>,
      )
      i++
      continue
    }

    // 无序列表
    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*+]\s+/, ''))
        i++
      }
      out.push(
        <ul key={key++} className="ml-1 space-y-1">
          {items.map((it, idx) => (
            <li key={idx} className="flex gap-2 text-sm leading-relaxed text-ink-700">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-water-400" />
              <span>{renderInline(it)}</span>
            </li>
          ))}
        </ul>,
      )
      continue
    }

    // 有序列表
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''))
        i++
      }
      out.push(
        <ol key={key++} className="ml-1 space-y-1">
          {items.map((it, idx) => (
            <li key={idx} className="flex gap-2 text-sm leading-relaxed text-ink-700">
              <span className="shrink-0 font-semibold text-water-600 tabular-nums">{idx + 1}.</span>
              <span>{renderInline(it)}</span>
            </li>
          ))}
        </ol>,
      )
      continue
    }

    // 普通段落（把连续非空、非特殊行合并）
    const para: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].trimStart().startsWith('```') &&
      !/^(#{1,4})\s+/.test(lines[i]) &&
      !/^\s*[-*+]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !/^\s*(---|\*\*\*|___)\s*$/.test(lines[i]) &&
      !isTableStart(lines, i)
    ) {
      para.push(lines[i])
      i++
    }
    out.push(
      // whitespace-pre-line：renderInline 会把换行原样带出来，但没有这个类
      // CSS 会把它折叠成空格，多行内容就糊成一坨。
      <p key={key++} className="whitespace-pre-line text-sm leading-relaxed text-ink-700">
        {renderInline(para.join('\n'))}
      </p>,
    )
  }

  return out
}

/** 表格起点：当前行有竖线，下一行是 |---|:--:| 这类分隔行。
 *
 * 只认「有分隔行」的表。正文里偶尔出现一行带竖线的普通文字（比如枚举
 * 「A | B | C」），没有分隔行就仍按段落渲染，不会被误判成表头。 */
function isTableStart(lines: string[], i: number): boolean {
  const head = lines[i]
  const sep = lines[i + 1]
  if (!head || !sep || !head.includes('|')) return false
  return sep.includes('-') && /^[\s|:-]+$/.test(sep)
}

/** 拆一行单元格：去掉首尾竖线，按未转义的 | 切分。 */
function splitRow(line: string): string[] {
  const cells: string[] = []
  let cur = ''
  for (let k = 0; k < line.length; k++) {
    const ch = line[k]
    // \| 是转义竖线，属于单元格内容
    if (ch === '\\' && line[k + 1] === '|') {
      cur += '|'
      k++
      continue
    }
    if (ch === '|') {
      cells.push(cur)
      cur = ''
      continue
    }
    cur += ch
  }
  cells.push(cur)
  // 首尾竖线会切出两个空串，去掉；中间的空单元格要留着，否则整行列位错开
  if (cells.length && cells[0].trim() === '') cells.shift()
  if (cells.length && cells[cells.length - 1].trim() === '') cells.pop()
  return cells.map((c) => c.trim())
}

/** 分隔行的对齐标记 → tailwind 类 */
function alignOf(cell: string): string {
  const s = cell.trim()
  if (s.startsWith(':') && s.endsWith(':')) return 'text-center'
  if (s.endsWith(':')) return 'text-right'
  return 'text-left'
}

/** 行内：**粗体** 和 `code`，其余原样（保留换行） */
function renderInline(text: string): ReactNode {
  // 先按 `code` 切，再在非 code 段里处理 **bold**
  const parts = text.split(/(`[^`]+`)/g)
  return parts.map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <code key={i} className="rounded bg-water-100 px-1.5 py-0.5 text-[13px] text-water-800">
          {part.slice(1, -1)}
        </code>
      )
    }
    return <Fragment key={i}>{renderBold(part)}</Fragment>
  })
}

function renderBold(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return (
        <strong key={i} className="font-semibold text-ink-900">
          {part.slice(2, -2)}
        </strong>
      )
    }
    return <Fragment key={i}>{part}</Fragment>
  })
}
