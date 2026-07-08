import type { Timestamp } from '../types'

export const yen = (n: number): string => '¥' + Math.round(n).toLocaleString('ja-JP')

export const fmtDate = (t?: Timestamp): string =>
  t ? t.toDate().toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }) : ''

export const fmtDateTime = (t?: Timestamp): string =>
  t
    ? t.toDate().toLocaleString('ja-JP', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : ''
