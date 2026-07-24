import type { CustomerRank } from '../types'

export const RANK_LABEL: Record<CustomerRank, string> = {
  VVIP: '1番の太客',
  VIP: '定期太客',
  IP: '見込み',
  LOVE: 'スキピ',
  BADBOY: '痛客',
}

export const RANK_OPTIONS: CustomerRank[] = ['VVIP', 'VIP', 'IP', 'LOVE', 'BADBOY']

// ランクごとのグラデーション（クロードデザイン由来の高級感トーン）
export const RANK_CLS: Record<CustomerRank, string> = {
  VVIP: 'bg-gradient-to-br from-[#e8c97e] to-gold text-night',
  VIP: 'bg-gradient-to-br from-[#e8e4ee] to-[#b9b3c9] text-night',
  IP: 'bg-gradient-to-br from-[#b88a5e] to-[#8f6540] text-white',
  LOVE: 'bg-gradient-to-br from-[#f0a9bf] to-[#e6789b] text-white',
  BADBOY: 'bg-gradient-to-br from-[#6b6478] to-[#443e52] text-white',
}

export function RankBadge({ rank, className = '' }: { rank?: CustomerRank; className?: string }) {
  if (!rank) return null
  return (
    <span
      className={`inline-flex items-center text-[10px] font-bold tracking-widest px-2.5 py-0.5 rounded-full ${RANK_CLS[rank]} ${className}`}
    >
      {rank}
    </span>
  )
}
