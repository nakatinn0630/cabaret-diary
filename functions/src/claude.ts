import Anthropic from '@anthropic-ai/sdk'

// Claude 呼び出しヘルパ。model=claude-opus-4-8 / adaptive thinking / effort でコスト調整。
export async function callClaude(opts: {
  apiKey: string
  system: string
  user: string
  effort?: 'low' | 'medium' | 'high'
  maxTokens?: number
}): Promise<string> {
  const client = new Anthropic({ apiKey: opts.apiKey })
  // output_config はモデル/SDKバージョン差を吸収するため any 経由で渡す
  const res = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: opts.maxTokens ?? 1024,
    thinking: { type: 'adaptive' },
    output_config: { effort: opts.effort ?? 'low' },
    system: opts.system,
    messages: [{ role: 'user', content: opts.user }],
  } as unknown as Anthropic.MessageCreateParamsNonStreaming)
  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim()
}

/** モデル出力から最初のJSON（オブジェクト/配列）を取り出してパースする */
export function extractJson<T>(text: string): T {
  const start = text.search(/[[{]/)
  if (start === -1) throw new Error('JSONが見つかりません')
  const open = text[start]
  const close = open === '{' ? '}' : ']'
  let depth = 0
  for (let i = start; i < text.length; i++) {
    if (text[i] === open) depth++
    else if (text[i] === close) {
      depth--
      if (depth === 0) return JSON.parse(text.slice(start, i + 1)) as T
    }
  }
  throw new Error('JSONの終端が見つかりません')
}

/** SEC-10: 送信前の軽量マスキング（電話番号など） */
export function maskPII(text: string): string {
  return (text ?? '').replace(/\d[\d\- ]{8,}\d/g, '[電話番号]')
}
