import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useCrypto } from '../../contexts/CryptoContext'
import { useProfileSettings, saveProfileSettings } from '../../lib/sales'
import {
  Header,
  Main,
  Card,
  SectionTitle,
  Avatar,
  Field,
  inputCls,
  subTx,
  goldTx,
  useToast,
} from '../../components/ui'

import { showsStore } from '../../lib/surface'

const items: { icon: string; label: string; to: string }[] = [
  { icon: '📊', label: '売上レポート', to: '/sales' },
  { icon: '🤵', label: 'AI黒服「クロ」に相談', to: '/consult' },
  { icon: '🔮', label: '占い・相性診断', to: '/compat' },
  { icon: '🔔', label: 'お知らせ', to: '/notices' },
  // 店舗コンソールは店舗サーフェスが同居する場合のみ露出（完全分離時は非表示）。
  ...(showsStore() ? [{ icon: '🏢', label: '店舗コンソール', to: '/console' }] : []),
]

// クロードデザインの MenuScreen を移植（源氏名の設定＋各機能導線＋ログアウト）
export default function Menu() {
  const { signOut } = useAuth()
  const toast = useToast()
  const { settings } = useProfileSettings()
  const stageName = settings.stageName?.trim() ?? ''

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)

  // 設定読み込み後に下書きへ反映
  useEffect(() => {
    setDraft(stageName)
  }, [stageName])

  const save = async () => {
    setSaving(true)
    try {
      await saveProfileSettings({ stageName: draft.trim() })
      toast('源氏名を保存しました ✓')
      setEditing(false)
    } catch (e) {
      toast(e instanceof Error ? e.message : '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  // SEC-07 暗号化パスフレーズ
  const { hasPassphrase, unlocked, setup, unlock, lock } = useCrypto()
  const [pp, setPp] = useState('')
  const [pp2, setPp2] = useState('')
  const [encBusy, setEncBusy] = useState(false)
  const [encErr, setEncErr] = useState<string | null>(null)

  const doSetup = async () => {
    setEncErr(null)
    if (pp.length < 6) return setEncErr('パスフレーズは6文字以上にしてください')
    if (pp !== pp2) return setEncErr('確認用と一致しません')
    setEncBusy(true)
    try {
      await setup(pp)
      toast('暗号化を有効にしました 🔒')
      setPp('')
      setPp2('')
    } catch (e) {
      setEncErr(e instanceof Error ? e.message : '設定に失敗しました')
    } finally {
      setEncBusy(false)
    }
  }
  const doUnlock = async () => {
    setEncErr(null)
    setEncBusy(true)
    try {
      await unlock(pp)
      toast('ロックを解除しました 🔓')
      setPp('')
    } catch (e) {
      setEncErr(e instanceof Error ? e.message : '解除に失敗しました')
    } finally {
      setEncBusy(false)
    }
  }

  return (
    <div className="h-full flex flex-col">
      <Header title="メニュー" />
      <Main>
        {/* プロフィール（源氏名） */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Avatar name={stageName || '？'} size={48} />
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-bold truncate">{stageName || '源氏名 未設定'}</p>
              <p className={`text-[12px] ${subTx}`}>キャスト</p>
            </div>
            {!editing && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="text-[13px] font-bold text-gold px-2 py-2"
              >
                {stageName ? '編集' : '設定'}
              </button>
            )}
          </div>
          {editing && (
            <div className="space-y-2.5">
              <Field label="源氏名（お店での名前）">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="例：れいな"
                  autoFocus
                  className={inputCls}
                />
              </Field>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDraft(stageName)
                    setEditing(false)
                  }}
                  className="flex-1 min-h-[44px] rounded-xl border border-night/15 dark:border-white/20 font-semibold text-[13px]"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={() => void save()}
                  disabled={saving || !draft.trim()}
                  className="flex-[2] min-h-[44px] rounded-xl bg-gold text-night font-bold text-[14px] disabled:opacity-40"
                >
                  {saving ? '保存中…' : '保存する'}
                </button>
              </div>
            </div>
          )}
        </Card>

        <Card className="divide-y divide-night/5 dark:divide-white/5">
          {items.map((it) => (
            <Link
              key={it.to}
              to={it.to}
              className="flex items-center gap-3 px-4 py-3.5 text-left min-h-[52px]"
            >
              <span className="text-[18px]" aria-hidden="true">
                {it.icon}
              </span>
              <span className="text-[14px] font-semibold flex-1">{it.label}</span>
              <span className={subTx} aria-hidden="true">
                ›
              </span>
            </Link>
          ))}
        </Card>

        {/* SEC-07 データ暗号化 */}
        <Card className="p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <SectionTitle>🔒 データ暗号化（本名・相談）</SectionTitle>
            {hasPassphrase && (
              <span className={`text-[11px] font-bold ${unlocked ? 'text-emerald-500' : 'text-rose'}`}>
                {unlocked ? '🔓 解除済み' : '🔒 ロック中'}
              </span>
            )}
          </div>

          {!hasPassphrase ? (
            <>
              <p className={`text-[12px] leading-relaxed ${subTx}`}>
                本名や黒服相談の内容を、あなただけが読める形で暗号化します。パスフレーズはサーバに送られません。
                <span className="text-rose font-semibold">
                  忘れると復号できず、暗号化したデータは二度と読めません。
                </span>
              </p>
              <Field label="パスフレーズ（6文字以上）">
                <input
                  type="password"
                  value={pp}
                  onChange={(e) => setPp(e.target.value)}
                  className={inputCls}
                  placeholder="覚えやすく推測されにくい語句"
                  autoComplete="new-password"
                />
              </Field>
              <Field label="確認のためもう一度">
                <input
                  type="password"
                  value={pp2}
                  onChange={(e) => setPp2(e.target.value)}
                  className={inputCls}
                  autoComplete="new-password"
                />
              </Field>
              <button
                type="button"
                onClick={() => void doSetup()}
                disabled={encBusy}
                className="w-full min-h-[44px] rounded-xl bg-gold text-night font-bold text-[14px] disabled:opacity-40"
              >
                {encBusy ? '設定中…' : '暗号化を有効にする'}
              </button>
            </>
          ) : !unlocked ? (
            <>
              <p className={`text-[12px] leading-relaxed ${subTx}`}>
                この端末はロック中です。パスフレーズを入力すると本名・相談を復号できます。
              </p>
              <Field label="パスフレーズ">
                <input
                  type="password"
                  value={pp}
                  onChange={(e) => setPp(e.target.value)}
                  className={inputCls}
                  autoComplete="current-password"
                />
              </Field>
              <button
                type="button"
                onClick={() => void doUnlock()}
                disabled={encBusy}
                className="w-full min-h-[44px] rounded-xl bg-gold text-night font-bold text-[14px] disabled:opacity-40"
              >
                {encBusy ? '解除中…' : 'ロックを解除する'}
              </button>
            </>
          ) : (
            <>
              <p className={`text-[12px] leading-relaxed ${goldTx}`}>
                この端末は解除済みです。本名・相談は暗号化して保存されています。
              </p>
              <button
                type="button"
                onClick={() => void lock()}
                className="w-full min-h-[44px] rounded-xl border border-night/15 dark:border-white/20 font-semibold text-[13px]"
              >
                この端末をロックする
              </button>
            </>
          )}
          {encErr && <p className="text-[12px] text-rose font-semibold">{encErr}</p>}
        </Card>

        <button
          type="button"
          onClick={() => void signOut()}
          className="w-full min-h-[48px] rounded-2xl border border-rose/40 text-rose font-bold text-[14px]"
        >
          ログアウト
        </button>
        <p className={`text-center text-[11px] ${subTx}`}>キャバ帳 v1.1.0</p>
      </Main>
    </div>
  )
}
