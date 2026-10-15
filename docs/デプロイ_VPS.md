# キャバ帳 VPS 配備手順(共用 XServer VPS・サーバー + SQLite)

更新: 2026-10-16(Firebase をやめ、ログインとデータ保存を VPS に移した版)

キャバ帳を、AINOWA の共用 XServer VPS(153.115.47.117)で動かす手順です。
**Firebase は使いません。** Google ログインもデータの保存も、VPS 上のキャバ帳サーバー(`server/`)が行います。

| 項目 | 値 |
|---|---|
| 公開 URL | https://kyabacho.ainowa.net |
| アプリ名(APP_NAME) | `kyabacho` |
| 構成 | nginx → 127.0.0.1:3010 のキャバ帳サーバー(Node 22。systemd `app-kyabacho`) |
| 配置先 | `/srv/apps/kyabacho/app`(`server.js` + `public/` = 画面) |
| データ | `/srv/apps/kyabacho/data/kyabacho.db`(SQLite)。1 時間ごとに `snapshot.db` を作成、毎日 data/ を `backups/` へ(14 日保持) |
| 設定 | `/srv/apps/kyabacho/.env`(`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `APP_ORIGIN` / `SESSION_SECRET` など。Git・GitHub には置かない) |
| 配備方法 | GitHub Actions「deploy-vps」(`AUTO_DEPLOY=true` なら main への反映で自動) |
| 追加の月額費用 | 0 円(既存の共用 VPS に同居) |

## 仕組み

```
ブラウザ ──https──▶ nginx ──▶ キャバ帳サーバー(server/server.js)
                               ├─ /api/auth/*  Google ログイン(OAuth。Cookie でログイン状態を保持)
                               ├─ /api/db      データの読み書き(SQLite。本人/店舗の境界をサーバーで判定)
                               └─ それ以外     画面(public/。未知のパスは index.html)
```

- 画面側のコードは Firestore と同じ書き方(`src/lib/fsdb.ts`)で `/api/db` を呼びます。
- アクセス制限は Firebase 時代の `firestore.rules`(`docs/legacy/`)を `server/lib/rules.js` に移植しました。
  移植時に 2 点締めています: 招待コードなしで店舗に参加できない / 本人が自分の役割(店長など)を変えられない。
- 他の端末での変更は、画面を開いている間 15 秒ごと(と画面に戻ったとき)に取り直して反映します。
- 生成AIの機能は「蓋閉じ」中です(下記)。

## 切り替え(Mac で1コマンド)

静的配信(--spa)で動いている今の kyabacho を、サーバー構成に切り替えてデータを移します。何度実行しても安全です。

```bash
cd ~/cabaret-diary-vps && git fetch -q && git checkout feat/vps-db && git pull -q
bash scripts/setup-vps.sh --dry-run   # 確認だけ
bash scripts/setup-vps.sh             # 本番
```

| 順 | 内容 | 聞かれること |
|---|---|---|
| 0 | 事前チェック(gh・VPS の root 鍵・DNS) | — |
| 2 | VPS を Node 構成に切り替え(nginx 設定を退避 → add-app.sh → 既存の証明書で HTTPS を入れ直す) | 切り替えてよいか(y) |
| 3 | Google ログインの設定を VPS の .env へ | クライアント ID / シークレット(下記) |
| 4 | GitHub の Secrets / Variables を確認 | — |
| 5 | PR をマージ → 配備の完了を待つ → `/api/health` を確認 | マージしてよいか(y) |
| 6 | Firebase のデータを移行(任意) | サービスアカウント鍵のパス、取り込んでよいか(y) |

**2 から 5 の間(数分)はメンテナンス表示**になります。
配備ワークフローは VPS が Node 構成でないと配備を中止するので、PR を先にマージしてしまっても本番は壊れません。

### Google ログインのクライアント(手順 3)

Google Cloud コンソール → API とサービス → 認証情報(プロジェクト `cabaret-diary`)。
Firebase が作った「Web client (auto created by Google Service)」をそのまま使えます。

- 承認済みの JavaScript 生成元: `https://kyabacho.ainowa.net`(Google カレンダー連携に使う)
- 承認済みのリダイレクト URI: `https://kyabacho.ainowa.net/api/auth/google/callback`

> この OAuth クライアントは Firebase プロジェクト(= Google Cloud プロジェクト `cabaret-diary`)の中にあります。
> 将来 Firebase プロジェクトを削除するなら、先に別の Google Cloud プロジェクトでクライアントを作り直し、.env を差し替えてください。

### データ移行(手順 6)

- Firestore の全文書と、Authentication のユーザー(uid・Google アカウントの ID)を移します。
  **uid を引き継ぐので、同じ Google アカウントでログインすれば今までのデータがそのまま見えます。**
- 暗号化済みの本名(パスフレーズで暗号化したもの)は暗号のまま移します。パスフレーズはそのまま使えます。
- 必要なもの: Firebase のサービスアカウント鍵(Firebase コンソール → プロジェクトの設定 → サービスアカウント →「新しい秘密鍵を生成」)。
  **強い権限の鍵です。移行が終わったら Mac から削除し、Google Cloud の IAM でも鍵を削除してください。**
- 移行データは画面・Git に残しません(VPS へ送って取り込んだ後に削除します)。
- 移行前に VPS へログインした人がいる場合は、VPS 側のデータを置き換えるか確認します。
- Google 以外(メール/パスワード)でログインしていたユーザーは、新しいログインでは元のデータに入れません(移行時に人数を表示します)。

## 生成AIの機能(蓋閉じ)

返信アシスト・特別連絡の文面作成・AI黒服「クロ」・占い/相性診断・予定のAI読み取りは、画面から導線を外し、外部の AI サービスへの送信もしません(コードは残しています)。

- 再開: GitHub の Variables に `VITE_ENABLE_AI=true` を追加して再配備(AI のキーは Secrets `VITE_AI_API_KEY`)。
- 蓋閉じ中は AI のキーをビルドに渡しません(配信される JS にキーが入らない)。
- 「今日のひとこと連絡」のおすすめ一覧と、予定の貼り付け読み取り(AI なしの読み取り)は残しています。

## 確認

- [ ] `https://kyabacho.ainowa.net/api/health` が `{"ok":true}`
- [ ] Google ログイン → 以前の顧客が見える(移行した場合)
- [ ] 顧客の登録 → 再読み込みしても残る
- [ ] メニュー・タブに AI の機能(返信・クロ・占い)が出ない
- [ ] 店舗コンソール: 招待コードで参加できる / 罰金・連絡が本人だけに見える

## 運用メモ

- ログ: `journalctl -u app-kyabacho -f`(VPS で root)
- 再起動: `systemctl restart app-kyabacho`
- バックアップから戻す: サービスを止め、`data/kyabacho.db` を `snapshot.db`(または `backups/data-*.tar.gz` の中身)で置き換えて起動
- DB の状態: `sudo -u app-kyabacho env DATA_DIR=/srv/apps/kyabacho/data node /srv/apps/kyabacho/app/status.js`
- 旧サイト(Firebase Hosting の cabaret-diary.web.app)は止めていません。二重に使われないよう、移行後に停止を検討してください。

## テスト

```bash
cd server && npm ci && npm test            # サーバー(アクセス制限・読み書き・ログイン)
cd scripts/migrate && npm ci && npm test   # 移行(書き出し → 取り込み → 同じ uid でログイン)
npm run typecheck && npm run lint && npm run build
```

ローカルで画面ごと動かす: `npm run build` → `cd server && DEV_LOGIN=1 PUBLIC_DIR=../dist node server.js`
(`DEV_LOGIN=1` はテスト用ログイン `/api/auth/dev-login` を有効にします。本番 `NODE_ENV=production` では無効)
