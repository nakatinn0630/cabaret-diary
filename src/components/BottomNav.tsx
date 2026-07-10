import { NavLink, useLocation } from 'react-router-dom'
import { subTx } from './ui'

const items = [
  { to: '/', label: 'ホーム', icon: '🏠', end: true },
  { to: '/customers', label: '顧客', icon: '👥', end: false },
  { to: '/schedule', label: '予定', icon: '📅', end: false },
  { to: '/reply', label: '返信', icon: '💬', end: false },
  { to: '/menu', label: 'メニュー', icon: '☰', end: false },
]

// タブを表示するのはルート画面のみ。詳細・フォーム・黒服相談などの
// 下層画面では非表示にして、保存バーやチャット入力を覆わないようにする。
const ROOT_PATHS = new Set(['/', '/customers', '/schedule', '/reply', '/menu'])

// クロードデザインの TabBar を移植（下部フローティングのグラスタブ・5導線）
export function BottomNav() {
  const { pathname } = useLocation()
  if (!ROOT_PATHS.has(pathname)) return null
  return (
    <nav
      aria-label="メインタブ"
      className="safe-bottom absolute bottom-0 inset-x-0 z-30 flex border-t border-night/10 bg-white/75 pt-1.5 backdrop-blur-lg dark:border-white/10 dark:bg-night/80"
    >
      {items.map((it) => (
        <NavLink
          key={it.to}
          to={it.to}
          end={it.end}
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center gap-0.5 py-1 text-[10px] font-semibold min-h-[44px] ${
              isActive ? 'text-gold' : subTx
            }`
          }
        >
          <span className="text-[19px] leading-none" aria-hidden="true">
            {it.icon}
          </span>
          {it.label}
        </NavLink>
      ))}
    </nav>
  )
}
