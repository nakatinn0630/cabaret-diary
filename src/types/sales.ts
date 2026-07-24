import type { Timestamp, Yen } from './common'

/** F-09 / F-16 売上数値 */
export interface SalesFigures {
  totalSales: Yen
  shimeiCount: number // 指名本数
  dohanCount: number
  joCount: number // 場内
}

/**
 * users/{uid}/salesRecords/{month}（F-09、month = 'YYYY-MM'）
 * self-reported（自己申告）と store-confirmed（店確定・F-16）を突合する。
 */
export interface SalesRecord {
  id: string // 'YYYY-MM'
  selfReported: SalesFigures
  storeConfirmed?: SalesFigures & { storeId: string }
  storeRank?: number // 店内順位（手入力 or F-18連携）
  updatedAt: Timestamp
}
