import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Customer, Schedule } from '../types'
import { computeSpecialContacts } from '../lib/recommend'
import { generateSpecialContact } from '../lib/ai'
import { Card, subTx, goldTx, useToast } from './ui'

// F-07 「営業じゃない特別な連絡」レコメンド（今日のひとこと連絡）
export function SpecialContacts({
  customers,
  schedules,
}: {
  customers: Customer[]
  schedules: Schedule[]
}) {
  const navigate = useNavigate()
  const toast = useToast()
  const candidates = useMemo(
    () => computeSpecialContacts(customers, schedules).slice(0, 3),
    [customers, schedules],
  )
  const [texts, setTexts] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)

  if (candidates.length === 0) {
    return (
      <Card className="p-4">
        <p className={`text-[12px] leading-relaxed ${subTx}`}>
          今日はおすすめの連絡先はありません。来店や記念日が近づくとここに提案が出ます。
        </p>
      </Card>
    )
  }

  const gen = async (cid: string, name: string, reason: string, hook?: string) => {
    setBusy(cid)
    try {
      const { text } = await generateSpecialContact({ customerName: name, reason, hook })
      setTexts((t) => ({ ...t, [cid]: text }))
    } finally {
      setBusy(null)
    }
  }

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      /* clipboard 権限がなくても失敗させない */
    }
    toast('コピーしました')
  }

  return (
    <Card className="p-4 space-y-3">
      {candidates.map((c, i) => (
        <div
          key={c.customer.id}
          className={i > 0 ? 'border-t border-night/5 pt-3 dark:border-white/10' : ''}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-[13px]">
              <button
                type="button"
                onClick={() => navigate(`/customers/${c.customer.id}`)}
                className="font-semibold"
              >
                {c.customer.nickname}
              </button>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] border border-gold/40 bg-gold/10 ${goldTx}`}
              >
                {c.reason}
              </span>
            </span>
            <button
              type="button"
              onClick={() => void gen(c.customer.id, c.customer.nickname, c.reason, c.hook)}
              disabled={busy === c.customer.id}
              className="text-[12px] font-bold text-gold disabled:opacity-60"
            >
              {busy === c.customer.id ? '生成中…' : texts[c.customer.id] ? '再生成' : '文面を作る'}
            </button>
          </div>
          {texts[c.customer.id] && (
            <div className="mt-2 rounded-xl p-3 bg-night/[0.04] dark:bg-white/[0.05]">
              <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{texts[c.customer.id]}</p>
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => void copy(texts[c.customer.id])}
                  className="text-[12px] font-bold text-gold border border-gold/40 rounded-full px-4 py-1.5"
                >
                  コピーして送る
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </Card>
  )
}
