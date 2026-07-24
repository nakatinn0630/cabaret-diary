// iPhone/Mac などネイティブのカレンダーへ登録するための iCalendar(.ics) 生成。
// Googleアカウント連携なしで、.ics を開くと「カレンダーに追加」できる。

/** ICS のUTCタイムスタンプ（YYYYMMDDTHHMMSSZ） */
function toIcsUtc(ms: number): string {
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`
  )
}

/** ICS のテキストエスケープ（カンマ・セミコロン・改行・バックスラッシュ） */
function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

export interface IcsEvent {
  title: string
  startMs: number
  endMs: number
  description?: string
  location?: string
}

export function buildIcs(ev: IcsEvent): string {
  const uid = `${ev.startMs}-${Math.floor(ev.endMs)}@cabaret-diary`
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Cabaret Diary//JP',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${toIcsUtc(Date.now())}`,
    `DTSTART:${toIcsUtc(ev.startMs)}`,
    `DTEND:${toIcsUtc(ev.endMs)}`,
    `SUMMARY:${esc(ev.title)}`,
    ev.location ? `LOCATION:${esc(ev.location)}` : '',
    ev.description ? `DESCRIPTION:${esc(ev.description)}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return lines.filter(Boolean).join('\r\n')
}

/** .ics をダウンロード/オープン（iOS Safariでは「カレンダーに追加」ダイアログが開く） */
export function downloadIcs(ev: IcsEvent, filename = 'event.ics'): void {
  const blob = new Blob([buildIcs(ev)], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // iOS がファイルを読み終える猶予を持って解放
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}
