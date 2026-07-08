import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  createCustomer,
  updateCustomer,
  useCustomer,
  type NewCustomer,
} from '../../lib/customers'
import { RANK_LABEL, RANK_OPTIONS } from '../../components/RankBadge'
import type { CustomerRank, Fatigue, FitLevel, PaymentMethod } from '../../types'

const FIT_LEVELS: FitLevel[] = ['得意', '普通', '苦手']
const FATIGUE_LEVELS: Fatigue[] = ['低', '中', '高']

const inputCls =
  'w-full rounded-lg border border-black/10 bg-black/5 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gold/50 dark:border-white/10 dark:bg-white/5'

const PAYMENTS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: '現金' },
  { value: 'card', label: 'カード' },
  { value: 'urikake', label: '売掛' },
]

export default function CustomerEdit() {
  const { cid } = useParams<{ cid: string }>()
  const editing = Boolean(cid)
  const navigate = useNavigate()
  const { customer } = useCustomer(cid)

  const [form, setForm] = useState<NewCustomer>({ nickname: '', paymentMethods: [], tags: [] })
  const [initialRank, setInitialRank] = useState<CustomerRank | undefined>(undefined)
  const [tagsText, setTagsText] = useState('')
  const [fitLevel, setFitLevel] = useState<FitLevel | ''>('')
  const [fitFatigue, setFitFatigue] = useState<Fatigue>('中')
  const [fitReasonsText, setFitReasonsText] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (editing && customer) {
      setForm({
        nickname: customer.nickname,
        lineName: customer.lineName,
        realName: customer.realName,
        occupation: customer.occupation,
        companyName: customer.companyName,
        incomeRange: customer.incomeRange,
        paymentMethods: customer.paymentMethods,
        tags: customer.tags,
        rank: customer.rank,
        memo: customer.memo,
      })
      setInitialRank(customer.rank)
      setTagsText(customer.tags.join(', '))
      if (customer.fit) {
        setFitLevel(customer.fit.level)
        setFitFatigue(customer.fit.fatigue)
        setFitReasonsText(customer.fit.reasonTags.join(', '))
      }
    }
  }, [editing, customer])

  const set = <K extends keyof NewCustomer>(key: K, value: NewCustomer[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const togglePayment = (p: PaymentMethod) =>
    setForm((f) => {
      const cur = f.paymentMethods ?? []
      return { ...f, paymentMethods: cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p] }
    })

  const submit = async () => {
    setError(null)
    if (!form.nickname.trim()) {
      setError('あだ名は必須です。')
      return
    }
    const tags = tagsText.split(',').map((t) => t.trim()).filter(Boolean)
    const fit = fitLevel
      ? {
          level: fitLevel,
          fatigue: fitFatigue,
          reasonTags: fitReasonsText.split(',').map((t) => t.trim()).filter(Boolean),
        }
      : undefined
    setSaving(true)
    try {
      if (editing && cid) {
        await updateCustomer(cid, { ...form, tags, fit }, form.rank !== initialRank)
        navigate(`/customers/${cid}`)
      } else {
        const id = await createCustomer({ ...form, tags, fit })
        navigate(`/customers/${id}`)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存に失敗しました。')
      setSaving(false)
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="safe-top sticky top-0 z-10 flex items-center justify-between border-b border-black/10 bg-white/90 px-4 pb-3 backdrop-blur dark:border-white/10 dark:bg-night/90">
        <Link to={editing ? `/customers/${cid}` : '/customers'} className="text-sm text-black/60 dark:text-white/60">
          ← 戻る
        </Link>
        <h1 className="text-base font-bold">{editing ? '顧客を編集' : '顧客を新規登録'}</h1>
        <span className="w-10" />
      </header>

      <div className="flex-1 space-y-3 p-4">
        <Field label="あだ名 *">
          <input value={form.nickname} onChange={(e) => set('nickname', e.target.value)} className={inputCls} />
        </Field>
        <Field label="LINE名">
          <input value={form.lineName ?? ''} onChange={(e) => set('lineName', e.target.value)} className={inputCls} />
        </Field>
        <Field label="本名（暗号化保存）">
          <input value={form.realName ?? ''} onChange={(e) => set('realName', e.target.value)} className={inputCls} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="職業">
            <input value={form.occupation ?? ''} onChange={(e) => set('occupation', e.target.value)} className={inputCls} />
          </Field>
          <Field label="会社名">
            <input value={form.companyName ?? ''} onChange={(e) => set('companyName', e.target.value)} className={inputCls} />
          </Field>
        </div>
        <Field label="年収帯">
          <input
            value={form.incomeRange ?? ''}
            onChange={(e) => set('incomeRange', e.target.value)}
            placeholder="例: 2000万〜"
            className={inputCls}
          />
        </Field>

        <Field label="ランク">
          <select
            value={form.rank ?? ''}
            onChange={(e) => set('rank', (e.target.value || undefined) as CustomerRank | undefined)}
            className={inputCls}
          >
            <option value="">未設定</option>
            {RANK_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r}・{RANK_LABEL[r]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="支払方法">
          <div className="flex gap-4 text-sm">
            {PAYMENTS.map((p) => (
              <label key={p.value} className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={(form.paymentMethods ?? []).includes(p.value)}
                  onChange={() => togglePayment(p.value)}
                />
                {p.label}
              </label>
            ))}
          </div>
        </Field>

        <Field label="タグ（カンマ区切り）">
          <input
            value={tagsText}
            onChange={(e) => setTagsText(e.target.value)}
            placeholder="太客, 新規, 要注意"
            className={inputCls}
          />
        </Field>

        <div className="rounded-xl border border-black/10 p-3 dark:border-white/10">
          <span className="text-xs font-semibold text-black/60 dark:text-white/60">向き不向き（F-13）</span>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-[11px] text-black/50 dark:text-white/50">相性</span>
              <select value={fitLevel} onChange={(e) => setFitLevel(e.target.value as FitLevel | '')} className={inputCls}>
                <option value="">未設定</option>
                {FIT_LEVELS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] text-black/50 dark:text-white/50">接客後の消耗度</span>
              <select value={fitFatigue} onChange={(e) => setFitFatigue(e.target.value as Fatigue)} className={inputCls}>
                {FATIGUE_LEVELS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="mt-2 block">
            <span className="mb-1 block text-[11px] text-black/50 dark:text-white/50">理由タグ（カンマ区切り）</span>
            <input
              value={fitReasonsText}
              onChange={(e) => setFitReasonsText(e.target.value)}
              placeholder="会話が弾む, 聞き役が向く, 束縛が強い"
              className={inputCls}
            />
          </label>
        </div>

        <Field label="メモ">
          <textarea value={form.memo ?? ''} onChange={(e) => set('memo', e.target.value)} rows={3} className={inputCls} />
        </Field>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          onClick={() => void submit()}
          disabled={saving}
          className="mt-2 w-full rounded-lg bg-gold py-3 text-sm font-bold text-night disabled:opacity-60"
        >
          {saving ? '保存中…' : editing ? '更新する' : '登録する'}
        </button>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-black/60 dark:text-white/60">{label}</span>
      {children}
    </label>
  )
}
