import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useCustomers } from '../../lib/customers'
import { useSchedules, SCHEDULE_LABEL } from '../../lib/schedules'
import { RiskChip } from '../../components/RiskAlert'
import { RankBadge } from '../../components/RankBadge'
import { SpecialContacts } from '../../components/SpecialContacts'
import { yen } from '../../lib/format'

export default function CastHome() {
  const { user, signOut } = useAuth()
  const { customers, loading } = useCustomers()
  const { schedules } = useSchedules()

  const alerting = customers.filter((c) => c.riskScore >= 50).sort((a, b) => b.riskScore - a.riskScore)
  const topSpenders = [...customers].sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 3)

  const todayKey = new Date().toISOString().slice(0, 10)
  const nameOf = (id?: string) => (id ? (customers.find((c) => c.id === id)?.nickname ?? '') : '')
  const todaySchedules = schedules.filter((s) => s.start.toDate().toISOString().slice(0, 10) === todayKey)
  const hhmm = (t: (typeof schedules)[number]['start']) => {
    const d = t.toDate()
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="safe-top sticky top-0 z-10 flex items-center justify-between border-b border-black/10 bg-white/90 px-4 pb-3 backdrop-blur dark:border-white/10 dark:bg-night/90">
        <span className="font-bold text-gold">キャバ帳</span>
        <button onClick={() => void signOut()} className="text-sm text-black/50 dark:text-white/50">
          ログアウト
        </button>
      </header>

      <main className="flex-1 space-y-4 p-4">
        <p className="text-sm text-black/60 dark:text-white/60">
          ようこそ、{user?.displayName ?? user?.email ?? 'ゲスト'} さん
        </p>

        {/* リスクアラート要約（F-02） */}
        {!loading && alerting.length > 0 && (
          <section className="rounded-2xl border border-amber-500/40 bg-amber-400/10 p-4">
            <h2 className="text-sm font-semibold text-amber-700 dark:text-amber-300">
              ⚠️ 要確認の顧客 {alerting.length}名
            </h2>
            <ul className="mt-2 space-y-1.5">
              {alerting.slice(0, 3).map((c) => (
                <li key={c.id}>
                  <Link to={`/customers/${c.id}`} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate">{c.nickname}</span>
                    <RiskChip score={c.riskScore} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* F-07 特別な連絡レコメンド */}
        {!loading && <SpecialContacts customers={customers} schedules={schedules} />}

        {/* 太客TOP */}
        <section className="rounded-2xl border border-black/10 p-4 dark:border-white/10">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">太客</h2>
            <Link to="/customers" className="text-xs font-semibold text-gold">
              すべて見る →
            </Link>
          </div>
          {loading ? (
            <p className="text-xs text-black/50 dark:text-white/50">読み込み中…</p>
          ) : topSpenders.length === 0 ? (
            <p className="text-xs text-black/50 dark:text-white/50">
              顧客がまだいません。
              <Link to="/customers/new" className="ml-1 font-semibold text-gold">
                登録する
              </Link>
            </p>
          ) : (
            <ul className="space-y-2">
              {topSpenders.map((c) => (
                <li key={c.id}>
                  <Link to={`/customers/${c.id}`} className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-2 truncate">
                      <span className="truncate font-medium">{c.nickname}</span>
                      <RankBadge rank={c.rank} />
                    </span>
                    <span className="font-bold text-gold tabular-nums">{yen(c.totalSpent)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-black/10 p-4 dark:border-white/10">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">今日の予定</h2>
            <Link to="/schedule" className="text-xs font-semibold text-gold">
              予定へ →
            </Link>
          </div>
          {todaySchedules.length === 0 ? (
            <p className="text-xs text-black/50 dark:text-white/50">今日の予定はありません。</p>
          ) : (
            <ul className="space-y-1.5">
              {todaySchedules.map((s) => (
                <li key={s.id} className="flex items-center gap-2 text-sm">
                  <span className="tabular-nums text-black/60 dark:text-white/60">{hhmm(s.start)}</span>
                  <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[11px] font-bold text-gold">
                    {SCHEDULE_LABEL[s.type]}
                  </span>
                  {nameOf(s.customerId) && <span className="truncate">{nameOf(s.customerId)}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  )
}
