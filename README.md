# キャバ帳 / Cabaret Diary

> 和名「キャバ帳」＝英名「Cabaret Diary」。本プロジェクトはキャバ帳専用。公開URL: https://cabaret-diary.web.app

キャバクラで働くキャスト向けの、顧客管理・スケジュール・LINE営業・メンタルケア・売上管理を1つで完結するパーソナルアプリ。加えて、店舗（担当黒服・店長）向けの店舗コンソールを備える。

- 業務要件定義: [`docs/キャバ帳_業務要件定義_v1.2.md`](docs/キャバ帳_業務要件定義_v1.2.md)
- 占い鑑定ペルソナ（参考）: [`docs/prompts/占い鑑定ペルソナ_参考.md`](docs/prompts/占い鑑定ペルソナ_参考.md)

## 技術スタック（決定: D-3）

- フロント: **React 18 + Vite + PWA**（Tailwind CSS）
- バックエンド: Firebase（Auth / Firestore / 将来 Cloud Functions）
- 認証: Firebase Authentication（Google OAuth / SEC-01）
- Firebaseプロジェクト: `cabaret-diary`（公開URL: `cabaret-diary.web.app`）

## サーフェス構成（D-1）

- **キャストアプリ**（`/`）: キャスト個人が使う。顧客・占い・売上などの個人領域。
- **店舗コンソール**（`/console`）: 担当黒服・店長向けの管理画面。キャスト個人領域には一切アクセスしない。
  - ※現状は同一Viteアプリ内のルート分離。将来的に別デプロイへ分離予定。

## セットアップ

```bash
npm install
cp .env.example .env   # Firebaseの値を記入（.env はコミットしない）
npm run dev            # http://localhost:5173
```

## スクリプト

| コマンド | 内容 |
|---|---|
| `npm run dev` | 開発サーバ |
| `npm run build` | 型チェック + 本番ビルド |
| `npm run preview` | ビルド成果物のプレビュー |
| `npm run typecheck` | 型チェックのみ |

## ディレクトリ

```
src/
  lib/firebase.ts          Firebase初期化（環境変数から注入）
  contexts/AuthContext.tsx Google OAuth 認証
  pages/
    LoginPage.tsx          ログイン
    cast/CastHome.tsx      キャストアプリ ホーム（Phase 1で顧客DB等）
    console/ConsoleHome.tsx 店舗コンソール ホーム（Phase 5で発信等）
firestore.rules            SEC-02準拠のセキュリティルール
docs/                      要件定義・設計ドキュメント
```

## 実装ロードマップ（要件定義書の開発フェーズ準拠）

| Phase | 内容 |
|---|---|
| 0（現在） | スキャフォールド（React PWA + Firebase + 認証 + ルール整備） |
| 1 | 顧客DB + 来店履歴 + リスクスコア（F-01/02/03） |
| 2 | スケジュール + Googleカレンダー連携（F-04） |
| 3 | LINEトーク取込 + AI返信案（F-05/06/07） |
| 4 | 黒服機能 + 売上レポート（F-08/09） |
| 5 | 店舗連携（F-15〜F-18）+ 店舗コンソール |
