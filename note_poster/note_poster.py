#!/usr/bin/env python3
"""
note_poster.py

note にログインし、新規記事に本文を流し込んで「下書き保存」までを自動化する。
--publish を付けた場合のみ、確認プロンプトを経て「公開」まで実行する。

使い方:
    python note_poster.py 5
    python note_poster.py 5 --source note      # note掲載用テキストを本文に使う
    python note_poster.py 5 --headful          # ブラウザを表示して実行（推奨・初回）
    python note_poster.py 5 --content-dir ~/sorano-tobikata
    python note_poster.py 5 --publish          # 下書き保存後に公開まで実行
    python note_poster.py 5 --publish --yes    # 公開前の確認プロンプトを省略

前提:
    1) 先に setup_credentials.py を実行して認証情報を Keychain に保存しておく
    2) pip install playwright keyring
    3) python -m playwright install chromium

設計方針:
    - ログインセッションは storage_state（auth_state.json）に保存し、
      2回目以降はログインを省略する。
    - 2要素認証/CAPTCHA/普段と違う端末確認などが出た場合は、
      --headful で起動し、人間がブラウザ上で対応する。
    - デフォルトは「下書き保存」まで。公開するのは --publish を
      明示した場合だけで、実行前に必ず確認プロンプトを出す（--yes で省略可）。
"""

import argparse
import os
import sys
import time

try:
    import keyring
except ImportError:
    print("エラー: keyring が必要です。 pip install keyring")
    sys.exit(1)

try:
    from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout
except ImportError:
    print("エラー: playwright が必要です。")
    print("  pip install playwright")
    print("  python -m playwright install chromium")
    sys.exit(1)

from content_loader import load_content, DEFAULT_CONTENT_DIR

SERVICE_NAME = "note-auto-poster"
EMAIL_KEY = "note_email"

# ログインセッションの保存先（このスクリプトと同じ場所）
AUTH_STATE_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "auth_state.json"
)

NOTE_LOGIN_URL = "https://note.com/login"
NOTE_NEW_TEXT_URL = "https://note.com/notes/new"


def get_credentials():
    email = keyring.get_password(SERVICE_NAME, EMAIL_KEY)
    if not email:
        print("認証情報が未設定です。先に setup_credentials.py を実行してください。")
        sys.exit(1)
    password = keyring.get_password(SERVICE_NAME, email)
    if not password:
        print("パスワードが取得できませんでした。setup_credentials.py を再実行してください。")
        sys.exit(1)
    return email, password


def login_if_needed(context, page, headful: bool):
    """
    保存済みセッションでログイン状態か確認し、未ログインならログインする。
    """
    page.goto("https://note.com/", wait_until="domcontentloaded")
    time.sleep(2)

    # ログイン済みかどうかを「ログイン」リンクの有無で大まかに判定
    already_logged_in = False
    try:
        # 投稿ボタンやアカウントメニューが存在すればログイン済みとみなす
        if page.locator("text=ログイン").count() == 0:
            already_logged_in = True
    except Exception:
        pass

    if already_logged_in:
        print("既存セッションでログイン済みです。")
        return

    print("ログインを実行します...")
    email, password = get_credentials()

    page.goto(NOTE_LOGIN_URL, wait_until="domcontentloaded")
    time.sleep(2)

    # メール/パスワードのログインフォームに入力
    # note のフォームは仕様変更されることがあるため、複数のセレクタを試す
    filled = False
    selectors_email = [
        'input[type="email"]',
        'input[name="email"]',
        'input[placeholder*="mail"]',
        'input#email',
    ]
    selectors_pw = [
        'input[type="password"]',
        'input[name="password"]',
        'input#password',
    ]

    for se in selectors_email:
        if page.locator(se).count() > 0:
            page.fill(se, email)
            filled = True
            break
    for sp in selectors_pw:
        if page.locator(sp).count() > 0:
            page.fill(sp, password)
            break

    if not filled:
        print("ログインフォームが見つかりませんでした。")
        print("note の画面が変わった可能性があります。--headful で起動し、")
        print("手動でログインしてください（セッションは保存されます）。")
        if headful:
            input("手動ログインが完了したら Enter を押してください...")
        else:
            sys.exit(1)
    else:
        # ログインボタンをクリック
        for btn in ['button:has-text("ログイン")', 'button[type="submit"]']:
            if page.locator(btn).count() > 0:
                page.locator(btn).first.click()
                break
        time.sleep(4)

    # 2要素認証・CAPTCHA・端末確認などの可能性をチェック
    page_text = page.content()
    needs_human = any(
        kw in page_text for kw in ["認証コード", "確認コード", "ロボット", "reCAPTCHA", "二段階"]
    )
    if needs_human or page.url.startswith(NOTE_LOGIN_URL):
        if headful:
            print("追加認証が必要なようです。ブラウザ上で対応してください。")
            input("ログインが完了したら Enter を押してください...")
        else:
            print("追加認証が必要です。--headful を付けて再実行し、手動で対応してください。")
            sys.exit(1)

    # セッションを保存（次回以降ログイン不要に）
    context.storage_state(path=AUTH_STATE_PATH)
    print(f"ログインセッションを保存しました: {AUTH_STATE_PATH}")


