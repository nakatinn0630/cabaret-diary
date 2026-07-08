import { useState } from 'react'
import { Timestamp } from 'firebase/firestore'
import { addVisit } from '../lib/customers'
import type { Bottle, PaymentMethod } from '../types'

// F-03 来店登録フォーム（モーダル）
export function VisitForm({ cid, onClose }: { cid: string; onClose: () => void }) {
  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(today)
  const [amount, setAmount] = useState('')
  const [durationMin, setDurationMin] = useState('')
  const [payment, setPayment] = useState<PaymentMethod>('card')
  const [isDohan, setIsDohan] = useState(false)
  const [isAfter, setIsAfter] = useState(false)
  const [urikakePaid, setUrikakePaid] = useState(false)
  const [bottles, setBottles] = useState<Bottle[]>([])
  const [episodeMemo, setEpisodeMemo] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addBottle = () => setBottles((b) => [...b, { name: '', price: 0 }])
  const setBottle = (i: number, patch: Partial<Bottle>) =>
    setBottles((b) => b.map((x, idx) => (idx === i ? { ...x, ...patch } : x)))
  const removeBottle = (i: number) => setBottles((b) => b.filter((_, idx) => idx !== i))

  const submit = async () => {
    setError(null)
    const amt = Number(amount)
    if (!amount || Number.isNaN(amt) || amt < 0) {
      setError('金額を正しく入力してください。')
      return
    }
    setSaving(true)
    try {
      await addVisit(cid, {
        date: Timestamp.fromDate(new Date(date)),
        amount: amt,
        durationMin: durationMin ? Number(durationMin) : undefined,
        payment,
        isDohan,
        isAfter,
        urikakePaid: payment === 'urikake' ? urikakePaid : undefined,
        bottles: bottles.filter((b) => b.name.trim()),
        episodeMemo: episodeMemo.trim() || undefined,
      })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存に失敗しました。')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        className="safe-bottom max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-4 dark:bg-night sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-bold">来店を登録</h2>

        <div className="mt-3 space-y-3">
          <Row label="来店日">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          </Row>
          <Row label="金額（円）">
            <input
              type="number"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="50000"
              className={inputCls}
            />
          </Row>
          <Row label="滞在（分）">
            <input
              type="number"
              inputMode="numeric"
              value={durationMin}
              onChange={(e) => setDurationMin(e.target.value)}
              placeholder="90"
              className={inputCls}
            />
          </Row>
          <Row label="支払方法">
            <select value={payment} onChange={(e) => setPayment(e.target.value as PaymentMethod)} className={inputCls}>
              <option value="card">カード</option>
              <option value="cash">現金</option>
              <option value="urikake">売掛</option>
            </select>
          </Row>

          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={isDohan} onChange={(e) => setIsDohan(e.target.checked)} /> 同伴
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={isAfter} onChange={(e) => setIsAfter(e.target.checked)} /> アフター
            </label>
            {payment === 'urikake' && (
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={urikakePaid} onChange={(e) => setUrikakePaid(e.target.checked)} /> 売掛回収済み
              </label>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-black/60 dark:text-white/60">卸したボトル</span>
              <button type="button" onClick={addBottle} className="text-xs font-semibold text-gold">
                ＋ 追加
              </button>
            </div>
            {bottles.map((b, i) => (
              <div key={i} className="mt-2 flex items-center gap-2">
                <input
                  value={b.name}
                  onChange={(e) => setBottle(i, { name: e.target.value })}
                  placeholder="ボトル名"
                  className={inputCls}
                />
                <input
                  type="number"
                  value={b.price || ''}
                  onChange={(e) => setBottle(i, { price: Number(e.target.value) })}
                  placeholder="価格"
                  className="w-28 rounded-lg border border-black/10 bg-black/5 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
                />
                <button type="button" onClick={() => removeBottle(i)} className="text-black/40 dark:text-white/40">
                  ✕
                </button>
              </div>
            ))}
          </div>

          <Row label="エピソード">
            <textarea
              value={episodeMemo}
              onChange={(e) => setEpisodeMemo(e.target.value)}
              rows={2}
              placeholder="その日の会話・出来事"
              className={inputCls}
            />
          </Row>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        <div className="mt-4 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-lg border border-black/15 py-2.5 text-sm font-semibold dark:border-white/20">
            キャンセル
          </button>
          <button
            onClick={() => void submit()}
            disabled={saving}
            className="flex-1 rounded-lg bg-gold py-2.5 text-sm font-bold text-night disabled:opacity-60"
          >
            {saving ? '保存中…' : '登録'}
          </button>
        </div>
      </div>
    </div>
  )
}

const inputCls =
  'w-full rounded-lg border border-black/10 bg-black/5 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gold/50 dark:border-white/10 dark:bg-white/5'

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-black/60 dark:text-white/60">{label}</span>
      {children}
    </label>
  )
}
