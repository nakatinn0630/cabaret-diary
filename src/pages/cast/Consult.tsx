import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  appendMessage,
  createConsultation,
  nowMsg,
  useConsultation,
  useConsultations,
} from '../../lib/consultations'
import { consultKurofuku } from '../../lib/ai'
import type { EscalationTarget } from '../../types'
import { Header, useToast } from '../../components/ui'

// 実データ(ConsultResult/Consultation)のエスカレーション先を、
// モックの rose エスカレーションカード表示にマッピングする。
const ESCALATION: Record<
  EscalationTarget,
  { title: string; body: string; action: string; toast: string }
> = {
  police: {
    title: '警察相談専用ダイヤル #9110',
    body: 'つきまとい・待ち伏せは一人で抱えないで。危険を感じたらすぐ110番。お店にも共有して送り迎えの対策を頼もう。',
    action: '#9110 に相談',
    toast: '相談窓口を開きます（デモ）',
  },
  store: {
    title: '証拠を残して相談を',
    body: 'やり取りのスクショや日時の記録を必ず保全して。その上でお店、必要なら警察への相談手順を一緒に整理しよう。',
    action: '相談手順を見る',
    toast: '相談窓口を開きます（デモ）',
  },
  window: {
    title: '公的な相談窓口',
    body: 'つらい時は無理をしないで。専門の相談窓口も使えます。あなたの味方だよ。',
    action: '相談窓口を見る',
    toast: '相談窓口を開きます（デモ）',
  },
}

export default function Consult() {
  const navigate = useNavigate()
  const toast = useToast()
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
  const card = escalate ? ESCALATION[escalate] : null

  return (
    <div
      className="flex h-full flex-col bg-[#241242]/95 text-[#f3eee4]"
      style={{ colorScheme: 'dark' }}
    >
      <Header
        title="🤵 黒服相談"
        back
        onBack={() => navigate('/')}
        className="!bg-[#241242]/85 !border-white/10"
      />

      <main className="flex-1 min-h-0 overflow-y-auto px-4 pb-4 space-y-3">
        {messages.length === 0 && (
          <p className="mt-6 text-center text-[13px] leading-relaxed text-white/50">
            誰にも言えない悩み、ここで話していいよ。
            <br />
            愚痴でも、トラブルでも、まず聞くからね。
          </p>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <p
              className={`max-w-[80%] whitespace-pre-wrap text-[13px] leading-relaxed px-3.5 py-2.5 rounded-2xl ${
                m.role === 'user' ? 'bg-gold text-night rounded-br-md' : 'bg-white/10 rounded-bl-md'
              }`}
            >
              {m.text}
            </p>
          </div>
        ))}

        {card && (
          <div className="rounded-2xl border border-[#e6789b]/50 bg-[#e6789b]/10 p-3.5 space-y-1.5">
            <p className="text-[13px] font-bold text-[#f0c3d2]">{card.title}</p>
            <p className="text-[12px] leading-relaxed text-white/80">{card.body}</p>
            <button
              type="button"
              onClick={() => toast(card.toast)}
              className="text-[12px] font-bold text-night bg-[#e6789b] rounded-full px-4 py-2 min-h-[36px]"
            >
              {card.action}
            </button>
          </div>
        )}
      </main>

      <div className="safe-bottom sticky bottom-0 flex gap-2 border-t border-white/10 bg-[#241242]/95 px-4 pb-8 pt-2 backdrop-blur">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void send()
          }}
          placeholder="例：出待ちされて怖い / 売掛が…"
          aria-label="相談メッセージ"
          className="flex-1 rounded-full px-4 py-3 text-[14px] bg-white/10 border border-white/15 outline-none focus:border-gold placeholder:text-white/30"
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={busy}
          aria-label="送信"
          className="w-12 h-12 rounded-full bg-gold text-night font-bold disabled:opacity-60 flex-shrink-0"
        >
          {busy ? '…' : '↑'}
        </button>
      </div>
    </div>
  )
}
