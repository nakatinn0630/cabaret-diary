import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Timestamp } from 'firebase/firestore'
import { useCustomers } from '../../lib/customers'
import {
  currentMonthKey,
  saveProfileSettings,
  saveShimeiCount,
  useMonthlyStats,
  useProfileSettings,
  useSalesRecord,
} from '../../lib/sales'
import { RankBadge, RANK_OPTIONS } from '../../components/RankBadge'
import { yen } from '../../lib/format'

const DAY = 24 * 60 * 60 * 1000

export default function SalesReport() {
  const month = currentMonthKey()
  const { stats } = useMonthlyStats(month)
  const { shimeiCount } = useSalesRecord(month)
  const { settings } = useProfileSettings()
  const { customers } = useCustomers()

  const [editing, setEditing] = useState(false)
  const [guarantee, setGuarantee] = useState('')
  const [targetShimei, setTargetShimei] = useState('')
  const [targetSales, setTargetSales] = useState('')
  const [shimeiInput, setShimeiInput] = useState('')

  const topSpenders = [...customers].sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 5)
  const rankCounts = RANK_OPTIONS.map((r) => ({ r, n: customers.filter((c) => c.rank === r).length }))

  const guaranteeMs = settings.guaranteeEndDate?.toMillis?.()
  const daysLeft = guaranteeMs ? Math.max(0, Math.ceil((guaranteeMs - Date.now()) / DAY)) : undefined
  const weeksLeft = daysLeft ? Math.max(1, Math.round(daysLeft / 7)) : undefined
  const remainingShimei = settings.targetShimei ? Math.max(0, settings.targetShimei - shimeiCount) : undefined
  const pacePerWeek = remainingShimei !== undefined && weeksLeft ? Math.ceil(remainingShimei / weeksLeft) : undefined

  const openEdit = () => {
    setGuarantee(guaranteeMs ? new Date(guaranteeMs).toISOString().slice(0, 10) : '')
    setTargetShimei(settings.targetShimei ? String(settings.targetShimei) : '')
    setTargetSales(settings.targetSales ? String(settings.targetSales) : '')
    setShimeiInput(String(shimeiCount))
    setEditing(true)
  }
  const save = async () => {
    await saveProfileSettings({
      guaranteeEndDate: guarantee ? Timestamp.fromDate(new Date(guarantee)) : undefined,
      targetShimei: targetShimei ? Number(targetShimei) : undefined,
      targetSales: targetSales ? Number(targetSales) : undefined,
    })
    await saveShimeiCount(month, Number(shimeiInput) || 0)
    setEditing(false)
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="safe-top sticky top-0 z-10 flex items-center justify-between border-b border-black/10 bg-white/90 px-4 pb-3 backdrop-blur dark:border-white/10 dark:bg-night/90">
        <Link to="/" className="text-sm text-black/60 dark:text-white/60">
          ← ホーム
        </Link>
        <h1 className="text-lg font-bold">売上レポート</h1>
        <button onClick={openEdit} className="text-sm font-semibold text-gold">
          設定
        </button>
      </header>

      <div className="flex-1 space-y-4 p-4">
        <p className="text-xs text-black/50 dark:text-white/50">{month} の実績</p>

        {/* 保証カウントダウン */}
        {daysLeft !== undefined ? (
          <section className="rounded-2xl bg-night p-4 text-white">
            <div className="text-xs text-white/60">保証終了まで</div>
            <div className="mt-1 text-3xl font-bold tabular-nums text-gold">
              あと {daysLeft}日
            </div>
            {remainingShimei !== undefined && (
              <div className="mt-1 text-sm">
                目標指名まであと <b>{remainingShimei}本</b>
                {pacePerWeek !== undefined && (
                  <span className="text-white/70">（週 {pacePerWeek}本ペースで達成）</span>
                )}
              </div>
            )}
          </section>
        ) : (
          <button
            onClick={openEdit}
            className="w-full rounded-2xl border border-dashed border-black/20 p-4 text-sm text-black/50 dark:border-white/20 dark:text-white/50"
          >
            保証終了日・目標を設定するとカウントダウンを表示します
          </button>
        )}

        {/* 今月の主要数値 */}
        <div className="grid grid-cols-2 gap-2">
          <Metric label="今月売上" value={yen(stats.totalSales)} />
          <Metric label="指名本数" value={`${shimeiCount}${settings.targetShimei ? ` / ${settings.targetShimei}` : ''}`} />
          <Metric label="同伴数" value={`${stats.dohanCount}`} />
          <Metric label="来店数" value={`${stats.visitCount}`} />
        </div>

        {/* 太客TOP5 */}
        <section className="rounded-2xl border border-black/10 p-4 dark:border-white/10">
          <h2 className="mb-2 text-sm font-semibold">太客 TOP5</h2>
          {topSpenders.length === 0 ? (
            <p className="text-xs text-black/50 dark:text-white/50">データがありません。</p>
          ) : (
            <ol className="space-y-1.5">
              {topSpenders.map((c, i) => (
                <li key={c.id} className="flex items-center gap-2 text-sm">
                  <span className="w-5 text-center font-bold text-gold tabular-nums">{i + 1}</span>
                  <Link to={`/customers/${c.id}`} className="flex-1 truncate">
                    {c.nickname}
                  </Link>
                  <RankBadge rank={c.rank} />
                  <span className="font-bold tabular-nums text-gold">{yen(c.totalSpent)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* ランク別構成 */}
        <section className="rounded-2xl border border-black/10 p-4 dark:border-white/10">
          <h2 className="mb-2 text-sm font-semibold">ランク別構成</h2>
          <div className="flex flex-wrap gap-2 text-xs">
            {rankCounts.map(({ r, n }) => (
              <span key={r} className="rounded-full bg-black/5 px-2.5 py-1 dark:bg-white/10">
                {r} <b className="tabular-nums">{n}</b>
              </span>
            ))}
          </div>
        </section>
      </div>

      {editing && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/50 sm:items-center" onClick={() => setEditing(false)}>
          <div className="safe-bottom w-full max-w-md rounded-t-2xl bg-white p-4 dark:bg-night sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-bold">目標・保証の設定</h2>
            <div className="mt-3 space-y-3">
              <L label="保証終了日">
                <input type="date" value={guarantee} onChange={(e) => setGuarantee(e.target.value)} className={inputCls} />
              </L>
              <div className="grid grid-cols-2 gap-3">
                <L label="目標指名本数">
                  <input type="number" value={targetShimei} onChange={(e) => setTargetShimei(e.target.value)} className={inputCls} />
                </L>
                <L label="今月の指名本数">
                  <input type="number" value={shimeiInput} onChange={(e) => setShimeiInput(e.target.value)} className={inputCls} />
                </L>
              </div>
              <L label="目標売上（円）">
                <input type="number" value={targetSales} onChange={(e) => setTargetSales(e.target.value)} className={inputCls} />
              </L>
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setEditing(false)} className="flex-1 rounded-lg border border-black/15 py-2.5 text-sm font-semibold dark:border-white/20">
                キャンセル
              </button>
              <button onClick={() => void save()} className="flex-1 rounded-lg bg-gold py-2.5 text-sm font-bold text-night">
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const inputCls =
  'w-full rounded-lg border border-black/10 bg-black/5 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gold/50 dark:border-white/10 dark:bg-white/5'

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-black/10 p-4 dark:border-white/10">
      <div className="text-lg font-bold tabular-nums">{value}</div>
      <div className="text-[11px] text-black/50 dark:text-white/50">{label}</div>
    </div>
  )
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-black/60 dark:text-white/60">{label}</span>
      {children}
    </label>
  )
}
