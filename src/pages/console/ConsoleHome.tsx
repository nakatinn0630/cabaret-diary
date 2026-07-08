import { useAuth } from '../../contexts/AuthContext'

// 店舗コンソール（黒服・店長向け／D-1: 別サーフェス）の骨組み。
// キャスト個人領域には一切アクセスしない。発信・売上確定・ランキング・メンバー管理を載せる（F-15〜F-18）。
export default function ConsoleHome() {
  const { user, signOut } = useAuth()

  return (
    <div className="min-h-full bg-neutral-100 text-night dark:bg-neutral-900 dark:text-white">
      <header className="flex items-center justify-between border-b border-black/10 bg-white px-6 py-4 dark:border-white/10 dark:bg-neutral-800">
        <span className="font-bold">キャバ帳 店舗コンソール</span>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-black/50 dark:text-white/50">{user?.email}</span>
          <button onClick={() => void signOut()} className="text-black/50 dark:text-white/50">
            ログアウト
          </button>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl grid-cols-1 gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
        {[
          ['情報発信', 'F-17 看板イベント・バースデーノルマ・連絡'],
          ['売上確定', 'F-16 伝票確定額の入力・突合'],
          ['ランキング', 'F-18 種別×期間・公開範囲設定'],
          ['メンバー管理', 'F-15 招待・ロール・掛け持ち'],
        ].map(([title, desc]) => (
          <section key={title} className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-neutral-800">
            <h2 className="text-sm font-semibold">{title}</h2>
            <p className="mt-1 text-xs text-black/50 dark:text-white/50">{desc}（Phase 5で実装予定）</p>
          </section>
        ))}
      </main>
    </div>
  )
}
