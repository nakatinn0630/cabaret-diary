import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// キャバ帳 PWA。オフライン時は閲覧のみ（Firestoreキャッシュ）を想定（v1.0 非機能要件）。
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        // ベンダーを分離してキャッシュ効率と初期チャンクサイズを改善
        manualChunks: {
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'og-image.png'],
      manifest: {
        name: 'キャバ帳 - Cabaret Diary',
        short_name: 'キャバ帳',
        description:
          '夜のおシゴト、この一冊で。キャストのための顧客管理・売上目標・スケジュール・占い・AI黒服相談アプリ。',
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
    }),
  ],
  server: { port: 5173 },
})
