import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useMyMemberships, createStore, joinByCode, useStore } from '../../lib/stores'
import type { MyMembership } from '../../lib/stores'

const inputCls =
  'w-full rounded-lg border border-black/10 bg-black/5 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gold/50 dark:border-white/10 dark:bg-neutral-700'

const ROLE_LABEL: Record<string, string> = { manager: '店長', kurofuku: '黒服', cast: 'キャスト' }

export default function ConsoleHome() {
  const { user, signOut } = useAuth()
  const { memberships, loading } = useMyMemberships()

  const [name, setName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [code, setCode] = useState('')
  const [joinName, setJoinName] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const staffStores = memberships.filter((m) => m.role === 'manager' || m.role === 'kurofuku')

  const onCreate = async () => {
    if (!name.trim() || !displayName.trim()) return
    setBusy(true)
    setMsg(null)
    try {
      await createStore(name.trim(), displayName.trim())
      setName('')
      setDisplayName('')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '作成に失敗しました')
    } finally {
      setBusy(false)
    }
  }
  const onJoin = async () => {
    if (!code.trim() || !joinName.trim()) return
    setBusy(true)
    setMsg(null)
    try {
      await joinByCode(code.trim(), joinName.trim())
      setCode('')
      setJoinName('')
      setMsg('店舗に参加しました。')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '参加に失敗しました')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-full bg-neutral-100 text-night dark:bg-neutral-900 dark:text-white">
      <header className="safe-top safe-x sticky top-0 z-10 flex items-center justify-between border-b border-black/10 bg-white px-6 pb-4 dark:border-white/10 dark:bg-neutral-800">
        <span className="font-bold">キャバ帳 店舗コンソール</span>
        <div className="flex items-center gap-4 text-sm">
          <Link to="/" className="text-black/50 dark:text-white/50">
            キャストアプリ →
          </Link>
          <span className="text-black/40 dark:text-white/40">{user?.email}</span>
          <button onClick={() => void signOut()} className="text-black/50 dark:text-white/50">
            ログアウト
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 p-6">
        <section>
          <h2 className="mb-2 text-sm font-bold">担当する店舗</h2>
          {loading ? (
            <p className="text-sm text-black/50 dark:text-white/50">読み込み中…</p>
          ) : staffStores.length === 0 ? (
            <p className="text-sm text-black/50 dark:text-white/50">
              まだ店舗がありません。下から作成、または招待コードで参加してください。
            </p>
          ) : (
            <ul className="space-y-2">
              {staffStores.map((m) => (
                <StoreRow key={m.storeId} m={m} />
              ))}
            </ul>
          )}
        </section>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <section className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-neutral-800">
            <h3 className="text-sm font-bold">店舗を作成（店長）</h3>
            <div className="mt-2 space-y-2">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="店舗名" className={inputCls} />
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="自分の表示名" className={inputCls} />
              <button onClick={() => void onCreate()} disabled={busy} className="w-full rounded-lg bg-gold py-2 text-sm font-bold text-night disabled:opacity-60">
                作成
              </button>
            </div>
          </section>

          <section className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-neutral-800">
            <h3 className="text-sm font-bold">招待コードで参加</h3>
            <div className="mt-2 space-y-2">
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="招待コード" className={inputCls} />
              <input value={joinName} onChange={(e) => setJoinName(e.target.value)} placeholder="表示名（源氏名）" className={inputCls} />
              <button onClick={() => void onJoin()} disabled={busy} className="w-full rounded-lg border border-black/15 py-2 text-sm font-semibold dark:border-white/20">
                参加
              </button>
            </div>
          </section>
        </div>

        {msg && <p className="text-sm text-gold">{msg}</p>}

        <p className="text-xs text-black/40 dark:text-white/40">
          ※ 店舗コンソールはキャストの個人領域（顧客・占い・相談）にはアクセスしません。売上・発信・ランキング等の店舗運営情報のみを扱います。
        </p>
      </main>
    </div>
  )
}

function StoreRow({ m }: { m: MyMembership }) {
  const store = useStore(m.storeId)
  return (
    <li>
      <Link
        to={`/console/${m.storeId}`}
        className="flex items-center justify-between rounded-xl border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-neutral-800"
      >
        <span className="font-semibold">{store?.name ?? '店舗'}</span>
        <span className="text-xs text-black/50 dark:text-white/50">{ROLE_LABEL[m.role]} · 開く →</span>
      </Link>
    </li>
  )
}
