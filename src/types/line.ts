import type { Timestamp } from './common'

/** 口調分析の結果（F-05） */
export interface ToneStats {
  emojiRate: number
  avgLen: number
  tone: string
}

/**
 * トークメッセージ。text は保存時アプリ層暗号化（SEC-07）。
 * ドメイン型では復号後の平文で扱う。
 */
export interface LineMessage {
  at: Timestamp
  from: 'me' | 'other'
  text: string // 🔒 保存時暗号化
}

/** users/{uid}/lineImports/{lid}（F-05） */
export interface LineImport {
  id: string
  customerId: string
  importedAt: Timestamp
  stats: ToneStats
  sourceRef?: string // 原本txtのCloud Storageパス
  messages: LineMessage[]
}

/** F-06 返信案のトーン */
export type ReplyTone = '軽め' | '標準' | '丁寧'

/** F-06 AI返信案（生成結果・保存は任意） */
export interface ReplySuggestion {
  tone: ReplyTone
  text: string
}
