import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useProfileSettings, saveProfileSettings } from '../../lib/sales'
import { Header, Main, Card, Avatar, Field, inputCls, subTx, useToast } from '../../components/ui'

const items: { icon: string; label: string; to: string }[] = [
  { icon: '📊', label: '売上レポート', to: '/sales' },
  { icon: '🤵', label: '黒服相談', to: '/consult' },
  { icon: '🔮', label: '占い・相性診断', to: '/compat' },
  { icon: '🔔', label: 'お知らせ', to: '/notices' },
  { icon: '🏢', label: '店舗コンソール', to: '/console' },
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
