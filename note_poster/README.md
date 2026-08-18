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

## 公開まで自動で行う場合

デフォルトは下書き保存までですが、`--publish` を付けると公開まで実行します：

```bash
# 確認プロンプト（y/N）を経て公開
python note_poster.py 5 --publish --headful

# 確認プロンプトも省略して公開（cron などの完全自動運用向け）
python note_poster.py 5 --publish --yes
```

- 公開前にターミナルで `本当に公開しますか？ [y/N]` と確認されます
- ハッシュタグ・有料設定などは note のデフォルトのまま投稿されます。
  細かく設定したい場合は下書きまでにして、note の画面から公開してください
- 公開に成功すると記事 URL が表示されます
