import type { ReplySuggestion, ReplyTone } from '../types'

// F-06 返信案生成 / F-07 特別連絡の文面生成。
// 本番: ai-proxy Cloud Function 経由で Claude API（SEC-10 マスキング / SEC-11 レート制限 / SEC-12 本文非保存）。
// 未設定時: ローカルの簡易テンプレ生成にフォールバック（デモ・オフライン用）。

const PROXY_URL = import.meta.env.VITE_AI_PROXY_URL

export interface ReplyContext {
  latestMessage: string
  customerName?: string
  recentEpisode?: string
  toneHint?: string // 口調学習（analyzeTone の tone 等）
  history?: { from: 'me' | 'other'; text: string }[]
}

export interface ReplyResult {
  suggestions: ReplySuggestion[]
  source: 'proxy' | 'local'
}

/** SEC-10: 送信前の軽量マスキング（電話番号など） */
function maskPII(text: string): string {
  return text.replace(/\d[\d\- ]{8,}\d/g, '[電話番号]')
}

export async function generateReplies(ctx: ReplyContext): Promise<ReplyResult> {
  if (PROXY_URL) {
    const res = await fetch(`${PROXY_URL}/replies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        latestMessage: maskPII(ctx.latestMessage),
        customerName: ctx.customerName,
        recentEpisode: ctx.recentEpisode,
        toneHint: ctx.toneHint,
        history: ctx.history?.map((h) => ({ from: h.from, text: maskPII(h.text) })),
      }),
    })
    if (!res.ok) throw new Error(`AI生成に失敗しました (${res.status})`)
    const data = (await res.json()) as { suggestions: ReplySuggestion[] }
    return { suggestions: data.suggestions, source: 'proxy' }
  }
  return { suggestions: localReplies(ctx), source: 'local' }
}

// --- ローカル簡易生成（フォールバック） ---
function localReplies(ctx: ReplyContext): ReplySuggestion[] {
  const name = ctx.customerName?.trim()
  const honor = name ? `${name}` : ''
  const episode = ctx.recentEpisode?.trim()
  const emojiHeavy = /絵文字多め/.test(ctx.toneHint ?? '')
  const e = (s: string) => (emojiHeavy ? s : '')

  const light: string = [
    `${honor ? honor + '！' : 'おつかれ〜'}${e('😊')}`,
    episode ? `この前の${episode}楽しかったね${e('🎶')}` : `メッセージありがとう${e('🙌')}`,
    'また会えるの楽しみにしてる！',
  ].join(' ')

  const standard: string = [
    `${honor ? honor + 'さん、' : ''}メッセージありがとうございます${e('😊')}`,
    episode ? `先日は${episode}、楽しい時間でした。` : 'お元気にされていますか？',
    'またゆっくりお話しできたら嬉しいです。',
  ].join(' ')

  const polite: string = [
    `${honor ? honor + '様、' : ''}ご連絡ありがとうございます。`,
    episode ? `先日は${episode}、素敵なひとときを過ごさせていただきました。` : 'いつも気にかけてくださり感謝しています。',
    'また近いうちにお会いできますことを楽しみにしております。',
  ].join(' ')

  const tones: { tone: ReplyTone; text: string }[] = [
    { tone: '軽め', text: light },
    { tone: '標準', text: standard },
    { tone: '丁寧', text: polite },
  ]
  return tones
}

export interface SpecialContactContext {
  customerName?: string
  reason: string // 例: '14日連絡なし' / '誕生日が近い'
  hook?: string // エピソードフック（メモ等）
  toneHint?: string
}

/** F-07 営業色のない自然な一言を1案生成 */
export async function generateSpecialContact(ctx: SpecialContactContext): Promise<{ text: string; source: 'proxy' | 'local' }> {
  if (PROXY_URL) {
    const res = await fetch(`${PROXY_URL}/special-contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ctx),
    })
    if (!res.ok) throw new Error(`AI生成に失敗しました (${res.status})`)
    const data = (await res.json()) as { text: string }
    return { text: data.text, source: 'proxy' }
  }
  const name = ctx.customerName?.trim()
  const emojiHeavy = /絵文字多め/.test(ctx.toneHint ?? '')
  const e = emojiHeavy ? '😊' : ''
  const text = /誕生日/.test(ctx.reason)
    ? `${name ? name + 'さん' : ''}、もうすぐお誕生日だね！おめでとう先に言わせて${e}`
    : ctx.hook
      ? `${name ? name + 'さん' : ''}久しぶり！${ctx.hook}のことふと思い出したよ${e} 元気にしてる？`
      : `${name ? name + 'さん' : ''}久しぶり！最近どうしてるかなと思って${e}`
  return { text, source: 'local' }
}

// ---- F-08 黒服機能（相談AI） ----
export type ConsultCategory = '愚痴' | 'ストーカー' | '売掛詐欺' | 'メンタル'
export type EscalationTarget = 'police' | 'store' | 'window'

export interface ConsultTurn {
  role: 'user' | 'assistant'
  text: string
}

export interface ConsultResult {
  text: string
  category?: ConsultCategory
  escalate?: EscalationTarget
  source: 'proxy' | 'local'
}

