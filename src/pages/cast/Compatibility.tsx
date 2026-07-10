import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useCustomers } from '../../lib/customers'
import { diagnoseCompatibility, type CompatResult } from '../../lib/ai'
import { saveDiagnosis, setPinnedCautions } from '../../lib/compatibility'
import { useProfileSettings, saveProfileSettings } from '../../lib/sales'
import { Card, SectionTitle, Header, Main, Field, MultiPill, inputCls, goldTx, subTx, useToast } from '../../components/ui'
import type { RelationshipType } from '../../types'

const RELATIONSHIPS: RelationshipType[] = ['友人', '仕事', '恋愛', '客', '家族その他']
const REL_OPTIONS = RELATIONSHIPS.map((r) => ({ v: r, label: r }))

export default function Compatibility() {
  const navigate = useNavigate()
  const toast = useToast()
  const [params] = useSearchParams()
  const cid = params.get('cid') ?? ''
  const { customers } = useCustomers()
  const customer = customers.find((c) => c.id === cid)

  const partnerBirthdayDefault = useMemo(() => {
    const ms = customer?.fortune?.birthday?.toMillis?.()
    return ms ? new Date(ms).toISOString().slice(0, 10) : ''
  }, [customer])

  // 自分の誕生日は毎回入力せず、プロフィール設定から復元・保存する
  const { settings } = useProfileSettings()
  const [selfBday, setSelfBday] = useState('')
  useEffect(() => {
    if (settings.birthday) setSelfBday((cur) => cur || settings.birthday || '')
  }, [settings.birthday])
  const [partnerBday, setPartnerBday] = useState(partnerBirthdayDefault)
  // 顧客が後から読み込まれたら相手の誕生日を自動反映（未入力時のみ）
  useEffect(() => {
    if (partnerBirthdayDefault) setPartnerBday((cur) => cur || partnerBirthdayDefault)
  }, [partnerBirthdayDefault])
  const [rels, setRels] = useState<RelationshipType[]>(['恋愛', '友人'])
  const [result, setResult] = useState<CompatResult | null>(null)
  const [pinned, setPinned] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  // 保存先顧客（cidクエリを初期選択として保持しつつ切替可能）
  const [saveTo, setSaveTo] = useState(cid)

  const toggleRel = (r: RelationshipType) =>
    setRels((cur) => (cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]))
  const togglePin = (c: string) =>
    setPinned((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]))

  const avgScore = result
    ? Math.round(result.scoresByRelationship.reduce((s, x) => s + x.score, 0) / Math.max(1, result.scoresByRelationship.length))
    : 0

  const run = async () => {
    if (rels.length === 0) return
    setBusy(true)
    setSaved(false)
    // 自分の誕生日を保存（次回以降は自動入力）
    if (selfBday && selfBday !== settings.birthday) {
      void saveProfileSettings({ birthday: selfBday })
    }
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
    if (!saveTo || !result) return
    await saveDiagnosis(saveTo, {
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
    await setPinnedCautions(saveTo, pinned)
    setSaved(true)
    toast('顧客に保存しました ✓')
  }

  return (
    <div className="flex h-full flex-col">
      <Header title="🔮 占い・相性診断" back onBack={() => navigate(cid ? `/customers/${cid}` : '/customers')} />

      <Main>
        {customer && <p className={`text-[13px] ${subTx}`}>お相手: {customer.nickname}</p>}

        <div className="grid grid-cols-2 gap-3">
          <Field label="自分の誕生日">
            <input type="date" value={selfBday} onChange={(e) => setSelfBday(e.target.value)} className={inputCls} />
          </Field>
          <Field label="相手の誕生日（任意）">
            <input type="date" value={partnerBday} onChange={(e) => setPartnerBday(e.target.value)} className={inputCls} />
          </Field>
        </div>

        <Field label="関係性（複数選択）">
          <MultiPill options={REL_OPTIONS} values={rels} onToggle={toggleRel} />
        </Field>

        <button
          type="button"
          onClick={() => void run()}
          disabled={busy || rels.length === 0}
          className="w-full min-h-[50px] rounded-2xl bg-gradient-to-r from-gold to-rose text-night font-bold text-[15px] shadow-lg disabled:opacity-60"
        >
          {busy ? '占い中…' : '診断する ✨'}
        </button>

        {result && (
          <>
            {/* 相性ランク（明朝の大文字・グラデーション） */}
            <Card className="p-5 text-center space-y-1">
              <p className={`text-[11px] tracking-[0.2em] ${subTx}`}>相性ランク</p>
              <p className="font-serif text-[56px] font-bold leading-none bg-gradient-to-br from-[#e8c97e] via-gold to-rose bg-clip-text text-transparent">
                {result.rankResult}
              </p>
              <p className={`text-[12px] ${subTx}`}>総合スコア {avgScore}/100</p>
            </Card>

            {/* 関係性別スコア + 総評 */}
            <Card className="p-4 space-y-3">
              {result.scoresByRelationship.map((s) => (
                <div key={s.type} className="space-y-1">
                  <div className="flex justify-between text-[12px]">
                    <span className="font-semibold">{s.type}</span>
                    <span className={goldTx}>{s.score}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-night/10 dark:bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-gold to-rose"
                      style={{ width: `${Math.max(0, Math.min(100, s.score))}%` }}
                    />
                  </div>
                  <p className={`text-[11px] break-words ${subTx}`}>{s.reason}</p>
                </div>
              ))}
              <p className="text-[13px] leading-relaxed pt-1 whitespace-pre-wrap break-words">{result.summary}</p>
            </Card>

            {/* 注意点チェック */}
            <Card className="p-4 space-y-2">
              <SectionTitle>注意点チェック（選んで保存）</SectionTitle>
              {result.cautionCandidates.map((c) => (
                <label key={c} className="flex items-center gap-2.5 text-[13px] min-h-[36px]">
                  <input
                    type="checkbox"
                    className="accent-[#c9a24b]"
                    style={{ width: 18, height: 18 }}
                    checked={pinned.includes(c)}
                    onChange={() => togglePin(c)}
                  />
                  {c}
                </label>
              ))}
            </Card>

            {/* 保存先顧客ピッカー */}
            <Field label="この結果を顧客に保存">
              {customers.length === 0 ? (
                <p className={`text-[13px] ${subTx}`}>先に顧客を登録してください。</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {customers.map((x) => (
                    <button
                      key={x.id}
                      type="button"
                      onClick={() => setSaveTo(x.id)}
                      className={`px-4 py-2.5 rounded-full text-[13px] font-semibold border min-h-[44px] ${
                        saveTo === x.id ? 'bg-gold text-night border-gold' : 'border-night/10 dark:border-white/15'
                      }`}
                    >
                      {x.nickname}
                    </button>
                  ))}
                </div>
              )}
            </Field>

            <button
              type="button"
              onClick={() => void save()}
              disabled={!saveTo}
              className="w-full min-h-[48px] rounded-2xl border border-gold/50 text-gold font-bold text-[14px] disabled:opacity-40"
            >
              {saved ? '保存しました ✓' : '顧客に保存する'}
            </button>

            {result.source === 'local' && (
              <p className={`text-[11px] ${subTx}`}>
                ※ AIプロキシ未設定のため簡易診断です（本番は占いエンジン/Claude 経由）。
              </p>
            )}
          </>
        )}
      </Main>
    </div>
  )
}
