import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
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
import ConsoleHome from './pages/console/ConsoleHome'
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

export default function App() {
  return (
    <Routes>
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

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
