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
