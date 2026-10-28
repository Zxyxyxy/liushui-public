import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import path from 'node:path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    // 固定监听 127.0.0.1:5173：默认的 localhost 在这台 Mac 上只绑 IPv6（::1），打开 127.0.0.1 会连不上；
    // 端口被占时直接报错，不悄悄换到 5174、5175 让人找不到
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    // 通过隧道分享时，浏览器只访问前端这一个端口，/api 由这里转发给本机后端
    proxy: {
      '/api': { target: 'http://127.0.0.1:5000', changeOrigin: true },
    },
    // Vite 默认拒绝未知 Host 头，放行常见隧道域名
    allowedHosts: ['.trycloudflare.com', '.ngrok-free.app', '.ngrok.app', '.loca.lt'],
  },
})
