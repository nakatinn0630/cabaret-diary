import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import {
  useMyMemberships,
  useBroadcasts,
  useStore,
  markBroadcastRead,
  joinByCode,
} from '../../lib/stores'
import { yen, fmtDateTime } from '../../lib/format'
import type { BroadcastType } from '../../types'
import {
  Header,
  Main,
  Card,
  Chip,
  Field,
  SectionTitle,
  Empty,
  inputCls,
  goldTx,
  subTx,
  useToast,
} from '../../components/ui'

const BTYPE_LABEL: Record<BroadcastType, string> = {
  event: '看板イベント',
  birthdayQuota: 'バースデーノルマ',
  shift: 'シフト/ヘルプ',
  notice: '連絡',
  direct: '個別連絡',
}

// 発信種別ごとのタグ配色（クロードデザイン: イベント=rose / ノルマ=gold / その他=neutral）
function chipCls(type: BroadcastType): string {
  if (type === 'event')
    return 'font-bold border-[#e6789b]/40 bg-[#e6789b]/10 text-[#a8395c] dark:text-[#f0c3d2]'
  if (type === 'birthdayQuota') return `font-bold border-gold/40 bg-gold/10 ${goldTx}`
  return 'font-bold border-night/15 dark:border-white/20'
}

export default function Notices() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
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
      toast('店舗に参加しました ✓')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '参加に失敗しました')
    }
  }

  return (
    <div className="flex h-full flex-col">
      <Header title="🔔 お知らせ" back onBack={() => navigate('/')} />

      <Main>
        {loading ? (
          <Empty>読み込み中…</Empty>
        ) : memberships.length === 0 ? (
          <Empty>所属店舗がありません。招待コードで参加できます。</Empty>
        ) : (
          memberships.map((m) => <StoreBroadcasts key={m.storeId} storeId={m.storeId} uid={user?.uid} />)
        )}

        <Card className="p-4 space-y-3">
          <SectionTitle>店舗に参加</SectionTitle>
          <Field label="招待コード">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="招待コード"
              className={inputCls}
            />
          </Field>
          <Field label="表示名（源氏名）">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="表示名（源氏名）"
              className={inputCls}
            />
          </Field>
          <button
            onClick={() => void join()}
            className="w-full min-h-[44px] rounded-xl bg-gold text-night font-bold text-[13px] shadow-lg shadow-gold/30"
          >
            参加する
          </button>
          {msg && <p className={`text-[12px] font-semibold ${goldTx}`}>{msg}</p>}
        </Card>
      </Main>
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
    <section className="space-y-2.5">
      <SectionTitle>{store?.name ?? '店舗'}</SectionTitle>
      {broadcasts.map((b) => (
        <Card key={b.id} className="p-4 space-y-1.5">
          <div className="flex items-center gap-2">
            <Chip className={chipCls(b.type)}>{BTYPE_LABEL[b.type] ?? b.type}</Chip>
            <span className={`text-[11px] ${subTx}`}>{fmtDateTime(b.createdAt)}</span>
          </div>
          <p className="text-[14px] font-bold">{b.title}</p>
          {b.body && <p className={`text-[12px] leading-relaxed whitespace-pre-wrap ${subTx}`}>{b.body}</p>}
          {b.quota ? <p className={`text-[12px] font-semibold ${goldTx}`}>目標 {yen(b.quota)}</p> : null}
        </Card>
      ))}
    </section>
  )
}
