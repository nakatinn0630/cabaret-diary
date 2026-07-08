import type { Timestamp, BloodType } from './common'

/** F-14 自分の占い基礎情報（診断の主軸＝色濃く） */
export interface FortuneBase {
  birthday: Timestamp // 必須
  birthTime?: string
  birthPlace?: string
  bloodType?: BloodType
  traits?: string
}

/** users/{uid}/profile */
export interface Profile {
  displayName: string
  storeNames: string[]
  guaranteeEndDate?: Timestamp // 保証期間終了日（F-09）
  targetShimei?: number // 目標指名本数
  targetSales?: number
  fortuneBase: FortuneBase
  createdAt: Timestamp
  updatedAt: Timestamp
}

export type SubscriptionStatus = 'active' | 'past_due' | 'canceled'

/** F-19 個人契約（キャスト課金・店舗契約とは独立） */
export interface PersonalSubscription {
  plan: 'personal'
  status: SubscriptionStatus
  currentPeriodEnd: Timestamp
  provider?: 'stripe'
  providerRef?: string
}
