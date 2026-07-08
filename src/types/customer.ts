import type { Timestamp, Yen, BloodType } from './common'

/** F-12 顧客ランク（単一・任意） */
export type CustomerRank = 'VVIP' | 'VIP' | 'IP' | 'LOVE' | 'BADBOY'

/** F-13 向き不向きの相性区分 */
export type FitLevel = '得意' | '普通' | '苦手'

/** F-13 接客後の消耗度 */
export type Fatigue = '低' | '中' | '高'

export type PaymentMethod = 'cash' | 'card' | 'urikake'

export interface RankHistoryEntry {
  rank: CustomerRank
  changedAt: Timestamp
  note?: string
}

/** F-13 向き不向き */
export interface Fit {
  level: FitLevel
  reasonTags: string[]
  fatigue: Fatigue
  note?: string
}

/** F-14 顧客側の占い基礎情報（任意入力） */
export interface CustomerFortune {
  birthday?: Timestamp
  bloodType?: BloodType
  birthTime?: string
  traits?: string
}

/**
 * users/{uid}/customers/{cid}
 * ※ realName は保存時アプリ層暗号化（SEC-07）。ドメイン型では復号後の平文で扱う。
 */
export interface Customer {
  id: string
  nickname: string // あだ名（必須）
  lineName?: string
  realName?: string // 🔒 保存時暗号化
  occupation?: string
  companyName?: string
  incomeRange?: string
  firstVisitDate?: Timestamp
  paymentMethods: PaymentMethod[]
  tags: string[]
  rank?: CustomerRank
  rankHistory: RankHistoryEntry[]
  fit?: Fit
  fortune?: CustomerFortune
  pinnedCautions: string[] // F-14 ピン留めした注意点
  // --- 非正規化集計（Cloud Functionが来店書込時に再計算）---
  totalSpent: Yen
  visitCount: number
  lastVisitAt?: Timestamp // 最終来店日（F-07判定用・集計）
  lastContactAt?: Timestamp // 最終連絡日（F-07判定用）
  riskScore: number // F-02（0-100）
  riskFlags: string[]
  memo?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface Bottle {
  name: string
  price: Yen
}

/**
 * users/{uid}/customers/{cid}/visits/{vid}（F-03）
 */
export interface Visit {
  id: string
  date: Timestamp
  durationMin?: number
  amount: Yen
  bottles: Bottle[]
  isDohan: boolean
  isAfter: boolean
  payment: PaymentMethod
  urikakePaid?: boolean
  episodeMemo?: string
  photoRefs: string[] // Cloud Storage パス（本体は Storage）
  storeId?: string // どの店の売上か（F-16集計用）
  createdAt: Timestamp
}

/** F-14 相性診断の関係性種別（選択式） */
export type RelationshipType = '友人' | '仕事' | '恋愛' | '客' | '家族その他'

/** F-14 相性ランク */
export type CompatibilityRank = 'S' | 'A' | 'B' | 'C' | 'D'

export interface CompatibilityScore {
  type: RelationshipType
  score: number
  reason: string
}

/**
 * users/{uid}/customers/{cid}/compatibility/{diagId}（F-14 診断履歴）
 */
export interface Compatibility {
  id: string
  relationshipTypes: RelationshipType[]
  persona: string // 例: 'assertive_saiki'
  methods: string[] // 使用した占い方式
  rankResult: CompatibilityRank
  scoresByRelationship: CompatibilityScore[]
  summary: string
  cautionCandidates: string[]
  pinnedCautions: string[]
  createdAt: Timestamp
}