function detectCategory(text: string): { category?: ConsultCategory; escalate?: EscalationTarget } {
  if (/(ストーカー|つきまと|待ち伏せ|脅|怖い|尾行|合鍵|付きまと)/.test(text))
    return { category: 'ストーカー', escalate: 'police' }
  if (/(売掛|詐欺|お金.*返|飛ばれ|持ち逃げ|未回収)/.test(text))
    return { category: '売掛詐欺', escalate: 'store' }
  if (/(死にたい|消えたい|しんどい|辛|眠れ|限界|うつ)/.test(text))
    return { category: 'メンタル', escalate: 'window' }
  return { category: '愚痴' }
}

export async function consultKurofuku(history: ConsultTurn[], latest: string): Promise<ConsultResult> {
  if (PROXY_URL) {
    const res = await fetch(`${PROXY_URL}/consult`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ history, latest: maskPII(latest) }),
    })
    if (!res.ok) throw new Error(`相談AIに接続できませんでした (${res.status})`)
    const data = (await res.json()) as Omit<ConsultResult, 'source'>
    return { ...data, source: 'proxy' }
  }
  const { category, escalate } = detectCategory(latest)
  const text =
    category === 'ストーカー'
      ? 'それは怖かったね、まず身の安全が最優先だよ。無理に一人で抱えないで。警察相談専用電話 #9110 に相談できるし、危険を感じたらすぐ110番。お店にも共有して送り迎えや対策を頼もう。'
      : category === '売掛詐欺'
        ? 'お金のことは証拠が大事。やり取りのスクショや日時の記録を必ず残しておいて。その上で、お店と、必要なら警察に相談する手順を一緒に考えよう。一人で立て替えたりしないでね。'
        : category === 'メンタル'
          ? '無理してないか心配だよ。今日はちゃんと休もう。しんどい気持ちは我慢しなくていい。よかったら専門の相談窓口も使えるからね。あなたの味方だよ。'
          : 'うんうん、話してくれてありがとう。まず聞かせて。あなたはよくやってるよ。その上で、次どうするか一緒に考えよう。'
  return { text, category, escalate, source: 'local' }
}

// ---- F-14 占い・相性診断 ----
export interface CompatPerson {
  birthdayMs?: number
  bloodType?: string
  traits?: string
}
export interface CompatInput {
  self: CompatPerson
  partner: CompatPerson
  relationshipTypes: string[] // '友人' | '仕事' | '恋愛' | '客' | '家族その他'
  persona: string // 'assertive_saiki'
}
export interface CompatResult {
  rankResult: 'S' | 'A' | 'B' | 'C' | 'D'
  scoresByRelationship: { type: string; score: number; reason: string }[]
  summary: string
  cautionCandidates: string[]
  source: 'proxy' | 'local'
}

const CAUTION_POOL = [
  '金の貸し借りはしない',
  '押しすぎると引く',
  'メンツを立てると機嫌が良い',
  '話を遮らない',
  '尽くしすぎない',
  '連絡はマメより間を空ける方が刺さる',
  '否定されると不機嫌になる',
  '距離を保つ',
]

function scoreFrom(self: CompatPerson, partner: CompatPerson, salt: number): number {
  const a = self.birthdayMs ? new Date(self.birthdayMs).getMonth() * 31 + new Date(self.birthdayMs).getDate() : 17
  const b = partner.birthdayMs ? new Date(partner.birthdayMs).getMonth() * 31 + new Date(partner.birthdayMs).getDate() : 23
  const raw = (a * 7 + b * 13 + salt * 29) % 101
  return 40 + Math.round((raw / 100) * 60) // 40-100
}

export async function diagnoseCompatibility(input: CompatInput): Promise<CompatResult> {
  if (PROXY_URL) {
    const res = await fetch(`${PROXY_URL}/compatibility`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    if (!res.ok) throw new Error(`占い生成に失敗しました (${res.status})`)
    const data = (await res.json()) as Omit<CompatResult, 'source'>
    return { ...data, source: 'proxy' }
  }
  const scores = input.relationshipTypes.map((type, i) => {
    const score = scoreFrom(input.self, input.partner, i + 1)
    const reason =
      type === '恋愛'
        ? '与える恋になりやすい。尽くしすぎ注意'
        : type === '仕事'
          ? 'お金が絡むと危うい。金銭は分けること'
          : type === '友人'
            ? '長く続く戦友タイプ'
            : '距離感を保てば良好'
    return { type, score, reason }
  })
  const avg = Math.round(scores.reduce((s, x) => s + x.score, 0) / Math.max(1, scores.length))
  const rankResult: CompatResult['rankResult'] =
    avg >= 90 ? 'S' : avg >= 78 ? 'A' : avg >= 65 ? 'B' : avg >= 52 ? 'C' : 'D'
  const cautionCandidates = CAUTION_POOL.slice(0, 4 + (avg % 3))
  const summary =
    'いい? この二人、金と依存さえ持ち込まなきゃ縁は本物よ。相性は悪くない、でも甘えは禁物。しっかりしなさい。'
  return { rankResult, scoresByRelationship: scores, summary, cautionCandidates, source: 'local' }
}
