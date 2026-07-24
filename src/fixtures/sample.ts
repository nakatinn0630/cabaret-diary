import { Timestamp } from 'firebase/firestore'
import type {
  Customer,
  Visit,
  Compatibility,
  Schedule,
  SalesRecord,
  ReplySuggestion,
  Broadcast,
  Ranking,
} from '../types'

// クロードデザインのモック（顧客詳細/返信案/黒服/売上）に対応するサンプルデータ。
// 型と実際のUIをつなぐ「契約の実例」。実装時は Firestore 取得値に差し替える。
const ts = (ms: number) => Timestamp.fromMillis(ms)

// 顧客詳細画面（②）: 「タカさん」
export const sampleCustomer: Customer = {
  id: 'cust_taka',
  nickname: 'タカさん',
  lineName: 'Taka',
  occupation: 'IT系 経営者',
  incomeRange: '2000万〜',
  firstVisitDate: ts(1767225600000),
  paymentMethods: ['card', 'cash'],
  tags: ['太客'],
  rank: 'VIP',
  rankHistory: [
    { rank: 'IP', changedAt: ts(1767225600000), note: '初回来店' },
    { rank: 'VIP', changedAt: ts(1774000000000) },
  ],
  fit: { level: '得意', reasonTags: ['会話が弾む', '聞き役が向く'], fatigue: '低' },
  fortune: { birthday: ts(394300800000), bloodType: 'B' },
  pinnedCautions: ['押しすぎると引く', 'メンツを立てると機嫌が良い'],
  totalSpent: 1250000,
  visitCount: 14,
  riskScore: 55,
  riskFlags: ['収入に対して使用金額が高い'],
  memo: '釣り好き。次回、先週行った釣りの釣果を聞く。',
  createdAt: ts(1767225600000),
  updatedAt: ts(1782864000000),
}

// 来店履歴タイムライン（②）
export const sampleVisits: Visit[] = [
  {
    id: 'visit_3',
    date: ts(1782864000000),
    durationMin: 120,
    amount: 180000,
    bottles: [{ name: 'Dom Pérignon 白', price: 120000 }],
    isDohan: true,
    isAfter: false,
    payment: 'card',
    episodeMemo: '同伴で寿司。仕事の愚痴を聞いた。',
    photoRefs: [],
    storeId: 'store_nagi',
    createdAt: ts(1782864000000),
  },
  {
    id: 'visit_2',
    date: ts(1780000000000),
    durationMin: 90,
    amount: 95000,
    bottles: [],
    isDohan: false,
    isAfter: false,
    payment: 'cash',
    episodeMemo: '釣りの話で盛り上がる。',
    photoRefs: [],
    storeId: 'store_nagi',
    createdAt: ts(1780000000000),
  },
]

// 相性診断（F-14）
export const sampleCompatibility: Compatibility = {
  id: 'diag_1',
  relationshipTypes: ['恋愛', '友人'],
  persona: 'assertive_saiki',
  methods: ['四柱推命', '五行'],
  rankResult: 'B',
  scoresByRelationship: [
    { type: '友人', score: 88, reason: '同じ傷を持つ戦友タイプ' },
    { type: '恋愛', score: 65, reason: '尽くしすぎ注意の与える恋' },
  ],
  summary: '金と依存を持ち込まなければ一生モノの縁。',
  cautionCandidates: ['金の貸し借りはしない', '尽くしすぎない', '距離を保つ'],
  pinnedCautions: ['金の貸し借りはしない'],
  createdAt: ts(1782864000000),
}

// 返信案生成（③）: 軽め/標準/丁寧
export const sampleReplySuggestions: ReplySuggestion[] = [
  { tone: '軽め', text: 'おはよ〜！この前のお寿司ほんと美味しかった🍣また行こ！' },
  { tone: '標準', text: 'おはようございます！先日はごちそうさまでした😊 釣りの続き聞かせてくださいね🎣' },
  { tone: '丁寧', text: '昨日はお忙しい中ありがとうございました。お寿司とても美味しかったです。またお会いできるのを楽しみにしています。' },
]

// スケジュール（①/②）
export const sampleSchedules: Schedule[] = [
  {
    id: 'sch_1',
    type: 'dohan',
    customerId: 'cust_taka',
    start: ts(1782856800000),
    end: ts(1782864000000),
    memo: '19:00 銀座で待ち合わせ',
  },
  { id: 'sch_2', type: 'shift', start: ts(1782864000000), end: ts(1782885600000) },
]

// 売上レポート（⑤）
export const sampleSalesRecord: SalesRecord = {
  id: '2026-07',
  selfReported: { totalSales: 3200000, shimeiCount: 18, dohanCount: 6, joCount: 9 },
  storeConfirmed: {
    totalSales: 3150000,
    shimeiCount: 18,
    dohanCount: 6,
    joCount: 8,
    storeId: 'store_nagi',
  },
  storeRank: 3,
  updatedAt: ts(1782864000000),
}

// 店舗発信（F-17）: バースデーノルマ
export const sampleBroadcast: Broadcast = {
  id: 'bc_1',
  type: 'birthdayQuota',
  title: '7月バースデーイベント',
  body: '今月のバースデー目標は150万。ヘルプ体制組みます！',
  audience: 'castIds',
  targetCastIds: ['cast_self'],
  quota: 1500000,
  eventDate: ts(1784000000000),
  createdBy: 'mgr_1',
  createdAt: ts(1782000000000),
}

// 店内ランキング（F-18・自分の順位のみ公開例）
export const sampleRanking: Ranking = {
  id: 'rank_2026-07_sales',
  metric: 'sales',
  period: 'month',
  visibility: 'selfOnly',
  computedAt: ts(1782864000000),
  entries: [{ castUid: 'cast_self', rank: 3, value: 3150000 }],
}
