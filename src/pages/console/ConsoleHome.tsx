import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useMyMemberships, createStore, joinByCode, useStore } from '../../lib/stores'
import type { MyMembership } from '../../lib/stores'
import { showsCast } from '../../lib/surface'
import {
  Header,
  Main,
  Card,
  Field,
  SectionTitle,
  Empty,
  inputCls,
  subTx,
  goldTx,
  useToast,
} from '../../components/ui'

const ROLE_LABEL: Record<string, string> = { manager: '店長', kurofuku: '黒服', cast: 'キャスト' }

export default function ConsoleHome() {
  const { user, signOut } = useAuth()
  const toast = useToast()
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
      toast('店舗を作成しました ✓')
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
      toast('店舗に参加しました ✓')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '参加に失敗しました')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col bg-night/[0.03] text-night dark:bg-[#151226]/60 dark:text-white">
      <Header
        title="店舗コンソール"
        right={
          <div className={`flex items-center gap-3 text-[12px] ${subTx}`}>
            {/* キャストアプリ導線はキャストサーフェス同居時のみ（完全分離時は非表示） */}
            {showsCast() && (
              <Link to="/" className="text-gold font-semibold">
                キャストアプリ →
              </Link>
            )}
            <button onClick={() => void signOut()}>ログアウト</button>
          </div>
        }
      />

      <Main>
        <p className={`text-[12px] ${subTx}`}>
          管理権限のある店舗（別サーフェス）· {user?.email}
        </p>

        <section className="space-y-2.5">
          <SectionTitle>担当する店舗</SectionTitle>
          {loading ? (
            <Empty>読み込み中…</Empty>
          ) : staffStores.length === 0 ? (
            <Empty>まだ店舗がありません。下から作成、または招待コードで参加してください。</Empty>
          ) : (
            staffStores.map((m) => <StoreRow key={m.storeId} m={m} />)
          )}
        </section>

        <Card className="p-4 space-y-3">
          <SectionTitle>店舗を作成（店長）</SectionTitle>
          <Field label="店舗名">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="店舗名" className={inputCls} />
          </Field>
          <Field label="自分の表示名">
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="自分の表示名"
              className={inputCls}
            />
          </Field>
          <button
            onClick={() => void onCreate()}
            disabled={busy}
            className="w-full min-h-[44px] rounded-xl bg-gold text-night font-bold text-[13px] shadow-lg shadow-gold/30 disabled:opacity-50"
          >
            作成
          </button>
        </Card>

        <Card className="p-4 space-y-3">
          <SectionTitle>招待コードで参加</SectionTitle>
          <Field label="招待コード">
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="招待コード" className={inputCls} />
          </Field>
          <Field label="表示名（源氏名）">
            <input
              value={joinName}
              onChange={(e) => setJoinName(e.target.value)}
              placeholder="表示名（源氏名）"
              className={inputCls}
            />
          </Field>
          <button
            onClick={() => void onJoin()}
            disabled={busy}
            className="w-full min-h-[44px] rounded-xl border border-night/15 dark:border-white/20 font-semibold text-[13px] disabled:opacity-50"
          >
            参加
          </button>
        </Card>

        {msg && <p className={`text-[12px] font-semibold ${goldTx}`}>{msg}</p>}

        <p className={`text-[11px] leading-relaxed ${subTx}`}>
          ※ 店舗コンソールはキャストの個人領域（顧客・占い・相談）にはアクセスしません。売上・発信・ランキング等の店舗運営情報のみを扱います。
        </p>
      </Main>
    </div>
  )
}

function StoreRow({ m }: { m: MyMembership }) {
  const store = useStore(m.storeId)
  const nm = store?.name ?? '店舗'
  return (
    <Link to={`/console/${m.storeId}`} className="block">
      <Card className="p-4 flex items-center gap-3 !rounded-xl">
        <div
          className="w-11 h-11 rounded-lg bg-night/80 dark:bg-white/10 text-gold flex items-center justify-center font-serif font-bold text-[16px]"
          aria-hidden="true"
        >
          {nm.charAt(0)}
        </div>
        <div className="flex-1">
          <p className="text-[14px] font-bold">{nm}</p>
          <p className={`text-[12px] ${subTx}`}>あなた: {ROLE_LABEL[m.role]}</p>
        </div>
        <span className={subTx} aria-hidden="true">
          ›
        </span>
      </Card>
    </Link>
  )
}
