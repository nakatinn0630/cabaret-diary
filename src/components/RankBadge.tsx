import type { CustomerRank } from '../types'

export const RANK_LABEL: Record<CustomerRank, string> = {
  VVIP: '1番の太客',
  VIP: '定期太客',
  IP: '見込み',
  LOVE: 'スキピ',
  BADBOY: '痛客',
}

export const RANK_OPTIONS: CustomerRank[] = ['VVIP', 'VIP', 'IP', 'LOVE', 'BADBOY']

const RANK_CLASS: Record<CustomerRank, string> = {
  VVIP: 'bg-gold/20 text-gold ring-1 ring-gold/40',
  VIP: 'bg-gold/10 text-gold ring-1 ring-gold/20',
  IP: 'bg-violet-500/15 text-violet-600 ring-1 ring-violet-500/30 dark:text-violet-300',
  LOVE: 'bg-pink-500/15 text-pink-600 ring-1 ring-pink-500/30 dark:text-pink-300',
  BADBOY: 'bg-red-500/15 text-red-600 ring-1 ring-red-500/30 dark:text-red-300',
}

export function RankBadge({ rank }: { rank?: CustomerRank }) {
  if (!rank) return null
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${RANK_CLASS[rank]}`}>
      {rank}・{RANK_LABEL[rank]}
    </span>
  )
}
