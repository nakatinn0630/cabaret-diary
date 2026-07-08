import type { Timestamp } from './common'

/** F-08 相談分類 */
export type ConsultationCategory = '愚痴' | 'ストーカー' | '売掛詐欺' | 'メンタル'

/** F-08 エスカレーション先 */
export type EscalationTarget = 'police' | 'store' | 'window'

/**
 * 相談メッセージ。text は保存時アプリ層暗号化（SEC-07）。
 * AI応答は分析用ログに本文を残さない（SEC-12）。
 */
export interface ConsultationMessage {
  at: Timestamp
  role: 'user' | 'assistant'
  text: string // 🔒 保存時暗号化
}

/** users/{uid}/consultations/{tid}（F-08 黒服相談） */
export interface Consultation {
  id: string
  category?: ConsultationCategory
  escalatedTo?: EscalationTarget
  messages: ConsultationMessage[]
  createdAt: Timestamp
  updatedAt: Timestamp
}
