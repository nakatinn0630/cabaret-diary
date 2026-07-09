import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useCustomers } from '../../lib/customers'
import { deleteSchedule, useSchedules, SCHEDULE_LABEL } from '../../lib/schedules'
import { ensureCabaageCalendar, deleteEvent } from '../../lib/gcal'
import type { Schedule as ScheduleT, ScheduleType, Timestamp } from '../../types'
import { Header, Main, Card, SectionTitle, Chip, Empty, subTx } from '../../components/ui'

const SCHED_ICON: Record<ScheduleType, string> = {
  shift: '🕘',
  dohan: '🍽️',
  after: '🌙',
  appointment: '📌',
}

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

  const Row = ({ s, showDate }: { s: ScheduleT; showDate?: boolean }) => {
    const name = nameOf(s.customerId)
    const dateTx = showDate
      ? `${s.start.toDate().toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })} · `
      : ''
    return (
      <Card className="px-4 py-3 flex items-center gap-3">
        <Link to={`/schedule/${s.id}/edit`} className="flex items-center gap-3 flex-1 min-w-0">
          <span className="text-[20px] flex-none" aria-hidden="true">
            {SCHED_ICON[s.type]}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-semibold truncate">
              {SCHEDULE_LABEL[s.type]}
              {name ? ` · ${name}` : ''}
              {s.googleEventId && <span className="ml-2 text-[11px] text-emerald-600 dark:text-emerald-300">✓同期</span>}
            </p>
            <p className={`text-[12px] truncate ${subTx}`}>
              {dateTx}
              {hhmm(s.start)}–{hhmm(s.end)}
              {s.memo ? ` · ${s.memo}` : ''}
            </p>
          </div>
        </Link>
        <button
          type="button"
          onClick={() => void onDelete(s)}
          className="flex-none text-[12px] font-semibold text-red-500 py-1 pl-1"
        >
          削除
        </button>
      </Card>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <Header
        title="予定"
        right={
          <Link
            to="/schedule/new"
            aria-label="予定追加"
            className="w-10 h-10 flex items-center justify-center rounded-full bg-gold text-night font-bold text-[20px] shadow-lg shadow-gold/30"
          >
            ＋
          </Link>
        }
      />
      <Main className="!space-y-2.5">
        {googleAccessToken ? (
          <Chip className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 font-bold">
            ✓ Googleカレンダー連携中
          </Chip>
        ) : (
          <button
            type="button"
            onClick={() => void connect()}
            disabled={connecting}
            className="text-[11px] px-2.5 py-1 rounded-full border border-night/15 dark:border-white/20 font-semibold disabled:opacity-60"
          >
            {connecting ? '連携中…' : 'Googleカレンダーと連携'}
          </button>
        )}

        {loading ? (
          <Empty>読み込み中…</Empty>
        ) : (
          <>
            <SectionTitle>今日</SectionTitle>
            {today.length === 0 ? (
              <Empty>今日の予定はありません</Empty>
            ) : (
              today.map((s) => <Row key={s.id} s={s} />)
            )}
            <SectionTitle>今後</SectionTitle>
            {later.length === 0 ? (
              <Empty>今後の予定はありません</Empty>
            ) : (
              later.map((s) => <Row key={s.id} s={s} showDate />)
            )}
          </>
        )}
      </Main>
    </div>
  )
}
