import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Timestamp } from 'firebase/firestore'
import { useCustomers } from '../../lib/customers'
import {
  currentMonthKey,
  monthEndMs,
  saveProfileSettings,
  saveShimeiCount,
  useMonthlyStats,
  useProfileSettings,
  useSalesRecord,
  type TrialRace,
} from '../../lib/sales'
import { RankBadge, RANK_OPTIONS } from '../../components/RankBadge'
import { Card, SectionTitle, Header, Main, Field, DateSelect, inputCls, goldTx, subTx, useToast } from '../../components/ui'
import { yen } from '../../lib/format'
import type { CustomerRank } from '../../types'

const DAY = 24 * 60 * 60 * 1000
const newRaceId = () => 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
const fmtVal = (n: number, unit?: string) => (!unit || unit === '円' ? yen(n) : `${n.toLocaleString()}${unit}`)

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
  const [trialEnd, setTrialEnd] = useState('')
  const [races, setRaces] = useState<TrialRace[]>([])

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

  // 月の目標（月締めまでのカウントダウン）
  const monthDaysLeft = Math.max(1, Math.ceil((monthEndMs() - Date.now()) / DAY))
  const monthPerDay =
    remainSales !== undefined && remainSales > 0 ? Math.ceil(remainSales / monthDaysLeft) : undefined

  // 試用期間レース
  const trialEndMs = settings.trialEndDate?.toMillis?.()
  const trialDaysLeft = trialEndMs ? Math.max(0, Math.ceil((trialEndMs - Date.now()) / DAY)) : undefined
  const trialRaces = settings.trialRaces ?? []

  // 指名リング
  const shimeiTarget = settings.targetShimei
  const ratio = shimeiTarget && shimeiTarget > 0 ? Math.min(1, shimeiCount / shimeiTarget) : 0
  const RING_C = 2 * Math.PI * 52

  const openEdit = () => {
    setGuarantee(guaranteeMs ? new Date(guaranteeMs).toISOString().slice(0, 10) : '')
    setTargetShimei(settings.targetShimei ? String(settings.targetShimei) : '')
    setTargetSales(settings.targetSales ? String(settings.targetSales) : '')
    setShimeiInput(String(shimeiCount))
    setTrialEnd(trialEndMs ? new Date(trialEndMs).toISOString().slice(0, 10) : '')
    setRaces((settings.trialRaces ?? []).map((r) => ({ ...r })))
    setEditing(true)
  }
  const addRace = () => setRaces((rs) => [...rs, { id: newRaceId(), name: '', target: 0, current: 0, unit: '円' }])
  const updateRace = (id: string, patch: Partial<TrialRace>) =>
    setRaces((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  const removeRace = (id: string) => setRaces((rs) => rs.filter((r) => r.id !== id))
  const save = async () => {
    const cleanRaces = races
      .filter((r) => r.name.trim())
      .map((r) => ({ ...r, name: r.name.trim(), target: Number(r.target) || 0, current: Number(r.current) || 0 }))
    await saveProfileSettings({
      guaranteeEndDate: guarantee ? Timestamp.fromDate(new Date(guarantee)) : undefined,
      targetShimei: targetShimei ? Number(targetShimei) : undefined,
      targetSales: targetSales ? Number(targetSales) : undefined,
      trialEndDate: trialEnd ? Timestamp.fromDate(new Date(trialEnd)) : undefined,
      trialRaces: cleanRaces,
    })
    await saveShimeiCount(month, Number(shimeiInput) || 0)
    setEditing(false)
    toast('目標・レースを更新しました ✓')
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

        {/* 今月の目標（月締めまでのカウントダウン） */}
        {targetSalesNum !== undefined ? (
          <Card className="p-4 space-y-1.5 !border-gold/40">
            <div className="flex items-center justify-between">
              <SectionTitle>🎯 今月の目標</SectionTitle>
              <span className={`text-[11px] ${subTx}`}>月締めまで残り{monthDaysLeft}日</span>
            </div>
            <p className="text-[14px]">
              {remainSales && remainSales > 0 ? (
                <>達成まで <span className={`font-serif text-[22px] font-bold ${goldTx}`}>{yen(remainSales)}</span></>
              ) : (
                <span className="font-serif text-[18px] font-bold text-emerald-500">目標達成！おめでとう🎉</span>
              )}
            </p>
            <div className="h-2 rounded-full bg-night/10 dark:bg-white/10">
              <div className="h-full rounded-full bg-gradient-to-r from-gold to-rose" style={{ width: `${salesPct}%` }} />
            </div>
            <p className={`text-[12px] ${subTx}`}>
              {yen(stats.totalSales)} / {yen(targetSalesNum)}（{Math.round(salesPct)}%）
              {monthPerDay !== undefined && <> · 1日あたり {yen(monthPerDay)} ペース</>}
            </p>
          </Card>
        ) : (
          <Card onClick={openEdit} className="p-4">
            <p className={`text-[13px] ${subTx}`}>🎯 今月の目標売上を設定すると、月締めまでのカウントダウンを表示します</p>
          </Card>
        )}

        {/* 試用期間レース（看板レース・うちわレース等を自由設定） */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <SectionTitle>🏁 試用期間レース</SectionTitle>
            {trialDaysLeft !== undefined && (
              <span className={`text-[11px] ${trialDaysLeft <= 3 ? 'text-rose font-bold' : subTx}`}>
                試用期間 残り{trialDaysLeft}日
              </span>
            )}
          </div>
          {trialRaces.length === 0 ? (
            <button type="button" onClick={openEdit} className="text-left text-[13px] text-gold font-semibold">
              ＋ 看板レース・うちわレースなどを追加する
            </button>
          ) : (
            trialRaces.map((r) => {
              const pct = r.target > 0 ? Math.min(100, (r.current / r.target) * 100) : 0
              const remain = Math.max(0, r.target - r.current)
              const perDay = trialDaysLeft && trialDaysLeft > 0 && remain > 0 ? Math.ceil(remain / trialDaysLeft) : undefined
              return (
                <div key={r.id} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[13px] font-bold truncate">{r.name}</span>
                    <span className={`text-[12px] font-serif font-bold ${goldTx}`}>
                      {fmtVal(r.current, r.unit)} <span className={`text-[11px] font-sans ${subTx}`}>/ {fmtVal(r.target, r.unit)}</span>
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-night/10 dark:bg-white/10">
                    <div
                      className={`h-full rounded-full ${pct >= 100 ? 'bg-emerald-500' : 'bg-gradient-to-r from-gold to-rose'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className={`text-[11px] ${subTx}`}>
                    {pct >= 100 ? '達成！' : <>あと {fmtVal(remain, r.unit)}</>}
                    {perDay !== undefined && <> · 1日 {fmtVal(perDay, r.unit)} ペース</>}
                  </p>
                </div>
              )
            })
          )}
        </Card>

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
            className="safe-bottom max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-4 dark:bg-night sm:rounded-2xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-serif text-[17px] font-bold">目標・保証・試用期間レース</h2>
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
            <Field label="今月の目標売上（円・月締めまで）">
              <input type="number" value={targetSales} onChange={(e) => setTargetSales(e.target.value)} className={inputCls} />
            </Field>

            {/* 試用期間レース（自由設定） */}
            <div className="rounded-2xl border border-gold/30 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[14px] font-bold">🏁 試用期間レース</h3>
                <button type="button" onClick={addRace} className="text-[12px] font-bold text-gold">
                  ＋ レースを追加
                </button>
              </div>
              <Field label="試用期間の終了日">
                <DateSelect
                  value={trialEnd}
                  onChange={setTrialEnd}
                  fromYear={new Date().getFullYear()}
                  toYear={new Date().getFullYear() + 2}
                />
              </Field>
              {races.length === 0 && (
                <p className={`text-[12px] ${subTx}`}>看板レース・うちわレースなど、名前・目標・単位を自由に設定できます。</p>
              )}
              {races.map((r) => (
                <div key={r.id} className="rounded-xl border border-night/10 dark:border-white/10 p-2.5 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      value={r.name}
                      onChange={(e) => updateRace(r.id, { name: e.target.value })}
                      placeholder="レース名（例：看板レース）"
                      className={`${inputCls} min-w-0 flex-1`}
                    />
                    <button type="button" onClick={() => removeRace(r.id)} className="text-[13px] font-semibold text-rose px-1.5">
                      削除
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Field label="目標">
                      <input type="number" value={r.target || ''} onChange={(e) => updateRace(r.id, { target: Number(e.target.value) })} className={inputCls} />
                    </Field>
                    <Field label="現在">
                      <input type="number" value={r.current || ''} onChange={(e) => updateRace(r.id, { current: Number(e.target.value) })} className={inputCls} />
                    </Field>
                    <Field label="単位">
                      <select value={r.unit || '円'} onChange={(e) => updateRace(r.id, { unit: e.target.value })} className={inputCls}>
                        <option value="円">円</option>
                        <option value="本">本</option>
                        <option value="pt">pt</option>
                      </select>
                    </Field>
                  </div>
                </div>
              ))}
            </div>

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
