import { Outlet } from 'react-router-dom'
import { BottomNav } from '../../components/BottomNav'
import { Onboarding } from '../../components/Onboarding'

// キャストアプリ共通シェル（モバイル幅・下地グラデーションは body 側／ボトムタブは重ね置き）
export default function CastLayout() {
  return (
    <div className="relative mx-auto h-full max-w-lg overflow-hidden text-[#2a2140] dark:text-[#f3eee4]">
      <Outlet />
      <BottomNav />
      <Onboarding />
    </div>
  )
}
