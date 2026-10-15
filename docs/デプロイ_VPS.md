# キャバ帳 VPS 配備手順(共用 XServer VPS・静的配信)

作成: 2026-10-15 / 対象コミット: main 1fc2729 + このブランチ

キャバ帳(Vite の静的 PWA)を、AINOWA の共用 XServer VPS(153.115.47.117)の nginx から配信する手順です。
**データ・ログインは引き続き Firebase(Auth / Firestore)** を使います。VPS が受け持つのは画面ファイルの配信だけです。

| 項目 | 値 |
|---|---|
| 公開URL(案) | https://kyabacho.ainowa.net |
| アプリ名(APP_NAME) | `kyabacho` |
| 配置先 | `/srv/apps/kyabacho/app`(nginx が直接配信。Node プロセスなし) |
| ポート | 3010(静的配信のため実際には使わない。重複防止の予約) |
| 配備方法 | GitHub Actions「deploy-vps」を手動実行(`.github/workflows/deploy-vps.yml`) |
| 追加の月額費用 | 0円(既存の共用 VPS に同居) |

## 自動セットアップ(Mac で1コマンド)

下の「手順」①〜⑥を、Mac(Mac mini など)で自動実行するスクリプトがあります。何度実行しても安全です(済んだ手順は飛ばします)。

```bash
gh repo clone nakatinn0630/cabaret-diary && cd cabaret-diary
git checkout feat/vps-deploy        # PR マージ後は不要(main にある)
bash scripts/setup-vps.sh --dry-run # 確認だけ(何も変更しない)
bash scripts/setup-vps.sh           # 本番。PR のマージ前に y/N を1回聞く(--yes で省略)
```

Finder からは `scripts/setup-vps.command` をダブルクリックでも動きます。

| 必要なもの(Mac) | 用途 | 無いとき |
|---|---|---|
| `gh`(ログイン済み) | Secrets 登録・PR マージ・配備の実行 | 停止(`brew install gh` → `gh auth login`) |
| `~/.ssh/vps_portal`(VPS の root 鍵) | add-app.sh の実行 | 停止(構築に使った Mac から安全にコピー) |
| Node.js(`npx`) | Firebase の構成値の取得(初回はブラウザでログイン) | 停止 |
| `gcloud`(ログイン済み) | Firebase の承認済みドメインの追加 | ブラウザで追加画面を開いて案内(Enter で続行) |

- **DNS だけは自動化していません**(Xserver レンタルサーバーの DNS を操作する API を確認できていないため)。未設定なら案内を出し、反映されるまで最大60分待ってから続きを実行します。
- 秘密鍵・API キーは画面・ログに出さず、`gh secret set` に直接渡します。VPS 上の一時鍵は登録後に削除します。
- 社内ポータルの PR(配備キット)は**マージしません**(マージするとポータル本番の再配備が走るため)。キットはブランチ `feat/vps-static-spa` から取得します。
- 最後に Variables `AUTO_DEPLOY=true` を設定し、以後は main への反映で自動配備されます(`--no-auto-deploy` で無効)。

## 前提

- 共用 VPS のキット(nakatinn0630/yell-staff-portal の `deploy/vps/add-app.sh`)に **`--spa` オプションが入っていること**。
  `--spa` が無い版の `--static` では、`/demo` や `/customers/...` をリロードすると 404 になります。
- Claude の作業環境から VPS へは SSH できません。①〜④はなかむーが行います。

## 手順

| 順 | 誰が | 内容 |
|---|---|---|
| ① | なかむー | Xserver **レンタルサーバー**のサーバーパネル →「DNSレコード設定」で `kyabacho.ainowa.net` の A レコード → `153.115.47.117` を追加 |
| ② | なかむー | Mac から VPS で `add-app.sh` を実行(下記) |
| ③ | なかむー | 表示された値と Firebase の構成値を、このリポジトリの Secrets / Variables に登録(下記) |
| ④ | なかむー | Firebase コンソール → Authentication → 設定 →「承認済みドメイン」に `kyabacho.ainowa.net` を追加 |
| ⑤ | なかむー | この PR を承認・マージ → Actions →「deploy-vps」→ Run workflow |
| ⑥ | Claude/なかむー | 下の「確認」を実施 |

