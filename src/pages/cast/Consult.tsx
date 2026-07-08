import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  appendMessage,
  createConsultation,
  nowMsg,
  useConsultation,
  useConsultations,
} from '../../lib/consultations'
import { consultKurofuku } from '../../lib/ai'

export default function Consult() {
  const { consultations } = useConsultations()
  const [tid, setTid] = useState<string | undefined>(undefined)
  const effectiveTid = tid ?? consultations[0]?.id
  const active = useConsultation(effectiveTid)
  const messages = active?.messages ?? []

  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  const send = async () => {
    const t = text.trim()
    if (!t || busy) return
    setText('')
    setBusy(true)
    try {
      const history = messages.map((m) => ({ role: m.role, text: m.text }))
      let id = effectiveTid
      if (!id) {
        id = await createConsultation(nowMsg('user', t))
        setTid(id)
      } else {
        await appendMessage(id, nowMsg('user', t))
      }
      const res = await consultKurofuku(history, t)
      await appendMessage(id, nowMsg('assistant', res.text), {
        category: res.category,
        escalatedTo: res.escalate,
      })
    } catch {
      /* best-effort */
    } finally {
      setBusy(false)
    }
  }

  const escalate = active?.escalatedTo

  return (
    <div className="flex min-h-full flex-col bg-[#2a2440] text-white">
      <header className="safe-top sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#2a2440]/95 px-4 pb-3 backdrop-blur">
        <Link to="/" className="text-sm text-white/60">
          ← ホーム
        </Link>
        <span className="flex items-center gap-2 text-sm font-bold">
          <span aria-hidden>🤵</span> 黒服（相談）
        </span>
        <span className="w-12" />
      </header>

      <div className="flex-1 space-y-3 p-4">
        {messages.length === 0 && (
          <p className="mt-6 text-center text-sm text-white/50">
            誰にも言えない悩み、ここで話していいよ。
            <br />
            愚痴でも、トラブルでも、まず聞くからね。
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                m.role === 'user' ? 'bg-gold text-night' : 'bg-white/10'
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}

        {escalate && (
          <div className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-sm">
            {escalate === 'police' && (
              <>
                <p className="font-bold text-amber-300">身の安全を最優先に</p>
                <p className="mt-1 text-white/80">
                  警察相談専用電話 <b>#9110</b>／危険を感じたらすぐ <b>110</b>。お店にも共有を。
                </p>
              </>
            )}
            {escalate === 'store' && (
              <>
                <p className="font-bold text-amber-300">証拠を残して相談を</p>
                <p className="mt-1 text-white/80">
                  やり取りのスクショ・日時を保全。お店/警察への相談手順を一緒に整理しよう。
                </p>
              </>
            )}
            {escalate === 'window' && (
              <>
                <p className="font-bold text-amber-300">無理をしないで</p>
                <p className="mt-1 text-white/80">
                  つらい時は公的な相談窓口も使えます。あなたの味方だよ。
                </p>
              </>
            )}
          </div>
        )}
      </div>

      <div className="safe-bottom sticky bottom-0 flex gap-2 border-t border-white/10 bg-[#2a2440]/95 p-3 backdrop-blur">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void send()
          }}
          placeholder="メッセージを入力"
          className="flex-1 rounded-full bg-white/10 px-4 py-2 text-sm outline-none placeholder:text-white/40"
        />
        <button
          onClick={() => void send()}
          disabled={busy}
          className="rounded-full bg-gold px-4 py-2 text-sm font-bold text-night disabled:opacity-60"
        >
          {busy ? '…' : '送信'}
        </button>
      </div>
    </div>
  )
}
