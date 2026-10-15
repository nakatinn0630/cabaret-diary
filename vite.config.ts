import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// キャバ帳 PWA。データは VPS のキャバ帳サーバー(/api)に保存する。
// 生成AIの機能が蓋閉じ中(VITE_ENABLE_AI≠true)は、アプリ説明からも AI の記載を外す。
const aiEnabled = process.env.VITE_ENABLE_AI === 'true'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'og-image.png'],
      manifest: {
        name: 'キャバ帳 - Cabaret Diary',
        short_name: 'キャバ帳',
        description: aiEnabled
          ? '夜のおシゴト、この一冊で。キャストのための顧客管理・売上目標・スケジュール・占い・AI黒服相談アプリ。'
          : '夜のおシゴト、この一冊で。キャストのための顧客管理・売上目標・スケジュールアプリ。',
        theme_color: '#1f1147',
        background_color: '#1f1147',
        display: 'standalone',
        lang: 'ja',
        categories: ['business', 'productivity', 'lifestyle'],
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // /api/ (Google ログインの行き来を含む)は Service Worker で index.html に差し替えない
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  // 開発時は API をローカルのキャバ帳サーバー(server/。既定 3010 番)へ中継する
  server: { port: 5173, proxy: { '/api': 'http://127.0.0.1:3010' } },
})
