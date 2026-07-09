/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // キャバ帳のブランドカラー（夜×高級感）
        night: '#1f1147',
        gold: '#c9a24b',
        rose: '#e6789b',
      },
      fontFamily: {
        // 見出し＝明朝（高級感）／本文＝ゴシック
        serif: ["'Zen Old Mincho'", 'serif'],
        sans: ["'Noto Sans JP'", 'sans-serif'],
      },
    },
  },
  plugins: [],
}
