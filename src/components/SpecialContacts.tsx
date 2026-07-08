import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Customer, Schedule } from '../types'
import { computeSpecialContacts } from '../lib/recommend'
import { generateSpecialContact } from '../lib/ai'

// F-07 「営業じゃない特別な連絡」レコメンド
export function SpecialContacts({
  customers,
  schedules,
}: {
  customers: Customer[]
  schedules: Schedule[]
}) {
  const candidates = useMemo(
    () => computeSpecialContacts(customers, schedules).slice(0, 3),
    [customers, schedules],
  )
  const [texts, setTexts] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  if (candidates.length === 0) return null

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
      setCopied(text)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      /* ignore */
    }
  }

  return (
    <section className="rounded-2xl border border-gold/40 bg-gold/5 p-4">
      <h2 className="text-sm font-semibold">今日のひとこと連絡</h2>
      <p className="mt-0.5 text-[11px] text-black/50 dark:text-white/50">営業色のない自然な連絡の提案（F-07）</p>
      <ul className="mt-3 space-y-3">
        {candidates.map((c) => (
          <li key={c.customer.id} className="border-t border-black/5 pt-3 first:border-0 first:pt-0 dark:border-white/10">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-sm">
                <Link to={`/customers/${c.customer.id}`} className="font-medium">
                  {c.customer.nickname}
                </Link>
                <span className="rounded-full bg-black/5 px-2 py-0.5 text-[11px] text-black/60 dark:bg-white/10 dark:text-white/60">
                  {c.reason}
                </span>
              </span>
              <button
                onClick={() => void gen(c.customer.id, c.customer.nickname, c.reason, c.hook)}
                disabled={busy === c.customer.id}
                className="text-xs font-semibold text-gold disabled:opacity-60"
              >
                {busy === c.customer.id ? '生成中…' : texts[c.customer.id] ? '再生成' : '文面を作る'}
              </button>
            </div>
            {texts[c.customer.id] && (
              <div className="mt-2 rounded-lg bg-white p-2 text-sm dark:bg-white/5">
                <p className="whitespace-pre-wrap">{texts[c.customer.id]}</p>
                <div className="mt-1 flex justify-end gap-3 text-xs">
                  <button onClick={() => void copy(texts[c.customer.id])} className="font-semibold text-gold">
                    {copied === texts[c.customer.id] ? 'コピーしました' : 'コピー'}
                  </button>
                  <Link to={`/reply?cid=${c.customer.id}`} className="text-black/50 dark:text-white/50">
                    返信アシストで開く
                  </Link>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
