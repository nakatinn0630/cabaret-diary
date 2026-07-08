// F-05 LINEトーク履歴（txtエクスポート）のパーサ（純粋関数）。
// LINEの「トーク履歴を送信」テキストを解析し、メッセージ列と口調分析を得る。

export interface ParsedMessage {
  tsMs?: number
  sender: string
  text: string
}

export interface ParsedLine {
  messages: ParsedMessage[]
  senders: string[]
}

const DATE_RE = /^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})/ // 2024/01/02(火) 等
const MSG_RE = /^(\d{1,2}):(\d{2})\t([^\t]+)\t(.*)$/ // HH:MM\t送信者\t本文

export function parseLineExport(raw: string): ParsedLine {
  const lines = raw.replace(/\r\n?/g, '\n').split('\n')
  const messages: ParsedMessage[] = []
  const senders = new Set<string>()
  let curDate: { y: number; m: number; d: number } | undefined

  for (const line of lines) {
    const dm = line.match(DATE_RE)
    if (dm) {
      curDate = { y: +dm[1], m: +dm[2], d: +dm[3] }
      continue
    }
    const mm = line.match(MSG_RE)
    if (mm) {
      const [, hh, min, sender, text] = mm
      let tsMs: number | undefined
      if (curDate) tsMs = new Date(curDate.y, curDate.m - 1, curDate.d, +hh, +min).getTime()
      messages.push({ tsMs, sender: sender.trim(), text })
      senders.add(sender.trim())
    } else if (messages.length > 0 && line.length > 0 && !DATE_RE.test(line)) {
      // タイムスタンプ無し＝直前メッセージの複数行継続
      messages[messages.length - 1].text += '\n' + line
    }
  }
  return { messages, senders: [...senders] }
}

const EMOJI_RE = /\p{Extended_Pictographic}/u

export interface ToneStats {
  emojiRate: number
  avgLen: number
  tone: string
}

/** 自分（myName）のメッセージから口調を分析（F-06のプロンプト注入用） */
export function analyzeTone(messages: ParsedMessage[], myName: string): ToneStats {
  const mine = messages.filter((m) => m.sender === myName)
  if (mine.length === 0) return { emojiRate: 0, avgLen: 0, tone: '不明' }
  const withEmoji = mine.filter((m) => EMOJI_RE.test(m.text)).length
  const emojiRate = withEmoji / mine.length
  const avgLen = Math.round(mine.reduce((s, m) => s + m.text.length, 0) / mine.length)
  const tone = `${emojiRate >= 0.5 ? '絵文字多め' : '絵文字控えめ'}・${avgLen < 15 ? '短文' : '標準文'}`
  return { emojiRate: Math.round(emojiRate * 100) / 100, avgLen, tone }
}
