import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useCustomers } from '../../lib/customers'
import { diagnoseCompatibility, type CompatResult } from '../../lib/ai'
import { saveDiagnosis, setPinnedCautions } from '../../lib/compatibility'
import type { RelationshipType } from '../../types'

const inputCls =
  'w-full rounded-lg border border-black/10 bg-black/5 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gold/50 dark:border-white/10 dark:bg-white/5'

const RELATIONSHIPS: RelationshipType[] = ['友人', '仕事', '恋愛', '客', '家族その他']

export default function Compatibility() {
  const [params] = useSearchParams()
  const cid = params.get('cid') ?? ''
  const { customers } = useCustomers()
  const customer = customers.find((c) => c.id === cid)

  const partnerBirthdayDefault = useMemo(() => {
    const ms = customer?.fortune?.birthday?.toMillis?.()
    return ms ? new Date(ms).toISOString().slice(0, 10) : ''
  }, [customer])

  const [selfBday, setSelfBday] = useState('')
  const [partnerBday, setPartnerBday] = useState(partnerBirthdayDefault)
  const [rels, setRels] = useState<RelationshipType[]>(['恋愛', '友人'])
  const [result, setResult] = useState<CompatResult | null>(null)
  const [pinned, setPinned] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)

  const toggleRel = (r: RelationshipType) =>
    setRels((cur) => (cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]))
  const togglePin = (c: string) =>
    setPinned((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]))

  const run = async () => {
    if (rels.length === 0) return
    setBusy(true)
    setSaved(false)
    try {
      const res = await diagnoseCompatibility({
        self: { birthdayMs: selfBday ? new Date(selfBday).getTime() : undefined },
        partner: { birthdayMs: partnerBday ? new Date(partnerBday).getTime() : undefined },
        relationshipTypes: rels,
        persona: 'assertive_saiki',
      })
      setResult(res)
      setPinned([])
    } finally {
      setBusy(false)
    }
  }

  const save = async () => {
    if (!cid || !result) return
    await saveDiagnosis(cid, {
      relationshipTypes: rels,
      persona: 'assertive_saiki',
      methods: ['四柱推命', '五行'],
      rankResult: result.rankResult,
      scoresByRelationship: result.scoresByRelationship as {
        type: RelationshipType
        score: number
        reason: string
      }[],
      summary: result.summary,
      cautionCandidates: result.cautionCandidates,
      pinnedCautions: pinned,
    })
    await setPinnedCautions(cid, pinned)
    setSaved(true)
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="safe-top sticky top-0 z-10 flex items-center justify-between border-b border-black/10 bg-white/90 px-4 pb-3 backdrop-blur dark:border-white/10 dark:bg-night/90">
        <Link to={cid ? `/customers/${cid}` : '/customers'} className="text-sm text-black/60 dark:text-white/60">
          ← 戻る
        </Link>
        <h1 className="text-base font-bold">占い・相性診断</h1>
        <span className="w-8" />
      </header>

      <div className="flex-1 space-y-4 p-4">
        {customer && <p className="text-sm text-black/60 dark:text-white/60">お相手: {customer.nickname}</p>}

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-black/60 dark:text-white/60">自分の誕生日</span>
            <input type="date" value={selfBday} onChange={(e) => setSelfBday(e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-black/60 dark:text-white/60">相手の誕生日（任意）</span>
            <input type="date" value={partnerBday} onChange={(e) => setPartnerBday(e.target.value)} className={inputCls} />
          </label>
        </div>

        <div>
          <span className="mb-1 block text-xs font-semibold text-black/60 dark:text-white/60">関係性（選択式）</span>
          <div className="flex flex-wrap gap-2">
            {RELATIONSHIPS.map((r) => (
              <button
                key={r}
                onClick={() => toggleRel(r)}
                className={`rounded-full px-3 py-1 text-sm ${
                  rels.includes(r)
                    ? 'bg-gold text-night font-bold'
                    : 'border border-black/15 dark:border-white/20'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => void run()}
          disabled={busy || rels.length === 0}
          className="w-full rounded-lg bg-gold py-3 text-sm font-bold text-night disabled:opacity-60"
        >
          {busy ? '占い中…' : '🔮 占う'}
        </button>

        {result && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-night p-4 text-white">
              <div className="flex items-center gap-3">
                <span className="text-3xl font-bold text-gold">{result.rankResult}</span>
                <span className="text-xs text-white/70">相性ランク</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-white/90">{result.summary}</p>
            </div>

            <div className="space-y-2">
              {result.scoresByRelationship.map((s) => (
                <div key={s.type} className="rounded-xl border border-black/10 p-3 dark:border-white/10">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{s.type}</span>
                    <span className="font-bold tabular-nums text-gold">{s.score}点</span>
                  </div>
                  <p className="mt-0.5 text-xs text-black/60 dark:text-white/60">{s.reason}</p>
                </div>
              ))}
            </div>

            <section className="rounded-2xl border border-black/10 p-4 dark:border-white/10">
              <h2 className="text-sm font-semibold">気をつけること（選んで保存）</h2>
              <ul className="mt-2 space-y-1.5">
                {result.cautionCandidates.map((c) => (
                  <li key={c}>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={pinned.includes(c)} onChange={() => togglePin(c)} />
                      {c}
                    </label>
                  </li>
                ))}
              </ul>
              {cid && (
                <button
                  onClick={() => void save()}
                  className="mt-3 w-full rounded-lg bg-gold py-2.5 text-sm font-bold text-night"
                >
                  {saved ? '保存しました' : '選んだ注意点を顧客に保存'}
                </button>
              )}
            </section>

            {result.source === 'local' && (
              <p className="text-[11px] text-black/40 dark:text-white/40">
                ※ AIプロキシ未設定のため簡易診断です（本番は占いエンジン/Claude 経由）。
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
