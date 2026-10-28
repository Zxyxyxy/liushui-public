import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  // 相对路径而不是默认的 '/'：这样 dist/index.html 双击就能看（file:// 下 /assets/… 取不到），
  // 同时 Netlify 根部署也照常工作。路由本来就是 hash，file:// 下切页不会触发导航。
  base: './',
  // 5174 而不是 5173 —— 前台原型占着 5173，两个要能同时开着比密度
  server: { port: 5174 },
})
