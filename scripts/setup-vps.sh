#!/usr/bin/env bash
# setup-vps.sh — キャバ帳を共用 XServer VPS に載せるまでを、Mac から1コマンドで自動実行する。
#
#   bash scripts/setup-vps.sh                 # 対話あり(要所で y/N を聞く)
#   bash scripts/setup-vps.sh --yes           # 確認なしで最後まで(DNS 未設定時の待機だけは行う)
#   bash scripts/setup-vps.sh --dry-run       # 確認だけ。VPS・GitHub・Firebase は何も変更しない
#   オプション: --no-auto-deploy(main への反映で自動配備にしない) / --skip-merge(PR をマージしない)
#
# やること(何度実行しても安全。済んでいる手順は飛ばす):
#   0. 事前チェック(gh のログイン、VPS の root 鍵、必要なコマンド)
#   1. DNS: kyabacho.ainowa.net の A レコードを確認(未設定なら Xserver のパネルを開いて反映を待つ)
#   2. VPS: 配備キット(yell-staff-portal の feat/vps-static-spa。無ければ main)を送り、add-app.sh --spa を実行
#   3. GitHub: 配備鍵・known_hosts・Firebase 構成値などを Secrets / Variables に登録(鍵は画面に出さない)
#   4. Firebase: Authentication の承認済みドメインに kyabacho.ainowa.net を追加
#   5. cabaret-diary の PR をマージ → 配備ワークフローを実行して完了を待つ → 公開 URL を確認
#   6. AUTO_DEPLOY=true(以後 main への反映で自動配備)
#
# 社内ポータルの PR(配備キット)はマージしない: マージするとポータル本番の再配備が走るため。
# 秘密情報(秘密鍵・API キー)は画面・ログ・ファイルに残さず、パイプで gh に直接渡す。
#
# 環境変数で上書き可:
#   APP_NAME(kyabacho) DOMAIN(kyabacho.ainowa.net) PORT(3010) EMAIL(gh のアカウントのメール)
#   VPS_IP(153.115.47.117) ROOT_KEY(~/.ssh/vps_portal) FIREBASE_PROJECT(cabaret-diary)
#   APP_REPO(nakatinn0630/cabaret-diary) APP_PR(4) KIT_REPO(nakatinn0630/yell-staff-portal) KIT_REF(feat/vps-static-spa)
#   GROQ_API_KEY(指定すると VITE_AI_API_KEY に登録。未指定なら対話で聞く/--yes では飛ばす)
set -euo pipefail

APP_NAME="${APP_NAME:-kyabacho}"
DOMAIN="${DOMAIN:-kyabacho.ainowa.net}"
PORT="${PORT:-3010}"
VPS_IP="${VPS_IP:-153.115.47.117}"
ROOT_KEY="${ROOT_KEY:-$HOME/.ssh/vps_portal}"
FIREBASE_PROJECT="${FIREBASE_PROJECT:-cabaret-diary}"
APP_REPO="${APP_REPO:-nakatinn0630/cabaret-diary}"
APP_PR="${APP_PR:-4}"
KIT_REPO="${KIT_REPO:-nakatinn0630/yell-staff-portal}"
KIT_REF="${KIT_REF:-feat/vps-static-spa}"
EMAIL="${EMAIL:-}"
YES=0; DRY=0; AUTO_DEPLOY=1; DO_MERGE=1

for a in "$@"; do
  case "$a" in
    --yes|-y) YES=1 ;;
    --dry-run) DRY=1 ;;
    --no-auto-deploy) AUTO_DEPLOY=0 ;;
    --skip-merge) DO_MERGE=0 ;;
    -h|--help) sed -n '2,30p' "$0"; exit 0 ;;
    *) echo "不明なオプション: $a" >&2; exit 2 ;;
  esac
done

