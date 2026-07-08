import { setGlobalOptions } from 'firebase-functions/v2'
import { onRequest, type Request } from 'firebase-functions/v2/https'
import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { defineSecret } from 'firebase-functions/params'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'
import type { Response } from 'express'
import { callClaude, extractJson, maskPII } from './claude'
import { computeRisk } from './risk'

initializeApp()
setGlobalOptions({ region: 'asia-northeast1', maxInstances: 10 })

const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY')

// ---- 認証（SEC-01/11）: Firebase IDトークンを検証 ----
async function requireUid(req: Request): Promise<string> {
  const header = req.get('Authorization') ?? ''
  const m = header.match(/^Bearer (.+)$/)
  if (!m) throw new Error('unauthorized')
  const decoded = await getAuth().verifyIdToken(m[1])
  return decoded.uid
}

function send(res: Response, status: number, body: unknown): void {
  res.status(status).json(body)
}

// =====================================================================
// ai-proxy（F-06 返信案 / F-07 特別連絡 / F-08 黒服相談 / F-14 占い）
// クライアント lib/ai.ts の VITE_AI_PROXY_URL 契約に一致。
// 本番の秘匿ロジック・APIキーはここに集約（SEC-08/10/12）。
// =====================================================================
export const aiProxy = onRequest(
  { cors: true, secrets: [ANTHROPIC_API_KEY] },
  async (req, res) => {
    if (req.method !== 'POST') {
      send(res, 405, { error: 'POSTのみ対応' })
      return
    }
    let uid: string
    try {
      uid = await requireUid(req)
    } catch {
      send(res, 401, { error: '認証が必要です' })
      return
    }
    void uid // 将来のレート制限（SEC-11）に使用

    const apiKey = ANTHROPIC_API_KEY.value()
    const path = req.path.replace(/\/+$/, '')

    try {
      if (path.endsWith('/replies')) {
        send(res, 200, await handleReplies(apiKey, req.body))
      } else if (path.endsWith('/special-contact')) {
        send(res, 200, await handleSpecialContact(apiKey, req.body))
      } else if (path.endsWith('/consult')) {
        send(res, 200, await handleConsult(apiKey, req.body))
      } else if (path.endsWith('/compatibility')) {
        send(res, 200, await handleCompatibility(apiKey, req.body))
      } else {
        send(res, 404, { error: 'unknown endpoint' })
      }
    } catch (e) {
      send(res, 500, { error: e instanceof Error ? e.message : 'AI生成に失敗しました' })
    }
  },
)

// F-06 返信案
async function handleReplies(apiKey: string, body: any) {
  const latest = maskPII(String(body?.latestMessage ?? ''))
  const name = body?.customerName ? String(body.customerName) : ''
  const episode = body?.recentEpisode ? String(body.recentEpisode) : ''
  const tone = body?.toneHint ? String(body.toneHint) : ''
  const history: { from: string; text: string }[] = Array.isArray(body?.history) ? body.history : []
  const histText = history
    .slice(-20)
    .map((h) => `${h.from === 'me' ? '自分' : '相手'}: ${maskPII(String(h.text))}`)
    .join('\n')

  const system =
    'あなたはキャバクラで働くキャストのLINE返信を支援するアシスタントです。' +
    'キャストの口調に寄せ、営業感を出しすぎず、自然で好感度の高い日本語の返信案を作ります。' +
    '出力は必ず次のJSONのみ: {"suggestions":[{"tone":"軽め","text":"..."},{"tone":"標準","text":"..."},{"tone":"丁寧","text":"..."}]}'
  const user =
    `お客様: ${name || '（不明）'}\n口調ヒント: ${tone || '（不明）'}\n` +
    `直近エピソード: ${episode || 'なし'}\n過去トーク:\n${histText || 'なし'}\n\n` +
    `相手の最新メッセージ:\n${latest}\n\n軽め/標準/丁寧の3案をJSONで。`

  const text = await callClaude({ apiKey, system, user, effort: 'low', maxTokens: 1024 })
  return extractJson<{ suggestions: { tone: string; text: string }[] }>(text)
}

// F-07 特別連絡
async function handleSpecialContact(apiKey: string, body: any) {
  const name = body?.customerName ? String(body.customerName) : ''
  const reason = String(body?.reason ?? '')
  const hook = body?.hook ? String(body.hook) : ''
  const system =
    'あなたはキャバクラのキャストの「営業じゃない自然な連絡」を1文だけ作るアシスタントです。' +
    '売り込み感を出さず、相手を気にかける自然な一言を作ります。出力はJSONのみ: {"text":"..."}'
  const user = `お客様: ${name || '（不明）'}\n連絡理由: ${reason}\nフック: ${hook || 'なし'}\n\n自然な一言をJSONで。`
  const text = await callClaude({ apiKey, system, user, effort: 'low', maxTokens: 400 })
  return extractJson<{ text: string }>(text)
}

