import { Timestamp } from 'firebase/firestore'
import type {
  Customer,
  Visit,
  Schedule,
  Consultation,
  ConsultationMessage,
  Store,
  Membership,
  Broadcast,
  Ranking,
  StoreCastSales,
  Penalty,
  StoreMessage,
} from '../types'
import type { ProfileSettings, MonthlyStats } from './sales'
import type { MyMembership } from './stores'

// ============================================================================
// デモモード（Google認証・Firestore不要のUIテスト用）
//   /demo にアクセスで有効化 → 実コンポーネントをサンプルデータで表示。
//   書き込み系はローカルのメモリ更新のみ（永続化しない）。
// ============================================================================

const KEY = 'kyabacho_demo'
export const DEMO_UID = 'demo-user'

export function demoActive(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(KEY) === '1'
}
export function enableDemo(): void {
  localStorage.setItem(KEY, '1')
}
export function disableDemo(): void {
  localStorage.removeItem(KEY)
}

const ts = (ms: number) => Timestamp.fromMillis(ms)
const day = 86400000
// 実行時の「今日」を基準に、近い誕生日や当日予定を生成（🎂バッジ・今日の予定を確実に表示）
const now = Date.now()
const soonBirthday = ts(now + 3 * day) // 3日後が誕生日（月日のみ利用）

// ---- 顧客 ----
export const demoCustomers: Customer[] = [
  {
    id: 'demo_taka',
    nickname: 'タカさん',
    lineName: 'Taka_88',
    phone: '090-1234-5678',
    occupation: 'IT系 経営者',
    incomeRange: '2000〜3000万',
    paymentMethods: ['card', 'cash'],
    tags: ['太客', '釣り', '聞き役'],
    rank: 'VIP',
    rankHistory: [],
    fit: { level: '得意', reasonTags: ['会話が弾む', '聞き役が向く'], fatigue: '低' },
    fortune: { birthday: soonBirthday, bloodType: 'B' },
    pinnedCautions: ['押しすぎると引く', 'メンツを立てると機嫌が良い'],
    totalSpent: 1250000,
    visitCount: 14,
    lastVisitAt: ts(now - 4 * day),
    riskScore: 55,
    riskFlags: ['収入に対して使用金額が高い'],
    memo: '釣り好き。次回、先週の釣果を聞く。',
    createdAt: ts(now - 200 * day),
    updatedAt: ts(now - 4 * day),
  },
  {
    id: 'demo_ken',
    nickname: 'けんさん',
    lineName: 'ken_t',
    phone: '080-9999-1111',
    occupation: '会社経営',
    companyName: 'T商事',
    incomeRange: '3000万〜',
    paymentMethods: ['card', 'urikake'],
    tags: ['焼酎派', 'ゴルフ'],
    rank: 'VVIP',
    rankHistory: [],
    fit: { level: '普通', reasonTags: ['話が長い', 'ボトル入れてくれる'], fatigue: '中' },
    fortune: { birthday: ts(Date.UTC(1980, 8, 3)) },
    pinnedCautions: ['家庭の話はNG'],
    totalSpent: 2840000,
    visitCount: 23,
    lastVisitAt: ts(now - 20 * day),
    riskScore: 72,
    riskFlags: ['売掛 ¥180,000 未回収', '来店間隔が平均の2倍に拡大', '深酒時に口調が荒くなる'],
    memo: '月末は連絡が返らない。',
    createdAt: ts(now - 300 * day),
    updatedAt: ts(now - 20 * day),
  },
  {
    id: 'demo_yu',
    nickname: 'ゆうくん',
    lineName: 'yu_28',
    occupation: '美容師',
    paymentMethods: ['cash'],
    tags: ['同世代', 'アフター多め'],
    rank: 'LOVE',
    rankHistory: [],
    fit: { level: '得意', reasonTags: ['気楽', 'テンション同じ'], fatigue: '低' },
    pinnedCautions: [],
    totalSpent: 380000,
    visitCount: 9,
    lastVisitAt: ts(now - 6 * day),
    riskScore: 18,
    riskFlags: [],
    memo: '',
    createdAt: ts(now - 90 * day),
    updatedAt: ts(now - 6 * day),
  },
  {
    id: 'demo_masa',
    nickname: 'まさ',
    occupation: '不明',
    incomeRange: '不明',
    paymentMethods: ['cash'],
    tags: ['新規', '要注意'],
    rank: 'BADBOY',
    rankHistory: [],
    fit: { level: '苦手', reasonTags: ['距離が近い', '酒癖'], fatigue: '高' },
    pinnedCautions: ['連絡先は店のLINEのみ'],
    totalSpent: 120000,
    visitCount: 3,
    lastVisitAt: ts(now - 2 * day),
    riskScore: 64,
    riskFlags: ['過度なボディタッチ', '閉店後の待ち伏せ疑い'],
    memo: '',
    createdAt: ts(now - 20 * day),
    updatedAt: ts(now - 2 * day),
  },
]