C_OK=$'\033[32m'; C_NG=$'\033[31m'; C_H=$'\033[1;36m'; C_0=$'\033[0m'
step() { printf '\n%s=== %s ===%s\n' "$C_H" "$*" "$C_0"; }
ok()   { printf '%s✓%s %s\n' "$C_OK" "$C_0" "$*"; }
die()  { printf '%s✗ %s%s\n' "$C_NG" "$*" "$C_0" >&2; exit 1; }
confirm() {
  [ "$YES" = 1 ] && return 0
  printf '%s [y/N] ' "$1"; read -r ans </dev/tty || ans=""
  case "$ans" in y|Y|yes|YES) return 0 ;; *) return 1 ;; esac
}
SSH_ROOT() { ssh -i "$ROOT_KEY" -o BatchMode=yes -o ConnectTimeout=10 "root@$VPS_IP" "$@"; }
secret_exists() { gh secret list -R "$APP_REPO" --json name -q '.[].name' 2>/dev/null | grep -qx "$1"; }

WORK="$(mktemp -d "${TMPDIR:-/tmp}/kyabacho-setup.XXXXXX")"
cleanup() { rm -rf "$WORK"; }
trap cleanup EXIT

echo "キャバ帳 VPS セットアップ: $APP_NAME → https://$DOMAIN (VPS $VPS_IP)"
[ "$DRY" = 1 ] && echo "(--dry-run: 確認だけ。何も変更しません)"

# ---------- 0. 事前チェック ----------
step "0/6 事前チェック"
for c in gh ssh rsync dig curl git node npx; do
  command -v "$c" >/dev/null 2>&1 || die "$c がありません(Homebrew なら: brew install ${c/npx/node})"
done
gh auth status >/dev/null 2>&1 || die "gh にログインしていません: gh auth login"
ok "gh: ログイン済み"
[ -f "$ROOT_KEY" ] || die "VPS の root 鍵がありません: $ROOT_KEY(社内ポータル構築に使った Mac からこのファイルを安全にコピーしてください)"
SSH_ROOT true || die "VPS に root で SSH できません($ROOT_KEY)。鍵・ネットワークを確認してください"
ok "VPS: root で接続できる"
if [ -z "$EMAIL" ]; then
  EMAIL="$(gh api user/emails -q '[.[]|select(.primary)][0].email' 2>/dev/null || true)"
fi
[ -n "$EMAIL" ] || die "証明書用のメールアドレスが分かりません。EMAIL=you@example.com bash $0 で指定してください"
ok "証明書の連絡先: $EMAIL"

# ---------- 1. DNS ----------
step "1/6 DNS: $DOMAIN → $VPS_IP"
dns_ok() { [ "$(dig +short @8.8.8.8 "$DOMAIN" A | tail -n1)" = "$VPS_IP" ]; }
if dns_ok; then
  ok "A レコード反映済み"
elif [ "$DRY" = 1 ]; then
  echo "未設定です(--dry-run のため待ちません)"
else
  echo "A レコードがまだありません。Xserver レンタルサーバーのサーバーパネル →「DNSレコード設定」で追加してください:"
  echo "    ホスト名: ${DOMAIN%%.ainowa.net}   種別: A   内容: $VPS_IP"
  echo "(VPS パネルの DNS ではありません)"
  echo "反映を待っています(30秒ごとに確認・最大60分。Ctrl+C で中断し、あとで再実行しても続きから進みます)"
  i=0
  until dns_ok; do
    i=$((i + 1)); [ "$i" -le 120 ] || die "60分待っても反映されませんでした。設定を確認して再実行してください"
    sleep 30; printf '.'
  done
  echo; ok "A レコード反映済み"
fi

# ---------- 2. VPS ----------
step "2/6 VPS: add-app.sh --spa"
gh repo clone "$KIT_REPO" "$WORK/kit" -- -q --depth 1 --branch "$KIT_REF" 2>/dev/null \
  || { echo "($KIT_REF が無いため main を使います)"; gh repo clone "$KIT_REPO" "$WORK/kit" -- -q --depth 1; }
