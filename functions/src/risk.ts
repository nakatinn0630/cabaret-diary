// F-02 リスクスコアリング（サーバ権威版・クライアント lib/risk.ts と同一ロジック）

const HIGH_CASH_YEN = 300_000

export interface RiskVisitInput {
  dateMs: number
  amount: number
  payment: string
  urikakePaid?: boolean
}

export interface RiskInput {
  occupation?: string
  incomeRange?: string
  realName?: string
  lineName?: string
  visits: RiskVisitInput[]
}

export interface RiskResult {
  score: number
  flags: string[]
}

function parseIncomeUpperYen(s?: string): number | undefined {
  if (!s) return undefined
  let max: number | undefined
  const re = /(\d+(?:\.\d+)?)\s*(億|万)?/g
  let m: RegExpExecArray | null
  while ((m = re.exec(s))) {
    const n = parseFloat(m[1])
    if (Number.isNaN(n)) continue
    const asYen = m[2] === '億' ? n * 1e8 : m[2] === '万' ? n * 1e4 : n
    if (max === undefined || asYen > max) max = asYen
  }
  return max
}

function monthlySpendYen(visits: RiskVisitInput[], nowMs: number): number {
  const since = nowMs - 30 * 24 * 60 * 60 * 1000
  return visits.filter((v) => v.dateMs >= since).reduce((s, v) => s + (v.amount || 0), 0)
}

export function computeRisk(input: RiskInput, nowMs: number): RiskResult {
  const flags: string[] = []
  let score = 0

  if ((input.occupation ?? '').trim().length <= 2) {
    score += 20
    flags.push('職業・勤め先が不明/曖昧')
  }
  const incomeUpper = parseIncomeUpperYen(input.incomeRange)
  if (incomeUpper && monthlySpendYen(input.visits, nowMs) * 12 > incomeUpper * 0.15) {
    score += 20
    flags.push('収入に対して使用金額が不自然に高い')
  }
  const since14 = nowMs - 14 * 24 * 60 * 60 * 1000
  if (input.visits.filter((v) => v.dateMs >= since14).length >= 10) {
    score += 15
    flags.push('高頻度来店（直近14日で10回以上）')
  }
  if (input.visits.some((v) => v.payment === 'cash' && v.amount > HIGH_CASH_YEN)) {
    score += 10
    flags.push('高額現金一括（1回30万円超）')
  }
  if (input.visits.some((v) => v.payment === 'urikake' && v.urikakePaid !== true)) {
    score += 25
    flags.push('売掛の未回収がある')
  }
  if (!(input.realName ?? '').trim() && !(input.lineName ?? '').trim()) {
    score += 10
    flags.push('本名・連絡先が未登録')
  }

  return { score: Math.min(100, score), flags }
}
