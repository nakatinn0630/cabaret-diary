import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useProfileSettings, saveProfileSettings } from '../lib/sales'
import { inputCls, subTx, useToast } from './ui'

// 初回オンボーディング：源氏名の設定＋使い方の要点を案内。
// 源氏名が未設定（＝新規）かつ未完了フラグのときだけ表示する。
const doneKey = (uid?: string) => `kyabacho_onboarded_${uid ?? 'anon'}`

const GUIDE: { icon: string; title: string; body: string }[] = [
  { icon: '👥', title: '顧客を登録', body: 'あだ名・LINE名・誕生日・タグで管理。来店で「指名」を付けると指名本数が自動集計されます。' },
  { icon: '📅', title: '予定とカレンダー', body: 'LINEを貼り付けるとAIが日時を読み取り。Googleカレンダー連携で自動同期もできます。' },
  { icon: '📊', title: '売上・目標・レース', body: '今月の目標（月締めカウントダウン）と、看板レース等の試用期間レースを設定。売上や指名に自動連動できます。' },
  { icon: '🔮', title: '占い・相性診断', body: 'お客様との相性をAIが鑑定。結果は端末内にだけ保存されます。' },
  { icon: '🤵', title: 'AI黒服「クロ」', body: '接客や安全の悩みを相談。内容は端末内のみに保存。危険を感じたら必ず担当・お店へ連絡を。' },
]

export function Onboarding() {
  const { user } = useAuth()
  const toast = useToast()
  const { settings, loading } = useProfileSettings()
  const [dismissed, setDismissed] = useState<boolean>(
    () => typeof localStorage !== 'undefined' && localStorage.getItem(doneKey(user?.uid)) === '1',
  )
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  // 表示条件：設定読込済み・源氏名未設定・未完了
  if (loading || dismissed || settings.stageName?.trim()) return null

  const finish = () => {
    localStorage.setItem(doneKey(user?.uid), '1')
    setDismissed(true)
  }

  const saveName = async () => {
    if (!name.trim()) {
      setStep(1)
      return
    }
    setSaving(true)
    try {
      await saveProfileSettings({ stageName: name.trim() })
      toast('源氏名を設定しました ✓')
      setStep(1)
    } catch (e) {
      toast(e instanceof Error ? e.message : '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 sm:items-center">
      <div className="safe-bottom max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-6 dark:bg-night sm:rounded-3xl">
        {step === 0 ? (
          <div className="space-y-4">
            <p className="text-[13px] font-bold tracking-widest text-gold">WELCOME</p>
            <h2 className="font-serif text-[24px] font-bold leading-tight">
              ようこそ、キャバ帳へ🌙
            </h2>
            <p className={`text-[13px] leading-relaxed ${subTx}`}>
              まず、お店で使う<strong>源氏名</strong>を決めましょう。Googleの名前は使いません。あとから変更できます。
            </p>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="源氏名（例：れいな）"
              className={inputCls}
              autoFocus
            />
            <button
              type="button"
              onClick={() => void saveName()}
              disabled={saving}
              className="w-full min-h-[52px] rounded-2xl bg-gold text-night font-bold text-[16px] shadow-lg shadow-gold/30 disabled:opacity-50"
            >
              {saving ? '設定中…' : 'はじめる'}
            </button>
            <button type="button" onClick={() => setStep(1)} className={`w-full text-center text-[12px] ${subTx}`}>
              あとで設定する
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <h2 className="font-serif text-[22px] font-bold">できること</h2>
            <div className="space-y-3">
              {GUIDE.map((g) => (
                <div key={g.title} className="flex gap-3">
                  <span className="text-[22px]" aria-hidden="true">
                    {g.icon}
                  </span>
                  <div>
                    <p className="text-[14px] font-bold">{g.title}</p>
                    <p className={`text-[12px] leading-relaxed ${subTx}`}>{g.body}</p>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={finish}
              className="w-full min-h-[52px] rounded-2xl bg-gold text-night font-bold text-[16px] shadow-lg shadow-gold/30"
            >
              使ってみる
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
