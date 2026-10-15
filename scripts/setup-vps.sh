#!/usr/bin/env bash
# setup-vps.sh — キャバ帳を共用 XServer VPS で「サーバー + SQLite」構成で動かすまでを、Mac から1コマンドで実行する。
# (Firebase は使わない。ログインもデータ保存も VPS 上のキャバ帳サーバーが行う)
#
#   bash scripts/setup-vps.sh                 # 対話あり(要所で y/N を聞く)
#   bash scripts/setup-vps.sh --dry-run       # 確認だけ。VPS・GitHub は何も変更しない
#   オプション: --skip-merge(PR をマージしない) / --skip-migrate(Firebase からのデータ移行をしない)
#
# やること(何度実行しても安全。済んでいる手順は飛ばす):
#   0. 事前チェック(gh のログイン、VPS の root 鍵、必要なコマンド)
#   1. DNS: kyabacho.ainowa.net の A レコードを確認
#   2. VPS: 静的配信(--spa)で作ってあれば、Node のサーバー構成に切り替える(add-app.sh。HTTPS 証明書は再利用)
#   3. VPS: Google ログインの設定(GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / APP_ORIGIN)を .env に書く
#   4. GitHub: 配備に使う Secrets / Variables を確認・登録
#   5. PR をマージ → 配備の完了を待つ → 公開 URL と /api/health を確認
#   6. Firebase からのデータ移行(Firestore の全データ + ログインユーザー。uid を引き継ぐ)
#
# 切り替えの順番が大事: 2 → 5。VPS を先に Node 構成にしないと、新しい配備物を受け取れない
# (配備ワークフローは VPS が Node 構成でなければ配備を中止するので、順番を間違えても本番は壊れない)。
# 2 から 5 の間(数分)は、サイトにメンテナンス表示が出る。
#
# 秘密情報(Google のクライアントシークレット、配備鍵、移行データ)は画面・ログ・Git に残さない。
#
# 環境変数で上書き可:
#   APP_NAME(kyabacho) DOMAIN(kyabacho.ainowa.net) PORT(3010) EMAIL(gh のアカウントのメール)
#   VPS_IP(153.115.47.117) ROOT_KEY(~/.ssh/vps_portal) GCP_PROJECT(cabaret-diary)
#   APP_REPO(nakatinn0630/cabaret-diary) APP_PR(未指定なら feat/vps-db の PR) KIT_REPO(nakatinn0630/yell-staff-portal)
#   KIT_REF(feat/vps-static-spa) SA_KEY(Firebase のサービスアカウント鍵 JSON のパス)
set -euo pipefail

APP_NAME="${APP_NAME:-kyabacho}"
DOMAIN="${DOMAIN:-kyabacho.ainowa.net}"
PORT="${PORT:-3010}"
VPS_IP="${VPS_IP:-153.115.47.117}"
ROOT_KEY="${ROOT_KEY:-$HOME/.ssh/vps_portal}"
GCP_PROJECT="${GCP_PROJECT:-cabaret-diary}"
APP_REPO="${APP_REPO:-nakatinn0630/cabaret-diary}"
APP_BRANCH="${APP_BRANCH:-feat/vps-db}"
APP_PR="${APP_PR:-}"
KIT_REPO="${KIT_REPO:-nakatinn0630/yell-staff-portal}"
KIT_REF="${KIT_REF:-feat/vps-static-spa}"
EMAIL="${EMAIL:-}"
SA_KEY="${SA_KEY:-}"
DRY=0; DO_MERGE=1; DO_MIGRATE=1
APP_ROOT="/srv/apps/$APP_NAME"
UNIT="app-$APP_NAME"
SITE="/etc/nginx/sites-available/app-$APP_NAME"

for a in "$@"; do
  case "$a" in
    --dry-run) DRY=1 ;;
    --skip-merge) DO_MERGE=0 ;;
    --skip-migrate) DO_MIGRATE=0 ;;
    -h|--help) sed -n '2,30p' "$0"; exit 0 ;;
    *) echo "不明なオプション: $a" >&2; exit 2 ;;
  esac
done

