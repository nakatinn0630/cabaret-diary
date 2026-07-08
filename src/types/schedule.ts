import type { Timestamp } from './common'

/** F-04 予定種別 */
export type ScheduleType = 'shift' | 'dohan' | 'after' | 'appointment'

/** users/{uid}/schedules/{sid}（F-04） */
export interface Schedule {
  id: string
  type: ScheduleType
  customerId?: string
  start: Timestamp
  end: Timestamp
  googleEventId?: string // GCal双方向同期キー
  memo?: string
}