// ---- 来店履歴 ----
export const demoVisitsByCustomer: Record<string, Visit[]> = {
  demo_taka: [
    {
      id: 'dv_taka_2',
      date: ts(now - 4 * day),
      durationMin: 120,
      amount: 180000,
      bottles: [{ name: 'Dom Pérignon 白', price: 120000 }],
      isDohan: true,
      isAfter: false,
      payment: 'card',
      episodeMemo: '同伴で寿司。仕事の愚痴を聞いた。',
      photoRefs: [],
      createdAt: ts(now - 4 * day),
    },
    {
      id: 'dv_taka_1',
      date: ts(now - 18 * day),
      durationMin: 90,
      amount: 95000,
      bottles: [],
      isDohan: false,
      isAfter: false,
      payment: 'cash',
      episodeMemo: '釣りの話で盛り上がる。',
      photoRefs: [],
      createdAt: ts(now - 18 * day),
    },
  ],
  demo_ken: [
    {
      id: 'dv_ken_1',
      date: ts(now - 20 * day),
      durationMin: 150,
      amount: 260000,
      bottles: [{ name: 'ドンペリ ゴールド', price: 180000 }],
      isDohan: false,
      isAfter: true,
      payment: 'urikake',
      urikakePaid: false,
      episodeMemo: '売掛の回収日は今月末の約束。',
      photoRefs: [],
      createdAt: ts(now - 20 * day),
    },
  ],
  demo_yu: [
    {
      id: 'dv_yu_1',
      date: ts(now - 6 * day),
      durationMin: 60,
      amount: 45000,
      bottles: [],
      isDohan: false,
      isAfter: true,
      payment: 'cash',
      episodeMemo: 'アフターでラーメン。',
      photoRefs: [],
      createdAt: ts(now - 6 * day),
    },
  ],
  demo_masa: [],
}

// ---- 予定（今日＋今後） ----
const atToday = (h: number, m = 0) => {
  const d = new Date(now)
  d.setHours(h, m, 0, 0)
  return Timestamp.fromMillis(d.getTime())
}
export const demoSchedules: Schedule[] = [
  { id: 'ds_1', type: 'dohan', customerId: 'demo_taka', start: atToday(18), end: atToday(20), memo: '寿司 まつむら' },
  { id: 'ds_2', type: 'shift', start: atToday(20), end: atToday(26 % 24) },
  { id: 'ds_3', type: 'appointment', customerId: 'demo_ken', start: ts(now + 2 * day), end: ts(now + 2 * day + 3600000), memo: '売掛回収の約束' },
  { id: 'ds_4', type: 'after', customerId: 'demo_yu', start: ts(now + 4 * day), end: ts(now + 4 * day + 7200000) },
]

// ---- プロフィール／売上集計 ----
export const demoProfile: ProfileSettings = {
  stageName: 'れいな',
  birthday: '1999-04-12',
  guaranteeEndDate: ts(now + 21 * day),
  targetShimei: 15,
  targetSales: 3200000,
  trialEndDate: ts(now + 10 * day),
  trialRaces: [
    { id: 'r1', name: '看板レース', target: 5000000, current: 2450000, unit: '円' },
    { id: 'r2', name: 'うちわレース', target: 40, current: 12, unit: '本' },
  ],
}
export const demoMonthlyStats: MonthlyStats = { totalSales: 2450000, visitCount: 20, dohanCount: 6 }
export const demoShimeiCount = 12

// ---- 黒服相談 ----
const cmsg = (role: 'user' | 'assistant', text: string, min: number): ConsultationMessage => ({
  role,
  text,
  at: ts(now - min * 60000),
})
export const demoConsultations: Consultation[] = [
  {
    id: 'dc_1',
    category: 'ストーカー',
    escalatedTo: 'urgent',
    messages: [
      cmsg('assistant', 'よう、お疲れ。困りごとがあるなら遠慮なく話しな。俺が聞くぞ。', 30),
      cmsg('user', '出待ちされてる気がして怖い…', 20),
      cmsg(
        'assistant',
        'おい、それはやばいやつだ。よく相談してくれたな。これはAIの俺じゃ守れない――今すぐ担当の黒服か店に直接連絡しろ。送り迎えや対応はお店に頼め。一人で抱え込むな、いいな。',
        19,
      ),
    ],
    createdAt: ts(now - 30 * 60000),
    updatedAt: ts(now - 19 * 60000),
  },
]

