/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // キャバ帳のブランドカラー（夜×高級感）
        night: '#1f1147',
        gold: '#c9a24b',
      },
    },
  },
  plugins: [],
}
