import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCustomers } from '../../lib/customers'
import { RankBadge, RANK_LABEL, RANK_OPTIONS } from '../../components/RankBadge'
import { RiskChip } from '../../components/RiskAlert'
import { yen } from '../../lib/format'
import type { CustomerRank } from '../../types'

type SortKey = 'updated' | 'spent' | 'risk'

export default function CustomerList() {
  const { customers, loading } = useCustomers()
  const [qText, setQText] = useState('')
  const [rankFilter, setRankFilter] = useState<CustomerRank | 'ALL'>('ALL')
  const [sort, setSort] = useState<SortKey>('updated')

  const view = useMemo(() => {
    let list = customers
    const q = qText.trim()
    if (q) {
      list = list.filter(
        (c) =>
          c.nickname.includes(q) ||
          (c.lineName ?? '').includes(q) ||
          (c.occupation ?? '').includes(q),
      )
    }
    if (rankFilter !== 'ALL') list = list.filter((c) => c.rank === rankFilter)
    const sorted = [...list]
    if (sort === 'spent') sorted.sort((a, b) => b.totalSpent - a.totalSpent)
    else if (sort === 'risk') sorted.sort((a, b) => b.riskScore - a.riskScore)
    return sorted
  }, [customers, qText, rankFilter, sort])

  return (
    <div className="flex min-h-full flex-col">
      <header className="safe-top sticky top-0 z-10 border-b border-black/10 bg-white/90 px-4 pb-3 backdrop-blur dark:border-white/10 dark:bg-night/90">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold">顧客</h1>
          <Link
            to="/customers/new"
            className="rounded-full bg-gold px-3 py-1.5 text-sm font-bold text-night"
          >
            ＋ 新規
          </Link>
        </div>
        <input
          value={qText}
          onChange={(e) => setQText(e.target.value)}
          placeholder="あだ名・LINE名・職業で検索"
          className="mt-2 w-full rounded-lg border border-black/10 bg-black/5 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gold/50 dark:border-white/10 dark:bg-white/5"
        />
        <div className="mt-2 flex items-center gap-2 overflow-x-auto text-xs">
          <select
            value={rankFilter}
            onChange={(e) => setRankFilter(e.target.value as CustomerRank | 'ALL')}
            className="rounded-md border border-black/10 bg-transparent px-2 py-1 dark:border-white/15"
          >
            <option value="ALL">全ランク</option>
            {RANK_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r}・{RANK_LABEL[r]}
              </option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-md border border-black/10 bg-transparent px-2 py-1 dark:border-white/15"
          >
            <option value="updated">更新順</option>
            <option value="spent">売上順</option>
            <option value="risk">リスク順</option>
          </select>
          <span className="ml-auto whitespace-nowrap text-black/40 dark:text-white/40">
            {view.length}件
          </span>
        </div>
      </header>

      <div className="flex-1 p-3">
        {loading ? (
          <p className="p-6 text-center text-sm text-black/50 dark:text-white/50">読み込み中…</p>
        ) : view.length === 0 ? (
          <div className="p-10 text-center text-sm text-black/50 dark:text-white/50">
            <p>顧客がいません。</p>
            <Link to="/customers/new" className="mt-3 inline-block font-semibold text-gold">
              最初の顧客を登録する
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {view.map((c) => (
              <li key={c.id}>
                <Link
                  to={`/customers/${c.id}`}
                  className="flex items-center gap-3 rounded-xl border border-black/10 bg-white p-3 active:scale-[.99] dark:border-white/10 dark:bg-white/5"
                >
                  <div className="grid h-10 w-10 flex-none place-items-center rounded-full bg-gold/15 font-bold text-gold">
                    {c.nickname.slice(0, 1)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-semibold">{c.nickname}</span>
                      <RankBadge rank={c.rank} />
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-black/50 dark:text-white/50">
                      <span>{yen(c.totalSpent)}</span>
                      <span>·</span>
                      <span>{c.visitCount}回</span>
                    </div>
                  </div>
                  <RiskChip score={c.riskScore} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
