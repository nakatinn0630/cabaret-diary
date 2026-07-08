import type { Customer, Schedule } from '../types'

// F-07 「営業じゃない特別な連絡」レコメンドの候補算出（純粋関数）。
// 条件: 来店予定がなく14日以上未連絡/未来店 の顧客、または誕生日が近い顧客。

const DAY = 24 * 60 * 60 * 1000

export interface ContactCandidate {
  customer: Customer
  reason: string
  hook?: string
  priority: number // 高いほど優先
}

function daysUntilNextBirthday(birthdayMs: number, nowMs: number): number {
  const b = new Date(birthdayMs)
  const now = new Date(nowMs)
  let next = new Date(now.getFullYear(), b.getMonth(), b.getDate()).getTime()
  if (next < now.setHours(0, 0, 0, 0)) {
    next = new Date(new Date(nowMs).getFullYear() + 1, b.getMonth(), b.getDate()).getTime()
  }
  return Math.round((next - new Date(nowMs).setHours(0, 0, 0, 0)) / DAY)
}

export function computeSpecialContacts(
  customers: Customer[],
  schedules: Schedule[],
  nowMs: number = Date.now(),
): ContactCandidate[] {
  const upcomingCustomerIds = new Set(
    schedules.filter((s) => s.end.toMillis() >= nowMs && s.customerId).map((s) => s.customerId as string),
  )

  const out: ContactCandidate[] = []
  for (const c of customers) {
    // BADBOY（痛客）は非営業連絡の推奨対象から除外（F-07仕様）
    if (c.rank === 'BADBOY') continue
    if (upcomingCustomerIds.has(c.id)) continue

    const bday = c.fortune?.birthday?.toMillis?.()
    if (bday !== undefined) {
      const d = daysUntilNextBirthday(bday, nowMs)
      if (d >= 0 && d <= 7) {
        out.push({ customer: c, reason: `誕生日まであと${d}日`, hook: c.memo, priority: 100 - d })
        continue
      }
    }

    const lastMs = c.lastContactAt?.toMillis?.() ?? c.lastVisitAt?.toMillis?.()
    if (lastMs !== undefined) {
      const days = Math.floor((nowMs - lastMs) / DAY)
      if (days >= 14) {
        out.push({ customer: c, reason: `${days}日連絡なし`, hook: c.memo, priority: Math.min(90, days) })
      }
    }
  }

  return out.sort((a, b) => b.priority - a.priority)
}
