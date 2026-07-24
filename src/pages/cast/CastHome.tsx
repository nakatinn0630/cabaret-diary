import { useNavigate } from 'react-router-dom'
import { useCustomers } from '../../lib/customers'
import { useProfileSettings } from '../../lib/sales'
import { useSchedules, SCHEDULE_LABEL } from '../../lib/schedules'
import { RankBadge } from '../../components/RankBadge'
import { SpecialContacts } from '../../components/SpecialContacts'
import { Header, Main, Card, SectionTitle, Avatar, subTx, goldTx } from '../../components/ui'
import { yen } from '../../lib/format'
import { fmtHM, localDateKey } from '../../lib/datetime'
import type { ScheduleType } from '../../types'

const SCHED_ICON: Record<ScheduleType, string> = {
  shift: '🕘',
  dohan: '🍽️',
  after: '🌙',
  appointment: '📌',
}

export default function CastHome() {
  const navigate = useNavigate()
  const { customers } = useCustomers()
  const { schedules } = useSchedules()
  const { settings } = useProfileSettings()

  // Google名は使わず、設定した源氏名を表示（未設定時は名前なしの挨拶）
  const name = settings.stageName?.trim() ?? ''
  const alerting = customers.filter((c) => c.riskScore >= 50).sort((a, b) => b.riskScore - a.riskScore)
  const topSpenders = [...customers].sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 3)

  const todayKey = localDateKey(new Date())
  const nameOf = (id?: string) => (id ? (customers.find((c) => c.id === id)?.nickname ?? '') : '')
  const todaySchedules = schedules
    .filter((s) => localDateKey(s.start.toDate()) === todayKey)
    .sort((a, b) => a.start.toMillis() - b.start.toMillis())
  const hhmm = (t: (typeof schedules)[number]['start']) => fmtHM(t.toDate())

  return (
    <div className="h-full flex flex-col">
      <Header title={name ? `こんばんは、${name}さん 🌙` : 'こんばんは 🌙'} />
      <Main>
        <SectionTitle>今日の予定</SectionTitle>
        {todaySchedules.length === 0 ? (
          <p className={`text-[12px] ${subTx}`}>今日の予定はありません。</p>
        ) : (
          todaySchedules.map((s) => (
            <Card
              key={s.id}
              className="px-4 py-3 flex items-center gap-3"
              onClick={() => navigate(`/schedule/${s.id}/edit`)}
            >
              <span className="text-[20px]" aria-hidden="true">
                {SCHED_ICON[s.type]}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold">
                  {SCHEDULE_LABEL[s.type]}
                  {nameOf(s.customerId) ? ` · ${nameOf(s.customerId)}` : ''}
                </p>
                <p className={`text-[12px] ${subTx}`}>
                  {hhmm(s.start)}–{hhmm(s.end)}
                  {s.memo ? ` · ${s.memo}` : ''}
                </p>
              </div>
              <span className={subTx} aria-hidden="true">
                ›
              </span>
            </Card>
          ))
        )}

        <SectionTitle>⚠️ 要確認の顧客</SectionTitle>
        {alerting.length === 0 ? (
          <p className={`text-[12px] ${subTx}`}>リスクの高い顧客はいません。</p>
        ) : (
          alerting.map((c) => {
            const red = c.riskScore >= 70
            return (
              <Card
                key={c.id}
                onClick={() => navigate(`/customers/${c.id}`)}
                className={`px-4 py-3 flex items-center gap-3 ${red ? '!border-rose/50' : '!border-gold/40'}`}
              >
                <Avatar name={c.nickname} size={38} />
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold flex items-center gap-2">
                    {c.nickname} <RankBadge rank={c.rank} />
                  </p>
                  <p className={`text-[12px] truncate ${red ? 'text-rose' : goldTx}`}>
                    {c.riskFlags[0] ?? 'リスク要確認'}
                  </p>
                </div>
                <span className={`font-serif font-bold text-[18px] ${red ? 'text-rose' : goldTx}`}>
                  {c.riskScore}
                </span>
              </Card>
            )
          })
        )}

        <div className="grid grid-cols-2 gap-3">
          <Card onClick={() => navigate('/sales')} className="p-4 space-y-1">
            <span className="text-[20px]" aria-hidden="true">
              📊
            </span>
            <p className="text-[13px] font-bold">売上レポート</p>
            <p className={`text-[12px] ${goldTx}`}>保証カウントダウン</p>
          </Card>
          <Card onClick={() => navigate('/consult')} className="p-4 space-y-1">
            <span className="text-[20px]" aria-hidden="true">
              🤵
            </span>
            <p className="text-[13px] font-bold">AI黒服「クロ」</p>
            <p className={`text-[12px] ${subTx}`}>困りごとを相談</p>
          </Card>
        </div>

        {/* F-07 特別な連絡レコメンド（今日のひとこと連絡） */}
        <SectionTitle>今日のひとこと連絡</SectionTitle>
        <SpecialContacts customers={customers} schedules={schedules} />

        <SectionTitle>太客TOP</SectionTitle>
        {topSpenders.length === 0 ? (
          <Card className="p-4">
            <p className={`text-[12px] ${subTx}`}>
              顧客がまだいません。
              <button onClick={() => navigate('/customers/new')} className="ml-1 font-semibold text-gold">
                登録する
              </button>
            </p>
          </Card>
        ) : (
          <Card className="divide-y divide-night/5 dark:divide-white/5">
            {topSpenders.map((c, i) => (
              <button
                key={c.id}
                type="button"
                onClick={() => navigate(`/customers/${c.id}`)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
              >
                <span className={`font-serif font-bold w-5 ${i === 0 ? goldTx : subTx}`}>{i + 1}</span>
                <span className="text-[14px] font-semibold flex-1">{c.nickname}</span>
                <span className={`text-[13px] font-serif font-bold ${goldTx}`}>{yen(c.totalSpent)}</span>
              </button>
            ))}
          </Card>
        )}
      </Main>
    </div>
  )
}
