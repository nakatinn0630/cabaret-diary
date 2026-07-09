import { riskLevelOf, SELF_CHECK_ITEMS } from '../lib/risk'
import { Card, subTx, goldTx } from './ui'

// F-02 リスクチップ（一覧・要約用）
export function RiskChip({ score }: { score: number }) {
  const level = riskLevelOf(score)
  const cls =
    level === 'red'
      ? 'bg-rose/15 text-rose ring-rose/30'
      : level === 'yellow'
        ? `bg-gold/15 ${goldTx} ring-gold/30`
        : 'bg-emerald-500/12 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${cls}`}>
      リスク {score}
    </span>
  )
}

// F-02 リスクアラート（顧客詳細）。>=50 で中（金）、>=70 で高（薔薇）＋セルフチェック。
export function RiskAlert({ score, flags }: { score: number; flags: string[] }) {
  const level = riskLevelOf(score)
  if (level === 'none') return null
  const red = level === 'red'

  return (
    <Card
      label="リスクアラート"
      className={`p-4 space-y-2.5 ${red ? '!border-rose/60 !bg-rose/10' : '!border-gold/50 !bg-gold/10'}`}
    >
      <div className="flex items-center justify-between">
        <p className={`text-[13px] font-bold ${red ? 'text-rose' : goldTx}`}>
          <span
            className="inline-block w-2 h-2 rounded-full mr-2 animate-pulse align-middle"
            style={{ background: red ? '#e6789b' : '#c9a24b' }}
          ></span>
          リスクアラート · {red ? '高' : '中'}
        </p>
        <span className={`font-serif text-[19px] font-bold ${red ? 'text-rose' : goldTx}`}>
          {score}
          <span className="text-[11px]">/100</span>
        </span>
      </div>

      <div
        className="h-1.5 rounded-full bg-night/10 dark:bg-white/10 overflow-hidden"
        role="img"
        aria-label={`リスクスコア${score}/100`}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-gold to-rose"
          style={{ width: `${Math.min(100, score)}%` }}
        ></div>
      </div>

      {flags.length > 0 && (
        <ul className="space-y-1.5">
          {flags.map((f) => (
            <li key={f} className="text-[13px] flex gap-2">
              <span className={red ? 'text-rose' : goldTx}>•</span>
              {f}
            </li>
          ))}
        </ul>
      )}

      {red && (
        <div className="rounded-xl p-3 space-y-1.5 bg-white/40 dark:bg-night/40 border border-rose/30">
          <p className="text-[12px] font-bold text-rose">セルフチェック（反社・詐欺の兆候）</p>
          {SELF_CHECK_ITEMS.map((item) => (
            <label key={item} className="flex items-start gap-2 text-[12px]">
              <input type="checkbox" className="mt-0.5 accent-[#e6789b] w-4 h-4" />
              <span>{item}</span>
            </label>
          ))}
          <p className={`text-[11px] ${subTx}`}>
            ※外部の反社DBとの自動照合は行いません。判断の補助と、店・黒服への相談導線としてご利用ください。
          </p>
        </div>
      )}
    </Card>
  )
}
