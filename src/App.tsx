import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { enableDemo, disableDemo, demoActive } from './lib/demo'
import { showsCast, showsStore } from './lib/surface'
import { UpdatePrompt } from './components/UpdatePrompt'
import LoginPage from './pages/LoginPage'
import CastLayout from './pages/cast/CastLayout'
import CastHome from './pages/cast/CastHome'
import type { ReactNode } from 'react'

// 初回表示(ログイン/ホーム)以外はルート単位でコード分割し、初期バンドルを軽くする。
const Legal = lazy(() => import('./pages/Legal'))
const CustomerList = lazy(() => import('./pages/cast/CustomerList'))
const CustomerDetail = lazy(() => import('./pages/cast/CustomerDetail'))
const CustomerEdit = lazy(() => import('./pages/cast/CustomerEdit'))
const Schedule = lazy(() => import('./pages/cast/Schedule'))
const ScheduleEdit = lazy(() => import('./pages/cast/ScheduleEdit'))
const ReplyAssist = lazy(() => import('./pages/cast/ReplyAssist'))
const Consult = lazy(() => import('./pages/cast/Consult'))
const SalesReport = lazy(() => import('./pages/cast/SalesReport'))
const Compatibility = lazy(() => import('./pages/cast/Compatibility'))
const Notices = lazy(() => import('./pages/cast/Notices'))
const Menu = lazy(() => import('./pages/cast/Menu'))
const ConsoleHome = lazy(() => import('./pages/console/ConsoleHome'))
const StoreConsole = lazy(() => import('./pages/console/StoreConsole'))

// 遅延チャンク読込中のフォールバック（ブランド色の軽いスピナー）
function PageLoader() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold border-t-transparent" aria-label="読み込み中" />
    </div>
  )
}

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
  // D-5: キャスト／店舗の完全分離。分離デプロイ時は VITE_SURFACE でどちらか一方のみ露出する。
  const cast = showsCast()
  const store = showsStore()
  const fallbackTo = cast ? '/' : '/console'
  return (
    <>
      <UpdatePrompt />
      <DemoBadge />
      <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/demo" element={<DemoEntry />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/legal" element={<Legal />} />

        {/* キャストアプリ（個人領域）。店舗サーフェスでは露出しない。 */}
        {cast && (
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
        )}

        {/* 店舗コンソール（D-1/D-5: 別サーフェス）。キャストサーフェスでは露出しない。 */}
        {store && (
          <Route
            path="/console"
            element={
              <RequireAuth>
                <ConsoleHome />
              </RequireAuth>
            }
          />
        )}
        {store && (
          <Route
            path="/console/:storeId"
            element={
              <RequireAuth>
                <StoreConsole />
              </RequireAuth>
            }
          />
        )}

        <Route path="*" element={<Navigate to={fallbackTo} replace />} />
      </Routes>
      </Suspense>
    </>
  )
}