### ② add-app.sh の実行

```bash
# キットを最新にして VPS へ送る(yell-staff-portal を置いている場所で)
git pull
rsync -az -e "ssh -i ~/.ssh/vps_portal" deploy/vps/ root@153.115.47.117:/root/vps-setup/

# 確認だけ(何も変更しない)
ssh -i ~/.ssh/vps_portal root@153.115.47.117 'bash /root/vps-setup/add-app.sh kyabacho kyabacho.ainowa.net 3010 <メールアドレス> --spa --dry-run'

# 本番実行
ssh -i ~/.ssh/vps_portal root@153.115.47.117 'bash /root/vps-setup/add-app.sh kyabacho kyabacho.ainowa.net 3010 <メールアドレス> --spa'
```

最後に**配備用の秘密鍵が1回だけ**表示されます。画面・履歴を共有しないでください。

### ③ GitHub に登録する値

このリポジトリ → Settings → Secrets and variables → Actions。

| 種類 | 名前 | 値 |
|---|---|---|
| Secret | `VPS_HOST` | `153.115.47.117` |
| Secret | `VPS_PORT` | `22` |
| Secret | `VPS_USER` | `deploy` |
| Secret | `VPS_SSH_KEY` | ②で表示された秘密鍵(`-----BEGIN` 〜 `-----END` まで) |
| Secret | `VPS_KNOWN_HOSTS` | ②で表示された1行(推奨) |
| Secret | `VITE_FIREBASE_API_KEY` ほか `VITE_FIREBASE_*` 6個 | 現在 Firebase Hosting 版のビルドに使っている値と同じ(必須: API_KEY / PROJECT_ID / APP_ID) |
| Secret | `VITE_AI_API_KEY` | 任意。Groq 等のキー(未設定ならAI機能は端末内の簡易生成) |
| Secret | `VITE_AI_PROXY_URL` | 任意。キーを秘匿するプロキシを用意した場合のみ |
| Variable | `APP_NAME` | `kyabacho` |
| Variable | `APP_URL` | `https://kyabacho.ainowa.net`(配備後の疎通確認用) |
| Variable | `VITE_AI_BASE_URL` / `VITE_AI_MODEL` | 任意(既定は Groq / llama-3.3-70b-versatile) |
| Variable | `BUILD_SCRIPT` | 任意。`build`(既定・キャストと店舗の両方)/ `build:cast` / `build:store` |

## 確認(⑥)

- [ ] `https://kyabacho.ainowa.net` が表示され、`http://` は `https://` に転送される
- [ ] `https://kyabacho.ainowa.net/demo` を**直接開いて**、リロードしても表示される(SPA 設定の確認)
- [ ] Google ログインが通る(弾かれる場合は④の承認済みドメインを確認)
- [ ] 顧客の登録・表示ができる(Firestore に届いている)
- [ ] 2回目以降の表示で `assets/` がブラウザキャッシュから読まれる(開発者ツールの Network で `(disk cache)`)

## 注意・未確認事項

- **個人情報の保存場所は変わりません。** 顧客データは Firestore(Google 社のサービス)にあります。仕様書 v3.0 の「ローカルファースト+E2E暗号化+国内サーバー」は**未実装**で、VPS 配備はその前段(画面の配信先の移動)です。
- `VITE_AI_API_KEY` は配信される JS に含まれ、閲覧者から見えます(Firebase Hosting 版と同じ状態)。従量課金の API を使う場合は利用上限を設定してください。
- Firebase Hosting 版(cabaret-diary.web.app)は止めていません。並行稼働になります。片方に寄せるかは別途判断してください。
- 配備ワークフローは GitHub Actions 上・実 VPS 上ではまだ実行していません(作業環境で `actionlint`、本番ビルド、rsync の入れ替え手順、`--spa` の nginx 設定の実配信を確認済み)。
