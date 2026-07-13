import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
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
import { parseScheduleText } from '../../lib/lineParser'
import { parseScheduleAI } from '../../lib/ai'
import type { ScheduleType } from '../../types'
import { Header, Main, Field, Seg, DateSelect, useToast, inputCls, subTx } from '../../components/ui'

const SCHED_ICON: Record<ScheduleType, string> = {
  shift: '🕘',
  dohan: '🍽️',
  after: '🌙',
  appointment: '📌',
}

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
  const toast = useToast()
  const { googleAccessToken } = useAuth()
  const { customers } = useCustomers()
  const { schedules } = useSchedules()
  const existing = useMemo(() => schedules.find((s) => s.id === sid), [schedules, sid])

  const now = new Date()
  const nowYear = now.getFullYear()
  const [type, setType] = useState<ScheduleType>('shift')
  const [customerId, setCustomerId] = useState('')
  const [date, setDate] = useState(now.toISOString().slice(0, 10))
  const [startTime, setStartTime] = useState('20:00')
  const [endTime, setEndTime] = useState('23:00')
  const [memo, setMemo] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [syncWarn, setSyncWarn] = useState<string | null>(null)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [importing, setImporting] = useState(false)

  // LINE等から貼り付けた文章を解析して日付・時刻・お客様・メモに反映。
  // まずAI（Gemini/Groq等）で構造化を試み、失敗時は正規表現にフォールバック。
  const importFromPaste = async () => {
    const text = pasteText.trim()
    if (!text) return
    setImporting(true)
    let ai = null
    try {
      ai = await parseScheduleAI(text, customers.map((c) => c.nickname))
    } catch {
      ai = null
    }
    const fb = parseScheduleText(text)
    const date = ai?.date ?? fb.date
    const startTime = ai?.startTime ?? fb.startTime
    const endTime = ai?.endTime ?? fb.endTime
    const got: string[] = []
    if (date) {
      setDate(date)
      got.push('日付')
    }
    if (startTime) {
      setStartTime(startTime)
      got.push('開始')
    }
    if (endTime) {
      setEndTime(endTime)
      got.push('終了')
    }
    // お客様のマッチング（AIが名前を返した場合）
    if (ai?.customerName) {
      const n = ai.customerName
      const match = customers.find((c) => c.nickname === n || c.nickname.includes(n) || n.includes(c.nickname))
      if (match) {
        setCustomerId(match.id)
        got.push('お客様')
      }
    }
    setMemo(text)
    setImporting(false)
    setPasteOpen(false)
    toast(
      got.length
        ? `${ai ? 'AIで' : ''}読み込みました（${got.join('・')}）✓`
        : '本文をメモに取り込みました（日付/時刻は手動調整を）',
    )
  }

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

      if (!syncWarn) {
        toast(googleAccessToken ? 'Googleカレンダーに同期しました ✓' : '保存しました ✓')
        navigate('/schedule')
      } else setSaving(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存に失敗しました。')
      setSaving(false)
    }
  }

  return (
    <div className="h-full flex flex-col relative">
      <Header
        title={editing ? '予定を編集' : '予定を追加'}
        back
        onBack={() => navigate('/schedule')}
        right={
          <button
            type="button"
            onClick={() => void submit()}
            disabled={saving}
            className="rounded-full bg-gold text-night font-bold text-[13px] px-4 py-2 min-h-[36px] shadow-sm shadow-gold/30 disabled:opacity-40"
          >
            {saving ? '保存中…' : editing ? '更新' : '追加'}
          </button>
        }
      />
      <Main className="!pb-10">
        {/* LINE等からの貼り付け読み込み */}
        {!pasteOpen ? (
          <button
            type="button"
            onClick={() => setPasteOpen(true)}
            className="w-full rounded-xl border border-dashed border-gold/50 bg-gold/5 px-4 py-2.5 text-[13px] font-semibold text-gold"
          >
            💬 LINEを貼り付けて予定を読み込む
          </button>
        ) : (
          <div className="rounded-xl border border-gold/40 p-3 space-y-2">
            <p className={`text-[12px] font-semibold ${subTx}`}>
              LINEの本文を貼り付け → AIが日付・時刻・お客様を読み取ります（「明日」「来週火曜」等もOK）
            </p>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              rows={3}
              className={inputCls}
              placeholder="例：明日19時から東京でタカさんと同伴。21時には出るね"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPasteOpen(false)}
                className="flex-1 min-h-[40px] rounded-xl border border-night/15 dark:border-white/20 text-[13px] font-semibold"
              >
                閉じる
              </button>
              <button
                type="button"
                onClick={() => void importFromPaste()}
                disabled={!pasteText.trim() || importing}
                className="flex-[2] min-h-[40px] rounded-xl bg-gold text-night text-[14px] font-bold disabled:opacity-40"
              >
                {importing ? 'AI解析中…' : '読み込む'}
              </button>
            </div>
          </div>
        )}

        <Field label="種別">
          <Seg<ScheduleType>
            options={TYPES.map((t) => ({ v: t, label: `${SCHED_ICON[t]} ${SCHEDULE_LABEL[t]}` }))}
            value={type}
            onChange={setType}
          />
        </Field>

        {needsCustomer && (
          <Field label="お客様">
            {customers.length === 0 ? (
              <button
                type="button"
                onClick={() => navigate('/customers/new')}
                className={`text-left text-[13px] text-gold font-semibold`}
              >
                ＋ 顧客が未登録です。先に顧客を登録する
              </button>
            ) : (
              <div className="flex flex-wrap gap-2">
                {customers.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCustomerId(customerId === c.id ? '' : c.id)}
                    className={`px-4 py-2 rounded-full text-[13px] font-semibold border transition min-h-[40px] ${
                      customerId === c.id
                        ? 'bg-rose text-white border-rose shadow'
                        : 'bg-white/50 dark:bg-white/[0.06] border-night/10 dark:border-white/15'
                    }`}
                  >
                    {c.nickname}
                  </button>
                ))}
              </div>
            )}
          </Field>
        )}

        <Field label="日付">
          <DateSelect value={date} onChange={setDate} fromYear={nowYear - 1} toYear={nowYear + 2} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="開始">
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputCls} />
          </Field>
          <Field label="終了">
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputCls} />
          </Field>
        </div>

        <Field label="メモ">
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={5}
            className={`${inputCls} leading-relaxed`}
            placeholder="場所・約束ごと など"
          />
        </Field>

        {!googleAccessToken && (
          <p className={`text-[11px] ${subTx}`}>
            ※ Googleカレンダー未連携です。予定一覧の「カレンダー連携」から連携すると自動同期されます。
          </p>
        )}
        {error && <p className="text-[13px] font-semibold text-red-500">{error}</p>}
        {syncWarn && <p className="text-[13px] font-semibold text-amber-600 dark:text-amber-400">{syncWarn}</p>}
      </Main>
    </div>
  )
}
