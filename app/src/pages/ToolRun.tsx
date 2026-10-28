import { Navigate, useParams } from 'react-router-dom'

/**
 * 独立的工具运行页已下线：使用工具的全过程（填参数、上传文件、运行、看结果）都在对话里完成。
 * 路由保留，是为了旧的分享链接、收藏和浏览器历史不会打到 404——
 * 一律带着「要用哪个工具」跳进对话，对话页会在会话里展开这个工具的参数表单。
 */
export function ToolRun() {
  const { id } = useParams()
  return <Navigate to="/chat" state={{ openTool: id }} replace />
}