grep -q -- '--no-print-key' "$WORK/kit/deploy/vps/add-app.sh" || die "キットに --spa / --no-print-key がありません($KIT_REPO の $KIT_REF)"
rsync -az -e "ssh -i $ROOT_KEY -o BatchMode=yes" "$WORK/kit/deploy/vps/" "root@$VPS_IP:/root/vps-setup/"
ok "キットを VPS の /root/vps-setup/ に送信"
ADD="bash /root/vps-setup/add-app.sh $APP_NAME $DOMAIN $PORT $EMAIL --spa --no-print-key"
SSH_ROOT "$ADD --dry-run" > "$WORK/dry.log" 2>&1 || { cat "$WORK/dry.log"; die "add-app.sh --dry-run が失敗しました"; }
ok "add-app.sh --dry-run: 問題なし"
if [ "$DRY" = 1 ]; then
  sed -n '1,40p' "$WORK/dry.log"
else
  SSH_ROOT "$ADD" > "$WORK/add.log" 2>&1 || { tail -40 "$WORK/add.log"; die "add-app.sh が失敗しました"; }
  grep -q 'BEGIN OPENSSH' "$WORK/add.log" && die "想定外: 秘密鍵がログに出力されました($WORK は終了時に削除します)。中断します"
  grep -E '^(=== |証明書|HTTPS|配備鍵)' "$WORK/add.log" | sed 's/^/    /' || true
  ok "add-app.sh 完了"
fi

# ---------- 3. GitHub Secrets / Variables ----------
step "3/6 GitHub: $APP_REPO の Secrets / Variables"
KEY_PATH="/root/app-keys/$APP_NAME/deploy_ed25519"
if [ "$DRY" = 1 ]; then
  echo "(--dry-run) 登録予定: VPS_HOST VPS_PORT VPS_USER VPS_SSH_KEY VPS_KNOWN_HOSTS VITE_FIREBASE_*(6) / APP_NAME APP_URL"
