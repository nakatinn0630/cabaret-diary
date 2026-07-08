import type { Timestamp, Yen } from './common'
import type { SalesFigures } from './sales'
import type { SubscriptionStatus } from './user'

/** F-15 店舗ロール */
export type StoreRole = 'cast' | 'kurofuku' | 'manager'

/** F-19 店舗契約（店課金・個人契約とは独立） */
export interface StoreSubscription {
  plan: 'store'
  status: SubscriptionStatus
  currentPeriodEnd: Timestamp
}

/** stores/{storeId}（F-15） */
export interface Store {
  id: string
  name: string
  createdBy: string // 店長uid
  settings?: Record<string, unknown>
  subscription?: StoreSubscription
}

/** stores/{storeId}/memberships/{uid}（F-15） */
export interface Membership {
  uid: string
  role: StoreRole
  displayName: string // 源氏名（店内表示）
  assignedKurofuku?: string // 担当黒服のuid（castの場合）
  joinedAt: Timestamp
  active: boolean
}

/** stores/{storeId}/invites/{code}（F-15 招待コード） */
export interface Invite {
  code: string
  role: Exclude<StoreRole, 'manager'>
  createdBy: string
  expiresAt: Timestamp
  usedBy?: string
}

/** stores/{storeId}/sales/{month}/casts/{uid}（F-16 店計上・店確定） */
export interface StoreCastSales {
  uid: string
  figures: SalesFigures
  bottles?: number
  selfReported?: SalesFigures // 突合用（顧客個人情報は含めない）
  confirmedBy: string
  confirmedAt: Timestamp
}

/** F-17 発信種別 */
export type BroadcastType = 'event' | 'birthdayQuota' | 'shift' | 'notice' | 'direct'

/** F-17 配信範囲 */
export type BroadcastAudience = 'all' | 'role' | 'castIds'

/** stores/{storeId}/broadcasts/{bid}（F-17 発信） */
export interface Broadcast {
  id: string
  type: BroadcastType
  title: string
  body: string
  audience: BroadcastAudience
  targetCastIds?: string[]
  quota?: Yen // バースデーノルマ等の目標
  eventDate?: Timestamp
  createdBy: string
  createdAt: Timestamp
}

/** stores/{storeId}/broadcasts/{bid}/reads/{uid}（F-17 既読） */
export interface BroadcastRead {
  uid: string
  readAt: Timestamp
  reaction?: string
}

/** F-18 ランキング指標 */
export type RankingMetric = 'sales' | 'shimei' | 'dohan' | 'newCustomer' | 'mom'

/** F-18 集計期間 */
export type RankingPeriod = 'day' | 'week' | 'month'

/** F-18 公開範囲 */
export type RankingVisibility = 'public' | 'topN' | 'selfOnly' | 'anonymous' | 'private'

export interface RankingEntry {
  castUid: string
  displayName?: string // 匿名モードでは伏せる
  rank: number
  value: number
}

/** stores/{storeId}/rankings/{rankId}（F-18） */
export interface Ranking {
  id: string
  metric: RankingMetric
  period: RankingPeriod
  visibility: RankingVisibility
  n?: number // topN の N
  computedAt: Timestamp
  entries: RankingEntry[]
}
