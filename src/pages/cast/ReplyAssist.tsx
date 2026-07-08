import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useCustomers, useVisits } from '../../lib/customers'
import { useCustomerImports, createLineImport } from '../../lib/lineImports'
import { parseLineExport, type ParsedLine } from '../../lib/lineParser'
import { generateReplies } from '../../lib/ai'
import type { ReplySuggestion } from '../../types'

const inputCls =
  'w-full rounded-lg border border-black/10 bg-black/5 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gold/50 dark:border-white/10 dark:bg-white/5'

export default function ReplyAssist() {
  const [params, setParams] = useSearchParams()
  const cid = params.get('cid') ?? ''
  const { customers } = useCustomers()
  const { visits } = useVisits(cid || undefined)
  const { imports } = useCustomerImports(cid || undefined)

  const customer = customers.find((c) => c.id === cid)
  const latestImport = imports[0]
  const recentEpisode = visits.find((v) => v.episodeMemo)?.episodeMemo

  const [latestMessage, setLatestMessage] = useState('')
  const [suggestions, setSuggestions] = useState<ReplySuggestion[]>([])
  const [source, setSource] = useState<'proxy' | 'local' | null>(null)
  const [genBusy, setGenBusy] = useState(false)
  const [genErr, setGenErr] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

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
      setCopied(text)
      setTimeout(() => setCopied(null), 1500)
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
      <header className="safe-top sticky top-0 z-10 flex items-center justify-between border-b border-black/10 bg-white/90 px-4 pb-3 backdrop-blur dark:border-white/10 dark:bg-night/90">
        <h1 className="text-lg font-bold">返信アシスト</h1>
        {customer && (
          <Link to={`/customers/${cid}`} className="text-sm text-gold">
            {customer.nickname} →
          </Link>
        )}
      </header>

      <div className="flex-1 space-y-4 p-4">
        {/* 顧客選択 */}
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-black/60 dark:text-white/60">お客様</span>
          <select
            value={cid}
            onChange={(e) => setParams(e.target.value ? { cid: e.target.value } : {})}
            className={inputCls}
          >
            <option value="">（選択してください）</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nickname}
              </option>
            ))}
          </select>
        </label>

        {cid && (
          <>
            {/* 学習ステータス */}
            <div className="flex flex-wrap items-center gap-2 text-xs text-black/50 dark:text-white/50">
              {latestImport ? (
                <span className="rounded-full bg-black/5 px-2 py-0.5 dark:bg-white/10">
                  口調: {latestImport.stats.tone}（{latestImport.messages.length}件学習済み）
                </span>
              ) : (
                <span>トーク未取込</span>
              )}
              <button onClick={() => setShowImport((s) => !s)} className="font-semibold text-gold">
                {showImport ? '取込を閉じる' : 'LINEトークを取込'}
              </button>
            </div>

            {/* F-05 取込フォーム */}
            {showImport && (
              <div className="rounded-xl border border-black/10 p-3 dark:border-white/10">
                <p className="text-xs text-black/60 dark:text-white/60">
                  LINEの「トーク履歴を送信」で書き出したテキストを貼り付け、または .txt を選択してください。
                </p>
                <input
                  type="file"
                  accept=".txt,text/plain"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) f.text().then(setRawText)
                  }}
                  className="mt-2 text-xs"
                />
                <textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  rows={4}
                  placeholder="ここにトーク履歴を貼り付け"
                  className={`mt-2 ${inputCls}`}
                />
                <div className="mt-2 flex items-center gap-2">
                  <button onClick={doParse} className="rounded-lg border border-black/15 px-3 py-1.5 text-sm font-semibold dark:border-white/20">
                    解析
                  </button>
                  {parsed && parsed.messages.length > 0 && (
                    <>
                      <select value={myName} onChange={(e) => setMyName(e.target.value)} className="rounded-lg border border-black/15 bg-transparent px-2 py-1.5 text-sm dark:border-white/20">
                        {parsed.senders.map((s) => (
                          <option key={s} value={s}>
                            自分＝{s}
                          </option>
                        ))}
                      </select>
                      <button onClick={() => void saveImport()} className="rounded-lg bg-gold px-3 py-1.5 text-sm font-bold text-night">
                        保存（{parsed.messages.length}件）
                      </button>
                    </>
                  )}
                </div>
                {importMsg && <p className="mt-2 text-xs text-black/60 dark:text-white/60">{importMsg}</p>}
              </div>
            )}

            {/* F-06 返信案生成 */}
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-black/60 dark:text-white/60">相手の最新メッセージ</span>
              <textarea
                value={latestMessage}
                onChange={(e) => setLatestMessage(e.target.value)}
                rows={3}
                placeholder={otherLastMsg ? `（空欄なら取込の最新: ${otherLastMsg.slice(0, 20)}…）` : '相手のメッセージを貼り付け'}
                className={inputCls}
              />
            </label>
            {recentEpisode && (
              <p className="text-[11px] text-black/40 dark:text-white/40">直近エピソード反映: {recentEpisode.slice(0, 30)}</p>
            )}

            <button
              onClick={() => void generate()}
              disabled={genBusy}
              className="w-full rounded-lg bg-gold py-3 text-sm font-bold text-night disabled:opacity-60"
            >
              {genBusy ? '生成中…' : '✨ 返信案を3つ生成'}
            </button>
            {genErr && <p className="text-sm text-red-500">{genErr}</p>}
            {source === 'local' && suggestions.length > 0 && (
              <p className="text-[11px] text-black/40 dark:text-white/40">
                ※ AIプロキシ未設定のため簡易生成です（VITE_AI_PROXY_URL 設定でClaude生成に切替）。
              </p>
            )}

            <div className="space-y-2">
              {suggestions.map((s) => (
                <div key={s.tone} className="rounded-xl border border-black/10 p-3 dark:border-white/10">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[11px] font-bold text-gold">{s.tone}</span>
                    <button onClick={() => void copy(s.text)} className="text-xs font-semibold text-gold">
                      {copied === s.text ? 'コピーしました' : 'コピー'}
                    </button>
                  </div>
                  <p className="whitespace-pre-wrap text-sm">{s.text}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