// F-08 黒服相談
async function handleConsult(apiKey: string, body: any) {
  const latest = maskPII(String(body?.latest ?? ''))
  const history: { role: string; text: string }[] = Array.isArray(body?.history) ? body.history : []
  const histText = history
    .slice(-20)
    .map((h) => `${h.role === 'user' ? 'キャスト' : '黒服'}: ${maskPII(String(h.text))}`)
    .join('\n')
  const system =
    'あなたは経験豊富で口の堅い「黒服」として、キャバクラのキャストの相談に乗るAIです。' +
    '説教せず、まず傾聴し、実務的で温かいアドバイスをします。' +
    'ストーカー/脅迫→警察相談(#9110・緊急は110)と店への報告を促す。' +
    '売掛/詐欺→証拠保全と店/警察相談の手順。メンタル不調→無理させず公的窓口案内。' +
    '出力はJSONのみ: {"text":"返答","category":"愚痴|ストーカー|売掛詐欺|メンタル","escalate":"police|store|window"}（escalateは該当時のみ）'
  const user = `これまでの会話:\n${histText || 'なし'}\n\nキャストの最新メッセージ:\n${latest}\n\n黒服として返答をJSONで。`
  const text = await callClaude({ apiKey, system, user, effort: 'medium', maxTokens: 800 })
  return extractJson<{ text: string; category?: string; escalate?: string }>(text)
}

// F-14 占い・相性診断（断言型ペルソナ）
async function handleCompatibility(apiKey: string, body: any) {
  const persona = String(body?.persona ?? 'assertive_saiki')
  const rels: string[] = Array.isArray(body?.relationshipTypes) ? body.relationshipTypes : ['恋愛']
  const self = body?.self ?? {}
  const partner = body?.partner ?? {}
  const fmt = (p: any) =>
    `生年月日ms:${p?.birthdayMs ?? '不明'} 血液型:${p?.bloodType ?? '不明'} 傾向:${p?.traits ?? '不明'}`
  const system =
    'あなたは「細木数子」を彷彿とさせる断言型の占術家です。四柱推命・五行の相生相剋・宿命・性格分析を組み合わせ、' +
    'ズバズバ言い切りつつ最後は前向きに導きます。いい面も悪い面も忖度なく。' +
    '出力はJSONのみ: {"rankResult":"S|A|B|C|D","scoresByRelationship":[{"type":"..","score":0,"reason":".."}],' +
    '"summary":"総評","cautionCandidates":["気をつけること",..]}'
  const user =
    `自分: ${fmt(self)}\n相手: ${fmt(partner)}\n関係性: ${rels.join('、')}\nペルソナ: ${persona}\n\n` +
    `関係性ごとにscore(0-100)とreason、総合rankResult(S〜D)、summary、cautionCandidates(4〜6件)をJSONで。`
  const text = await callClaude({ apiKey, system, user, effort: 'high', maxTokens: 1500 })
  return extractJson<{
    rankResult: string
    scoresByRelationship: { type: string; score: number; reason: string }[]
    summary: string
    cautionCandidates: string[]
  }>(text)
}

// =====================================================================
// risk-recalc（F-02）: 来店の作成/更新/削除で顧客の集計とリスクを再計算
// クライアント側スタンドインを置き換えるサーバ権威版（DB設計6章）。
// =====================================================================
export const riskRecalc = onDocumentWritten(
  'users/{uid}/customers/{cid}/visits/{vid}',
  async (event) => {
    const { uid, cid } = event.params as { uid: string; cid: string }
    const db = getFirestore()
    const custRef = db.doc(`users/${uid}/customers/${cid}`)
    const [custSnap, visitsSnap] = await Promise.all([
      custRef.get(),
      db.collection(`users/${uid}/customers/${cid}/visits`).get(),
    ])
    if (!custSnap.exists) return
    const cust = custSnap.data() ?? {}
    const visits = visitsSnap.docs.map((d) => d.data())
    const totalSpent = visits.reduce((s, v) => s + (v.amount || 0), 0)
    let lastVisitMs = 0
    for (const v of visits) {
      const ms = (v.date as Timestamp | undefined)?.toMillis?.() ?? 0
      if (ms > lastVisitMs) lastVisitMs = ms
    }
    const risk = computeRisk(
      {
        occupation: cust.occupation,
        incomeRange: cust.incomeRange,
        realName: cust.realName,
        lineName: cust.lineName,
        visits: visits.map((v) => ({
          dateMs: (v.date as Timestamp | undefined)?.toMillis?.() ?? 0,
          amount: v.amount || 0,
          payment: v.payment,
          urikakePaid: v.urikakePaid,
        })),
      },
      Date.now(),
    )
    await custRef.update({
      totalSpent,
      visitCount: visits.length,
      lastVisitAt: lastVisitMs > 0 ? Timestamp.fromMillis(lastVisitMs) : null,
      riskScore: risk.score,
      riskFlags: risk.flags,
      updatedAt: Timestamp.now(),
    })
  },
)
