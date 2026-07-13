import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
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
import {
  Header,
  Main,
  Card,
  Chip,
  Field,
  Seg,
  Avatar,
  Empty,
  SectionTitle,
  inputCls,
  subTx,
  goldTx,
  useToast,
} from '../../components/ui'

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
const ROLE_LABEL: Record<string, string> = { manager: '店長', kurofuku: '黒服', cast: 'キャスト' }

// 発信種別ごとのタグ配色（イベント=rose / ノルマ=gold / その他=neutral）
function tagCls(type: BroadcastType): string {
  if (type === 'event')
    return 'font-bold border-[#e6789b]/40 bg-[#e6789b]/10 text-[#a8395c] dark:text-[#f0c3d2]'
  if (type === 'birthdayQuota') return `font-bold border-gold/40 bg-gold/10 ${goldTx}`
  return 'font-bold border-night/15 dark:border-white/20'
}

type Tab = 'broadcast' | 'members' | 'sales' | 'ranking'
const TABS: { v: Tab; label: string }[] = [
  { v: 'broadcast', label: '発信' },
  { v: 'members', label: 'メンバー' },
  { v: 'sales', label: '売上確定' },
  { v: 'ranking', label: 'ランキング' },
]

export default function StoreConsole() {
  const { storeId } = useParams<{ storeId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const store = useStore(storeId)
  const members = useMemberships(storeId)
  const myRole = members.find((m) => m.uid === user?.uid)?.role
  const isManager = myRole === 'manager'
  const [tab, setTab] = useState<Tab>('broadcast')

  const casts = members.filter((m) => m.role === 'cast')

  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col bg-night/[0.03] text-night dark:bg-[#151226]/60 dark:text-white">
      <Header
        title={store?.name ?? '店舗'}
        back
        onBack={() => navigate('/console')}
        right={myRole ? <span className={`text-[12px] ${subTx}`}>{ROLE_LABEL[myRole]}</span> : undefined}
      />

      <div className="px-4 pb-3 flex gap-1.5 flex-shrink-0">
        {TABS.map((t) => (
          <button
            key={t.v}
            onClick={() => setTab(t.v)}
            className={`flex-1 py-2 rounded-xl text-[12px] font-bold border min-h-[40px] transition ${
              tab === t.v ? 'bg-gold text-night border-gold' : 'border-night/10 dark:border-white/15'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Main className="!space-y-2.5">
        {tab === 'broadcast' && storeId && <BroadcastTab storeId={storeId} />}
        {tab === 'members' && storeId && <MembersTab storeId={storeId} members={members} isManager={isManager} />}
        {tab === 'sales' && storeId && <SalesTab storeId={storeId} casts={casts} isManager={isManager} />}
        {tab === 'ranking' && storeId && <RankingTab storeId={storeId} casts={casts} isManager={isManager} />}
      </Main>
    </div>
  )
}

function BroadcastTab({ storeId }: { storeId: string }) {
  const toast = useToast()
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
      toast('発信しました ✓')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Card className="p-4 space-y-3 !rounded-xl">
        <SectionTitle>新しい発信</SectionTitle>
        <Field label="種別">
          <select value={type} onChange={(e) => setType(e.target.value as BroadcastType)} className={inputCls}>
            {BTYPES.map((t) => (
              <option key={t.v} value={t.v}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="タイトル" required>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="タイトル" className={inputCls} />
        </Field>
        <Field label="本文">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            placeholder="キャスト全員へのお知らせを入力…"
            className={inputCls}
          />
        </Field>
        {type === 'birthdayQuota' && (
          <Field label="目標金額（円）">
            <input
              value={quota}
              onChange={(e) => setQuota(e.target.value)}
              type="number"
              placeholder="目標金額（円）"
              className={inputCls}
            />
          </Field>
        )}
        <button
          onClick={() => void post()}
          disabled={busy}
          className="w-full min-h-[44px] rounded-xl bg-gold text-night font-bold text-[13px] shadow-lg shadow-gold/30 disabled:opacity-50"
        >
          発信する
        </button>
      </Card>

      <SectionTitle>発信履歴</SectionTitle>
      {broadcasts.length === 0 ? (
        <Empty>まだ発信はありません。</Empty>
      ) : (
        broadcasts.map((b) => (
          <Card key={b.id} className="p-3.5 space-y-1.5 !rounded-xl">
            <div className="flex items-center gap-2">
              <Chip className={tagCls(b.type)}>{BTYPES.find((t) => t.v === b.type)?.label ?? b.type}</Chip>
              <span className="text-[13px] font-bold">{b.title}</span>
            </div>
            {b.body && <p className={`text-[12px] leading-relaxed whitespace-pre-wrap ${subTx}`}>{b.body}</p>}
            {b.quota ? <p className={`text-[12px] font-semibold ${goldTx}`}>目標 {yen(b.quota)}</p> : null}
          </Card>
        ))
      )}
    </>
  )
}

function MembersTab({
  storeId,
  members,
  isManager,
}: {
  storeId: string
  members: Membership[]
  isManager: boolean
}) {
  const toast = useToast()
  const [invite, setInvite] = useState<string | null>(null)
  const gen = async (role: 'cast' | 'kurofuku') => {
    setInvite(await createInvite(storeId, role))
    toast('招待コードを発行しました ✓')
  }
  return (
    <>
      {isManager && (
        <Card className="p-4 space-y-3 !rounded-xl">
          <SectionTitle>招待コード発行</SectionTitle>
          <div className="flex gap-2">
            <button
              onClick={() => void gen('cast')}
              className="flex-1 min-h-[40px] rounded-xl border border-night/15 dark:border-white/20 text-[13px] font-semibold"
            >
              キャストを招待
            </button>
            <button
              onClick={() => void gen('kurofuku')}
              className="flex-1 min-h-[40px] rounded-xl border border-night/15 dark:border-white/20 text-[13px] font-semibold"
            >
              黒服を招待
            </button>
          </div>
          {invite && (
            <p className="select-all break-all rounded-xl bg-night/5 dark:bg-white/10 p-2.5 text-[13px] font-mono">
              {invite}
            </p>
          )}
        </Card>
      )}

      <SectionTitle>メンバー（{members.length}）</SectionTitle>
      {members.length === 0 ? (
        <Empty>メンバーがいません。</Empty>
      ) : (
        members.map((m) => (
          <Card key={m.uid} className="px-4 py-3 flex items-center gap-3 !rounded-xl">
            <Avatar name={m.displayName} size={36} />
            <span className="text-[14px] font-semibold flex-1">{m.displayName}</span>
            <Chip className={m.role === 'kurofuku' ? 'border-night/20 dark:border-white/20' : `border-gold/40 bg-gold/10 ${goldTx}`}>
              {ROLE_LABEL[m.role] ?? m.role}
            </Chip>
          </Card>
        ))
      )}
    </>
  )
}

const emptyFigures: SalesFigures = { totalSales: 0, shimeiCount: 0, dohanCount: 0, joCount: 0 }

function SalesTab({ storeId, casts, isManager }: { storeId: string; casts: Membership[]; isManager: boolean }) {
  const toast = useToast()
  const month = currentMonthKey()
  const confirmed = useStoreMonthSales(storeId, month)
  const [draft, setDraft] = useState<Record<string, SalesFigures>>({})

  const get = (uid: string): SalesFigures =>
    draft[uid] ?? confirmed.find((c) => c.uid === uid)?.figures ?? emptyFigures
  const setField = (uid: string, key: keyof SalesFigures, val: number) =>
    setDraft((d) => ({ ...d, [uid]: { ...get(uid), [key]: val } }))
  const save = async (uid: string) => {
    await confirmCastSales(storeId, month, uid, get(uid))
    toast('売上を確定しました ✓')
  }

  if (!isManager) return <Empty>売上確定は店長のみ操作できます。</Empty>

  return (
    <>
      <SectionTitle>{month} 売上確定（伝票確定額）</SectionTitle>
      {casts.length === 0 ? (
        <Empty>キャストがいません。招待してください。</Empty>
      ) : (
        casts.map((c) => {
          const f = get(c.uid)
          const isDone = confirmed.some((s) => s.uid === c.uid)
          return (
            <Card key={c.uid} className="p-4 space-y-3 !rounded-xl">
              <div className="flex items-center gap-3">
                <Avatar name={c.displayName} size={32} />
                <span className="text-[14px] font-semibold flex-1">{c.displayName}</span>
                <span className={`font-serif text-[14px] font-bold ${goldTx}`}>{yen(f.totalSales)}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Num label="売上" value={f.totalSales} onChange={(v) => setField(c.uid, 'totalSales', v)} />
                <Num label="指名" value={f.shimeiCount} onChange={(v) => setField(c.uid, 'shimeiCount', v)} />
                <Num label="同伴" value={f.dohanCount} onChange={(v) => setField(c.uid, 'dohanCount', v)} />
                <Num label="場内" value={f.joCount} onChange={(v) => setField(c.uid, 'joCount', v)} />
              </div>
              <button
                onClick={() => void save(c.uid)}
                className={`text-[12px] font-bold rounded-full px-4 py-2 min-h-[36px] ${
                  isDone ? 'text-emerald-500 border border-emerald-500/40' : 'bg-night text-white dark:bg-gold dark:text-night'
                }`}
              >
                {isDone ? '確定済 ✓（再確定）' : '確定'}
              </button>
            </Card>
          )
        })
      )}
    </>
  )
}

function RankingTab({ storeId, casts, isManager }: { storeId: string; casts: Membership[]; isManager: boolean }) {
  const toast = useToast()
  const { user } = useAuth()
  const month = currentMonthKey()
  const sales = useStoreMonthSales(storeId, month)
  const rankings = useRankings(storeId)
  const [visibility, setVisibility] = useState<RankingVisibility>('selfOnly')

  const nameOf = useMemo(() => new Map(casts.map((c) => [c.uid, c.displayName])), [casts])

  const ranked = useMemo(
    () =>
      [...sales]
        .sort((a, b) => (b.figures?.totalSales ?? 0) - (a.figures?.totalSales ?? 0))
        .map((s, i) => ({
          uid: s.uid,
          displayName: nameOf.get(s.uid),
          rank: i + 1,
          value: s.figures?.totalSales ?? 0,
        })),
    [sales, nameOf],
  )

  const publish = async () => {
    const entries = ranked.map((r) => ({
      castUid: r.uid,
      displayName: r.displayName,
      rank: r.rank,
      value: r.value,
    }))
    await publishRanking(storeId, { metric: 'sales', period: 'month', visibility, entries })
    toast('ランキングを公開しました ✓')
  }

  const salesRanking = rankings.find((r) => r.metric === 'sales')

  // 公開範囲に応じたプレビュー用の減光判定（実データの5値をマッピング）
  const dim = (i: number, uid: string): boolean => {
    switch (visibility) {
      case 'private':
        return true
      case 'topN':
        return i >= 3
      case 'selfOnly':
        return uid !== user?.uid
      default:
        return false
    }
  }
  const scopeNote: Record<RankingVisibility, string> = {
    public: '全キャストに公開されます',
    topN: '上位のみキャストに表示されます',
    selfOnly: '各キャストには自分の順位のみ表示されます',
    anonymous: '順位のみ・氏名は伏せて表示されます',
    private: 'キャストには表示されません',
  }

  return (
    <>
      {isManager && (
        <Card className="p-4 space-y-3 !rounded-xl">
          <Field label="公開範囲">
            <Seg options={VIS} value={visibility} onChange={setVisibility} />
          </Field>
          <button
            onClick={() => void publish()}
            className="w-full min-h-[44px] rounded-xl bg-gold text-night font-bold text-[13px] shadow-lg shadow-gold/30"
          >
            この内容で公開
          </button>
        </Card>
      )}

      <SectionTitle>売上プレビュー（{month}）</SectionTitle>
      {ranked.length === 0 ? (
        <Empty>確定済みの売上がありません。</Empty>
      ) : (
        <>
          {ranked.map((r, i) => (
            <Card
              key={r.uid}
              className={`px-4 py-3 flex items-center gap-3 !rounded-xl ${dim(i, r.uid) ? 'opacity-40' : ''}`}
            >
              <span className={`font-serif text-[18px] font-bold w-6 ${i === 0 ? goldTx : subTx}`}>{r.rank}</span>
              <span className="text-[14px] font-semibold flex-1">
                {visibility === 'anonymous' ? '（匿名）' : (r.displayName ?? '—')}
              </span>
              <span className={`font-serif text-[14px] font-bold ${goldTx}`}>{yen(r.value)}</span>
            </Card>
          ))}
          <p className={`text-[11px] text-center ${subTx}`}>{scopeNote[visibility]}</p>
        </>
      )}

      <SectionTitle>現在公開中のランキング</SectionTitle>
      {!salesRanking ? (
        <Empty>未公開です。</Empty>
      ) : (
        <>
          <p className={`text-[11px] ${subTx}`}>公開範囲: {VIS.find((v) => v.v === salesRanking.visibility)?.label}</p>
          {salesRanking.entries.map((e) => (
            <Card key={e.castUid} className="px-4 py-2.5 flex items-center gap-3 !rounded-xl">
              <span className="font-serif text-[16px] font-bold w-6 text-gold tabular-nums">{e.rank}</span>
              <span className="text-[14px] flex-1">
                {salesRanking.visibility === 'anonymous' ? '（匿名）' : (e.displayName ?? '—')}
              </span>
              <span className="font-serif text-[14px] font-bold tabular-nums">{yen(e.value)}</span>
            </Card>
          ))}
        </>
      )}
    </>
  )
}

function Num({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block space-y-1">
      <span className={`block text-[11px] font-semibold ${subTx}`}>{label}</span>
      <input
        type="number"
        value={value || ''}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-xl border px-3 py-2 text-[16px] bg-white/70 dark:bg-white/[0.07] border-night/10 dark:border-white/15 outline-none focus:border-gold"
      />
    </label>
  )
}
