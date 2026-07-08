import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { deleteCustomer, useCustomer, useVisits } from '../../lib/customers'
import { RankBadge } from '../../components/RankBadge'
import { RiskAlert } from '../../components/RiskAlert'
import { VisitTimeline } from '../../components/VisitTimeline'
import { VisitForm } from '../../components/VisitForm'
import { yen } from '../../lib/format'

export default function CustomerDetail() {
  const { cid } = useParams<{ cid: string }>()
  const navigate = useNavigate()
  const { customer, loading } = useCustomer(cid)
  const { visits } = useVisits(cid)
  const [showVisitForm, setShowVisitForm] = useState(false)

  if (loading) {
    return <p className="p-10 text-center text-sm text-black/50 dark:text-white/50">読み込み中…</p>
  }
  if (!customer) {
    return (
      <div className="p-10 text-center text-sm text-black/50 dark:text-white/50">
        <p>顧客が見つかりません。</p>
        <Link to="/customers" className="mt-3 inline-block font-semibold text-gold">
          顧客一覧へ
        </Link>
      </div>
    )
  }

  const onDelete = async () => {
    if (!cid) return
    if (!confirm(`「${customer.nickname}」を削除しますか？この操作は取り消せません。`)) return
    await deleteCustomer(cid)
    navigate('/customers')
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="safe-top sticky top-0 z-10 flex items-center justify-between border-b border-black/10 bg-white/90 px-4 pb-3 backdrop-blur dark:border-white/10 dark:bg-night/90">
        <Link to="/customers" className="text-sm text-black/60 dark:text-white/60">
          ← 顧客
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <Link to={`/compat?cid=${cid}`} className="font-semibold text-gold">
            占い
          </Link>
          <Link to={`/reply?cid=${cid}`} className="font-semibold text-gold">
            返信案
          </Link>
          <Link to={`/customers/${cid}/edit`} className="font-semibold text-gold">
            編集
          </Link>
          <button onClick={() => void onDelete()} className="text-red-500">
            削除
          </button>
        </div>
      </header>

      <div className="flex-1 space-y-4 p-4">
        {/* プロフィールカード */}
        <section className="rounded-2xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-white/5">
          <div className="flex items-start gap-3">
            <div className="grid h-14 w-14 flex-none place-items-center rounded-full bg-gold/15 text-xl font-bold text-gold">
              {customer.nickname.slice(0, 1)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-bold">{customer.nickname}</h1>
                <RankBadge rank={customer.rank} />
              </div>
              <p className="mt-0.5 text-xs text-black/50 dark:text-white/50">
                {[customer.occupation, customer.companyName].filter(Boolean).join(' / ') || '職業未登録'}
                {customer.lineName ? ` · LINE: ${customer.lineName}` : ''}
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <Stat label="累計" value={yen(customer.totalSpent)} />
            <Stat label="来店" value={`${customer.visitCount}回`} />
            <Stat label="リスク" value={String(customer.riskScore)} />
          </div>
          {customer.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {customer.tags.map((t) => (
                <span key={t} className="rounded-full bg-black/5 px-2 py-0.5 text-[11px] dark:bg-white/10">
                  {t}
                </span>
              ))}
            </div>
          )}
          {customer.fit && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span
                className={`rounded-full px-2 py-0.5 font-bold ${
                  customer.fit.level === '得意'
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
                    : customer.fit.level === '苦手'
                      ? 'bg-red-500/15 text-red-600 dark:text-red-300'
                      : 'bg-black/5 text-black/60 dark:bg-white/10 dark:text-white/60'
                }`}
              >
                相性: {customer.fit.level}
              </span>
              <span className="text-black/50 dark:text-white/50">消耗度 {customer.fit.fatigue}</span>
              {customer.fit.reasonTags.map((t) => (
                <span key={t} className="rounded-full bg-black/5 px-2 py-0.5 dark:bg-white/10">
                  {t}
                </span>
              ))}
            </div>
          )}
        </section>

        <RiskAlert score={customer.riskScore} flags={customer.riskFlags} />

        {/* F-14 ピン留めした注意点 */}
        {customer.pinnedCautions.length > 0 && (
          <section className="rounded-2xl border border-black/10 p-4 dark:border-white/10">
            <h2 className="text-sm font-semibold">気をつけること</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {customer.pinnedCautions.map((c) => (
                <li key={c} className="flex gap-2">
                  <span className="text-gold">•</span>
                  {c}
                </li>
              ))}
            </ul>
          </section>
        )}

        {customer.memo && (
          <section className="rounded-2xl border border-black/10 p-4 dark:border-white/10">
            <h2 className="text-sm font-semibold">メモ</h2>
            <p className="mt-1 whitespace-pre-wrap text-sm text-black/70 dark:text-white/70">{customer.memo}</p>
          </section>
        )}

        {/* 来店履歴 */}
        <section className="rounded-2xl border border-black/10 p-4 dark:border-white/10">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">来店履歴</h2>
            <button
              onClick={() => setShowVisitForm(true)}
              className="rounded-full bg-gold px-3 py-1 text-xs font-bold text-night"
            >
              ＋ 来店を登録
            </button>
          </div>
          <VisitTimeline visits={visits} />
        </section>
      </div>

      {showVisitForm && cid && <VisitForm cid={cid} onClose={() => setShowVisitForm(false)} />}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-black/5 py-2 dark:bg-white/5">
      <div className="text-sm font-bold tabular-nums">{value}</div>
      <div className="text-[11px] text-black/50 dark:text-white/50">{label}</div>
    </div>
  )
}
