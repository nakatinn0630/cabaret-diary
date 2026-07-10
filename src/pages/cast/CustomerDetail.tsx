import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { deleteCustomer, useCustomer, useVisits } from '../../lib/customers'
import { RankBadge } from '../../components/RankBadge'
import { RiskAlert } from '../../components/RiskAlert'
import { VisitTimeline } from '../../components/VisitTimeline'
import { VisitForm } from '../../components/VisitForm'
import {
  Header,
  Main,
  Card,
  SectionTitle,
  Chip,
  Avatar,
  Empty,
  subTx,
  goldTx,
  useToast,
} from '../../components/ui'
import { yen, fmtMonthDay, daysUntilBirthday, tagColorClass } from '../../lib/format'
import type { FitLevel, PaymentMethod } from '../../types'

const PAY_LABEL: Record<PaymentMethod, string> = { cash: '現金', card: 'カード', urikake: '売掛' }
const FIT_CLS: Record<FitLevel, string> = {
  得意: 'text-emerald-600 dark:text-emerald-300 bg-emerald-500/10 border-emerald-500/40',
  普通: `${goldTx} bg-gold/10 border-gold/40`,
  苦手: 'text-rose bg-rose/10 border-rose/40',
}

export default function CustomerDetail() {
  const { cid } = useParams<{ cid: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const { customer, loading } = useCustomer(cid)
  const { visits } = useVisits(cid)
  const [showVisitForm, setShowVisitForm] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)

  if (loading) {
    return (
      <div className="h-full flex flex-col">
        <Header title="顧客詳細" back onBack={() => navigate(-1)} />
        <Empty>読み込み中…</Empty>
      </div>
    )
  }
  if (!customer) {
    return (
      <div className="h-full flex flex-col">
        <Header title="顧客詳細" back onBack={() => navigate('/customers')} />
        <Empty>顧客が見つかりません。</Empty>
      </div>
    )
  }

  const c = customer
  const bdayDays = daysUntilBirthday(c.fortune?.birthday)
  const bdaySoon = bdayDays !== null && bdayDays <= 7
  const copy = async (label: string, val: string) => {
    try {
      await navigator.clipboard.writeText(val)
    } catch {
      /* クリップボード権限が無くても失敗させない */
    }
    toast(`${label}をコピーしました`)
  }
  const onDelete = async () => {
    if (!cid) return
    if (!confirmDel) {
      setConfirmDel(true)
      return
    }
    await deleteCustomer(cid)
    toast('削除しました')
    navigate('/customers')
  }

  return (
    <div className="h-full flex flex-col">
      <Header
        title={c.nickname}
        back
        onBack={() => navigate(-1)}
        right={
          <button
            type="button"
            onClick={() => navigate(`/customers/${c.id}/edit`)}
            className="text-[13px] font-bold text-gold px-2 py-2"
          >
            編集
          </button>
        }
      />
      <Main>
        {/* プロフィール */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Avatar name={c.nickname} size={52} />
            <div className="min-w-0">
              <p className="font-serif text-[19px] font-bold flex items-center gap-2 flex-wrap">
                {c.nickname} <RankBadge rank={c.rank} />
                {bdaySoon && (
                  <Chip className="border-rose/40 bg-rose/10 text-[#a8395c] dark:text-[#f0c3d2] font-bold">
                    🎂 誕生日{bdayDays === 0 ? '当日' : `まで${bdayDays}日`}
                  </Chip>
                )}
              </p>
              <p className={`text-[12px] ${subTx}`}>
                {[
                  c.fortune?.birthday ? `🎂 ${fmtMonthDay(c.fortune.birthday)}` : '',
                  [c.occupation, c.companyName, c.incomeRange].filter(Boolean).join(' / '),
                ]
                  .filter(Boolean)
                  .join(' · ') || '未登録'}
              </p>
            </div>
          </div>

          {/* 連絡先（1タップコピー） */}
          {(c.phone || c.lineName) && (
            <div className="flex flex-wrap gap-2">
              {c.phone && (
                <button
                  type="button"
                  onClick={() => void copy('電話番号', c.phone!)}
                  className="flex items-center gap-1.5 rounded-full border border-night/15 dark:border-white/20 px-3 py-1.5 text-[12px] font-semibold min-h-[36px]"
                >
                  📞 {c.phone} <span className={subTx}>⧉</span>
                </button>
              )}
              {c.lineName && (
                <button
                  type="button"
                  onClick={() => void copy('LINE名称', c.lineName!)}
                  className="flex items-center gap-1.5 rounded-full border border-night/15 dark:border-white/20 px-3 py-1.5 text-[12px] font-semibold min-h-[36px]"
                >
                  💬 {c.lineName} <span className={subTx}>⧉</span>
                </button>
              )}
            </div>
          )}

          {(c.tags.length > 0 || c.paymentMethods.length > 0) && (
            <div className="flex flex-wrap gap-1.5">
              {c.tags.map((t) => (
                <Chip key={t} className={tagColorClass(t)}>
                  {t}
                </Chip>
              ))}
              {c.paymentMethods.map((p) => (
                <Chip key={p} className={`border-gold/40 bg-gold/10 ${goldTx}`}>
                  {PAY_LABEL[p]}
                </Chip>
              ))}
            </div>
          )}
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              ['累計売上', yen(c.totalSpent), true],
              ['来店回数', `${c.visitCount}回`, false],
              ['平均単価', c.visitCount ? yen(Math.round(c.totalSpent / c.visitCount)) : '—', false],
            ].map(([label, value, gold]) => (
              <div key={label as string} className="rounded-xl py-2.5 bg-night/[0.04] dark:bg-white/[0.05]">
                <p className={`text-[10px] ${subTx}`}>{label}</p>
                <p className={`font-serif text-[14px] font-bold ${gold ? goldTx : ''}`}>{value}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* F-02 リスクアラート */}
        <RiskAlert score={c.riskScore} flags={c.riskFlags} />

        {/* F-13 相性（向き不向き） */}
        {c.fit && (
          <Card className="p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <SectionTitle>相性</SectionTitle>
              <div className="flex gap-2">
                <Chip className={FIT_CLS[c.fit.level]}>{c.fit.level}</Chip>
                <Chip className="border-night/10 dark:border-white/15">消耗度 {c.fit.fatigue}</Chip>
              </div>
            </div>
            {c.fit.reasonTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {c.fit.reasonTags.map((t) => (
                  <Chip key={t} className="border-rose/35 bg-rose/10 text-[#a8395c] dark:text-[#f0c3d2]">
                    {t}
                  </Chip>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* F-14 気をつけること */}
        {c.pinnedCautions.length > 0 && (
          <Card className="p-4 space-y-2">
            <SectionTitle>📌 気をつけること</SectionTitle>
            {c.pinnedCautions.map((t) => (
              <p key={t} className="text-[13px] font-medium rounded-xl px-3 py-2.5 border border-gold/30 bg-gold/[0.08]">
                {t}
              </p>
            ))}
          </Card>
        )}

        {/* F-03 来店タイムライン */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <SectionTitle>来店タイムライン</SectionTitle>
            <button
              type="button"
              onClick={() => setShowVisitForm(true)}
              className="text-[12px] font-bold text-gold border border-gold/40 rounded-full px-3 py-1.5"
            >
              ＋ 来店登録
            </button>
          </div>
          <VisitTimeline visits={visits} />
        </Card>

        {c.memo && (
          <Card className="p-4 space-y-1.5">
            <SectionTitle>メモ</SectionTitle>
            <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{c.memo}</p>
          </Card>
        )}

        {/* アクション */}
        <div className="grid grid-cols-3 gap-2.5">
          <button
            type="button"
            onClick={() => setShowVisitForm(true)}
            className="min-h-[48px] rounded-2xl bg-gold text-night text-[13px] font-bold shadow-lg shadow-gold/25"
          >
            ＋ 来店登録
          </button>
          <button
            type="button"
            onClick={() => navigate(`/compat?cid=${c.id}`)}
            className="min-h-[48px] rounded-2xl border border-night/15 dark:border-white/20 text-[13px] font-bold"
          >
            🔮 占い
          </button>
          <button
            type="button"
            onClick={() => navigate(`/reply?cid=${c.id}`)}
            className="min-h-[48px] rounded-2xl border border-night/15 dark:border-white/20 text-[13px] font-bold"
          >
            💬 返信案
          </button>
        </div>
        <button
          type="button"
          onClick={() => void onDelete()}
          className={`w-full min-h-[44px] rounded-2xl text-[13px] font-bold border ${
            confirmDel ? 'bg-rose text-white border-rose' : 'text-rose border-rose/40'
          }`}
        >
          {confirmDel ? '本当に削除する（取り消せません）' : '顧客を削除'}
        </button>
      </Main>

      {showVisitForm && cid && <VisitForm cid={cid} onClose={() => setShowVisitForm(false)} />}
    </div>
  )
}
