#!/bin/zsh
# 双击这个文件即可启动"流水"演示站点
# 关闭方法：在弹出的终端窗口里按 Control + C，或直接关掉窗口

cd "$(dirname "$0")" || exit 1

echo ""
echo "  🌊 流水 · 学生 AI 目标达成平台"
echo "  正在启动，请稍等几秒……"
echo ""

# 首次运行时自动安装依赖
if [ ! -d node_modules ]; then
  echo "  第一次启动，需要先下载依赖（约 1-2 分钟，只有这一次）"
  echo ""
  npm install || { echo "依赖安装失败，请把上面的报错内容发给我"; read -r; exit 1; }
  echo ""
fi

# 8 秒后自动打开浏览器，给 Vite 留出启动时间
( sleep 8 && open "http://localhost:5173" ) &

echo "  启动后会自动打开浏览器。"
echo "  如果没自动打开，手动访问：http://localhost:5173"
echo ""
echo "  ⚠️  想关闭网站：在这个窗口里按 Control + C"
echo "  ────────────────────────────────────────────"
echo ""

npm run dev
