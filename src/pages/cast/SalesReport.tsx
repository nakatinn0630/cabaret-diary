import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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
import { Card, SectionTitle, Header, Main, Field, DateSelect, inputCls, goldTx, subTx, useToast } from '../../components/ui'
import { yen } from '../../lib/format'
import type { CustomerRank } from '../../types'

const DAY = 24 * 60 * 60 * 1000

// ランク別構成バーの配色（クロードデザイン由来）
const RANK_COLOR: Record<CustomerRank, string> = {
  VVIP: '#c9a24b',
  VIP: '#b9b3c9',
  IP: '#b88a5e',
  LOVE: '#e6789b',
  BADBOY: '#6b6478',
}

export default function SalesReport() {
  const navigate = useNavigate()
  const toast = useToast()
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
  // ランク別の売上構成（クロードデザインの積み上げバー）
  const byRank = RANK_OPTIONS.map((r) => ({
    r,
    sum: customers.filter((c) => c.rank === r).reduce((a, c) => a + c.totalSpent, 0),
  }))
  const rankTotal = byRank.reduce((a, x) => a + x.sum, 0)

  // 保証カウントダウン（残り日数）
  const guaranteeMs = settings.guaranteeEndDate?.toMillis?.()
  const daysLeft = guaranteeMs ? Math.max(0, Math.ceil((guaranteeMs - Date.now()) / DAY)) : undefined
  const weeksLeft = daysLeft ? Math.max(1, Math.round(daysLeft / 7)) : undefined
  const remainingShimei = settings.targetShimei ? Math.max(0, settings.targetShimei - shimeiCount) : undefined
  const pacePerWeek = remainingShimei !== undefined && weeksLeft ? Math.ceil(remainingShimei / weeksLeft) : undefined

  // 目標売上に対する達成状況（保証カウントダウンのプログレスバー）
  const targetSalesNum = settings.targetSales
  const remainSales = targetSalesNum !== undefined ? Math.max(0, targetSalesNum - stats.totalSales) : undefined
  const salesPct = targetSalesNum && targetSalesNum > 0 ? Math.min(100, (stats.totalSales / targetSalesNum) * 100) : 0
  const perDaySales = remainSales !== undefined && daysLeft && daysLeft > 0 ? Math.ceil(remainSales / daysLeft) : undefined

  // 指名リング
  const shimeiTarget = settings.targetShimei
  const ratio = shimeiTarget && shimeiTarget > 0 ? Math.min(1, shimeiCount / shimeiTarget) : 0
  const RING_C = 2 * Math.PI * 52

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
    toast('目標・保証を更新しました ✓')
  }

  return (
    <div className="flex h-full flex-col">
      <Header
        title="📊 売上レポート"
        back
        onBack={() => navigate('/')}
        right={
          <button type="button" onClick={openEdit} className="text-[13px] font-semibold text-gold py-1 pl-2">
            設定
          </button>
        }
      />

      <Main>
        <p className={`text-[12px] ${subTx}`}>{month} の実績</p>

        {/* 保証カウントダウン */}
        {daysLeft !== undefined ? (
          <Card className={`p-4 space-y-1.5 ${remainSales === undefined || remainSales > 0 ? '!border-gold/50' : '!border-emerald-500/50'}`}>
            <SectionTitle>保証カウントダウン</SectionTitle>
            {remainSales !== undefined ? (
              <p className="text-[14px]">
                達成まで <span className={`font-serif text-[22px] font-bold ${goldTx}`}>{yen(remainSales)}</span>
              </p>
            ) : (
              <p className="text-[14px]">
                保証終了まで <span className={`font-serif text-[22px] font-bold ${goldTx}`}>あと {daysLeft}日</span>
              </p>
            )}
            <p className={`text-[12px] ${subTx}`}>
              残り {daysLeft}日
              {perDaySales !== undefined && <> · 1日あたり {yen(perDaySales)} ペースで達成</>}
            </p>
            {remainingShimei !== undefined && (
              <p className={`text-[12px] ${subTx}`}>
                目標指名まであと <b className="text-inherit">{remainingShimei}本</b>
                {pacePerWeek !== undefined && <>（週 {pacePerWeek}本ペース）</>}
              </p>
            )}
            {targetSalesNum !== undefined && (
              <div className="h-2 rounded-full bg-night/10 dark:bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-r from-gold to-rose" style={{ width: `${salesPct}%` }} />
              </div>
            )}
          </Card>
        ) : (
          <Card onClick={openEdit} className="p-4">
            <p className={`text-[13px] ${subTx}`}>保証終了日・目標を設定するとカウントダウンを表示します</p>
          </Card>
        )}

        {/* 指名リング + 主要数値 */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4 flex flex-col items-center gap-1">
            <svg width="120" height="120" viewBox="0 0 120 120" role="img" aria-label={`指名 ${shimeiCount}/${shimeiTarget ?? 0}`}>
              <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(120,110,150,0.2)" strokeWidth="10" />
              <circle
                cx="60"
                cy="60"
                r="52"
                fill="none"
                stroke="#c9a24b"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${RING_C * ratio} ${RING_C}`}
                transform="rotate(-90 60 60)"
              />
              <text x="60" y="57" textAnchor="middle" fontSize="22" fontWeight="700" fill="currentColor" fontFamily="'Zen Old Mincho',serif">
                {shimeiCount}
              </text>
              <text x="60" y="76" textAnchor="middle" fontSize="11" fill="#8f86a8">
                / {shimeiTarget ?? '—'}本
              </text>
            </svg>
            <p className={`text-[11px] font-bold tracking-widest ${subTx}`}>今月の指名</p>
          </Card>
          <div className="flex flex-col gap-3">
            <Card className="p-4 flex-1">
              <p className={`text-[10px] tracking-widest ${subTx}`}>今月売上</p>
              <p className={`font-serif text-[20px] font-bold ${goldTx}`}>{yen(stats.totalSales)}</p>
            </Card>
            <Card className="p-4 flex-1">
              <p className={`text-[10px] tracking-widest ${subTx}`}>同伴</p>
              <p className="font-serif text-[20px] font-bold">{stats.dohanCount}本</p>
            </Card>
            <Card className="p-4 flex-1">
              <p className={`text-[10px] tracking-widest ${subTx}`}>来店</p>
              <p className="font-serif text-[20px] font-bold">{stats.visitCount}回</p>
            </Card>
          </div>
        </div>

        {/* 太客TOP5 */}
        <Card className="p-4 space-y-2.5">
          <SectionTitle>太客TOP5</SectionTitle>
          {topSpenders.length === 0 ? (
            <p className={`text-[13px] ${subTx}`}>データがありません。</p>
          ) : (
            topSpenders.map((c, i) => (
              <Link key={c.id} to={`/customers/${c.id}`} className="w-full flex items-center gap-3 text-left min-h-[36px]">
                <span className={`font-serif font-bold w-5 ${i < 3 ? goldTx : subTx}`}>{i + 1}</span>
                <span className="text-[13px] font-semibold flex-1 truncate">{c.nickname}</span>
                <RankBadge rank={c.rank} />
                <span className={`text-[13px] font-serif font-bold ${goldTx}`}>{yen(c.totalSpent)}</span>
              </Link>
            ))
          )}
        </Card>

        {/* ランク別構成 */}
        <Card className="p-4 space-y-2.5">
          <SectionTitle>ランク別構成</SectionTitle>
          {rankTotal === 0 ? (
            <p className={`text-[13px] ${subTx}`}>売上データがありません。</p>
          ) : (
            <>
              <div className="flex h-3 rounded-full overflow-hidden">
                {byRank
                  .filter((x) => x.sum > 0)
                  .map((x) => (
                    <div
                      key={x.r}
                      title={x.r}
                      style={{ width: `${(x.sum / rankTotal) * 100}%`, background: RANK_COLOR[x.r] }}
                    />
                  ))}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {byRank
                  .filter((x) => x.sum > 0)
                  .map((x) => (
                    <span key={x.r} className={`text-[11px] ${subTx}`}>
                      <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: RANK_COLOR[x.r] }} />
                      {x.r} {Math.round((x.sum / rankTotal) * 100)}%
                    </span>
                  ))}
              </div>
            </>
          )}
        </Card>
      </Main>

      {editing && (
        <div
          className="fixed inset-0 z-30 flex items-end justify-center bg-black/50 sm:items-center"
          onClick={() => setEditing(false)}
        >
          <div
            className="safe-bottom w-full max-w-md rounded-t-2xl bg-white p-4 dark:bg-night sm:rounded-2xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-serif text-[17px] font-bold">目標・保証の設定</h2>
            <Field label="保証終了日">
              <DateSelect
                value={guarantee}
                onChange={setGuarantee}
                fromYear={new Date().getFullYear()}
                toYear={new Date().getFullYear() + 2}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="目標指名本数">
                <input type="number" value={targetShimei} onChange={(e) => setTargetShimei(e.target.value)} className={inputCls} />
              </Field>
              <Field label="今月の指名本数">
                <input type="number" value={shimeiInput} onChange={(e) => setShimeiInput(e.target.value)} className={inputCls} />
              </Field>
            </div>
            <Field label="目標売上（円）">
              <input type="number" value={targetSales} onChange={(e) => setTargetSales(e.target.value)} className={inputCls} />
            </Field>
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="flex-1 min-h-[48px] rounded-2xl border border-night/15 dark:border-white/20 font-semibold text-[14px]"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={() => void save()}
                className="flex-[2] min-h-[48px] rounded-2xl bg-gold text-night font-bold text-[15px] shadow-lg shadow-gold/30"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
