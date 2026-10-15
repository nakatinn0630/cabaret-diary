# キャバ帳 / Cabaret Diary

キャバクラで働く**キャスト**向けの、顧客管理・スケジュール・LINE営業・占い・メンタルケア・売上/目標管理を1つにまとめたパーソナル PWA。加えて、**店舗（店長・黒服）**向けの店舗コンソールを備え、キャスト⇄店舗の連絡・ノルマ・罰金・売上を連携できる。

- 🌐 **アプリ本体**（Googleログイン）: https://cabaret-diary.web.app
- 🔎 **デモ**（ログイン不要・テストデータ入り）: https://cabaret-diary.web.app/demo

> 和名「キャバ帳」＝英名「Cabaret Diary」。React 18 + Vite の Web アプリ（PWA）。データとログインは VPS 上のキャバ帳サーバー（Node + SQLite）。

---

## 主な機能

### キャスト向け（個人領域 `/`）
- **顧客管理**: あだ名・LINE名・電話（ワンタップコピー）・誕生日（🎂バッジ／占い自動反映）・タグ・ランク（VVIP〜BADBOY）。本名は任意でパスフレーズ暗号化（SEC-07）。
- **来店記録**: 金額・同伴・アフター・**指名**・ボトル。指名本数は記録から自動集計。
- **リスク管理**: 収入と使用額のバランス等からリスクスコアと注意フラグを自動算出。
- **スケジュール**: ネイティブ日付/時刻入力（YYYY/MM/DD・24時間表示）。**LINEを貼り付けるとAIが種別・日時・お客様を自動入力**。登録先を **Googleカレンダー / iPhone(端末).ics** からスイッチで選択（設定として記憶）。
- **売上・目標**: 月の目標（月締めカウントダウン）・保証カウントダウン・指名リング。**試用期間レース**（看板レース等を自由設定、売上/指名に自動連動可）。
- **占い・相性診断**: 生年月日等からAIが関係性別に鑑定。結果は端末内のみ保存（DB非保存）。
- **AI黒服「クロ」**: 接客・安全・メンタルの相談。相談内容は端末内のみ保存。危険時は「AIに頼らず担当・お店へ」誘導（AIは警察通報しない）。
- **返信アシスト**: 顧客ごとにAIが返信案を生成。LINEトーク取込で口調を学習。

### 店舗向け（コンソール `/console`）
- **メンバー管理**: 招待コード発行、担当黒服の割り当て、ノルマ設定、**罰金**の発行/支払管理、キャストへの連絡（本人と店のみ可視）。
- 発信（お知らせ）・売上確定・ランキング公開。

### セキュリティ・プライバシー
- Firestore セキュリティルールで **本人(uid)以外はアクセス不可**。店舗データはメンバー範囲のみ。
- **端末ローカルのみ保存**: AI黒服の相談・占い結果（サーバに保存しない）。
- **本名の暗号化（任意・E2E）**: PBKDF2→AES-GCM。パスフレーズはサーバに送らない。
- Google認証は毎回アカウント選択を表示し、別アカウントのデータ混在を防止。

---

## 技術スタック
- **フロント**: React 18 + Vite + TypeScript(strict) + Tailwind CSS + react-router-dom v6 + PWA（vite-plugin-pwa）
- **バックエンド**: キャバ帳サーバー（`server/`。Node 22 + SQLite / better-sqlite3）。Google ログインをサーバーが直接処理し、本人/店舗の境界をサーバーで判定。共用 XServer VPS で稼働
- **AI**: 現在は蓋閉じ中（`VITE_ENABLE_AI=true` で再開）。OpenAI互換API（既定は Groq / `llama-3.3-70b-versatile`）。`VITE_AI_*` で差し替え可能。
- **カレンダー**: Google Calendar API 連携 ＋ iCalendar(.ics) 生成（端末カレンダー登録）

## サーフェス分離（キャスト / 店舗）
同一コードベースをビルド時 env **`VITE_SURFACE`** で切替え、URLごとに露出する画面を排他化できる。
- `VITE_SURFACE=cast` → キャスト画面のみ（`npm run build:cast`）
- `VITE_SURFACE=store` → 店舗コンソールのみ（`npm run build:store`）
- 未指定（既定）→ 両方（単一URL運用）

## セットアップ
```bash
npm install && (cd server && npm install)
(cd server && DEV_LOGIN=1 node server.js)   # API: http://127.0.0.1:3010（DEV_LOGIN=1 はテスト用ログインを有効化）
npm run dev                                 # 画面: http://localhost:5173（/api はサーバーへ中継）
```

## スクリプト
| コマンド | 内容 |
|---|---|
| `npm run dev` | 開発サーバ |
| `npm run build` | 型チェック + 本番ビルド（両サーフェス） |
| `npm run build:cast` / `build:store` | サーフェス分離ビルド |
| `npm run preview` | ビルド成果物のプレビュー |
| `npm run typecheck` | 型チェックのみ |
| `npm run lint` | ESLint |

## ディレクトリ
```
src/
  lib/            backend(ログイン), fsdb(Firestore 互換の保存), customers, schedules, sales, stores, ai, features, ics, crypto …
  contexts/       AuthContext(Google ログイン), CryptoContext(SEC-07)
  components/     UIキット・Onboarding・BottomNav・VisitForm など
  pages/
    cast/         キャストアプリ（顧客・予定・売上・占い・クロ・返信・お知らせ・メニュー）
    console/      店舗コンソール（メンバー管理・発信・売上確定・ランキング）
server/           キャバ帳サーバー（API・Google ログイン・アクセス制限 lib/rules.js・SQLite）
scripts/          setup-vps.sh（VPS の構築・切り替え）/ migrate/（Firebase からの移行）
docs/             要件定義・DB設計・デプロイ手順・プロンプト
```

## デプロイ
**共用 XServer VPS**（サーバー + SQLite・GitHub Actions）: [`docs/デプロイ_VPS.md`](docs/デプロイ_VPS.md)
初回・切り替えは Mac で `bash scripts/setup-vps.sh`。以後は main への反映で自動配備。

Firebase（Hosting / Firestore / Authentication）は 2026-10 に使用をやめました（旧手順: `docs/デプロイ手順.md`）。

## ドキュメント
- 業務要件定義: [`docs/キャバ帳_業務要件定義_v1.2.md`](docs/キャバ帳_業務要件定義_v1.2.md)
- DB設計: [`docs/キャバ帳_DB設計_v1.0.md`](docs/キャバ帳_DB設計_v1.0.md)
- AI黒服「クロ」システムプロンプト: [`docs/prompts/AI黒服クロ_システムプロンプト.md`](docs/prompts/AI黒服クロ_システムプロンプト.md)
- UI/UX レビュー100件: [`docs/UIレビュー_100件.md`](docs/UIレビュー_100件.md)
