import { Outlet } from 'react-router-dom'
import { BottomNav } from '../../components/BottomNav'

// キャストアプリ共通レイアウト（モバイル幅＋ボトムナビ）
export default function CastLayout() {
  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col bg-white text-night dark:bg-night dark:text-white">
      <div className="flex-1">
        <Outlet />
      </div>
      <BottomNav />
    </div>
  )
}
