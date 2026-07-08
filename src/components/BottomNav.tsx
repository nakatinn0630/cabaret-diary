import { NavLink } from 'react-router-dom'

const items = [
  { to: '/', label: 'ホーム', icon: '🏠', end: true },
  { to: '/customers', label: '顧客', icon: '👥', end: false },
]

// F-01 導線用のボトムナビ（Phase 2以降で予定/カレンダー等を追加）
export function BottomNav() {
  return (
    <nav className="safe-bottom sticky bottom-0 z-10 flex border-t border-black/10 bg-white/95 backdrop-blur dark:border-white/10 dark:bg-night/95">
      {items.map((it) => (
        <NavLink
          key={it.to}
          to={it.to}
          end={it.end}
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
              isActive ? 'text-gold' : 'text-black/50 dark:text-white/50'
            }`
          }
        >
          <span className="text-lg leading-none">{it.icon}</span>
          {it.label}
        </NavLink>
      ))}
    </nav>
  )
}