C_OK=$'\033[32m'; C_NG=$'\033[31m'; C_H=$'\033[1;36m'; C_0=$'\033[0m'
step() { printf '\n%s=== %s ===%s\n' "$C_H" "$*" "$C_0"; }
ok()   { printf '%s✓%s %s\n' "$C_OK" "$C_0" "$*"; }
warn() { printf '  ! %s\n' "$*"; }
die()  { printf '%s✗ %s%s\n' "$C_NG" "$*" "$C_0" >&2; exit 1; }
confirm() {
  printf '%s [y/N] ' "$1"; read -r ans </dev/tty || ans=""
  case "$ans" in y|Y|yes|YES) return 0 ;; *) return 1 ;; esac
}
SSH_ROOT() { ssh -i "$ROOT_KEY" -o BatchMode=yes -o ConnectTimeout=10 "root@$VPS_IP" "$@"; }
secret_exists() { gh secret list -R "$APP_REPO" --json name -q '.[].name' 2>/dev/null | grep -qx "$1"; }

WORK="$(mktemp -d "${TMPDIR:-/tmp}/kyabacho-setup.XXXXXX")"
chmod 700 "$WORK"
cleanup() { rm -rf "$WORK"; }
trap cleanup EXIT

echo "キャバ帳 VPS セットアップ(サーバー + SQLite): $APP_NAME → https://$DOMAIN (VPS $VPS_IP)"
[ "$DRY" = 1 ] && echo "(--dry-run: 確認だけ。何も変更しません)"

# ---------- 0. 事前チェック ----------
step "0/6 事前チェック"
for c in gh ssh rsync dig curl git node npm; do
  command -v "$c" >/dev/null 2>&1 || die "$c がありません(Homebrew なら: brew install ${c/npm/node})"
done
gh auth status >/dev/null 2>&1 || die "gh にログインしていません: gh auth login"
ok "gh: ログイン済み"
[ -f "$ROOT_KEY" ] || die "VPS の root 鍵がありません: $ROOT_KEY"
SSH_ROOT true || die "VPS に root で SSH できません($ROOT_KEY)。鍵・ネットワークを確認してください"
ok "VPS: root で接続できる"
if [ -z "$EMAIL" ]; then
  # gh api は失敗時もエラー本文(JSON)を標準出力に出すため、メールの形のものだけ採用する
  _is_mail() { printf '%s' "$1" | grep -Eq '^[^[:space:]@"{}]+@[^[:space:]@"{}]+\.[^[:space:]@"{}]+$'; }
  _cand="$(gh api user/emails -q '[.[]|select(.primary)][0].email' 2>/dev/null || true)"
  _is_mail "$_cand" || _cand="$(gh api user -q .email 2>/dev/null || true)"
  _is_mail "$_cand" || _cand="$(git config --global user.email 2>/dev/null || true)"
  _is_mail "$_cand" && EMAIL="$_cand"
