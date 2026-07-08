import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import {
  useMyMemberships,
  useBroadcasts,
  useStore,
  markBroadcastRead,
  joinByCode,
} from '../../lib/stores'
import { yen } from '../../lib/format'
import { fmtDateTime } from '../../lib/format'

const BTYPE_LABEL: Record<string, string> = {
  event: '看板イベント',
  birthdayQuota: 'バースデーノルマ',
  shift: 'シフト/ヘルプ',
  notice: '連絡',
  direct: '個別連絡',
}

export default function Notices() {
  const { user } = useAuth()
  const { memberships, loading } = useMyMemberships()

  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [msg, setMsg] = useState<string | null>(null)

  const join = async () => {
    if (!code.trim() || !name.trim()) return
    try {
      await joinByCode(code.trim(), name.trim())
      setCode('')
      setName('')
      setMsg('店舗に参加しました。')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '参加に失敗しました')
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="safe-top sticky top-0 z-10 flex items-center justify-between border-b border-black/10 bg-white/90 px-4 pb-3 backdrop-blur dark:border-white/10 dark:bg-night/90">
        <h1 className="text-lg font-bold">お知らせ</h1>
        <Link to="/" className="text-sm text-black/60 dark:text-white/60">
          ← ホーム
        </Link>
      </header>

      <div className="flex-1 space-y-4 p-4">
        {loading ? (
          <p className="text-sm text-black/50 dark:text-white/50">読み込み中…</p>
        ) : memberships.length === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/50">所属店舗がありません。招待コードで参加できます。</p>
        ) : (
          memberships.map((m) => <StoreBroadcasts key={m.storeId} storeId={m.storeId} uid={user?.uid} />)
        )}

        <section className="rounded-2xl border border-dashed border-black/20 p-4 dark:border-white/20">
          <h2 className="text-sm font-semibold">店舗に参加</h2>
          <div className="mt-2 space-y-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="招待コード"
              className="w-full rounded-lg border border-black/10 bg-black/5 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
            />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="表示名（源氏名）"
              className="w-full rounded-lg border border-black/10 bg-black/5 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
            />
            <button onClick={() => void join()} className="w-full rounded-lg bg-gold py-2 text-sm font-bold text-night">
              参加する
            </button>
            {msg && <p className="text-xs text-gold">{msg}</p>}
          </div>
        </section>
      </div>
    </div>
  )
}

function StoreBroadcasts({ storeId, uid }: { storeId: string; uid?: string }) {
  const store = useStore(storeId)
  const broadcasts = useBroadcasts(storeId)

  // 既読を記録（表示時）
  useEffect(() => {
    if (!uid) return
    broadcasts.forEach((b) => void markBroadcastRead(storeId, b.id))
  }, [storeId, uid, broadcasts])

  if (broadcasts.length === 0) return null
  return (
    <section>
      <h2 className="mb-2 text-xs font-bold text-black/50 dark:text-white/50">{store?.name ?? '店舗'}</h2>
      <ul className="space-y-2">
        {broadcasts.map((b) => (
          <li key={b.id} className="rounded-xl border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-white/5">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[11px] font-bold text-gold">
                {BTYPE_LABEL[b.type] ?? b.type}
              </span>
              <span className="font-semibold">{b.title}</span>
            </div>
            {b.body && <p className="mt-1 whitespace-pre-wrap text-sm text-black/70 dark:text-white/70">{b.body}</p>}
            {b.quota ? <p className="mt-1 text-xs text-gold">目標 {yen(b.quota)}</p> : null}
            <p className="mt-1 text-[11px] text-black/40 dark:text-white/40">{fmtDateTime(b.createdAt)}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
