import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useCustomers, useVisits } from '../../lib/customers'
import { useCustomerImports, createLineImport } from '../../lib/lineImports'
import { parseLineExport, type ParsedLine } from '../../lib/lineParser'
import { generateReplies, type AiSource } from '../../lib/ai'
import type { ReplySuggestion, ReplyTone } from '../../types'
import {
  Card,
  Chip,
  Empty,
  Field,
  Header,
  Main,
  Seg,
  goldTx,
  inputCls,
  subTx,
  useToast,
} from '../../components/ui'

// トーンごとの Chip 配色（軽め=rose / 標準=gold / 丁寧=neutral）
function toneChip(tone: ReplyTone): string {
  if (tone === '軽め')
    return 'font-bold border-[#e6789b]/40 bg-[#e6789b]/10 text-[#a8395c] dark:text-[#f0c3d2]'
  if (tone === '標準') return `font-bold border-gold/40 bg-gold/10 ${goldTx}`
  return 'font-bold border-night/15 dark:border-white/20'
}

export default function ReplyAssist() {
  const [params, setParams] = useSearchParams()
  const cid = params.get('cid') ?? ''
  const { customers } = useCustomers()
  const { visits } = useVisits(cid || undefined)
  const { imports } = useCustomerImports(cid || undefined)
  const toast = useToast()

  const customer = customers.find((c) => c.id === cid)
  const latestImport = imports[0]
  const recentEpisode = visits.find((v) => v.episodeMemo)?.episodeMemo

  const [latestMessage, setLatestMessage] = useState('')
  const [suggestions, setSuggestions] = useState<ReplySuggestion[]>([])
  const [source, setSource] = useState<AiSource | null>(null)
  const [genBusy, setGenBusy] = useState(false)
  const [genErr, setGenErr] = useState<string | null>(null)

  // 取込フォーム
  const [showImport, setShowImport] = useState(false)
  const [rawText, setRawText] = useState('')
  const [parsed, setParsed] = useState<ParsedLine | null>(null)
  const [myName, setMyName] = useState('')
  const [importMsg, setImportMsg] = useState<string | null>(null)

  const otherLastMsg = useMemo(
    () => (latestImport ? [...latestImport.messages].reverse().find((m) => m.from === 'other')?.text : undefined),
    [latestImport],
  )

  const generate = async () => {
    setGenErr(null)
    const msg = latestMessage.trim() || otherLastMsg || ''
    if (!msg) {
      setGenErr('相手の最新メッセージを入力してください。')
      return
    }
    setGenBusy(true)
    try {
      const res = await generateReplies({
        latestMessage: msg,
        customerName: customer?.nickname,
        recentEpisode,
        toneHint: latestImport?.stats.tone,
        history: latestImport?.messages.slice(-20).map((m) => ({ from: m.from, text: m.text })),
      })
      setSuggestions(res.suggestions)
      setSource(res.source)
    } catch (e) {
      setGenErr(e instanceof Error ? e.message : '生成に失敗しました。')
    } finally {
      setGenBusy(false)
    }
  }

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast('コピーしました')
    } catch {
      /* ignore */
    }
  }

  const doParse = () => {
    const p = parseLineExport(rawText)
    setParsed(p)
    setMyName(p.senders[0] ?? '')
    setImportMsg(p.messages.length === 0 ? '解析できるメッセージが見つかりませんでした。' : null)
  }

  const saveImport = async () => {
    if (!cid || !parsed || !myName) return
    await createLineImport({ customerId: cid, myName, parsed })
    setImportMsg('取込を保存しました。口調を学習に反映します。')
    setRawText('')
    setParsed(null)
    setShowImport(false)
  }

  return (
    <div className="flex min-h-full flex-col">
      <Header
        title="返信アシスト"
        right={
          customer ? (
            <Link to={`/customers/${cid}`} className="text-[13px] font-semibold text-gold">
              {customer.nickname} ›
            </Link>
          ) : undefined
        }
      />

      <Main>
        {/* 顧客選択（gold選択のタップピル） */}
        <Field label="顧客を選択">
          {customers.length === 0 ? (
            <Empty>顧客が登録されていません。</Empty>
          ) : (
            <Seg
              options={customers.map((c) => ({ v: c.id, label: c.nickname }))}
              value={cid}
              onChange={(v) => setParams(v ? { cid: v } : {})}
            />
          )}
        </Field>

        {cid && (
          <>
            {/* 学習ステータス */}
            <div className="flex flex-wrap items-center gap-2">
              {latestImport ? (
                <Chip className={`${subTx} border-night/10 dark:border-white/15`}>
                  口調: {latestImport.stats.tone}（{latestImport.messages.length}件学習済み）
                </Chip>
              ) : (
                <span className={`text-[12px] ${subTx}`}>トーク未取込</span>
              )}
              <button
                type="button"
                onClick={() => setShowImport((s) => !s)}
                className="text-[12px] font-bold text-gold px-1 py-1"
              >
                {showImport ? '取込を閉じる' : 'LINEトークを取込'}
              </button>
            </div>

            {/* F-05 取込フォーム */}
            {showImport && (
              <Card className="p-4 space-y-3">
                <p className={`text-[12px] leading-relaxed ${subTx}`}>
                  LINEの「トーク履歴を送信」で書き出したテキストを貼り付け、または .txt を選択してください。
                </p>
                <input
                  type="file"
                  accept=".txt,text/plain"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) f.text().then(setRawText)
                  }}
                  className="text-[12px]"
                />
                <textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  rows={4}
                  placeholder="ここにトーク履歴を貼り付け"
                  className={inputCls}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={doParse}
                    className="rounded-full border border-night/15 dark:border-white/20 px-4 py-2 text-[13px] font-semibold min-h-[40px]"
                  >
                    解析
                  </button>
                  {parsed && parsed.messages.length > 0 && (
                    <>
                      <select
                        value={myName}
                        onChange={(e) => setMyName(e.target.value)}
                        className="rounded-full border border-night/15 dark:border-white/20 bg-transparent px-3 py-2 text-[13px] min-h-[40px]"
                      >
                        {parsed.senders.map((s) => (
                          <option key={s} value={s}>
                            自分＝{s}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => void saveImport()}
                        className="rounded-full bg-gold px-4 py-2 text-[13px] font-bold text-night min-h-[40px]"
                      >
                        保存（{parsed.messages.length}件）
                      </button>
                    </>
                  )}
                </div>
                {importMsg && <p className={`text-[12px] ${subTx}`}>{importMsg}</p>}
              </Card>
            )}

            {/* F-06 返信案生成 */}
            <Field label="相手からのメッセージ">
              <textarea
                value={latestMessage}
                onChange={(e) => setLatestMessage(e.target.value)}
                rows={3}
                placeholder={otherLastMsg ? `（空欄なら取込の最新: ${otherLastMsg.slice(0, 20)}…）` : '「今週行けそう」など、届いたメッセージを貼り付け'}
                className={inputCls}
              />
            </Field>
            {recentEpisode && (
              <p className={`text-[11px] ${subTx}`}>直近エピソード反映: {recentEpisode.slice(0, 30)}</p>
            )}

            <button
              type="button"
              onClick={() => void generate()}
              disabled={genBusy}
              className="w-full min-h-[50px] rounded-2xl bg-gold text-night font-bold text-[15px] shadow-lg shadow-gold/30 disabled:opacity-40"
            >
              {genBusy ? '生成中…' : '3案を作成 ✨'}
            </button>
            {genErr && <p className="text-[13px] font-semibold text-red-400">{genErr}</p>}
            {source === 'local' && suggestions.length > 0 && (
              <p className={`text-[11px] ${subTx}`}>
                ※ AIプロキシ未設定のため簡易生成です（VITE_AI_PROXY_URL 設定でClaude生成に切替）。
              </p>
            )}

            {suggestions.map((s) => (
              <Card key={s.tone} className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <Chip className={toneChip(s.tone)}>{s.tone}</Chip>
                  <button
                    type="button"
                    onClick={() => void copy(s.text)}
                    className="text-[12px] font-bold text-gold px-3 py-2"
                  >
                    コピー
                  </button>
                </div>
                <p className="whitespace-pre-wrap text-[13px] leading-relaxed">{s.text}</p>
              </Card>
            ))}
          </>
        )}
      </Main>
    </div>
  )
}
