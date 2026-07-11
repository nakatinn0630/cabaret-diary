import { useState } from 'react'
import { Timestamp } from 'firebase/firestore'
import { addVisit } from '../lib/customers'
import { Field, Seg, Toggle, DateSelect, inputCls, subTx, useToast } from './ui'
import type { Bottle, PaymentMethod } from '../types'

const PAY_OPTIONS: { v: PaymentMethod; label: string }[] = [
  { v: 'cash', label: '現金' },
  { v: 'card', label: 'カード' },
  { v: 'urikake', label: '売掛' },
]

// F-03 来店登録（ボトムシート）
export function VisitForm({ cid, onClose }: { cid: string; onClose: () => void }) {
  const toast = useToast()
  const today = new Date().toISOString().slice(0, 10)
  const nowYear = new Date().getFullYear()
  const [date, setDate] = useState(today)
  const [amount, setAmount] = useState(0)
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
    if (amount <= 0) {
      setError('金額を正しく入力してください。')
      return
    }
    setSaving(true)
    try {
      await addVisit(cid, {
        date: Timestamp.fromDate(new Date(date)),
        amount,
        durationMin: durationMin ? Number(durationMin) : undefined,
        payment,
        isDohan,
        isAfter,
        urikakePaid: payment === 'urikake' ? urikakePaid : undefined,
        bottles: bottles.filter((b) => b.name.trim()),
        episodeMemo: episodeMemo.trim() || undefined,
      })
      toast('来店を登録しました ✓')
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存に失敗しました。')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/45" onClick={onClose}>
      <div
        role="dialog"
        aria-label="来店登録"
        onClick={(e) => e.stopPropagation()}
        className="anim-sheet safe-bottom w-full max-w-md max-h-[92vh] overflow-y-auto rounded-t-3xl p-5 space-y-4 bg-[#f7f4fb] text-[#2a2140] dark:bg-[#241a4d] dark:text-[#f3eee4] border-t border-gold/30"
      >
        <div className="w-10 h-1 rounded-full bg-night/20 dark:bg-white/25 mx-auto" aria-hidden="true"></div>
        <p className="font-serif text-[17px] font-bold">来店登録</p>

        <Field label="金額">
          <input
            type="number"
            inputMode="numeric"
            value={amount || ''}
            onChange={(e) => setAmount(Number(e.target.value || 0))}
            placeholder="0"
            className={`${inputCls} !text-[24px] font-serif font-bold text-right`}
          />
        </Field>
        <div className="flex gap-2">
          {[10000, 30000, 50000].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setAmount((a) => a + n)}
              className="flex-1 min-h-[44px] rounded-xl border border-gold/40 text-gold font-bold text-[13px]"
            >
              +{n / 10000}万
            </button>
          ))}
          <button
            type="button"
            onClick={() => setAmount(0)}
            className={`min-h-[44px] px-4 rounded-xl border border-night/15 dark:border-white/20 text-[13px] font-bold ${subTx}`}
          >
            C
          </button>
        </div>

        <Field label="来店日">
          <DateSelect value={date} onChange={setDate} fromYear={nowYear - 2} toYear={nowYear} />
        </Field>
        <Field label="滞在（分）">
          <input
            type="number"
            inputMode="numeric"
            value={durationMin}
            onChange={(e) => setDurationMin(e.target.value)}
            placeholder="90"
            className={inputCls}
          />
        </Field>

        <div className="flex items-center justify-between">
          <span className="text-[14px] font-semibold">🍽️ 同伴あり</span>
          <Toggle on={isDohan} onChange={setIsDohan} label="同伴" />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[14px] font-semibold">🌙 アフターあり</span>
          <Toggle on={isAfter} onChange={setIsAfter} label="アフター" />
        </div>

        <Field label="支払方法">
          <Seg options={PAY_OPTIONS} value={payment} onChange={setPayment} />
        </Field>
        {payment === 'urikake' && (
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-semibold">売掛を回収済み</span>
            <Toggle on={urikakePaid} onChange={setUrikakePaid} label="売掛回収済み" />
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className={`text-[12px] font-semibold ${subTx}`}>卸したボトル</span>
            <button type="button" onClick={addBottle} className="text-[12px] font-bold text-gold">
              ＋ 追加
            </button>
          </div>
          {bottles.map((b, i) => (
            <div key={i} className="flex items-center gap-2">
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
                className={`${inputCls} !w-28`}
              />
              <button
                type="button"
                onClick={() => removeBottle(i)}
                className={subTx}
                aria-label="ボトルを削除"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <Field label="エピソード">
          <textarea
            value={episodeMemo}
            onChange={(e) => setEpisodeMemo(e.target.value)}
            rows={2}
            placeholder="その日の会話・出来事"
            className={inputCls}
          />
        </Field>

        {error && <p className="text-[12px] text-rose font-semibold">{error}</p>}

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-h-[48px] rounded-2xl border border-night/15 dark:border-white/20 font-semibold text-[14px]"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={saving || amount <= 0}
            className="flex-[2] min-h-[48px] rounded-2xl bg-gold text-night font-bold text-[15px] shadow-lg shadow-gold/30 disabled:opacity-40"
          >
            {saving ? '保存中…' : '登録する'}
          </button>
        </div>
      </div>
    </div>
  )
}
