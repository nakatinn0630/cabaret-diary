import { useState } from 'react'
import type { Visit, PaymentMethod } from '../types'
import { yen, fmtDate } from '../lib/format'
import { Chip, Empty, subTx, goldTx } from './ui'

const PAY_LABEL: Record<PaymentMethod, string> = { cash: '現金', card: 'カード' }
const INITIAL_COUNT = 5

// F-03 来店履歴の時系列表示（思い出タイムライン）。長くなるので直近5件＋折り畳み。
export function VisitTimeline({ visits: all }: { visits: Visit[] }) {
  const [showAll, setShowAll] = useState(false)
  if (all.length === 0) return <Empty>来店記録がありません</Empty>
  const visits = showAll ? all : all.slice(0, INITIAL_COUNT)
  const hidden = all.length - visits.length

  return (
    <>
      {visits.map((v, i) => {
        return (
          <div key={v.id} className="grid grid-cols-[16px_1fr] gap-3">
            <div className="flex flex-col items-center gap-1" aria-hidden="true">
              <span className="w-2.5 h-2.5 rounded-full mt-1 bg-gold"></span>
              {i < visits.length - 1 && <span className="w-px flex-1 bg-night/10 dark:bg-white/10"></span>}
            </div>
            <div className="pb-3 space-y-1.5 min-w-0">
              <div className="flex justify-between items-baseline gap-2">
                <span className="text-[13px] font-semibold">
                  {fmtDate(v.date)}
                  {v.durationMin ? (
                    <span className={`text-[11px] font-normal ml-1.5 ${subTx}`}>{v.durationMin}分</span>
                  ) : null}
                </span>
                <span className={`font-serif text-[14px] font-bold ${goldTx}`}>{yen(v.amount)}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {v.isDohan && (
                  <Chip className={`border-gold/40 bg-gold/10 ${goldTx} !text-[10px] font-bold`}>同伴</Chip>
                )}
                {v.isAfter && (
                  <Chip className="border-rose/40 bg-rose/10 text-[#a8395c] dark:text-[#f0c3d2] !text-[10px] font-bold">
                    アフター
                  </Chip>
                )}
                {v.isShimei && (
                  <Chip className={`border-gold/40 bg-gold/10 ${goldTx} !text-[10px] font-bold`}>指名</Chip>
                )}
                <Chip className={`border-night/10 dark:border-white/15 ${subTx} !text-[10px] font-bold`}>
                  {PAY_LABEL[v.payment]}
                </Chip>
              </div>
              {v.bottles.map((b, bi) => (
                <p
                  key={`${b.name}-${bi}`}
                  className="text-[12px] flex justify-between rounded-lg px-2.5 py-1.5 bg-night/[0.04] dark:bg-white/[0.05]"
                >
                  <span>🍾 {b.name}</span>
                  <span className={goldTx}>{yen(b.price)}</span>
                </p>
              ))}
              {v.episodeMemo && <p className={`text-[12px] leading-relaxed ${subTx}`}>{v.episodeMemo}</p>}
            </div>
          </div>
        )
      })}
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="w-full min-h-[40px] rounded-xl border border-night/10 dark:border-white/15 text-[12px] font-bold text-gold"
        >
          もっと見る（あと{hidden}件）
        </button>
      )}
      {showAll && all.length > INITIAL_COUNT && (
        <button
          type="button"
          onClick={() => setShowAll(false)}
          className={`w-full min-h-[36px] text-[12px] font-semibold ${subTx}`}
        >
          折りたたむ
        </button>
      )}
    </>
  )
}
