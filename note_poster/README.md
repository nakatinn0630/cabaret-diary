# note 自動下書きツール セットアップガイド

`pip install` は成功しましたが、Chromium のダウンロードはリモート実行環境からはネットワーク制限でブロックされます。
**このツールはローカルの Mac で動かすものです。** お手元のターミナルで以下を順番に実行してください。

## ステップ 1 — リポジトリを手元に clone（済みなら不要）

```bash
git clone https://github.com/nakatinn0630/points-optimizer-app.git
cd points-optimizer-app/note_poster
```

## ステップ 2 — 依存ライブラリをインストール

```bash
pip install -r requirements.txt
python -m playwright install chromium
```

## ステップ 3 — note のログイン情報を Keychain に保存

```bash
python setup_credentials.py
```

メールアドレスとパスワードを入力すると macOS Keychain に暗号化保存されます。

## ステップ 4 — 原稿ディレクトリを確認（任意）

デフォルトは `~/sorano-tobikata` です。別の場所に原稿がある場合：

```bash
export NOTE_CONTENT_DIR="$HOME/別のディレクトリ"
```

## ステップ 5 — 動作確認（初回は `--headful` 必須）

```bash
python note_poster.py 1 --headful
```

ブラウザが開きます。2要素認証が出た場合はブラウザ上で対応し、Enter を押してください。以降は `auth_state.json` にセッションが保存されるので、ログインは省略されます。
