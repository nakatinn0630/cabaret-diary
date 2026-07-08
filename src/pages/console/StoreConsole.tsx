import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { currentMonthKey } from '../../lib/sales'
import { yen } from '../../lib/format'
import {
  createBroadcast,
  createInvite,
  confirmCastSales,
  publishRanking,
  useBroadcasts,
  useMemberships,
  useRankings,
  useStore,
  useStoreMonthSales,
  type NewBroadcast,
} from '../../lib/stores'
import type { BroadcastType, Membership, RankingVisibility, SalesFigures } from '../../types'

const inputCls =
  'w-full rounded-lg border border-black/10 bg-black/5 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gold/50 dark:border-white/10 dark:bg-neutral-700'

const BTYPES: { v: BroadcastType; label: string }[] = [
  { v: 'event', label: '看板イベント' },
  { v: 'birthdayQuota', label: 'バースデーノルマ' },
  { v: 'shift', label: 'シフト/ヘルプ' },
  { v: 'notice', label: '全体連絡' },
]
const VIS: { v: RankingVisibility; label: string }[] = [
  { v: 'public', label: '全体公開' },
  { v: 'topN', label: '上位のみ' },
  { v: 'selfOnly', label: '自分の順位のみ' },
  { v: 'anonymous', label: '匿名順位' },
  { v: 'private', label: '非公開' },
]

type Tab = 'broadcast' | 'members' | 'sales' | 'ranking'

