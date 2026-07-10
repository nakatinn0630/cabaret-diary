import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { enableDemo, disableDemo, demoActive } from './lib/demo'
import LoginPage from './pages/LoginPage'
import CastLayout from './pages/cast/CastLayout'
import CastHome from './pages/cast/CastHome'
import CustomerList from './pages/cast/CustomerList'
import CustomerDetail from './pages/cast/CustomerDetail'
import CustomerEdit from './pages/cast/CustomerEdit'
import Schedule from './pages/cast/Schedule'
import ScheduleEdit from './pages/cast/ScheduleEdit'
import ReplyAssist from './pages/cast/ReplyAssist'
import Consult from './pages/cast/Consult'
import SalesReport from './pages/cast/SalesReport'
import Compatibility from './pages/cast/Compatibility'
import Notices from './pages/cast/Notices'
import Menu from './pages/cast/Menu'
import ConsoleHome from './pages/console/ConsoleHome'
import StoreConsole from './pages/console/StoreConsole'
import type { ReactNode } from 'react'

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-night dark:text-white">読み込み中…</div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

// /demo アクセスでデモモードを有効化し、フルリロードでトップへ（AuthProviderを再初期化）
function DemoEntry() {
  useEffect(() => {
    enableDemo()
    window.location.replace('/')
  }, [])
  return <div className="flex h-full items-center justify-center text-night dark:text-white">デモを準備中…</div>
}

// デモ中である旨の小さな固定バッジ（タップで終了）
function DemoBadge() {
  if (!demoActive()) return null
  return (
    <button
      type="button"
      onClick={() => {
        disableDemo()
        window.location.replace('/login')
      }}
      className="fixed right-3 z-[90] rounded-full bg-rose/90 text-white text-[11px] font-bold px-3 py-1.5 shadow-lg"
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 70px)' }}
      aria-label="デモモードを終了"
    >
      🔎 DEMO（タップで終了）
    </button>
  )
}

export default function App() {
  return (
    <>
      <DemoBadge />
      <Routes>
        <Route path="/demo" element={<DemoEntry />} />
      <Route path="/login" element={<LoginPage />} />

      {/* キャストアプリ（個人領域） */}
      <Route
        element={
          <RequireAuth>
            <CastLayout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<CastHome />} />
        <Route path="/customers" element={<CustomerList />} />
        <Route path="/customers/new" element={<CustomerEdit />} />
        <Route path="/customers/:cid" element={<CustomerDetail />} />
        <Route path="/customers/:cid/edit" element={<CustomerEdit />} />
        <Route path="/schedule" element={<Schedule />} />
        <Route path="/schedule/new" element={<ScheduleEdit />} />
        <Route path="/schedule/:sid/edit" element={<ScheduleEdit />} />
        <Route path="/reply" element={<ReplyAssist />} />
        <Route path="/consult" element={<Consult />} />
        <Route path="/sales" element={<SalesReport />} />
        <Route path="/compat" element={<Compatibility />} />
        <Route path="/notices" element={<Notices />} />
        <Route path="/menu" element={<Menu />} />
      </Route>

      {/* 店舗コンソール（D-1: 別サーフェス。将来は別デプロイに分離予定） */}
      <Route
        path="/console"
        element={
          <RequireAuth>
            <ConsoleHome />
          </RequireAuth>
        }
      />
      <Route
        path="/console/:storeId"
        element={
          <RequireAuth>
            <StoreConsole />
          </RequireAuth>
        }
      />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
