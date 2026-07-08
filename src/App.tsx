import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import LoginPage from './pages/LoginPage'
import CastHome from './pages/cast/CastHome'
import ConsoleHome from './pages/console/ConsoleHome'
import type { ReactNode } from 'react'

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-night dark:text-white">
        読み込み中…
      </div>
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
        path="/"
        element={
          <RequireAuth>
            <CastHome />
          </RequireAuth>
        }
      />

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