// ---- 店舗（お知らせ・店舗コンソール用） ----
const DEMO_STORE = 'demo_store'
export const demoMemberships: MyMembership[] = [
  { storeId: DEMO_STORE, role: 'manager', displayName: 'れいな' },
]
export const demoStore: Store = { id: DEMO_STORE, name: 'CLUB LUXE 本店', createdBy: DEMO_UID }
export const demoStoreMembers: Membership[] = [
  { uid: DEMO_UID, role: 'manager', displayName: 'れいな', joinedAt: ts(now - 120 * day), active: true },
  { uid: 'm_mio', role: 'cast', displayName: 'みお', assignedKurofuku: 'm_sato', monthlyQuota: 2000000, joinedAt: ts(now - 80 * day), active: true },
  { uid: 'm_anna', role: 'cast', displayName: 'あんな', assignedKurofuku: 'm_sato', monthlyQuota: 1500000, joinedAt: ts(now - 60 * day), active: true },
  { uid: 'm_sato', role: 'kurofuku', displayName: '佐藤', joinedAt: ts(now - 150 * day), active: true },
]
export const demoPenalties: Penalty[] = [
  { id: 'p1', castUid: 'm_mio', amount: 3000, reason: '遅刻（15分）', paid: false, createdBy: DEMO_UID, createdAt: ts(now - 3 * day) },
  { id: 'p2', castUid: 'm_anna', amount: 5000, reason: '当日欠勤', paid: true, createdBy: DEMO_UID, createdAt: ts(now - 12 * day) },
]
export const demoStoreMessages: StoreMessage[] = [
  { id: 'sm1', castUid: 'm_mio', fromUid: DEMO_UID, fromRole: 'store', fromName: '店長', text: '今週末の白ドレスDAY、ドレスコード白でお願いします🤍', createdAt: ts(now - 2 * day) },
  { id: 'sm2', castUid: 'm_mio', fromUid: 'm_mio', fromRole: 'cast', fromName: 'みお', text: '了解です！タカさん同伴で入れそうです🍾', createdAt: ts(now - 2 * day + 3600000) },
  { id: 'sm3', castUid: 'm_mio', fromUid: DEMO_UID, fromRole: 'store', fromName: '店長', text: 'ありがとう！助かります。', createdAt: ts(now - 2 * day + 7200000) },
]
export const demoBroadcasts: Broadcast[] = [
  { id: 'b1', type: 'event', title: 'サマーイベント「白ドレスDAY」', body: 'ドレスコード白。シャンパンバック20%。', audience: 'all', eventDate: ts(now + 8 * day), createdBy: DEMO_UID, createdAt: ts(now - 2 * day) },
  { id: 'b2', type: 'birthdayQuota', title: 'バースデーノルマ確認', body: '9月バースデー組は同伴3本以上を目標に。', audience: 'all', quota: 1500000, createdBy: DEMO_UID, createdAt: ts(now - 5 * day) },
  { id: 'b3', type: 'shift', title: '来週シフト提出〆切', body: '金曜21時までにコンソールから提出してください。', audience: 'all', createdBy: DEMO_UID, createdAt: ts(now - 1 * day) },
]
export const demoStoreSales: StoreCastSales[] = [
  { uid: DEMO_UID, figures: { totalSales: 2450000, shimeiCount: 12, dohanCount: 6, joCount: 9 }, confirmedBy: DEMO_UID, confirmedAt: ts(now - day) },
  { uid: 'm_mio', figures: { totalSales: 1980000, shimeiCount: 10, dohanCount: 4, joCount: 7 }, confirmedBy: DEMO_UID, confirmedAt: ts(now - day) },
]
export const demoRankings: Ranking[] = [
  {
    id: 'demo_store_month_sales',
    metric: 'sales',
    period: 'month',
    visibility: 'public',
    computedAt: ts(now - day),
    entries: [
      { castUid: DEMO_UID, displayName: 'れいな', rank: 1, value: 2450000 },
      { castUid: 'm_mio', displayName: 'みお', rank: 2, value: 1980000 },
      { castUid: 'm_anna', displayName: 'あんな', rank: 3, value: 1520000 },
    ],
  },
]
