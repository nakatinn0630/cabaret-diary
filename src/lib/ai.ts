import type { ReplySuggestion, ReplyTone } from '../types'
import { auth } from './firebase'

// F-06 返信案生成 / F-07 特別連絡 / F-08 黒服相談 / F-14 相性診断。
// 生成の優先順位:
//   1) VITE_AI_PROXY_URL があれば ai-proxy(Cloud Function 等)経由（サーバでキー秘匿・SEC-10/11/12）
//   2) VITE_AI_API_KEY があれば OpenAI互換API(DeepSeek/Groq 等)を直接呼ぶ（静的配信・簡易運用向け）
//   3) いずれも無ければローカルの簡易テンプレ生成にフォールバック（オフライン/デモ）
// ※ 直接呼び出しではAPIキーがバンドルに含まれ公開される。DeepSeek等の従量課金APIでは
//   漏洩＝実費消費のリスクがあるため、残高上限の設定を推奨。秘匿したい場合は
//   VITE_AI_PROXY_URL のサーバ経由に切り替える（本コードはそのまま利用可）。
// 既定は DeepSeek(OpenAI互換)。Groq を使う場合は BASE_URL と MODEL を環境変数で上書き。

const PROXY_URL = import.meta.env.VITE_AI_PROXY_URL
// 後方互換: 旧 VITE_GROQ_API_KEY / VITE_GROQ_MODEL も引き続き解釈する
const AI_KEY = import.meta.env.VITE_AI_API_KEY || import.meta.env.VITE_GROQ_API_KEY
const AI_BASE = (import.meta.env.VITE_AI_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '')
const AI_MODEL =
  import.meta.env.VITE_AI_MODEL || import.meta.env.VITE_GROQ_MODEL || 'deepseek-chat'
const AI_URL = `${AI_BASE}/chat/completions`
const useDirect = Boolean(AI_KEY)

export type AiSource = 'proxy' | 'api' | 'local'

// ai-proxy は Firebase IDトークンで認証（SEC-01/11）。
async function proxyHeaders(): Promise<Record<string, string>> {
  const base: Record<string, string> = { 'Content-Type': 'application/json' }
  const u = auth?.currentUser
  if (u) {
    try {
      base.Authorization = `Bearer ${await u.getIdToken()}`
    } catch {
      /* トークン取得失敗時は未認証で送る（サーバが401を返す） */
    }
  }
  return base
}

/** SEC-10: 送信前の軽量マスキング（電話番号など）。プロキシ・Groq いずれの外部送信にも適用 */
function maskPII(text: string): string {
  return text.replace(/\d[\d\- ]{8,}\d/g, '[電話番号]')
}

/** OpenAI互換API(DeepSeek/Groq 等)のチャット補完。失敗時は例外→呼び出し側でローカルへフォールバック */
async function callAI(
  system: string,
  user: string,
  opts?: { json?: boolean; temperature?: number },
): Promise<string> {
  const res = await fetch(AI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${AI_KEY}` },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: opts?.temperature ?? 0.85,
      max_tokens: 1024,
      ...(opts?.json ? { response_format: { type: 'json_object' } } : {}),
    }),
  })
  if (!res.ok) throw new Error(`AI ${res.status}`)
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('AI empty response')
  return content
}

/** JSONオブジェクトを頑健に取り出す（```json フェンスや前後テキストを許容） */
function extractJson<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T
  } catch {
    /* フェンスや前後テキストがある場合は最初の { … } を抽出 */
  }
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(raw.slice(start, end + 1)) as T
    } catch {
      return null
    }
  }
  return null
}

// ============================================================================
// F-06 返信案生成
// ============================================================================
export interface ReplyContext {
  latestMessage: string
  customerName?: string
  recentEpisode?: string
  toneHint?: string // 口調学習（analyzeTone の tone 等）
  history?: { from: 'me' | 'other'; text: string }[]
}

export interface ReplyResult {
  suggestions: ReplySuggestion[]
  source: AiSource
}

const REPLY_TONES: ReplyTone[] = ['軽め', '標準', '丁寧']

