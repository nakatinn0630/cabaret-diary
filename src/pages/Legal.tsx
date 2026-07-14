import { useNavigate } from 'react-router-dom'
import { Header, Main, Card, subTx } from '../components/ui'

// プライバシーポリシー / 利用規約（個人情報を扱うため掲示）。
// 記載は本アプリの実装に即した内容。連絡先は運営者が設定してください。
export default function Legal() {
  const navigate = useNavigate()
  return (
    <div className="h-full flex flex-col">
      <Header title="プライバシー・利用規約" back onBack={() => navigate(-1)} />
      <Main className="!pb-16">
        <Card className="p-4 space-y-3 text-[13px] leading-relaxed">
          <h2 className="font-serif text-[16px] font-bold">プライバシーポリシー</h2>
          <p className={subTx}>最終更新：2026-07-14</p>

          <section className="space-y-1">
            <h3 className="font-bold">取得する情報</h3>
            <p>Googleログインで取得するアカウント情報（メールアドレス・表示名）、およびアプリに入力した顧客情報・予定・売上・目標などのデータ。</p>
          </section>
          <section className="space-y-1">
            <h3 className="font-bold">保存先と管理</h3>
            <p>入力データは Google の Firebase（Firestore）に保存され、あなたのアカウント（uid）に紐づき、本人のみがアクセスできます（セキュリティルールで強制）。店舗機能では、所属店舗の管理者が閲覧できる範囲（発信・売上・ランキング等）に限り共有されます。</p>
          </section>
          <section className="space-y-1">
            <h3 className="font-bold">端末内のみに保存する情報</h3>
            <p>AI黒服「クロ」への相談内容と、占い・相性診断の結果は、<b>サーバに保存せず、この端末内（ブラウザのローカル保存）にのみ</b>保持します。機種変更やブラウザのデータ削除で消えます。設定から手動で消去できます。</p>
          </section>
          <section className="space-y-1">
            <h3 className="font-bold">本名の暗号化（任意）</h3>
            <p>顧客の本名は、任意でパスフレーズによる暗号化を有効にできます。パスフレーズはサーバに送信されず、この端末内でのみ復号できます。</p>
          </section>
          <section className="space-y-1">
            <h3 className="font-bold">AIへの送信</h3>
            <p>返信案・占い・相談・予定の読み取りでは、入力内容の一部を応答生成のため外部のAIサービスへ送信します。送信前に電話番号などは簡易マスキングします。</p>
          </section>
          <section className="space-y-1">
            <h3 className="font-bold">Googleカレンダー連携（任意）</h3>
            <p>連携を許可した場合のみ、アプリの予定を専用カレンダーに書き込みます。許可はいつでも解除できます。</p>
          </section>
          <section className="space-y-1">
            <h3 className="font-bold">第三者提供・削除</h3>
            <p>法令に基づく場合を除き、第三者へ提供しません。データはアプリ内の操作（ログアウト・顧客削除・相談履歴の消去）で削除できます。</p>
          </section>
          <section className="space-y-1">
            <h3 className="font-bold">お問い合わせ</h3>
            <p className={subTx}>運営者までご連絡ください（連絡先は運営者が設定します）。</p>
          </section>
        </Card>

        <Card className="p-4 space-y-3 text-[13px] leading-relaxed">
          <h2 className="font-serif text-[16px] font-bold">利用規約</h2>
          <section className="space-y-1">
            <h3 className="font-bold">目的・対象</h3>
            <p>本アプリは接客業務を支援する個人向けツールです。業務目的での利用を想定しています。</p>
          </section>
          <section className="space-y-1">
            <h3 className="font-bold">利用者の責任</h3>
            <p>入力する情報の正確性・適法性、および第三者（顧客等）の個人情報の取り扱いは、利用者の責任で行ってください。違法・反社会的な目的での利用を禁止します。</p>
          </section>
          <section className="space-y-1">
            <h3 className="font-bold">AIの回答について</h3>
            <p>AI（占い・返信・黒服「クロ」等）の出力は参考情報であり、正確性・安全性を保証しません。重要な判断はご自身の責任で行い、危険を感じた場合は必ず人間の担当・店舗など信頼できる相手へ連絡してください。</p>
          </section>
          <section className="space-y-1">
            <h3 className="font-bold">免責・変更</h3>
            <p>本アプリは現状有姿で提供され、利用により生じた損害について運営者は責任を負いません。仕様は予告なく変更・停止する場合があります。</p>
          </section>
        </Card>
      </Main>
    </div>
  )
}
