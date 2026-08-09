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

/** 誕生日の「M/D」表記 */
export const fmtMonthDay = (t?: Timestamp): string => {
  if (!t) return ''
  const d = t.toDate()
  return `${d.getMonth() + 1}/${d.getDate()}`
}

/** 次の誕生日までの日数（今日=0）。未設定は null */
export function daysUntilBirthday(t?: Timestamp, nowMs: number = Date.now()): number | null {
  if (!t) return null
  const b = t.toDate()
  const now = new Date(nowMs)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let next = new Date(now.getFullYear(), b.getMonth(), b.getDate())
  if (next.getTime() < today.getTime()) next = new Date(now.getFullYear() + 1, b.getMonth(), b.getDate())
  return Math.round((next.getTime() - today.getTime()) / 86400000)
}

// F-38 タグの色分け（タグ文字列から決定的に配色。ライト/ダーク両対応）
const TAG_PALETTE = [
  'border-rose/35 bg-rose/10 text-[#a8395c] dark:text-[#f0c3d2]',
  'border-gold/40 bg-gold/10 text-[#8a6a1e] dark:text-[#e3c987]',
  'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  'border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300',
  'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
]
export function tagColorClass(tag: string): string {
  let h = 0
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0
  return TAG_PALETTE[h % TAG_PALETTE.length]
}

/** 満年齢。誕生日未設定や年が不明(1904年以前=年未入力の慣例値)は null */
export function ageFrom(t?: Timestamp, nowMs: number = Date.now()): number | null {
  if (!t) return null
  const b = t.toDate()
  if (b.getFullYear() <= 1904) return null
  const now = new Date(nowMs)
  let age = now.getFullYear() - b.getFullYear()
  const beforeBday =
    now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())
  if (beforeBday) age--
  return age >= 0 && age < 120 ? age : null
}

/** 星座（月日から） */
export function zodiacOf(t?: Timestamp): string | null {
  if (!t) return null
  const d = t.toDate()
  const m = d.getMonth() + 1
  const day = d.getDate()
  const md = m * 100 + day
  if (md >= 321 && md <= 419) return '牡羊座'
  if (md >= 420 && md <= 520) return '牡牛座'
  if (md >= 521 && md <= 621) return '双子座'
  if (md >= 622 && md <= 722) return '蟹座'
  if (md >= 723 && md <= 822) return '獅子座'
  if (md >= 823 && md <= 922) return '乙女座'
  if (md >= 923 && md <= 1023) return '天秤座'
  if (md >= 1024 && md <= 1122) return '蠍座'
  if (md >= 1123 && md <= 1221) return '射手座'
  if (md >= 1222 || md <= 119) return '山羊座'
  if (md >= 120 && md <= 218) return '水瓶座'
  return '魚座'
}
