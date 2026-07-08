import type { Visit } from '../types'
import { yen, fmtDate } from '../lib/format'

// F-03 来店履歴の時系列表示（思い出タイムライン）
export function VisitTimeline({ visits }: { visits: Visit[] }) {
  if (visits.length === 0) {
    return <p className="text-sm text-black/50 dark:text-white/50">まだ来店履歴がありません。</p>
  }
  return (
    <ol className="relative space-y-4 border-l border-black/10 pl-4 dark:border-white/15">
      {visits.map((v) => (
        <li key={v.id} className="relative">
          <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-gold ring-4 ring-white dark:ring-night" />
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold">{fmtDate(v.date)}</span>
            <span className="text-sm font-bold text-gold">{yen(v.amount)}</span>
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
            {v.isDohan && <Tag>同伴</Tag>}
            {v.isAfter && <Tag>アフター</Tag>}
            {v.durationMin ? <Tag>{v.durationMin}分</Tag> : null}
            <Tag>{paymentLabel(v.payment)}</Tag>
            {v.payment === 'urikake' && v.urikakePaid !== true && <Tag danger>売掛未回収</Tag>}
            {v.bottles.map((b, i) => (
              <Tag key={i}>🍾 {b.name}</Tag>
            ))}
          </div>
          {v.episodeMemo && (
            <p className="mt-1 text-xs text-black/70 dark:text-white/70">{v.episodeMemo}</p>
          )}
        </li>
      ))}
    </ol>
  )
}

function Tag({ children, danger }: { children: React.ReactNode; danger?: boolean }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 ${
        danger
          ? 'bg-red-500/15 text-red-600 dark:text-red-300'
          : 'bg-black/5 text-black/70 dark:bg-white/10 dark:text-white/70'
      }`}
    >
      {children}
    </span>
  )
}

function paymentLabel(p: Visit['payment']): string {
  return p === 'cash' ? '現金' : p === 'card' ? 'カード' : '売掛'
}
