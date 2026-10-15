#!/bin/bash
# Finder でダブルクリックすると、キャバ帳の VPS セットアップ(scripts/setup-vps.sh)を実行する。
cd "$(dirname "$0")/.." || exit 1
bash scripts/setup-vps.sh "$@"
status=$?
echo; read -r -p "終了しました(終了コード $status)。Enter で閉じます" _
exit $status
