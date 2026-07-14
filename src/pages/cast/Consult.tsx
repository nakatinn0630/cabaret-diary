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

// エスカレーション先の表示。AIは警察へ通報・電話しない。危険時は「人間の担当・店舗へ今すぐ連絡」へ誘導する。
const ESCALATION: Record<
  EscalationTarget,
  { title: string; body: string; action: string; toast: string }
> = {
  urgent: {
    title: '⚠️ 今すぐ担当・お店に連絡を',
    body: 'これは一人で抱えちゃダメなやつ。AIでは守れない。今すぐ担当の黒服かお店に直接連絡して、送り迎えや対応を頼んで。',
    action: '担当・お店に連絡する',
    toast: '担当・お店への連絡導線（デモ）',
  },
  store: {
    title: 'お店に相談を',
    body: 'お金のことは証拠が大事。やり取りのスクショや日時を残して、お店に相談しよう。一人で立て替えないで。',
    action: 'お店に相談する',
    toast: 'お店への相談導線（デモ）',
  },
  window: {
    title: '無理せず、頼っていい',
    body: 'つらい時は無理をしないで。今日はちゃんと休もう。しんどさが続くなら、担当やお店、信頼できる人にも話してみて。',
    action: '担当・お店に相談する',
    toast: '相談導線（デモ）',
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
    } catch (e) {
      toast(e instanceof Error ? e.message : '相談AIに接続できませんでした。時間をおいて再度お試しください。')
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
        title="🤵 AI黒服「クロ」"
        back
        onBack={() => navigate('/')}
        className="!bg-[#241242]/85 !border-white/10"
      />

      {/* 常時表示の注意バナー（AI助言・危険時は人間の担当/店舗へ） */}
      <div className="flex-shrink-0 px-4 py-2 bg-rose/20 border-b border-rose/30 text-[11px] leading-snug text-[#f7c8d6]">
        ⚠️ これはAIによる助言です。<span className="font-bold">やばい・危険と感じたら、AIに頼らず今すぐ担当の黒服／お店に直接連絡してください。</span>
      </div>

      <main className="flex-1 min-h-0 overflow-y-auto px-4 pb-4 space-y-3">
        {messages.length === 0 && (
          <p className="mt-6 text-center text-[13px] leading-relaxed text-white/50">
            よう、俺がAI黒服の「クロ」だ。
            <br />
            接客も売上も、しんどい話も、まず聞くぞ。遠慮するな。
            <br />
            <span className="text-[11px] text-white/35">※相談はこの端末内だけに保存され、店や他の人には見えません（機種変更・キャッシュ削除で消えます）。</span>
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
          placeholder="クロに相談…（例：指名が減った / 出待ちが怖い）"
          aria-label="相談メッセージ"
          className="min-w-0 flex-1 rounded-full px-4 py-3 text-[16px] bg-white/10 border border-white/15 outline-none focus:border-gold placeholder:text-white/30"
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
