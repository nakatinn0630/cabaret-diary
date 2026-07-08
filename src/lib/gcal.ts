import type { ScheduleType } from '../types'

// F-04 Googleカレンダー連携（クライアント側MVP）。
// 専用カレンダー「キャバ帳」を自動作成し、アプリの予定をイベントとして書き込む（アプリ→Google）。
// ※ Google→アプリの取り込み（双方向のpull側）とpush通知は、堅牢性のため将来 Cloud Function
//   `gcal-sync`（差分sync token）で実装する想定（要件定義 5章 / DB設計）。ここは片方向の同期。

const BASE = 'https://www.googleapis.com/calendar/v3'
const CAL_SUMMARY = 'キャバ帳'
const TZ = 'Asia/Tokyo'

/** 命名規則: 【出勤】/【同伴】○○さん/【アフター】○○さん */
export function buildEventTitle(type: ScheduleType, customerName?: string): string {
  const name = customerName?.trim()
  switch (type) {
    case 'shift':
      return '【出勤】'
    case 'dohan':
      return `【同伴】${name ?? ''}`.trim()
    case 'after':
      return `【アフター】${name ?? ''}`.trim()
    default:
      return `【予定】${name ?? ''}`.trim()
  }
}

async function api<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    throw new Error(`Google Calendar API エラー (${res.status})`)
  }
  return (await res.json()) as T
}

interface CalendarListResponse {
  items?: { id: string; summary: string }[]
}

/** 専用カレンダー「キャバ帳」のIDを取得（無ければ作成） */
export async function ensureCabaageCalendar(token: string): Promise<string> {
  const list = await api<CalendarListResponse>(token, '/users/me/calendarList')
  const found = list.items?.find((c) => c.summary === CAL_SUMMARY)
  if (found) return found.id
  const created = await api<{ id: string }>(token, '/calendars', {
    method: 'POST',
    body: JSON.stringify({ summary: CAL_SUMMARY, timeZone: TZ }),
  })
  return created.id
}

export interface GCalEventInput {
  type: ScheduleType
  startMs: number
  endMs: number
  memo?: string
  customerName?: string
}

/** イベントを作成/更新し、GoogleのeventIdを返す */
export async function upsertEvent(
  token: string,
  calendarId: string,
  input: GCalEventInput,
  eventId?: string,
): Promise<string> {
  const body = {
    summary: buildEventTitle(input.type, input.customerName),
    description: input.memo ?? '',
    start: { dateTime: new Date(input.startMs).toISOString(), timeZone: TZ },
    end: { dateTime: new Date(input.endMs).toISOString(), timeZone: TZ },
  }
  const cal = encodeURIComponent(calendarId)
  const res = eventId
    ? await api<{ id: string }>(token, `/calendars/${cal}/events/${eventId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      })
    : await api<{ id: string }>(token, `/calendars/${cal}/events`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
  return res.id
}

export async function deleteEvent(token: string, calendarId: string, eventId: string): Promise<void> {
  const cal = encodeURIComponent(calendarId)
  await fetch(`${BASE}/calendars/${cal}/events/${eventId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
}
