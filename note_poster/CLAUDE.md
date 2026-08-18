# CLAUDE.md — note 自動下書きツール 操作ガイド（Claude Code 用）

このプロジェクトは、連載小説「そらのとびかた」の各話を note に
**自動投稿**するためのツールです。デフォルトは下書き保存までで、
`--publish` を明示した場合のみ公開まで実行します。

## ユーザーの自然言語指示の解釈ルール

ユーザーが次のように言ったら、対応するコマンドを実行してください。

|ユーザーの指示例               |実行すべきコマンド                                        |
|-----------------------|-------------------------------------------------|
|「第5話を投稿して」             |`python note_poster.py 5 --headful`              |
|「第5話を下書きにして」           |`python note_poster.py 5 --headful`              |
|「第3話をnoteに上げて」         |`python note_poster.py 3 --headful`              |
|「第5話を note掲載用テキストで投稿して」|`python note_poster.py 5 --source note --headful`|
|「第5話を公開して」            |`python note_poster.py 5 --publish --headful`    |
|「認証情報を設定して」            |`python setup_credentials.py`                    |
|「ログイン情報を消して」           |`python delete_credentials.py`                   |

### 重要な原則

1. **デフォルトは「下書き保存」までです。** 公開まで行うのは、ユーザーが
   「公開して」と明確に指示し、`--publish` を付けて実行した場合だけです。
   `--publish` 実行時もスクリプトが確認プロンプト（y/N）を出すので、
   ユーザー自身が最終確認します。Claude Code の判断で `--yes` を付けて
   確認を省略してはいけません。
1. **初回や認証が絡む場合は必ず `--headful` を付けて**ブラウザを表示します。
   note は2要素認証や端末確認を求めることがあり、その場合は人間の操作が必要です。
1. 実行前に、対象の原稿ファイルが存在するか確認してください。
- 小説本文: `episode_05.md`（第1話のみ `episode_01_final.md`）
- note掲載用: `note_post_text_ep05.md`
  ファイルが見つからない場合は、`--content-dir` でディレクトリを指定するか、
  環境変数 `NOTE_CONTENT_DIR` を設定するようユーザーに案内してください。
1. 本文ソースの既定は小説本文（`episode`）です。ユーザーが
   「note用のテキストで」「紹介文込みで」と言った場合のみ `--source note` を使います。

## セットアップ手順（初回のみ）

ユーザーがまだセットアップしていない場合は、次の順で案内してください。

```bash
# 1. 依存ライブラリのインストール
pip install -r requirements.txt
python -m playwright install chromium

# 2. note のログイン情報を Keychain に保存（初回のみ）
python setup_credentials.py

# 3. 原稿の場所を設定（任意。デフォルトは ~/sorano-tobikata）
export NOTE_CONTENT_DIR="$HOME/sorano-tobikata"
```

## 通常運用

```bash
# 第5話を下書き投稿（ブラウザ表示）
python note_poster.py 5 --headful

# 第5話を公開まで実行（確認プロンプトあり）
python note_poster.py 5 --publish --headful
```

下書きのみの実行後、Claude Code はユーザーに次を伝えてください。

- 「下書きを作成しました。note のダッシュボードの『下書き』を開いて内容を確認してください」
- 「問題なければ、note の画面で手動で『公開』してください」

`--publish` での実行後は、表示された記事URLを伝え、note 上で
表示崩れが無いか確認するよう案内してください。

## 注意・免責

- note は利用規約で自動化アクセスを制限しています。本ツールは個人の執筆作業の
  補助を目的とし、公開時も人間が確認プロンプトで最終判断する設計です。
  利用は自己責任で、アカウント凍結等のリスクを理解した上で使用してください。
- note の画面仕様が変わると、セレクタが合わずに失敗することがあります。
  その場合は `--headful` で起動し、エラー時の画面を確認してセレクタを更新してください。