def create_draft(page, title: str, body: str):
    """
    新規テキスト記事を作成し、タイトルと本文を入力して下書き保存する。
    """
    print("新規記事ページを開きます...")
    page.goto(NOTE_NEW_TEXT_URL, wait_until="domcontentloaded")
    time.sleep(4)

    # --- タイトル入力 ---
    # note の新規エディタはタイトル用 textarea/contenteditable が先頭にある
    title_selectors = [
        'textarea[placeholder*="タイトル"]',
        'textarea[placeholder*="記事タイトル"]',
        '[contenteditable="true"][data-placeholder*="タイトル"]',
        'textarea',
    ]
    title_set = False
    for ts in title_selectors:
        if page.locator(ts).count() > 0:
            page.locator(ts).first.click()
            page.locator(ts).first.fill(title)
            title_set = True
            print(f"タイトルを入力しました: {title}")
            break
    if not title_set:
        print("警告: タイトル欄が見つかりませんでした。本文だけ入力を続けます。")

    time.sleep(1)

    # --- 本文入力 ---
    # note の本文は contenteditable。段落ごとに入力し、改行は Enter で送る。
    body_selectors = [
        '[contenteditable="true"][data-placeholder*="本文"]',
        'div[contenteditable="true"][role="textbox"]',
        '[contenteditable="true"]',
    ]
    editor = None
    for bs in body_selectors:
        loc = page.locator(bs)
        # タイトル欄と区別するため、最後の contenteditable を本文とみなすことが多い
        if loc.count() > 0:
            editor = loc.last
            break

    if editor is None:
        print("エラー: 本文エディタが見つかりませんでした。")
        print("note のUI変更の可能性があります。--headful で確認してください。")
        return False

    editor.click()
    time.sleep(1)

    # 段落単位で入力。空行は段落区切りとして扱う。
    paragraphs = body.split("\n")
    for i, para in enumerate(paragraphs):
        if para.strip() == "":
            # 空行 → 段落を分けるための改行
            page.keyboard.press("Enter")
        else:
            page.keyboard.type(para, delay=2)
            page.keyboard.press("Enter")
        # たまに小休止（入力取りこぼし防止）
        if i % 40 == 0:
            time.sleep(0.5)

    print("本文を入力しました。")
    time.sleep(2)

    # --- 下書き保存 ---
    # note は自動保存されるが、明示的に「下書き保存」ボタンも押す。
    saved = False
    for sb in [
        'button:has-text("下書き保存")',
        'button:has-text("保存")',
        'text=下書き保存',
    ]:
        if page.locator(sb).count() > 0:
            try:
                page.locator(sb).first.click()
                saved = True
                break
            except Exception:
                continue

    time.sleep(3)
    if saved:
        print("下書き保存を実行しました。")
    else:
        print("注: 明示的な下書き保存ボタンは押せませんでしたが、")
        print("    note は入力内容を自動保存します。ダッシュボードの下書きを確認してください。")

    return True


