import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { createCustomer, updateCustomer, useCustomer, type NewCustomer } from '../../lib/customers'
import { useCrypto } from '../../contexts/CryptoContext'
import { decField } from '../../lib/crypto'
import { RANK_OPTIONS } from '../../components/RankBadge'
import { Header, Main, Field, Seg, MultiPill, DateSelect, inputCls, subTx, useToast } from '../../components/ui'
import type { CustomerRank, Fatigue, FitLevel, PaymentMethod } from '../../types'

const FIT_LEVELS: FitLevel[] = ['得意', '普通', '苦手']
const FATIGUE_LEVELS: Fatigue[] = ['低', '中', '高']
const INCOME_OPTIONS: string[] = ['不明', '〜500万', '500〜1000万', '1000〜2000万', '2000〜3000万', '3000万〜']
const PAY_OPTIONS: { v: PaymentMethod; label: string }[] = [
  { v: 'cash', label: '現金' },
  { v: 'card', label: 'カード' },
]

export default function CustomerEdit() {
  const { cid } = useParams<{ cid: string }>()
  const editing = Boolean(cid)
  const navigate = useNavigate()
  const toast = useToast()
  const { customer } = useCustomer(cid)
  const { unlocked, hasPassphrase } = useCrypto()
  const nowYear = new Date().getFullYear()

  const [form, setForm] = useState<NewCustomer>({ nickname: '', paymentMethods: ['cash'], tags: [] })
  const [realNameInput, setRealNameInput] = useState('')
  const [initialRank, setInitialRank] = useState<CustomerRank | undefined>(undefined)
  const [tagsText, setTagsText] = useState('')
  const [rank, setRank] = useState<CustomerRank>('IP')
  const [fitLevel, setFitLevel] = useState<FitLevel>('普通')
  const [fitFatigue, setFitFatigue] = useState<Fatigue>('低')
  const [fitReasonsText, setFitReasonsText] = useState('')
  const [cautionsText, setCautionsText] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(false)
  const [shake, setShake] = useState(0)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (editing && customer) {
      setForm({
        nickname: customer.nickname,
        lineName: customer.lineName,
        phone: customer.phone,
        occupation: customer.occupation,
        companyName: customer.companyName,
        incomeRange: customer.incomeRange,
        birthday: customer.fortune?.birthday
          ? new Date(customer.fortune.birthday.toMillis()).toISOString().slice(0, 10)
          : undefined,
        paymentMethods: customer.paymentMethods,
        tags: customer.tags,
        rank: customer.rank,
        memo: customer.memo,
      })
      setInitialRank(customer.rank)
      setRank(customer.rank ?? 'IP')
      setTagsText(customer.tags.join('、'))
      setCautionsText(customer.pinnedCautions.join('\n'))
      if (customer.fit) {
        setFitLevel(customer.fit.level)
        setFitFatigue(customer.fit.fatigue)
        setFitReasonsText(customer.fit.reasonTags.join('、'))
      }
    }
  }, [editing, customer])

  // SEC-07 本名はロック解除時のみ復号して表示
  useEffect(() => {
    if (editing && customer?.realName && unlocked) {
      let alive = true
      void decField(customer.realName).then((v) => {
        if (alive) setRealNameInput(v)
      })
      return () => {
        alive = false
      }
    }
  }, [editing, customer, unlocked])

  const set = <K extends keyof NewCustomer>(key: K, value: NewCustomer[K]) => {
    setDirty(true)
    setForm((f) => ({ ...f, [key]: value }))
  }

  const togglePayment = (p: PaymentMethod) => {
    setDirty(true)
    setForm((f) => {
      const cur = f.paymentMethods ?? []
      return { ...f, paymentMethods: cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p] }
    })
  }

  const splitList = (s: string) => s.split(/[、,]/).map((t) => t.trim()).filter(Boolean)

  const submit = async () => {
    if (!form.nickname.trim()) {
      setErr(true)
      setShake((s) => s + 1)
      return
    }
    const payload: NewCustomer = {
      ...form,
      nickname: form.nickname.trim(),
      rank,
      tags: splitList(tagsText),
      fit: { level: fitLevel, fatigue: fitFatigue, reasonTags: splitList(fitReasonsText) },
      pinnedCautions: cautionsText.split('\n').map((t) => t.trim()).filter(Boolean),
      // 本名: 未設定(平文可)または解除済みなら保存。設定済みロック中のみ既存暗号値を保持。
      ...(!(hasPassphrase && !unlocked) ? { realName: realNameInput.trim() } : {}),
    }
    setSaving(true)
    try {
      if (editing && cid) {
        await updateCustomer(cid, payload, rank !== initialRank)
        toast('更新しました ✓')
        navigate(`/customers/${cid}`)
      } else {
        const id = await createCustomer(payload)
        toast('登録しました ✓')
        navigate(`/customers/${id}`)
      }
    } catch (e) {
      setErr(false)
      setShake((s) => s + 1)
      toast(e instanceof Error ? e.message : '保存に失敗しました。')
      setSaving(false)
    }
  }

  const cancel = () => {
    if (dirty && !confirm('編集内容が保存されていません。破棄して戻りますか？')) return
    navigate(editing && cid ? `/customers/${cid}` : '/customers')
  }

  return (
    <div className="h-full flex flex-col">
      <Header
        title={editing ? `${customer?.nickname ?? ''} を編集` : '顧客 新規登録'}
        back
        onBack={cancel}
        right={
          <button
            type="button"
            onClick={() => void submit()}
            disabled={saving}
            className="rounded-full bg-gold text-night font-bold text-[13px] px-4 py-2 min-h-[36px] shadow-sm shadow-gold/30 disabled:opacity-40"
          >
            {saving ? '保存中…' : editing ? '更新' : '登録'}
          </button>
        }
      />
      <Main className="!pb-28">
        <div key={shake} className={shake && err ? 'anim-shake' : ''}>
          <Field label="あだ名" required error={err && !form.nickname.trim() ? 'あだ名は必須です' : ''}>
            <input
              value={form.nickname}
              onChange={(e) => {
                set('nickname', e.target.value)
                if (e.target.value.trim()) setErr(false)
              }}
              placeholder="例：タカさん"
              className={`${inputCls} ${err && !form.nickname.trim() ? '!border-red-400 !border-2' : ''}`}
            />
          </Field>
        </div>

        <Field label="LINE名称">
          <input value={form.lineName ?? ''} onChange={(e) => set('lineName', e.target.value)} className={inputCls} placeholder="LINEの表示名" />
        </Field>
        <Field label="電話番号">
          <input
            type="tel"
            inputMode="tel"
            value={form.phone ?? ''}
            // 電話として無効な文字（かな・英字等）は弾く。数字・+・-・()・空白のみ許可。
            onChange={(e) => set('phone', e.target.value.replace(/[^\d+\-() 　]/g, ''))}
            className={inputCls}
            placeholder="090-0000-0000"
          />
          {(() => {
            const digits = (form.phone ?? '').replace(/\D/g, '')
            return digits.length > 0 && digits.length < 10 ? (
              <span className={`block text-[11px] text-amber-600 dark:text-amber-400`}>
                桁数が少ないようです（携帯なら11桁）。番号をご確認ください。
              </span>
            ) : null
          })()}
        </Field>
        <Field label="誕生日">
          <DateSelect
            value={form.birthday ?? ''}
            onChange={(v) => set('birthday', v)}
            fromYear={nowYear - 90}
            toYear={nowYear}
          />
        </Field>
        {/* パスフレーズを設定済みでロック中のときだけ入力不可。未設定なら通常入力（平文保存・所有者のみ閲覧可）。 */}
        {hasPassphrase && !unlocked ? (
          <Field label="本名">
            <div className={`rounded-xl border border-night/10 dark:border-white/15 px-4 py-3 text-[13px] ${subTx}`}>
              🔒 ロック中です。メニューの「データ暗号化」で解除すると入力・編集できます。
              <button type="button" onClick={() => navigate('/menu')} className="ml-1 font-bold text-gold">
                設定へ
              </button>
            </div>
          </Field>
        ) : (
          <Field label={unlocked ? '本名（暗号化して保存）' : '本名'}>
            <input
              value={realNameInput}
              onChange={(e) => {
                setDirty(true)
                setRealNameInput(e.target.value)
              }}
              className={inputCls}
              placeholder="任意"
              autoComplete="off"
            />
            {!unlocked && (
              <span className={`block text-[11px] ${subTx}`}>
                ※ 本人だけが閲覧できます。さらに端末内で暗号化するには
                <button type="button" onClick={() => navigate('/menu')} className="font-semibold text-gold">
                  メニューでパスフレーズを設定
                </button>
                （任意）。
              </span>
            )}
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="職業">
            <input value={form.occupation ?? ''} onChange={(e) => set('occupation', e.target.value)} className={inputCls} placeholder="経営者 など" />
          </Field>
          <Field label="会社名">
            <input value={form.companyName ?? ''} onChange={(e) => set('companyName', e.target.value)} className={inputCls} placeholder="任意" />
          </Field>
        </div>
        <Field label="年収">
          <Seg
            options={INCOME_OPTIONS}
            value={form.incomeRange ?? ''}
            onChange={(v) => set('incomeRange', v)}
          />
        </Field>

        <Field label="ランク">
          <Seg options={RANK_OPTIONS} value={rank} onChange={(v) => { setDirty(true); setRank(v) }} />
        </Field>
        <Field label="支払方法（複数可）">
          <MultiPill options={PAY_OPTIONS} values={form.paymentMethods ?? []} onToggle={togglePayment} />
        </Field>

        <Field label="相性（向き不向き）">
          <Seg options={FIT_LEVELS} value={fitLevel} onChange={(v) => { setDirty(true); setFitLevel(v) }} />
        </Field>
        <Field label="消耗度">
          <Seg options={FATIGUE_LEVELS} value={fitFatigue} onChange={(v) => { setDirty(true); setFitFatigue(v) }} />
        </Field>
        <Field label="相性の理由タグ（読点区切り）">
          <input value={fitReasonsText} onChange={(e) => { setDirty(true); setFitReasonsText(e.target.value) }} className={inputCls} placeholder="会話が弾む、聞き役が向く" />
        </Field>

        <Field label="タグ（読点区切り）">
          <input value={tagsText} onChange={(e) => { setDirty(true); setTagsText(e.target.value) }} className={inputCls} placeholder="太客、釣り" />
        </Field>
        <Field label="気をつけること（1行1件）">
          <textarea value={cautionsText} onChange={(e) => { setDirty(true); setCautionsText(e.target.value) }} rows={3} className={inputCls} placeholder="押しすぎると引く" />
        </Field>
        <Field label="メモ">
          <textarea value={form.memo ?? ''} onChange={(e) => set('memo', e.target.value)} rows={3} className={inputCls} placeholder="自由メモ" />
        </Field>
      </Main>
    </div>
  )
}
