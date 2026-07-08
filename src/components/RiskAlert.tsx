import { riskLevelOf, SELF_CHECK_ITEMS } from '../lib/risk'

// F-02 リスクアラート表示。score>=50 で黄、>=70 で赤＋セルフチェックリスト。
export function RiskChip({ score }: { score: number }) {
  const level = riskLevelOf(score)
  const cls =
    level === 'red'
      ? 'bg-red-500/15 text-red-600 ring-red-500/30 dark:text-red-300'
      : level === 'yellow'
        ? 'bg-amber-400/20 text-amber-700 ring-amber-500/30 dark:text-amber-300'
        : 'bg-emerald-500/12 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ring-1 ${cls}`}>
      リスク {score}
    </span>
  )
}

export function RiskAlert({ score, flags }: { score: number; flags: string[] }) {
  const level = riskLevelOf(score)
  if (level === 'none') return null

  const red = level === 'red'
  return (
    <div
      className={`rounded-xl border p-3 ${
        red
          ? 'border-red-500/40 bg-red-500/10'
          : 'border-amber-500/40 bg-amber-400/10'
      }`}
    >
      <div className="flex items-center gap-2 text-sm font-bold">
        <span>{red ? '🚨' : '⚠️'}</span>
        <span className={red ? 'text-red-600 dark:text-red-300' : 'text-amber-700 dark:text-amber-300'}>
          リスクスコア {score}
          {red ? ' — 黒服機能で相談を推奨' : ' — 情報確認を推奨'}
        </span>
      </div>

      {flags.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {flags.map((f) => (
            <li
              key={f}
              className="rounded-full bg-black/5 px-2 py-0.5 text-[11px] text-black/70 dark:bg-white/10 dark:text-white/70"
            >
              {f}
            </li>
          ))}
        </ul>
      )}

      {red && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-semibold text-red-600 dark:text-red-300">
            セルフチェックリストを開く（反社・詐欺の兆候）
          </summary>
          <ul className="mt-2 space-y-1.5">
            {SELF_CHECK_ITEMS.map((item) => (
              <li key={item} className="flex items-start gap-2 text-xs">
                <input type="checkbox" className="mt-0.5" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-black/50 dark:text-white/50">
            ※外部の反社DBとの自動照合は行いません。判断の補助と、店・黒服への相談導線としてご利用ください。
          </p>
        </details>
      )}
    </div>
  )
}