else
  # 配備鍵: add-app.sh が今回発行していればそれを、GitHub に無ければ再発行して登録
  if ! SSH_ROOT "test -f $KEY_PATH"; then
    if secret_exists VPS_SSH_KEY; then
      echo "VPS_SSH_KEY は登録済み(VPS 側の鍵も登録済み)のため再発行しません"
    else
      SSH_ROOT "bash /root/vps-setup/add-app.sh rotate-key $APP_NAME --no-print-key" > "$WORK/rot.log" 2>&1 || { tail -20 "$WORK/rot.log"; die "配備鍵の再発行に失敗"; }
    fi
  fi
  if SSH_ROOT "test -f $KEY_PATH"; then
    SSH_ROOT "cat $KEY_PATH" | gh secret set VPS_SSH_KEY -R "$APP_REPO" >/dev/null
    SSH_ROOT "rm -f $KEY_PATH"
    ok "VPS_SSH_KEY を登録し、VPS 上の秘密鍵を削除"
  fi
  printf '%s' "$VPS_IP" | gh secret set VPS_HOST -R "$APP_REPO" >/dev/null
  printf '22' | gh secret set VPS_PORT -R "$APP_REPO" >/dev/null
  printf 'deploy' | gh secret set VPS_USER -R "$APP_REPO" >/dev/null
  KH="$(ssh-keyscan -T 10 -t ed25519 "$VPS_IP" 2>/dev/null | grep -v '^#' || true)"
  [ -n "$KH" ] && printf '%s\n' "$KH" | gh secret set VPS_KNOWN_HOSTS -R "$APP_REPO" >/dev/null
  ok "VPS_HOST / VPS_PORT / VPS_USER / VPS_KNOWN_HOSTS"

  # Firebase の Web アプリ構成値(firebase-tools にログインしていない場合はブラウザでログインを求める)
  if secret_exists VITE_FIREBASE_API_KEY && secret_exists VITE_FIREBASE_APP_ID && secret_exists VITE_FIREBASE_PROJECT_ID; then
    ok "VITE_FIREBASE_* は登録済み"
  else
    # 入っていれば Mac の firebase コマンドを使う(npx は毎回 npm から取得するため、通信の不調で失敗しやすい)
    if command -v firebase >/dev/null 2>&1; then FB="firebase"; else FB="npx -y firebase-tools@latest"; fi
    $FB projects:list >/dev/null 2>&1 || $FB login
    $FB apps:sdkconfig web --project "$FIREBASE_PROJECT" --json > "$WORK/sdk.json" 2>/dev/null \
      || die "Firebase の構成値を取得できません(project: $FIREBASE_PROJECT)。FIREBASE_PROJECT=... で指定してください"
    node -e '
      const fs=require("fs"); const j=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
      let c=(j.result&&j.result.sdkConfig)||null;
      if(!c&&j.result&&j.result.fileContents){ const m=j.result.fileContents.match(/\{[\s\S]*\}/); if(m){ try{c=JSON.parse(m[0])}catch(e){ c=Function("return "+m[0])() } } }
      if(!c||!c.apiKey){ process.exit(3) }
      const map={apiKey:"API_KEY",authDomain:"AUTH_DOMAIN",projectId:"PROJECT_ID",storageBucket:"STORAGE_BUCKET",messagingSenderId:"MESSAGING_SENDER_ID",appId:"APP_ID"};
      for(const k in map){ if(c[k]) fs.writeFileSync(process.argv[2]+"/fb_"+map[k], String(c[k])) }
    ' "$WORK/sdk.json" "$WORK" || die "Firebase の構成値を読み取れませんでした"
    for k in API_KEY AUTH_DOMAIN PROJECT_ID STORAGE_BUCKET MESSAGING_SENDER_ID APP_ID; do
      [ -f "$WORK/fb_$k" ] && gh secret set "VITE_FIREBASE_$k" -R "$APP_REPO" < "$WORK/fb_$k" >/dev/null
    done
    rm -f "$WORK"/fb_* "$WORK/sdk.json"
    ok "VITE_FIREBASE_*(Firebase project: $FIREBASE_PROJECT)"
  fi

  # AI キー(任意)
  if secret_exists VITE_AI_API_KEY; then
    ok "VITE_AI_API_KEY は登録済み"
  elif [ -n "${GROQ_API_KEY:-}" ]; then
    printf '%s' "$GROQ_API_KEY" | gh secret set VITE_AI_API_KEY -R "$APP_REPO" >/dev/null; ok "VITE_AI_API_KEY"
  elif [ "$YES" = 0 ]; then
    printf 'AI 用の API キー(Groq の gsk_... 等。空 Enter で飛ばす。入力は表示されません): '
    read -rs AIK </dev/tty || AIK=""; echo
    if [ -n "$AIK" ]; then printf '%s' "$AIK" | gh secret set VITE_AI_API_KEY -R "$APP_REPO" >/dev/null; ok "VITE_AI_API_KEY"; fi
    unset AIK
  else
    echo "VITE_AI_API_KEY は未登録(AI 機能は端末内の簡易生成になります)"
  fi

  gh variable set APP_NAME -R "$APP_REPO" --body "$APP_NAME" >/dev/null
  gh variable set APP_URL -R "$APP_REPO" --body "https://$DOMAIN" >/dev/null
  ok "Variables: APP_NAME / APP_URL"
fi

