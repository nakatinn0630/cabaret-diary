#!/usr/bin/env python3
"""
setup_credentials.py

note のログイン情報（メールアドレス＋パスワード）を
macOS の Keychain に安全に保存するための初回セットアップスクリプト。

使い方:
    python setup_credentials.py

一度実行すれば、認証情報は macOS Keychain に暗号化保存される。
パスワードがソースコードや平文ファイルに残ることはない。

保存先を確認したい場合は「キーチェーンアクセス.app」で
サービス名 "note-auto-poster" を検索する。
"""

import getpass
import sys

try:
    import keyring
except ImportError:
    print("エラー: keyring がインストールされていません。")
    print("  pip install keyring を実行してください。")
    sys.exit(1)

SERVICE_NAME = "note-auto-poster"
EMAIL_KEY = "note_email"          # メールアドレスを保存するキー
PASSWORD_PREFIX = "note_password" # 実パスワードは email をアカウント名として保存


def main():
    print("=" * 50)
    print(" note 自動投稿ツール 認証情報セットアップ")
    print("=" * 50)
    print("入力した情報は macOS Keychain に暗号化して保存されます。")
    print("（ソースコードや平文ファイルには一切残りません）\n")

    email = input("note のログイン用メールアドレス: ").strip()
    if not email:
        print("メールアドレスが空です。中止します。")
        sys.exit(1)

    # パスワードは画面に表示されない形で入力
    password = getpass.getpass("note のログインパスワード: ")
    if not password:
        print("パスワードが空です。中止します。")
        sys.exit(1)

    password_confirm = getpass.getpass("確認のためもう一度パスワード: ")
    if password != password_confirm:
        print("パスワードが一致しません。中止します。")
        sys.exit(1)

    # Keychain に保存
    # メールアドレス自体も Keychain に保存しておき、実行時に参照する
    keyring.set_password(SERVICE_NAME, EMAIL_KEY, email)
    # パスワードは「メールアドレスをアカウント名」として保存
    keyring.set_password(SERVICE_NAME, email, password)

    print("\n保存が完了しました。")
    print(f"  サービス名 : {SERVICE_NAME}")
    print(f"  メール     : {email}")
    print("  パスワード : （Keychain に暗号化保存済み）")
    print("\nこれで note_poster.py が利用できます。")
    print("認証情報を削除したい場合は delete_credentials.py を実行してください。")


if __name__ == "__main__":
    main()
