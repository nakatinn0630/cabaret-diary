// 日時表示の共通ヘルパー。
// 注意: 日付キーは必ず「端末ローカルの日付」を使うこと。toISOString() はUTC日付になるため、
// JSTの深夜0時〜8時台の予定が前日扱いになるバグの原因になる（夜職アプリでは致命的）。

export const pad2 = (n: number): string => String(n).padStart(2, '0')

/** 24時間表記 HH:MM */
export function fmtHM(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

/** 端末ローカルの YYYY-MM-DD（date input・日別グルーピング用） */
export function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}
