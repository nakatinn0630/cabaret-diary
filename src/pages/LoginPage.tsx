import { useState } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { subTx } from '../components/ui'

// クロードデザインの LoginScreen を移植（ブランド表現＋実 Google 認証）
export default function LoginPage() {
  const { user, loading, signInWithGoogle } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (loading) return null
  if (user) return <Navigate to="/" replace />

  const onSignIn = async () => {
    setError(null)
    setBusy(true)
    try {
      await signInWithGoogle()
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'ログインに失敗しました。時間をおいて再度お試しください。',
      )
      setBusy(false)
    }
  }

  return (
    <div className="safe-top h-full flex flex-col items-center justify-center gap-10 px-8 text-center text-[#2a2140] dark:text-[#f3eee4]">
      <div className="space-y-3">
        <div className="text-[44px]" aria-hidden="true">
          🥂
        </div>
        <h1 className="font-serif text-[34px] font-bold tracking-[0.2em] bg-gradient-to-r from-[#e8c97e] via-gold to-rose bg-clip-text text-transparent">
          キャバ帳
        </h1>
        <p className={`text-[13px] leading-relaxed ${subTx}`}>
          夜のお仕事を、もっとスマートに。
          <br />
          顧客・売上・予定をこの一冊で。
        </p>
      </div>

      <ul className={`flex flex-wrap justify-center gap-1.5 max-w-[320px] text-[11px] font-semibold ${subTx}`}>
        {['顧客管理', '売上目標', 'スケジュール', '占い・相性', 'AI黒服相談'].map((f) => (
          <li key={f} className="rounded-full border border-gold/40 px-2.5 py-1">
            {f}
          </li>
        ))}
      </ul>

      <div className="w-full max-w-[280px] space-y-3">
        <button
          type="button"
          onClick={() => void onSignIn()}
          disabled={busy}
          className="w-full min-h-[52px] rounded-2xl bg-gold text-night font-bold text-[16px] shadow-xl shadow-gold/30 transition active:scale-[0.98] disabled:opacity-60"
        >
          {busy ? 'ログイン中…' : 'Googleでログイン'}
        </button>
        <a
          href="/demo"
          className="block w-full min-h-[48px] leading-[48px] rounded-2xl border border-gold/50 text-gold font-bold text-[15px] transition active:scale-[0.98]"
        >
          ログインせずデモを見る
        </a>
      </div>

      {error && <p className="max-w-xs text-[12px] text-rose">{error}</p>}
      <p className={`max-w-xs text-[11px] leading-relaxed ${subTx}`}>
        18歳未満の方はご利用いただけません。ログインで
        <Link to="/legal" className="font-semibold text-gold underline">
          利用規約・プライバシーポリシー
        </Link>
        に同意したものとみなします。
      </p>
    </div>
  )
}
