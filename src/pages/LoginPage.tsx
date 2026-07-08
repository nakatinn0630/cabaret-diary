import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function LoginPage() {
  const { user, loading, signInWithGoogle } = useAuth()

  if (loading) return null
  if (user) return <Navigate to="/" replace />

  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 bg-night px-6 text-white">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-wide text-gold">キャバ帳</h1>
        <p className="mt-2 text-sm text-white/70">顧客・スケジュールをひとつで</p>
      </div>
      <button
        onClick={() => void signInWithGoogle()}
        className="rounded-full bg-white px-8 py-3 font-medium text-night shadow-lg transition hover:bg-white/90"
      >
        Googleでログイン
      </button>
      <p className="max-w-xs text-center text-xs text-white/50">
        18歳未満の方はご利用いただけません。ログインで利用規約・プライバシーポリシーに同意したものとみなします。
      </p>
    </div>
  )
}
