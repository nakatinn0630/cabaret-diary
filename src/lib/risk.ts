import type { PaymentMethod } from '../types'

// F-02 リスクスコアリング（加点式）。
// ※ 本番は Cloud Function `risk-recalc` が来店書込時に再計算する想定（DB設計 6章）。
//   本モジュールはその純粋ロジックで、クライアント側スタンドインとしても使う。

const HIGH_CASH_YEN = 300_000

export type RiskLevel = 'none' | 'yellow' | 'red'

export interface RiskVisitInput {
  dateMs: number
  amount: number
  payment: PaymentMethod
}

export interface RiskInput {
  occupation?: string
  incomeRange?: string
  realName?: string
  lineName?: string
  visits: RiskVisitInput[]
}

export interface RiskResult {
  score: number // 0-100
  flags: string[]
  level: RiskLevel
}

/** incomeRange 文字列（例 '2000万〜', '500-1000万'）から年収上限[円]を推定（best-effort） */
function parseIncomeUpperYen(s?: string): number | undefined {
  if (!s) return undefined
  let max: number | undefined
  const re = /(\d+(?:\.\d+)?)\s*(億|万)?/g
  let m: RegExpExecArray | null
  while ((m = re.exec(s))) {
    const n = parseFloat(m[1])
    if (Number.isNaN(n)) continue
    const unit = m[2]
    const asYen = unit === '億' ? n * 1e8 : unit === '万' ? n * 1e4 : n
    if (max === undefined || asYen > max) max = asYen
  }
  return max
}

function monthlySpendYen(visits: RiskVisitInput[], nowMs: number): number {
  const since = nowMs - 30 * 24 * 60 * 60 * 1000
  return visits.filter((v) => v.dateMs >= since).reduce((s, v) => s + (v.amount || 0), 0)
}

export function computeRisk(input: RiskInput, nowMs: number = Date.now()): RiskResult {
  const flags: string[] = []
  let score = 0

  // 職業・勤め先が不明/曖昧（2文字以下・未登録）: +20
  if ((input.occupation ?? '').trim().length <= 2) {
    score += 20
    flags.push('職業・勤め先が不明/曖昧')
  }

  // 申告年収に対する使用金額の乖離（月間使用額×12 > 年収上限×15%）: +20
  const incomeUpper = parseIncomeUpperYen(input.incomeRange)
  if (incomeUpper) {
    const annualSpend = monthlySpendYen(input.visits, nowMs) * 12
    if (annualSpend > incomeUpper * 0.15) {
      score += 20
      flags.push('収入に対して使用金額が不自然に高い')
    }
  }

  // 高頻度来店（直近14日で10回以上）: +15
  const since14 = nowMs - 14 * 24 * 60 * 60 * 1000
  if (input.visits.filter((v) => v.dateMs >= since14).length >= 10) {
    score += 15
    flags.push('高頻度来店（直近14日で10回以上）')
  }

  // 高額現金一括（1回30万円超）: +10
  if (input.visits.some((v) => v.payment === 'cash' && v.amount > HIGH_CASH_YEN)) {
    score += 10
    flags.push('高額現金一括（1回30万円超）')
  }

  // 本名・連絡先が未登録: +10
  if (!(input.realName ?? '').trim() && !(input.lineName ?? '').trim()) {
    score += 10
    flags.push('本名・連絡先が未登録')
  }

  score = Math.min(100, score)
  const level: RiskLevel = score >= 70 ? 'red' : score >= 50 ? 'yellow' : 'none'
  return { score, flags, level }
}

export function riskLevelOf(score: number): RiskLevel {
  return score >= 70 ? 'red' : score >= 50 ? 'yellow' : 'none'
}

// 赤アラート時に表示するセルフチェックリスト（反社・詐欺の兆候・F-02）
export const SELF_CHECK_ITEMS: string[] = [
  '名刺の会社をネットで検索して実在を確認したか',
  '登記情報（国税庁 法人番号公表サイト）で会社の実在を確認したか',
  '羽振りの良さ・収入源の説明に一貫性があるか',
  '他のキャストや店に対するトラブル歴がないか',
  '本名・連絡先など身元を明かしているか',
  '立替やお金の相談を求められていないか',
  '短期間で急に距離を詰めてきていないか',
  '個人的な住所・生活圏を知られていないか',
  '「投資」「儲け話」など金銭の勧誘がないか',
  '不安を感じたら店・黒服に相談できているか',
]
