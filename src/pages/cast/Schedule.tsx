import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useCustomers } from '../../lib/customers'
import { deleteSchedule, useSchedules, SCHEDULE_LABEL } from '../../lib/schedules'
import { ensureCabaageCalendar, deleteEvent } from '../../lib/gcal'
import type { Schedule as ScheduleT, Timestamp } from '../../types'

function hhmm(t: Timestamp): string {
  const d = t.toDate()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
function dayKey(t: Timestamp): string {
  return t.toDate().toISOString().slice(0, 10)
}

export default function Schedule() {
  const { googleAccessToken, reconnectGoogle } = useAuth()
  const { customers } = useCustomers()
  const { schedules, loading } = useSchedules()
  const [connecting, setConnecting] = useState(false)

  const nameOf = useMemo(() => {
    const m = new Map(customers.map((c) => [c.id, c.nickname]))
    return (id?: string) => (id ? (m.get(id) ?? '') : '')
  }, [customers])

  const todayKey = new Date().toISOString().slice(0, 10)
  const upcoming = schedules.filter((s) => dayKey(s.end) >= todayKey)
  const today = upcoming.filter((s) => dayKey(s.start) === todayKey)
  const later = upcoming.filter((s) => dayKey(s.start) > todayKey)

  const connect = async () => {
    setConnecting(true)
    try {
      await reconnectGoogle()
    } finally {
      setConnecting(false)
    }
  }

  const onDelete = async (s: ScheduleT) => {
    if (!confirm('この予定を削除しますか？')) return
    await deleteSchedule(s.id)
    if (googleAccessToken && s.googleEventId) {
      try {
        const calId = await ensureCabaageCalendar(googleAccessToken)
        await deleteEvent(googleAccessToken, calId, s.googleEventId)
      } catch {
        /* best-effort */
      }
    }
  }

  const Item = ({ s }: { s: ScheduleT }) => (
    <li className="flex items-center gap-3 rounded-xl border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-white/5">
      <div className="w-14 flex-none text-center">
        <div className="text-sm font-bold tabular-nums">{hhmm(s.start)}</div>
        <div className="text-[11px] text-black/40 dark:text-white/40">{hhmm(s.end)}</div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[11px] font-bold text-gold">
            {SCHEDULE_LABEL[s.type]}
          </span>
          {nameOf(s.customerId) && <span className="truncate text-sm font-medium">{nameOf(s.customerId)}</span>}
          {s.googleEventId && <span className="text-[11px] text-emerald-600 dark:text-emerald-400">✓同期</span>}
        </div>
        {s.memo && <p className="mt-0.5 truncate text-xs text-black/50 dark:text-white/50">{s.memo}</p>}
      </div>
      <Link to={`/schedule/${s.id}/edit`} className="text-xs font-semibold text-gold">
        編集
      </Link>
      <button onClick={() => void onDelete(s)} className="text-xs text-red-500">
        削除
      </button>
    </li>
  )

  return (
    <div className="flex min-h-full flex-col">
      <header className="safe-top sticky top-0 z-10 border-b border-black/10 bg-white/90 px-4 pb-3 backdrop-blur dark:border-white/10 dark:bg-night/90">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold">予定</h1>
          <Link to="/schedule/new" className="rounded-full bg-gold px-3 py-1.5 text-sm font-bold text-night">
            ＋ 追加
          </Link>
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs">
          {googleAccessToken ? (
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              ● Googleカレンダー連携中（キャバ帳）
            </span>
          ) : (
            <button
              onClick={() => void connect()}
              disabled={connecting}
              className="rounded-full border border-black/15 px-3 py-1 font-semibold dark:border-white/20"
            >
              {connecting ? '連携中…' : 'Googleカレンダーと連携'}
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 space-y-5 p-4">
        {loading ? (
          <p className="p-6 text-center text-sm text-black/50 dark:text-white/50">読み込み中…</p>
        ) : upcoming.length === 0 ? (
          <div className="p-10 text-center text-sm text-black/50 dark:text-white/50">
            <p>今後の予定はありません。</p>
            <Link to="/schedule/new" className="mt-3 inline-block font-semibold text-gold">
              予定を追加する
            </Link>
          </div>
        ) : (
          <>
            <section>
              <h2 className="mb-2 text-xs font-bold text-black/50 dark:text-white/50">今日</h2>
              {today.length === 0 ? (
                <p className="text-sm text-black/40 dark:text-white/40">今日の予定はありません。</p>
              ) : (
                <ul className="space-y-2">
                  {today.map((s) => (
                    <Item key={s.id} s={s} />
                  ))}
                </ul>
              )}
            </section>
            {later.length > 0 && (
              <section>
                <h2 className="mb-2 text-xs font-bold text-black/50 dark:text-white/50">今後</h2>
                <ul className="space-y-2">
                  {later.map((s) => (
                    <li key={s.id}>
                      <div className="mb-1 text-[11px] text-black/40 dark:text-white/40">
                        {s.start.toDate().toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })}
                      </div>
                      <Item s={s} />
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}
