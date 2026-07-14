import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// キャバ帳 PWA。オフライン時は閲覧のみ（Firestoreキャッシュ）を想定（v1.0 非機能要件）。
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'キャバ帳',
        short_name: 'キャバ帳',
        description: 'キャスト向け顧客・スケジュール管理アプリ',
        theme_color: '#1f1147',
        background_color: '#1f1147',
        display: 'standalone',
        lang: 'ja',
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
