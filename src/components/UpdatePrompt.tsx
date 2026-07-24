import { useRegisterSW } from 'virtual:pwa-register/react'

// PWAの新バージョン検知時に「更新」を促す。毎回リロードしなくても、
// このバナーの「更新」で即座に最新版へ切り替わる（P1: 更新が反映されにくい問題の解消）。
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null
  return (
    <div
      className="fixed left-1/2 z-[95] flex -translate-x-1/2 items-center gap-3 rounded-full border border-gold/40 bg-night/95 px-4 py-2.5 text-white shadow-lg backdrop-blur"
      style={{ top: 'max(env(safe-area-inset-top), 10px)' }}
      role="status"
    >
      <span className="text-[13px] font-semibold">✨ 新しいバージョンがあります</span>
      <button
        type="button"
        onClick={() => void updateServiceWorker(true)}
        className="rounded-full bg-gold px-3 py-1 text-[12px] font-bold text-night"
      >
        更新
      </button>
      <button
        type="button"
        onClick={() => setNeedRefresh(false)}
        aria-label="閉じる"
        className="text-[16px] leading-none text-white/60"
      >
        ×
      </button>
    </div>
  )
}
