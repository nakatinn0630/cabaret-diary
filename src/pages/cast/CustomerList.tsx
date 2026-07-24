import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCustomers } from '../../lib/customers'
import { RankBadge, RANK_OPTIONS } from '../../components/RankBadge'
import { Header, Main, Card, Avatar, Empty, inputCls, subTx } from '../../components/ui'
import { yen, daysUntilBirthday } from '../../lib/format'
import type { CustomerRank } from '../../types'

type SortKey = '更新' | '売上' | 'リスク'

export default function CustomerList() {
  const navigate = useNavigate()
  const { customers, loading } = useCustomers()
  const [qText, setQText] = useState('')
  const [rankFilter, setRankFilter] = useState<CustomerRank | 'ALL'>('ALL')
  const [sort, setSort] = useState<SortKey>('更新')

  const view = useMemo(() => {
    let list = customers
    const q = qText.trim()
    if (q) {
      list = list.filter(
        (c) =>
          c.nickname.includes(q) ||
          (c.lineName ?? '').includes(q) ||
          (c.occupation ?? '').includes(q) ||
          c.tags.some((t) => t.includes(q)),
      )
    }
    if (rankFilter !== 'ALL') list = list.filter((c) => c.rank === rankFilter)
    const sorted = [...list]
    if (sort === '売上') sorted.sort((a, b) => b.totalSpent - a.totalSpent)
    else if (sort === 'リスク') sorted.sort((a, b) => b.riskScore - a.riskScore)
    return sorted
  }, [customers, qText, rankFilter, sort])

  return (
    <div className="h-full flex flex-col">
      <Header
        title="顧客"
        right={
          <button
            type="button"
            onClick={() => navigate('/customers/new')}
            aria-label="新規登録"
            className="w-10 h-10 rounded-full bg-gold text-night font-bold text-[20px] shadow-lg shadow-gold/30"
          >
            ＋
          </button>
        }
      />
      <div className="px-5 space-y-2.5 pb-3">
        <input
          value={qText}
          onChange={(e) => setQText(e.target.value)}
          placeholder="🔍 あだ名・LINE名称・タグで検索"
          aria-label="顧客検索"
          className={inputCls}
        />
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {(['ALL', ...RANK_OPTIONS] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRankFilter(r)}
              className={`px-3.5 py-1.5 rounded-full text-[12px] font-bold whitespace-nowrap border ${
                rankFilter === r
                  ? 'bg-night text-white dark:bg-gold dark:text-night border-transparent'
                  : 'border-night/15 dark:border-white/15'
              }`}
            >
              {r === 'ALL' ? 'すべて' : r}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[11px] ${subTx}`}>並び替え</span>
          {(['更新', '売上', 'リスク'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSort(s)}
              className={`text-[12px] font-semibold px-3 py-1.5 rounded-full ${
                sort === s ? 'bg-gold/15 text-gold border border-gold/40' : subTx
              }`}
            >
              {s}
            </button>
          ))}
          <span className={`ml-auto text-[11px] ${subTx}`}>{view.length}件</span>
        </div>
      </div>

      <Main className="!space-y-2.5">
        {loading ? (
          <Empty>読み込み中…</Empty>
        ) : view.length === 0 ? (
          <div className="py-10 text-center">
            <Empty>該当する顧客がいません</Empty>
            <button
              type="button"
              onClick={() => navigate('/customers/new')}
              className="mt-1 font-semibold text-gold text-[13px]"
            >
              最初の顧客を登録する
            </button>
          </div>
        ) : (
          view.map((c) => (
            <Card
              key={c.id}
              onClick={() => navigate(`/customers/${c.id}`)}
              className="px-4 py-3 flex items-center gap-3"
            >
              <Avatar name={c.nickname} size={42} />
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold flex items-center gap-2">
                  {c.nickname} <RankBadge rank={c.rank} />
                  {(() => {
                    const d = daysUntilBirthday(c.fortune?.birthday)
                    return d !== null && d <= 7 ? (
                      <span aria-label="誕生日が近い" title="誕生日が近い">
                        🎂
                      </span>
                    ) : null
                  })()}
                </p>
                <p className={`text-[12px] truncate ${subTx}`}>
                  {c.visitCount}回 · {yen(c.totalSpent)}
                  {c.tags[0] ? ` · ${c.tags[0]}` : ''}
                </p>
              </div>
              {c.riskScore >= 50 && (
                <span
                  aria-label={`リスク${c.riskScore}`}
                  className={`w-2.5 h-2.5 rounded-full ${c.riskScore >= 70 ? 'bg-rose' : 'bg-gold'}`}
                ></span>
              )}
              <span className={subTx} aria-hidden="true">
                ›
              </span>
            </Card>
          ))
        )}
      </Main>
    </div>
  )
}
