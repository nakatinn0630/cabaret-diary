import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { Header, Main, Card, Avatar, subTx } from '../../components/ui'

const items: { icon: string; label: string; to: string }[] = [
  { icon: '📊', label: '売上レポート', to: '/sales' },
  { icon: '🤵', label: '黒服相談', to: '/consult' },
  { icon: '🔮', label: '占い・相性診断', to: '/compat' },
  { icon: '🔔', label: 'お知らせ', to: '/notices' },
  { icon: '🏢', label: '店舗コンソール', to: '/console' },
]

// クロードデザインの MenuScreen を移植（プロフィール＋各機能導線＋ログアウト）
export default function Menu() {
  const { user, signOut } = useAuth()
  const name = user?.displayName ?? user?.email ?? 'ゲスト'

  return (
    <div className="h-full flex flex-col">
      <Header title="メニュー" />
      <Main>
        <Card className="p-4 flex items-center gap-3">
          <Avatar name={name} size={48} />
          <div>
            <p className="text-[15px] font-bold">{name}</p>
            <p className={`text-[12px] ${subTx}`}>キャスト</p>
          </div>
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