def publish_article(page, title: str, assume_yes: bool) -> bool:
    """
    エディタ画面から「公開に進む」→「投稿する」まで実行して記事を公開する。
    create_draft() で本文入力が終わった状態で呼ぶこと。
    """
    if not assume_yes:
        print()
        print(f"記事「{title}」を note に公開します。")
        answer = input("本当に公開しますか？ [y/N]: ").strip().lower()
        if answer != "y":
            print("公開をキャンセルしました。下書きとして保存されています。")
            return False

    # --- 公開設定画面へ進む ---
    proceeded = False
    for pb in [
        'button:has-text("公開に進む")',
        'button:has-text("公開設定")',
        'button:has-text("次へ")',
    ]:
        if page.locator(pb).count() > 0:
            try:
                page.locator(pb).first.click()
                proceeded = True
                break
            except Exception:
                continue

    if not proceeded:
        print("エラー: 「公開に進む」ボタンが見つかりませんでした。")
        print("note のUI変更の可能性があります。下書きは保存済みなので、")
        print("お手数ですが note の画面から手動で公開してください。")
        return False

    time.sleep(3)

    # --- 公開設定画面で「投稿する」を押す ---
    # ハッシュタグや有料設定はデフォルトのまま（必要なら手動で設定して公開する）
    posted = False
    for fb in [
        'button:has-text("投稿する")',
        'button:has-text("公開する")',
    ]:
        if page.locator(fb).count() > 0:
            try:
                page.locator(fb).first.click()
                posted = True
                break
            except Exception:
                continue

    if not posted:
        print("エラー: 「投稿する」ボタンが見つかりませんでした。")
        print("公開設定画面までは進んでいます。ブラウザ上で手動で投稿してください。")
        return False

    time.sleep(4)

    # 公開後は記事ページ（note.com/xxx/n/xxxx）へ遷移する
    if "/n/" in page.url:
        print(f"公開しました: {page.url}")
    else:
        print("投稿ボタンを押しました。note のダッシュボードで公開状態を確認してください。")
    return True


def main():
    parser = argparse.ArgumentParser(
        description="note に第X話を下書き投稿する（公開はしない）"
    )
    parser.add_argument("episode", type=int, help="話数（例: 5）")
    parser.add_argument(
        "--source", default="episode", choices=["episode", "note"],
        help="本文ソース: episode=小説本文 / note=note掲載用テキスト",
    )
    parser.add_argument(
        "--content-dir", default=None,
        help=f"原稿ディレクトリ（デフォルト: {DEFAULT_CONTENT_DIR}）",
    )
    parser.add_argument(
        "--headful", action="store_true",
        help="ブラウザを表示して実行（初回・認証対応時に推奨）",
    )
    parser.add_argument(
        "--publish", action="store_true",
        help="下書き保存後に公開まで実行する（確認プロンプトあり）",
    )
    parser.add_argument(
        "--yes", action="store_true",
        help="--publish の確認プロンプトを省略する",
    )
    args = parser.parse_args()

    # 本文を読み込む
    try:
        data = load_content(args.episode, args.source, args.content_dir)
    except FileNotFoundError as e:
        print(f"エラー: {e}")
        sys.exit(1)

    title = data["title"]
    body = data["body"]
    print("=" * 50)
    print(f" note 下書き作成: {title}")
    print(f" 本文ソース: {data['source_path']}")
    print(f" 本文文字数: {len(body)} 文字")
    print("=" * 50)

    with sync_playwright() as p:
        launch_kwargs = {"headless": not args.headful}
        browser = p.chromium.launch(**launch_kwargs)

        # 保存済みセッションがあれば読み込む
        context_kwargs = {}
        if os.path.exists(AUTH_STATE_PATH):
            context_kwargs["storage_state"] = AUTH_STATE_PATH
        context = browser.new_context(**context_kwargs)
        page = context.new_page()

        try:
            login_if_needed(context, page, args.headful)
            ok = create_draft(page, title, body)
            if ok:
                published = False
                if args.publish:
                    published = publish_article(page, title, args.yes)

                print("\n完了しました。")
                if not published:
                    print("note のダッシュボード → 下書き から内容を確認し、")
                    print("問題なければ手動で「公開」してください。")
                # 確認のため少し待つ（headful時に画面を見られるように）
                if args.headful:
                    input("ブラウザを閉じてよければ Enter を押してください...")
        except PWTimeout:
            print("タイムアウトしました。--headful で再実行して状況を確認してください。")
        finally:
            # セッションを最新化
            try:
                context.storage_state(path=AUTH_STATE_PATH)
            except Exception:
                pass
            browser.close()


if __name__ == "__main__":
    main()