# ---------- 4. Firebase 承認済みドメイン ----------
step "4/6 Firebase: 承認済みドメインに $DOMAIN"
add_domain_api() {
  command -v gcloud >/dev/null 2>&1 || return 1
  local tok cur new
  tok="$(gcloud auth print-access-token 2>/dev/null)" || return 1
  cur="$(curl -fsS -H "Authorization: Bearer $tok" -H "x-goog-user-project: $FIREBASE_PROJECT" \
    "https://identitytoolkit.googleapis.com/admin/v2/projects/$FIREBASE_PROJECT/config")" || return 1
  if printf '%s' "$cur" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const d=JSON.parse(s).authorizedDomains||[];process.exit(d.includes(process.argv[1])?0:1)})' "$DOMAIN"; then
    ok "登録済み"; return 0
  fi
  [ "$DRY" = 1 ] && { echo "(--dry-run) 追加予定"; return 0; }
  new="$(printf '%s' "$cur" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const d=JSON.parse(s).authorizedDomains||[];d.push(process.argv[1]);process.stdout.write(JSON.stringify({authorizedDomains:d}))})' "$DOMAIN")"
  curl -fsS -X PATCH -H "Authorization: Bearer $tok" -H "x-goog-user-project: $FIREBASE_PROJECT" -H 'Content-Type: application/json' \
    -d "$new" "https://identitytoolkit.googleapis.com/admin/v2/projects/$FIREBASE_PROJECT/config?updateMask=authorizedDomains" >/dev/null || return 1
  ok "追加しました"
}
if ! add_domain_api; then
  URL="https://console.firebase.google.com/project/$FIREBASE_PROJECT/authentication/settings"
  echo "自動で追加できませんでした(gcloud が無い、または未ログイン: gcloud auth login)。"
  echo "ブラウザで「承認済みドメイン」に $DOMAIN を追加してください: $URL"
  command -v open >/dev/null 2>&1 && open "$URL" || true
  if [ "$DRY" = 0 ] && [ "$YES" = 0 ]; then printf '追加したら Enter: '; read -r _ </dev/tty || true; fi
fi

# ---------- 5. マージと配備 ----------
step "5/6 配備: PR #$APP_PR をマージ → deploy-vps を実行"
if [ "$DRY" = 1 ]; then
  echo "(--dry-run) PR #$APP_PR のマージと deploy-vps の実行は行いません"
else
  state="$(gh api "repos/$APP_REPO/pulls/$APP_PR" -q '.merged')"
  if [ "$state" = "true" ]; then
    ok "PR #$APP_PR はマージ済み"
  elif [ "$DO_MERGE" = 1 ] && confirm "PR #$APP_PR($APP_REPO)を main にマージします。よいですか?"; then
    gh api -X PUT "repos/$APP_REPO/pulls/$APP_PR/merge" -f merge_method=merge >/dev/null
    ok "PR #$APP_PR をマージ"
  else
    die "PR #$APP_PR が未マージのため配備できません(--skip-merge 指定時は手動でマージ後に再実行)"
  fi
  sleep 5
  before="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  gh workflow run deploy-vps.yml -R "$APP_REPO" --ref main
  echo "実行を開始しました。完了を待っています…"
  rid=""
  for _ in $(seq 1 20); do
    sleep 5
    rid="$(gh run list -R "$APP_REPO" --workflow deploy-vps.yml --event workflow_dispatch --limit 5 \
      --json databaseId,createdAt -q "[.[]|select(.createdAt>=\"$before\")][0].databaseId" 2>/dev/null || true)"
    [ -n "$rid" ] && break
  done
  [ -n "$rid" ] || die "実行が見つかりません。GitHub の Actions 画面を確認してください"
  gh run watch "$rid" -R "$APP_REPO" --exit-status || die "配備に失敗しました: gh run view $rid -R $APP_REPO --log-failed"
  ok "配備完了"
  for p in / /demo /login; do
    code="$(curl -s -o /dev/null -w '%{http_code}' -m 20 "https://$DOMAIN$p")"
    [ "$code" = 200 ] && ok "https://$DOMAIN$p → $code" || echo "  ! https://$DOMAIN$p → $code"
  done
fi

# ---------- 6. 自動配備 ----------
step "6/6 以後の自動配備"
if [ "$AUTO_DEPLOY" = 1 ]; then
  if [ "$DRY" = 1 ]; then echo "(--dry-run) AUTO_DEPLOY=true を設定予定"
  else gh variable set AUTO_DEPLOY -R "$APP_REPO" --body true >/dev/null; ok "AUTO_DEPLOY=true(main への反映で自動配備。docs/・*.md のみの変更は除く)"; fi
else
  echo "AUTO_DEPLOY は設定しません(配備は Actions の Run workflow で手動)"
fi

echo
ok "完了: https://$DOMAIN"
echo "残りの確認(手動): Google ログイン、顧客の登録・表示"
