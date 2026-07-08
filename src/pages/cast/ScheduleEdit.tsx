import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Timestamp } from 'firebase/firestore'
import { useAuth } from '../../contexts/AuthContext'
import { useCustomers } from '../../lib/customers'
import {
  createSchedule,
  setGoogleEventId,
  updateSchedule,
  useSchedules,
  SCHEDULE_LABEL,
} from '../../lib/schedules'
import { ensureCabaageCalendar, upsertEvent } from '../../lib/gcal'
import type { ScheduleType } from '../../types'

const inputCls =
  'w-full rounded-lg border border-black/10 bg-black/5 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gold/50 dark:border-white/10 dark:bg-white/5'

const TYPES: ScheduleType[] = ['shift', 'dohan', 'after', 'appointment']

function toDateInput(t: Timestamp): string {
  const d = t.toDate()
  return d.toISOString().slice(0, 10)
}
function toTimeInput(t: Timestamp): string {
  const d = t.toDate()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function ScheduleEdit() {
  const { sid } = useParams<{ sid: string }>()
  const editing = Boolean(sid)
  const navigate = useNavigate()
  const { googleAccessToken } = useAuth()
  const { customers } = useCustomers()
  const { schedules } = useSchedules()
  const existing = useMemo(() => schedules.find((s) => s.id === sid), [schedules, sid])

  const now = new Date()
  const [type, setType] = useState<ScheduleType>('shift')
  const [customerId, setCustomerId] = useState('')
  const [date, setDate] = useState(now.toISOString().slice(0, 10))
  const [startTime, setStartTime] = useState('20:00')
  const [endTime, setEndTime] = useState('23:00')
  const [memo, setMemo] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [syncWarn, setSyncWarn] = useState<string | null>(null)

  useEffect(() => {
    if (editing && existing) {
      setType(existing.type)
      setCustomerId(existing.customerId ?? '')
      setDate(toDateInput(existing.start))
      setStartTime(toTimeInput(existing.start))
      setEndTime(toTimeInput(existing.end))
      setMemo(existing.memo ?? '')
    }
  }, [editing, existing])

  const needsCustomer = type === 'dohan' || type === 'after'

  const submit = async () => {
    setError(null)
    setSyncWarn(null)
    const startMs = new Date(`${date}T${startTime}`).getTime()
    let endMs = new Date(`${date}T${endTime}`).getTime()
    if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
      setError('日時を正しく入力してください。')
      return
    }
    if (endMs <= startMs) endMs += 24 * 60 * 60 * 1000 // 日跨ぎ（アフター等）

    const input = {
      type,
      customerId: customerId || undefined,
      start: Timestamp.fromMillis(startMs),
      end: Timestamp.fromMillis(endMs),
      memo: memo.trim() || undefined,
    }

    setSaving(true)
    try {
      const id = editing && sid ? (await updateSchedule(sid, input), sid) : await createSchedule(input)

      // F-04 Googleカレンダー同期（best-effort）
      if (googleAccessToken) {
        try {
          const customerName = customers.find((c) => c.id === customerId)?.nickname
          const calId = await ensureCabaageCalendar(googleAccessToken)
          const eventId = await upsertEvent(
            googleAccessToken,
            calId,
            { type, startMs, endMs, memo: input.memo, customerName },
            existing?.googleEventId ?? undefined,
          )
          await setGoogleEventId(id, eventId)
        } catch {
          setSyncWarn('保存はできましたが、Googleカレンダー同期に失敗しました（予定一覧から再連携できます）。')
        }
      }

      if (!syncWarn) navigate('/schedule')
      else setSaving(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存に失敗しました。')
      setSaving(false)
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="safe-top sticky top-0 z-10 flex items-center justify-between border-b border-black/10 bg-white/90 px-4 pb-3 backdrop-blur dark:border-white/10 dark:bg-night/90">
        <Link to="/schedule" className="text-sm text-black/60 dark:text-white/60">
          ← 予定
        </Link>
        <h1 className="text-base font-bold">{editing ? '予定を編集' : '予定を追加'}</h1>
        <span className="w-8" />
      </header>

      <div className="flex-1 space-y-3 p-4">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-black/60 dark:text-white/60">種別</span>
          <select value={type} onChange={(e) => setType(e.target.value as ScheduleType)} className={inputCls}>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {SCHEDULE_LABEL[t]}
              </option>
            ))}
          </select>
        </label>

        {needsCustomer && (
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-black/60 dark:text-white/60">お客様</span>
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={inputCls}>
              <option value="">（未選択）</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nickname}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-black/60 dark:text-white/60">日付</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-black/60 dark:text-white/60">開始</span>
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-black/60 dark:text-white/60">終了</span>
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputCls} />
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-black/60 dark:text-white/60">メモ</span>
          <textarea value={memo} onChange={(e) => setMemo(e.target.value)} rows={2} className={inputCls} />
        </label>

        {!googleAccessToken && (
          <p className="text-[11px] text-black/40 dark:text-white/40">
            ※ Googleカレンダー未連携です。予定一覧の「カレンダー連携」から連携すると自動同期されます。
          </p>
        )}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {syncWarn && <p className="text-sm text-amber-600 dark:text-amber-400">{syncWarn}</p>}

        <button
          onClick={() => void submit()}
          disabled={saving}
          className="mt-2 w-full rounded-lg bg-gold py-3 text-sm font-bold text-night disabled:opacity-60"
        >
          {saving ? '保存中…' : editing ? '更新する' : '追加する'}
        </button>
        {syncWarn && (
          <button onClick={() => navigate('/schedule')} className="w-full py-2 text-sm text-black/60 dark:text-white/60">
            予定一覧へ戻る
          </button>
        )}
      </div>
    </div>
  )
}