export async function generateReplies(ctx: ReplyContext): Promise<ReplyResult> {
  if (PROXY_URL) {
    const res = await fetch(`${PROXY_URL}/replies`, {
      method: 'POST',
      headers: await proxyHeaders(),
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

  if (useDirect) {
    try {
      const system =
        'あなたは日本のキャバクラ/クラブで働くキャストの、LINE返信文面づくりのアシスタントです。' +
        '相手（お客様）へ送る返信を、営業感が出すぎない自然な日本語で作ります。' +
        '軽め=フランクでフレンドリー、標準=丁寧すぎない好印象、丁寧=きちんとした敬語、の3トーンを作り分けます。' +
        '出力は必ず次のJSONのみ: {"suggestions":[{"tone":"軽め","text":"..."},{"tone":"標準","text":"..."},{"tone":"丁寧","text":"..."}]}'
      const lines = [
        ctx.customerName ? `お客様の呼び名: ${ctx.customerName}` : '',
        ctx.recentEpisode ? `最近の出来事/話題: ${ctx.recentEpisode}` : '',
        ctx.toneHint ? `口調のヒント: ${ctx.toneHint}` : '',
        `お客様から届いたメッセージ: ${maskPII(ctx.latestMessage) || '(なし。こちらから送る想定)'}`,
      ].filter(Boolean)
      const raw = await callAI(system, lines.join('\n'), { json: true })
      const parsed = extractJson<{ suggestions?: { tone?: string; text?: string }[] }>(raw)
      const arr = parsed?.suggestions
      if (!Array.isArray(arr) || arr.length === 0) throw new Error('bad shape')
      const suggestions: ReplySuggestion[] = REPLY_TONES.map((tone, i) => ({
        tone,
        text: String(arr[i]?.text ?? arr[i % arr.length]?.text ?? '').trim(),
      }))
      if (suggestions.some((s) => !s.text)) throw new Error('empty text')
      return { suggestions, source: 'api' }
    } catch {
      /* 直接API失敗時はローカルへ */
    }
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

// ============================================================================
// F-07 特別連絡
// ============================================================================
export interface SpecialContactContext {
  customerName?: string
  reason: string // 例: '14日連絡なし' / '誕生日が近い'
  hook?: string // エピソードフック（メモ等）
  toneHint?: string
}

/** F-07 営業色のない自然な一言を1案生成 */
export async function generateSpecialContact(
  ctx: SpecialContactContext,
): Promise<{ text: string; source: AiSource }> {
  if (PROXY_URL) {
    const res = await fetch(`${PROXY_URL}/special-contact`, {
      method: 'POST',
      headers: await proxyHeaders(),
      body: JSON.stringify(ctx),
    })
    if (!res.ok) throw new Error(`AI生成に失敗しました (${res.status})`)
    const data = (await res.json()) as { text: string }
    return { text: data.text, source: 'proxy' }
  }

  if (useDirect) {
    try {
      const system =
        'あなたはキャバクラ/クラブのキャストの連絡アシスタントです。' +
        '「営業」ではなく、自然で気の利いた“ひとこと連絡”を日本語で1通だけ作ります。' +
        '長すぎず、絵文字は控えめ、押し付けがましくしないこと。出力は本文のみ（前置き・カギ括弧・説明は不要）。'
      const user = [
        ctx.customerName ? `相手の呼び名: ${ctx.customerName}` : '',
        `連絡したい理由/きっかけ: ${ctx.reason}`,
        ctx.hook ? `思い出せる話題: ${ctx.hook}` : '',
        ctx.toneHint ? `口調のヒント: ${ctx.toneHint}` : '',
      ]
        .filter(Boolean)
        .join('\n')
      const raw = (await callAI(system, user, { temperature: 0.9 })).trim()
      const text = raw.replace(/^["「『]|["」』]$/g, '').trim()
      if (text) return { text, source: 'api' }
    } catch {
      /* fallthrough */
    }
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

// ============================================================================
// F-08 黒服機能（相談AI）
// ============================================================================
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
  source: AiSource
}

// エスカレーション判定は誤検知を避けるため常にローカルで決定的に行う（安全導線の一貫性のため）。
function detectCategory(text: string): { category?: ConsultCategory; escalate?: EscalationTarget } {
  if (/(ストーカー|つきまと|待ち伏せ|脅|怖い|尾行|合鍵|付きまと)/.test(text))
    return { category: 'ストーカー', escalate: 'police' }
  if (/(売掛|詐欺|お金.*返|飛ばれ|持ち逃げ|未回収)/.test(text))
    return { category: '売掛詐欺', escalate: 'store' }
  if (/(死にたい|消えたい|しんどい|辛|眠れ|限界|うつ)/.test(text))
    return { category: 'メンタル', escalate: 'window' }
  return { category: '愚痴' }
}

const CONSULT_LOCAL: Record<ConsultCategory, string> = {
  ストーカー:
    'それは怖かったね、まず身の安全が最優先だよ。無理に一人で抱えないで。警察相談専用電話 #9110 に相談できるし、危険を感じたらすぐ110番。お店にも共有して送り迎えや対策を頼もう。',
  売掛詐欺:
    'お金のことは証拠が大事。やり取りのスクショや日時の記録を必ず残しておいて。その上で、お店と、必要なら警察に相談する手順を一緒に考えよう。一人で立て替えたりしないでね。',
  メンタル:
    '無理してないか心配だよ。今日はちゃんと休もう。しんどい気持ちは我慢しなくていい。よかったら専門の相談窓口も使えるからね。あなたの味方だよ。',
  愚痴: 'うんうん、話してくれてありがとう。まず聞かせて。あなたはよくやってるよ。その上で、次どうするか一緒に考えよう。',
}

export async function consultKurofuku(history: ConsultTurn[], latest: string): Promise<ConsultResult> {
  if (PROXY_URL) {
    const res = await fetch(`${PROXY_URL}/consult`, {
      method: 'POST',
      headers: await proxyHeaders(),
      body: JSON.stringify({ history, latest: maskPII(latest) }),
    })
    if (!res.ok) throw new Error(`相談AIに接続できませんでした (${res.status})`)
    const data = (await res.json()) as Omit<ConsultResult, 'source'>
    return { ...data, source: 'proxy' }
  }

  const { category, escalate } = detectCategory(latest)

  if (useDirect) {
    try {
      const system =
        'あなたは夜職（キャバクラ/クラブ）で働く女性を支える、経験豊富で温かい「黒服（ボーイ/内勤）」の相談役です。' +
        '相手の気持ちにまず寄り添い、否定せず、短めの日本語で安心できる返答をします。' +
        '危険（ストーカー・つきまとい）が疑われるときは身の安全と #9110/110番・お店への共有を、' +
        '金銭トラブルは証拠保全とお店/警察への相談を、メンタルの落ち込みは休息と専門窓口を、それぞれ自然に促します。' +
        '説教くさくならず、味方であることが伝わるようにします。出力は本文のみ。'
      const convo = history
        .slice(-6)
        .map((t) => `${t.role === 'user' ? 'キャスト' : '黒服'}: ${maskPII(t.text)}`)
        .join('\n')
      const user = `${convo ? convo + '\n' : ''}キャスト: ${maskPII(latest)}\n黒服:`
      const text = (await callAI(system, user, { temperature: 0.7 })).trim()
      if (text) return { text, category, escalate, source: 'api' }
    } catch {
      /* fallthrough */
    }
  }

  return { text: CONSULT_LOCAL[category ?? '愚痴'], category, escalate, source: 'local' }
}

// ============================================================================
// F-14 占い・相性診断
// ============================================================================
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
  source: AiSource
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

function localCompat(input: CompatInput): CompatResult {
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

export async function diagnoseCompatibility(input: CompatInput): Promise<CompatResult> {
  if (PROXY_URL) {
    const res = await fetch(`${PROXY_URL}/compatibility`, {
      method: 'POST',
      headers: await proxyHeaders(),
      body: JSON.stringify(input),
    })
    if (!res.ok) throw new Error(`占い生成に失敗しました (${res.status})`)
    const data = (await res.json()) as Omit<CompatResult, 'source'>
    return { ...data, source: 'proxy' }
  }

  if (useDirect) {
    try {
      const fmt = (p: CompatPerson) =>
        [
          p.birthdayMs ? `誕生日:${new Date(p.birthdayMs).toISOString().slice(0, 10)}` : '誕生日:不明',
          p.bloodType ? `血液型:${p.bloodType}` : '',
          p.traits ? `特徴:${p.traits}` : '',
        ]
          .filter(Boolean)
          .join(' / ')
      const rels = input.relationshipTypes.length ? input.relationshipTypes : ['客']
      const system =
        'あなたは細木数子のような、ズバッと言い切る断定的で少し辛口だが愛のある占い師です。' +
        '四柱推命・五行の観点で二人の相性を鑑定します。姉御肌の口調（「いい？」「〜しなさい」等）で。' +
        'スコアは0〜100の整数。出力は必ず次のJSONのみ:' +
        '{"rankResult":"S|A|B|C|D","scoresByRelationship":[{"type":"関係名","score":0,"reason":"短い理由"}],' +
        '"summary":"総評(120字程度・断定口調)","cautionCandidates":["注意点1","注意点2","注意点3"]}'
      const user =
        `自分: ${fmt(input.self)}\n相手: ${fmt(input.partner)}\n` +
        `鑑定する関係性(この順・この名称で): ${rels.join('、')}\n` +
        `各関係性ごとに score と reason を出し、rankResult は総合評価にすること。`
      const raw = await callAI(system, user, { json: true, temperature: 0.9 })
      const parsed = extractJson<{
        rankResult?: string
        scoresByRelationship?: { type?: string; score?: number; reason?: string }[]
        summary?: string
        cautionCandidates?: string[]
      }>(raw)
      const ranks = ['S', 'A', 'B', 'C', 'D']
      const rankResult = (parsed?.rankResult ?? '').toString().trim().toUpperCase()
      const modelScores = parsed?.scoresByRelationship
      if (ranks.includes(rankResult) && Array.isArray(modelScores) && modelScores.length > 0) {
        const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)))
        const byType = new Map(modelScores.map((s) => [String(s.type ?? '').trim(), s]))
        const scoresByRelationship = rels.map((type, i) => {
          const m = byType.get(type) ?? modelScores[i] ?? modelScores[0]
          return {
            type,
            score: clamp(Number(m?.score ?? 60)),
            reason: String(m?.reason ?? '').trim() || '相性は悪くない',
          }
        })
        const cautionCandidates = (parsed?.cautionCandidates ?? [])
          .map((c) => String(c).trim())
          .filter(Boolean)
        return {
          rankResult: rankResult as CompatResult['rankResult'],
          scoresByRelationship,
          summary: String(parsed?.summary ?? '').trim() || '金と依存を持ち込まなければ縁は本物よ。',
          cautionCandidates: cautionCandidates.length ? cautionCandidates : CAUTION_POOL.slice(0, 4),
          source: 'api',
        }
      }
    } catch {
      /* fallthrough */
    }
  }

  return localCompat(input)
}