export default function StoreConsole() {
  const { storeId } = useParams<{ storeId: string }>()
  const { user } = useAuth()
  const store = useStore(storeId)
  const members = useMemberships(storeId)
  const myRole = members.find((m) => m.uid === user?.uid)?.role
  const isManager = myRole === 'manager'
  const [tab, setTab] = useState<Tab>('broadcast')

  const casts = members.filter((m) => m.role === 'cast')

  return (
    <div className="min-h-full bg-neutral-100 text-night dark:bg-neutral-900 dark:text-white">
      <header className="safe-top safe-x sticky top-0 z-10 border-b border-black/10 bg-white px-6 pb-3 dark:border-white/10 dark:bg-neutral-800">
        <div className="flex items-center justify-between">
          <Link to="/console" className="text-sm text-black/60 dark:text-white/60">
            ← 店舗一覧
          </Link>
          <span className="text-xs text-black/40 dark:text-white/40">{myRole}</span>
        </div>
        <h1 className="mt-1 text-lg font-bold">{store?.name ?? '店舗'} コンソール</h1>
        <nav className="mt-2 flex gap-1 overflow-x-auto text-sm">
          {(
            [
              ['broadcast', '発信'],
              ['members', 'メンバー'],
              ['sales', '売上確定'],
              ['ranking', 'ランキング'],
            ] as [Tab, string][]
          ).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`whitespace-nowrap rounded-full px-3 py-1 ${
                tab === t ? 'bg-gold font-bold text-night' : 'text-black/60 dark:text-white/60'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 p-6">
        {tab === 'broadcast' && storeId && <BroadcastTab storeId={storeId} />}
        {tab === 'members' && storeId && <MembersTab storeId={storeId} members={members} isManager={isManager} />}
        {tab === 'sales' && storeId && <SalesTab storeId={storeId} casts={casts} isManager={isManager} />}
        {tab === 'ranking' && storeId && <RankingTab storeId={storeId} casts={casts} isManager={isManager} />}
      </main>
    </div>
  )
}

function BroadcastTab({ storeId }: { storeId: string }) {
  const broadcasts = useBroadcasts(storeId)
  const [type, setType] = useState<BroadcastType>('event')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [quota, setQuota] = useState('')
  const [busy, setBusy] = useState(false)

  const post = async () => {
    if (!title.trim()) return
    setBusy(true)
    try {
      const b: NewBroadcast = {
        type,
        title: title.trim(),
        body: body.trim(),
        audience: 'all',
        quota: type === 'birthdayQuota' && quota ? Number(quota) : undefined,
      }
      await createBroadcast(storeId, b)
      setTitle('')
      setBody('')
      setQuota('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <section className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-neutral-800">
        <h3 className="text-sm font-bold">新しい発信</h3>
        <div className="mt-2 space-y-2">
          <select value={type} onChange={(e) => setType(e.target.value as BroadcastType)} className={inputCls}>
            {BTYPES.map((t) => (
              <option key={t.v} value={t.v}>
                {t.label}
              </option>
            ))}
          </select>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="タイトル" className={inputCls} />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="本文" className={inputCls} />
          {type === 'birthdayQuota' && (
            <input value={quota} onChange={(e) => setQuota(e.target.value)} type="number" placeholder="目標金額（円）" className={inputCls} />
          )}
          <button onClick={() => void post()} disabled={busy} className="w-full rounded-lg bg-gold py-2 text-sm font-bold text-night disabled:opacity-60">
            全員に発信
          </button>
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-bold">発信履歴</h3>
        <ul className="space-y-2">
          {broadcasts.map((b) => (
            <li key={b.id} className="rounded-xl border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-neutral-800">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[11px] font-bold text-gold">
                  {BTYPES.find((t) => t.v === b.type)?.label ?? b.type}
                </span>
                <span className="font-semibold">{b.title}</span>
              </div>
              {b.body && <p className="mt-1 text-sm text-black/70 dark:text-white/70">{b.body}</p>}
              {b.quota ? <p className="mt-1 text-xs text-gold">目標 {yen(b.quota)}</p> : null}
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}

function MembersTab({ storeId, members, isManager }: { storeId: string; members: Membership[]; isManager: boolean }) {
  const [invite, setInvite] = useState<string | null>(null)
  const gen = async (role: 'cast' | 'kurofuku') => {
    setInvite(await createInvite(storeId, role))
  }
  return (
    <>
      {isManager && (
        <section className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-neutral-800">
          <h3 className="text-sm font-bold">招待コード発行</h3>
          <div className="mt-2 flex gap-2">
            <button onClick={() => void gen('cast')} className="rounded-lg border border-black/15 px-3 py-1.5 text-sm font-semibold dark:border-white/20">
              キャストを招待
            </button>
            <button onClick={() => void gen('kurofuku')} className="rounded-lg border border-black/15 px-3 py-1.5 text-sm font-semibold dark:border-white/20">
              黒服を招待
            </button>
          </div>
          {invite && (
            <p className="mt-2 select-all break-all rounded-lg bg-black/5 p-2 text-sm dark:bg-white/10">{invite}</p>
          )}
        </section>
      )}
      <section>
        <h3 className="mb-2 text-sm font-bold">メンバー（{members.length}）</h3>
        <ul className="space-y-2">
          {members.map((m) => (
            <li key={m.uid} className="flex items-center justify-between rounded-xl border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-neutral-800">
              <span className="font-medium">{m.displayName}</span>
              <span className="text-xs text-black/50 dark:text-white/50">{m.role}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}

const emptyFigures: SalesFigures = { totalSales: 0, shimeiCount: 0, dohanCount: 0, joCount: 0 }

function SalesTab({ storeId, casts, isManager }: { storeId: string; casts: Membership[]; isManager: boolean }) {
  const month = currentMonthKey()
  const confirmed = useStoreMonthSales(storeId, month)
  const [draft, setDraft] = useState<Record<string, SalesFigures>>({})

  const get = (uid: string): SalesFigures =>
    draft[uid] ?? confirmed.find((c) => c.uid === uid)?.figures ?? emptyFigures
  const setField = (uid: string, key: keyof SalesFigures, val: number) =>
    setDraft((d) => ({ ...d, [uid]: { ...get(uid), [key]: val } }))
  const save = async (uid: string) => {
    await confirmCastSales(storeId, month, uid, get(uid))
  }

  if (!isManager) return <p className="text-sm text-black/50 dark:text-white/50">売上確定は店長のみ操作できます。</p>

  return (
    <section>
      <h3 className="mb-2 text-sm font-bold">{month} 売上確定（伝票確定額）</h3>
      {casts.length === 0 ? (
        <p className="text-sm text-black/50 dark:text-white/50">キャストがいません。招待してください。</p>
      ) : (
        <ul className="space-y-3">
          {casts.map((c) => {
            const f = get(c.uid)
            return (
              <li key={c.uid} className="rounded-xl border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-neutral-800">
                <div className="mb-2 font-semibold">{c.displayName}</div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Num label="売上" value={f.totalSales} onChange={(v) => setField(c.uid, 'totalSales', v)} />
                  <Num label="指名" value={f.shimeiCount} onChange={(v) => setField(c.uid, 'shimeiCount', v)} />
                  <Num label="同伴" value={f.dohanCount} onChange={(v) => setField(c.uid, 'dohanCount', v)} />
                  <Num label="場内" value={f.joCount} onChange={(v) => setField(c.uid, 'joCount', v)} />
                </div>
                <button onClick={() => void save(c.uid)} className="mt-2 rounded-lg bg-gold px-3 py-1.5 text-sm font-bold text-night">
                  確定
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function RankingTab({ storeId, casts, isManager }: { storeId: string; casts: Membership[]; isManager: boolean }) {
  const month = currentMonthKey()
  const sales = useStoreMonthSales(storeId, month)
  const rankings = useRankings(storeId)
  const [visibility, setVisibility] = useState<RankingVisibility>('selfOnly')

  const nameOf = useMemo(() => new Map(casts.map((c) => [c.uid, c.displayName])), [casts])

  const publish = async () => {
    const entries = [...sales]
      .sort((a, b) => (b.figures?.totalSales ?? 0) - (a.figures?.totalSales ?? 0))
      .map((s, i) => ({
        castUid: s.uid,
        displayName: nameOf.get(s.uid),
        rank: i + 1,
        value: s.figures?.totalSales ?? 0,
      }))
    await publishRanking(storeId, { metric: 'sales', period: 'month', visibility, entries })
  }

  const salesRanking = rankings.find((r) => r.metric === 'sales')

  return (
    <>
      {isManager && (
        <section className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-neutral-800">
          <h3 className="text-sm font-bold">売上ランキングを公開</h3>
          <div className="mt-2 flex items-center gap-2">
            <select value={visibility} onChange={(e) => setVisibility(e.target.value as RankingVisibility)} className={inputCls}>
              {VIS.map((v) => (
                <option key={v.v} value={v.v}>
                  {v.label}
                </option>
              ))}
            </select>
            <button onClick={() => void publish()} className="whitespace-nowrap rounded-lg bg-gold px-3 py-2 text-sm font-bold text-night">
              公開
            </button>
          </div>
        </section>
      )}
      <section>
        <h3 className="mb-2 text-sm font-bold">現在の売上ランキング</h3>
        {!salesRanking ? (
          <p className="text-sm text-black/50 dark:text-white/50">未公開です。</p>
        ) : (
          <>
            <p className="mb-2 text-xs text-black/50 dark:text-white/50">
              公開範囲: {VIS.find((v) => v.v === salesRanking.visibility)?.label}
            </p>
            <ol className="space-y-1.5">
              {salesRanking.entries.map((e) => (
                <li key={e.castUid} className="flex items-center gap-2 rounded-lg border border-black/10 bg-white p-2 text-sm dark:border-white/10 dark:bg-neutral-800">
                  <span className="w-6 text-center font-bold text-gold tabular-nums">{e.rank}</span>
                  <span className="flex-1">
                    {salesRanking.visibility === 'anonymous' ? '（匿名）' : (e.displayName ?? '—')}
                  </span>
                  <span className="font-bold tabular-nums">{yen(e.value)}</span>
                </li>
              ))}
            </ol>
          </>
        )}
      </section>
    </>
  )
}

function Num({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] text-black/50 dark:text-white/50">{label}</span>
      <input
        type="number"
        value={value || ''}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-lg border border-black/10 bg-black/5 px-2 py-1.5 text-sm dark:border-white/10 dark:bg-neutral-700"
      />
    </label>
  )
}
