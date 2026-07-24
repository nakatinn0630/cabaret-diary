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

// F-05b LINE等から貼り付けた自由文を「予定」に解析する（純粋関数）。
// 例: 「駒井さん・漣さんとセミナー 7/14(火)19:00-21:00@東京」→ 日付/開始/終了/メモ
export interface ParsedSchedule {
  date?: string // 'YYYY-MM-DD'
  startTime?: string // 'HH:MM'
  endTime?: string // 'HH:MM'
  memo: string
}

export function parseScheduleText(raw: string, nowMs: number = Date.now()): ParsedSchedule {
  const text = raw.trim()
  const now = new Date(nowMs)
  const pad = (n: number) => String(n).padStart(2, '0')

  // --- 日付 ---
  let date: string | undefined
  let dm = text.match(/(\d{4})\s*[/.\-年]\s*(\d{1,2})\s*[/.\-月]\s*(\d{1,2})/)
  if (dm) {
    date = `${dm[1]}-${pad(+dm[2])}-${pad(+dm[3])}`
  } else {
    dm = text.match(/(\d{1,2})\s*[/.月]\s*(\d{1,2})/) // M/D・M月D日
    if (dm) {
      const mo = +dm[1]
      const d = +dm[2]
      let y = now.getFullYear()
      const today = new Date(y, now.getMonth(), now.getDate()).getTime()
      // 過去日なら翌年扱い（年跨ぎ）
      if (new Date(y, mo - 1, d).getTime() < today - 24 * 60 * 60 * 1000) y += 1
      if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) date = `${y}-${pad(mo)}-${pad(d)}`
    }
  }

  // --- 時刻帯 ---
  let startTime: string | undefined
  let endTime: string | undefined
  // 26時など24以上の表記は time入力に入らないため % 24 で正規化（開始>終了時は保存側で翌日補正）
  let tm = text.match(/(\d{1,2}):(\d{2})\s*[-〜~～–]\s*(\d{1,2}):(\d{2})/)
  if (tm) {
    startTime = `${pad(+tm[1] % 24)}:${tm[2]}`
    endTime = `${pad(+tm[3] % 24)}:${tm[4]}`
  } else if ((tm = text.match(/(\d{1,2})時(?:(\d{1,2})分?)?\s*[-〜~～–]\s*(\d{1,2})時(?:(\d{1,2})分?)?/))) {
    startTime = `${pad(+tm[1] % 24)}:${pad(tm[2] ? +tm[2] : 0)}`
    endTime = `${pad(+tm[3] % 24)}:${pad(tm[4] ? +tm[4] : 0)}`
  } else if ((tm = text.match(/(\d{1,2}):(\d{2})/))) {
    startTime = `${pad(+tm[1] % 24)}:${tm[2]}`
  } else if ((tm = text.match(/(\d{1,2})時(?:(\d{1,2})分?)?/))) {
    startTime = `${pad(+tm[1] % 24)}:${pad(tm[2] ? +tm[2] : 0)}`
  }

  return { date, startTime, endTime, memo: text }
}
