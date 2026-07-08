import { useAuth } from '../../contexts/AuthContext'

// キャストアプリのホーム（骨組み）。Phase 1で顧客DB/来店/リスクスコアを載せる。
export default function CastHome() {
  const { user, signOut } = useAuth()

  return (
    <div className="mx-auto flex h-full max-w-md flex-col bg-white text-night dark:bg-night dark:text-white">
      <header className="safe-top sticky top-0 z-10 flex items-center justify-between border-b border-black/10 bg-white/90 px-4 pb-3 backdrop-blur dark:border-white/10 dark:bg-night/90">
        <span className="font-bold text-gold">キャバ帳</span>
        <button onClick={() => void signOut()} className="text-sm text-black/50 dark:text-white/50">
          ログアウト
        </button>
      </header>

      <main className="flex-1 space-y-4 p-4">
        <p className="text-sm">
          ようこそ、{user?.displayName ?? user?.email ?? 'ゲスト'} さん
        </p>

        <section className="rounded-xl border border-black/10 p-4 dark:border-white/10">
          <h2 className="text-sm font-semibold">今日の予定</h2>
          <p className="mt-1 text-xs text-black/50 dark:text-white/50">（Phase 2で実装予定）</p>
        </section>

        <section className="rounded-xl border border-black/10 p-4 dark:border-white/10">
          <h2 className="text-sm font-semibold">顧客管理</h2>
          <p className="mt-1 text-xs text-black/50 dark:text-white/50">
            F-01/02/03（顧客DB・来店履歴・リスクスコア）はPhase 1で実装予定
          </p>
        </section>
      </main>
    </div>
  )
}
