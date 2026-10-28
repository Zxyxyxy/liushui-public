/** 把一段文字存成文件下载到本地（浏览器端，不经过服务器） */
export function downloadText(filename: string, text: string) {
  // 文件名里的路径分隔符和控制字符去掉，避免浏览器把它当成目录
  const safe = filename.replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').slice(0, 80) || '结果.md'
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = safe
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