fi
printf '%s' "$EMAIL" | grep -Eq '^[^[:space:]@]+@[^[:space:]@]+$' || die "証明書用のメールアドレスが分かりません。EMAIL=you@example.com bash $0 で指定してください"
ok "証明書の連絡先: $EMAIL"
if [ -z "$APP_PR" ]; then
  APP_PR="$(gh api "repos/$APP_REPO/pulls?head=${APP_REPO%%/*}:$APP_BRANCH&state=all" -q '.[0].number' 2>/dev/null || true)"
fi
[ -n "$APP_PR" ] || die "ブランチ $APP_BRANCH の PR が見つかりません。APP_PR=番号 で指定してください"
ok "対象の PR: #$APP_PR($APP_BRANCH)"

# ---------- 1. DNS ----------
step "1/6 DNS: $DOMAIN → $VPS_IP"
[ "$(dig +short @8.8.8.8 "$DOMAIN" A | tail -n1)" = "$VPS_IP" ] || die "A レコードが $VPS_IP を向いていません(Xserver のサーバーパネル →「DNSレコード設定」)"
ok "A レコード反映済み"

# ---------- 2. VPS: Node 構成へ ----------
step "2/6 VPS: Node のサーバー構成(add-app.sh)"
gh repo clone "$KIT_REPO" "$WORK/kit" -- -q --depth 1 --branch "$KIT_REF" 2>/dev/null \
  || { echo "($KIT_REF が無いため main を使います)"; gh repo clone "$KIT_REPO" "$WORK/kit" -- -q --depth 1; }
grep -q -- '--no-print-key' "$WORK/kit/deploy/vps/add-app.sh" || die "キットに --no-print-key がありません($KIT_REPO の $KIT_REF)"
mode="$(SSH_ROOT "sed -n 's/^# add-app: mode=//p' $SITE 2>/dev/null | head -n1" || true)"
echo "現在の構成: ${mode:-未作成}"
ADD="bash /root/vps-setup/add-app.sh $APP_NAME $DOMAIN $PORT $EMAIL --no-print-key"
if [ "$DRY" = 1 ]; then
  rsync -az -e "ssh -i $ROOT_KEY -o BatchMode=yes" "$WORK/kit/deploy/vps/" "root@$VPS_IP:/root/vps-setup-dryrun/"
  echo "(--dry-run) 切り替え後の add-app.sh(node)の予定:"
  SSH_ROOT "bash /root/vps-setup-dryrun/add-app.sh $APP_NAME $DOMAIN $PORT $EMAIL --no-print-key --dry-run 2>&1 | grep -E '^(===|\\[dry-run\\] (ファイル|ディレクトリ))' | head -30; rm -rf /root/vps-setup-dryrun" || true
elif [ "$mode" = "node" ]; then
  rsync -az -e "ssh -i $ROOT_KEY -o BatchMode=yes" "$WORK/kit/deploy/vps/" "root@$VPS_IP:/root/vps-setup/"
  SSH_ROOT "$ADD" > "$WORK/add.log" 2>&1 || { tail -40 "$WORK/add.log"; die "add-app.sh が失敗しました"; }
  ok "Node 構成は作成済み(設定を確認しました)"
else
  if [ -n "$mode" ]; then
    echo "静的配信($mode)から Node のサーバー構成に切り替えます。配備が終わるまで(数分)メンテナンス表示になります。"
    confirm "切り替えてよいですか?" || die "中止しました"
  fi
  rsync -az -e "ssh -i $ROOT_KEY -o BatchMode=yes" "$WORK/kit/deploy/vps/" "root@$VPS_IP:/root/vps-setup/"
  if [ -n "$mode" ]; then
    # 静的構成の nginx 設定を退避(add-app.sh はモードの違う既存設定を上書きしないため)。証明書と配備鍵はそのまま使う
    SSH_ROOT "set -e; b=/root/vps-setup/backup-\$(date +%Y%m%d-%H%M%S); mkdir -p \$b; cp -a $SITE \$b/; rm -f /etc/nginx/sites-enabled/app-$APP_NAME $SITE; echo \"退避: \$b\""
  fi
  SSH_ROOT "$ADD" > "$WORK/add.log" 2>&1 || { tail -40 "$WORK/add.log"; die "add-app.sh が失敗しました(退避した設定は /root/vps-setup/backup-* にあります)"; }
  grep -q 'BEGIN OPENSSH' "$WORK/add.log" && die "想定外: 秘密鍵がログに出力されました。中断します"
  grep -E '^(=== |証明書|HTTPS|配備鍵)' "$WORK/add.log" | sed 's/^/    /' || true
  ok "add-app.sh(node)完了"
fi
if [ "$DRY" = 0 ]; then
  # 証明書が取得済みだと add-app.sh は certbot を呼ばないため、作り直した nginx 設定に HTTPS を入れ直す
  if ! SSH_ROOT "grep -q 'listen 443' $SITE"; then
    SSH_ROOT "certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m $EMAIL --redirect --reinstall" > "$WORK/cert.log" 2>&1 \
      || { tail -20 "$WORK/cert.log"; die "HTTPS の設定に失敗しました"; }
    ok "HTTPS を設定(既存の証明書を再利用)"
  else
    ok "HTTPS 設定済み"
  fi
fi

# ---------- 3. Google ログインの設定 ----------
step "3/6 VPS: Google ログインの設定($APP_ROOT/.env)"
has_env() { SSH_ROOT "grep -Eq '^$1=.+' $APP_ROOT/.env" 2>/dev/null; }
if [ "$DRY" = 1 ]; then
  for k in APP_ORIGIN GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET; do has_env "$k" && echo "  $k: 設定済み" || echo "  $k: 未設定(本番で入力を求めます)"; done
else
  ENV_LINES=""
  has_env APP_ORIGIN || ENV_LINES+="APP_ORIGIN=https://$DOMAIN"$'\n'
  if has_env GOOGLE_CLIENT_ID && has_env GOOGLE_CLIENT_SECRET; then
    ok "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET は設定済み"
  else
    URL="https://console.cloud.google.com/apis/credentials?project=$GCP_PROJECT"
    cat <<EOT
Google ログイン用の OAuth クライアントが必要です。ブラウザで次を開きます:
  $URL
  1. 「OAuth 2.0 クライアント ID」の Web クライアント(Firebase が作った "Web client (auto created by Google Service)" で可)を開く
  2. 「承認済みの JavaScript 生成元」に   https://$DOMAIN   を追加
  3. 「承認済みのリダイレクト URI」に     https://$DOMAIN/api/auth/google/callback   を追加して保存
  4. 画面右側の「クライアント ID」と「クライアント シークレット」を下に貼り付ける
EOT
    command -v open >/dev/null 2>&1 && open "$URL" || true
    printf 'クライアント ID: '; read -r GCID </dev/tty
    printf 'クライアント シークレット(入力は表示されません): '; read -rs GCSEC </dev/tty; echo
    printf '%s' "$GCID" | grep -Eq '^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$' || die "クライアント ID の形式が違います(…apps.googleusercontent.com)"
    printf '%s' "$GCSEC" | grep -Eq '^[A-Za-z0-9_-]{10,100}$' || die "クライアント シークレットの形式が違います"
    ENV_LINES+="GOOGLE_CLIENT_ID=$GCID"$'\n'"GOOGLE_CLIENT_SECRET=$GCSEC"$'\n'
    unset GCSEC
  fi
  if [ -n "$ENV_LINES" ]; then
    # 値はコマンドライン引数ではなく標準入力で渡す(ps やログに出さない)。既存の同名行は置き換える
    printf '%s' "$ENV_LINES" | SSH_ROOT "set -e; f=$APP_ROOT/.env; t=\$(mktemp); cp -p \$f \$t
      while IFS= read -r line; do [ -n \"\$line\" ] || continue; k=\${line%%=*}; grep -v \"^\$k=\" \$t > \$t.n || true; mv \$t.n \$t; printf '%s\n' \"\$line\" >> \$t; done
      chown root:$UNIT \$t; chmod 640 \$t; mv \$t \$f
      systemctl is-active --quiet $UNIT && systemctl restart $UNIT || true"
    unset ENV_LINES
    ok "設定を書き込みました(値は表示しません)"
  fi
fi

# ---------- 4. GitHub ----------
step "4/6 GitHub: $APP_REPO の Secrets / Variables"
if [ "$DRY" = 1 ]; then
  for s in VPS_HOST VPS_PORT VPS_USER VPS_SSH_KEY; do secret_exists "$s" && echo "  $s: 登録済み" || echo "  $s: 未登録"; done
else
  KEY_PATH="/root/app-keys/$APP_NAME/deploy_ed25519"
  if ! SSH_ROOT "test -f $KEY_PATH" && ! secret_exists VPS_SSH_KEY; then
    SSH_ROOT "bash /root/vps-setup/add-app.sh rotate-key $APP_NAME --no-print-key" > "$WORK/rot.log" 2>&1 || { tail -20 "$WORK/rot.log"; die "配備鍵の発行に失敗"; }
  fi
  if SSH_ROOT "test -f $KEY_PATH"; then
    SSH_ROOT "cat $KEY_PATH" | gh secret set VPS_SSH_KEY -R "$APP_REPO" >/dev/null
    SSH_ROOT "rm -f $KEY_PATH"
    ok "VPS_SSH_KEY を登録し、VPS 上の秘密鍵を削除"
  else
    ok "VPS_SSH_KEY は登録済み"
  fi
  printf '%s' "$VPS_IP" | gh secret set VPS_HOST -R "$APP_REPO" >/dev/null
  printf '22' | gh secret set VPS_PORT -R "$APP_REPO" >/dev/null
  printf 'deploy' | gh secret set VPS_USER -R "$APP_REPO" >/dev/null
  KH="$(ssh-keyscan -T 10 -t ed25519 "$VPS_IP" 2>/dev/null | grep -v '^#' || true)"
  [ -n "$KH" ] && printf '%s\n' "$KH" | gh secret set VPS_KNOWN_HOSTS -R "$APP_REPO" >/dev/null
  gh variable set APP_NAME -R "$APP_REPO" --body "$APP_NAME" >/dev/null
  gh variable set APP_URL -R "$APP_REPO" --body "https://$DOMAIN" >/dev/null
  ok "VPS_HOST / VPS_PORT / VPS_USER / VPS_KNOWN_HOSTS / APP_NAME / APP_URL"
  if secret_exists VITE_FIREBASE_API_KEY; then
    echo "  (VITE_FIREBASE_* と VITE_AI_API_KEY の Secrets はもう使いません。不要なら GitHub の Settings から削除できます)"
  fi
fi

# ---------- 5. マージと配備 ----------
step "5/6 配備: PR #$APP_PR をマージ → deploy-vps の完了を待つ"
if [ "$DRY" = 1 ]; then
  echo "(--dry-run) マージと配備は行いません"
else
  before="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  state="$(gh api "repos/$APP_REPO/pulls/$APP_PR" -q '.merged')"
  if [ "$state" = "true" ]; then
    ok "PR #$APP_PR はマージ済み。最新の main を配備します"
    gh workflow run deploy-vps.yml -R "$APP_REPO" --ref main
  elif [ "$DO_MERGE" = 1 ] && confirm "PR #$APP_PR($APP_REPO)を main にマージします(=本番配備)。よいですか?"; then
    gh api -X PUT "repos/$APP_REPO/pulls/$APP_PR/merge" -f merge_method=merge >/dev/null
    ok "PR #$APP_PR をマージ"
    # AUTO_DEPLOY=true なら main への反映で配備が始まる。始まらなければ手動で起動する
    sleep 20
    if [ -z "$(gh run list -R "$APP_REPO" --workflow deploy-vps.yml --limit 5 --json createdAt -q "[.[]|select(.createdAt>=\"$before\")][0].createdAt" 2>/dev/null)" ]; then
      gh workflow run deploy-vps.yml -R "$APP_REPO" --ref main
    fi
  else
    die "PR #$APP_PR が未マージのため配備できません(マージ後に再実行してください)"
  fi
  echo "配備の完了を待っています…"
  rid=""
  for _ in $(seq 1 30); do
    rid="$(gh run list -R "$APP_REPO" --workflow deploy-vps.yml --limit 5 --json databaseId,createdAt \
      -q "[.[]|select(.createdAt>=\"$before\")]|last|.databaseId" 2>/dev/null || true)"
    [ -n "$rid" ] && [ "$rid" != null ] && break
    sleep 5
  done
  [ -n "$rid" ] && [ "$rid" != null ] || die "配備の実行が見つかりません。GitHub の Actions 画面を確認してください"
  gh run watch "$rid" -R "$APP_REPO" --exit-status >/dev/null || die "配備に失敗しました: gh run view $rid -R $APP_REPO --log-failed"
  # 同時に複数走った場合に備え、最後の実行も待つ
  last="$(gh run list -R "$APP_REPO" --workflow deploy-vps.yml --limit 1 --json databaseId -q '.[0].databaseId')"
  [ "$last" != "$rid" ] && { gh run watch "$last" -R "$APP_REPO" --exit-status >/dev/null || die "配備に失敗しました: gh run view $last -R $APP_REPO --log-failed"; }
  ok "配備完了"
  code="$(curl -s -o /dev/null -w '%{http_code}' -m 20 "https://$DOMAIN/api/health")"
  [ "$code" = 200 ] && ok "https://$DOMAIN/api/health → 200(サーバー稼働中)" || die "https://$DOMAIN/api/health → $code(journalctl -u $UNIT で確認)"
  for p in / /login /demo; do
    code="$(curl -s -o /dev/null -w '%{http_code}' -m 20 "https://$DOMAIN$p")"
    [ "$code" = 200 ] && ok "https://$DOMAIN$p → $code" || warn "https://$DOMAIN$p → $code"
  done
  loc="$(curl -s -o /dev/null -w '%{redirect_url}' -m 20 "https://$DOMAIN/api/auth/google")"
  case "$loc" in https://accounts.google.com/*) ok "Google ログインの入口 → accounts.google.com" ;; *) warn "Google ログインの入口が想定外です: ${loc:-なし}" ;; esac
fi

# ---------- 6. データ移行 ----------
step "6/6 Firebase からのデータ移行"
db_status() { SSH_ROOT "sudo -u $UNIT env DATA_DIR=$APP_ROOT/data node $APP_ROOT/app/status.js" 2>/dev/null || echo '{}'; }
if [ "$DRY" = 1 ] || [ "$DO_MIGRATE" = 0 ]; then
  echo "(スキップ)"
elif db_status | grep -q '"imported":{'; then
  ok "移行済み(もう一度行う場合は scripts/migrate/README.md の手順で --replace)"
elif confirm "Firebase のデータ(Firestore 全体 + ログインユーザー)を VPS に移しますか?"; then
  if [ -z "$SA_KEY" ]; then
    URL="https://console.firebase.google.com/project/$GCP_PROJECT/settings/serviceaccounts/adminsdk"
    echo "Firebase のサービスアカウント鍵が必要です: $URL →「新しい秘密鍵を生成」(JSON がダウンロードされます)"
    command -v open >/dev/null 2>&1 && open "$URL" || true
    latest="$(ls -t "$HOME"/Downloads/"$GCP_PROJECT"-*.json 2>/dev/null | head -n1 || true)"
    printf '鍵ファイルのパス[%s]: ' "${latest:-なし}"; read -r SA_KEY </dev/tty
    SA_KEY="${SA_KEY:-$latest}"
  fi
  [ -f "$SA_KEY" ] || die "鍵ファイルがありません: $SA_KEY"
  here="$(cd "$(dirname "$0")" && pwd)"
  (cd "$here/migrate" && npm ci --no-audit --no-fund --silent) || die "移行ツールの準備に失敗しました"
  node "$here/migrate/export-firebase.mjs" "$SA_KEY" "$WORK/export.json" || die "Firebase からの書き出しに失敗しました"
  scp -q -i "$ROOT_KEY" -o BatchMode=yes "$WORK/export.json" "root@$VPS_IP:/root/kyabacho-export.json"
  rm -f "$WORK/export.json"
  IMPORT="sudo -u $UNIT env DATA_DIR=$APP_ROOT/data node $APP_ROOT/app/import.js $APP_ROOT/data/import.json"
  SSH_ROOT "set -e; install -o $UNIT -g $UNIT -m 600 /root/kyabacho-export.json $APP_ROOT/data/import.json; shred -u /root/kyabacho-export.json 2>/dev/null || rm -f /root/kyabacho-export.json; $IMPORT --dry-run" \
    || { SSH_ROOT "rm -f $APP_ROOT/data/import.json"; die "移行データの確認で問題が見つかりました(上の表示を確認してください)"; }
  REPLACE=""
  st="$(db_status)"
  if ! printf '%s' "$st" | grep -q '"docs":0,"users":0'; then
    echo "VPS の DB には既にデータがあります(移行後にログインした分など): $st"
    confirm "VPS 側のデータを消して、Firebase のデータで置き換えますか?" && REPLACE="--replace" || { SSH_ROOT "rm -f $APP_ROOT/data/import.json"; die "移行を中止しました"; }
  fi
  confirm "上の内容で取り込みます。よいですか?" || { SSH_ROOT "rm -f $APP_ROOT/data/import.json"; die "移行を中止しました"; }
  SSH_ROOT "set -e; systemctl stop $UNIT; trap 'rm -f $APP_ROOT/data/import.json; systemctl start $UNIT' EXIT; $IMPORT $REPLACE" \
    || die "取り込みに失敗しました(サービスは再開済み。データは変更されていません)"
  ok "データ移行完了"
  echo "  サービスアカウント鍵は強い権限を持つため、削除してください:"
  echo "    - この Mac の $SA_KEY"
  echo "    - https://console.cloud.google.com/iam-admin/serviceaccounts?project=$GCP_PROJECT の該当アカウント →「鍵」で削除"
else
  echo "移行しません(あとで: bash scripts/setup-vps.sh を再実行)"
fi

echo
ok "完了: https://$DOMAIN"
echo "残りの確認(手動): Google ログイン → 以前の顧客が見えること、顧客の登録・表示"
echo "旧サイト(Firebase Hosting の cabaret-diary.web.app)は残っています。二重に使われないよう、移行後は停止を検討してください。"
