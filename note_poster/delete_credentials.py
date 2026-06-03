#!/usr/bin/env python3
"""
delete_credentials.py

macOS Keychain から note の認証情報を削除する。

使い方:
    python delete_credentials.py
"""

import sys

try:
    import keyring
except ImportError:
    print("エラー: keyring がインストールされていません。")
    print("  pip install keyring を実行してください。")
    sys.exit(1)

SERVICE_NAME = "note-auto-poster"
EMAIL_KEY = "note_email"


def main():
    print("=" * 50)
    print(" note 自動投稿ツール 認証情報削除")
    print("=" * 50)

    email = keyring.get_password(SERVICE_NAME, EMAIL_KEY)
    if not email:
        print("保存された認証情報が見つかりません。すでに削除済みです。")
        sys.exit(0)

    print(f"以下の認証情報を Keychain から削除します。")
    print(f"  サービス名 : {SERVICE_NAME}")
    print(f"  メール     : {email}")
    answer = input("\n本当に削除しますか？ [y/N]: ").strip().lower()
    if answer != "y":
        print("キャンセルしました。")
        sys.exit(0)

    errors = []
    try:
        keyring.delete_password(SERVICE_NAME, email)
    except keyring.errors.PasswordDeleteError:
        errors.append(f"パスワード（アカウント: {email}）の削除に失敗しました。")

    try:
        keyring.delete_password(SERVICE_NAME, EMAIL_KEY)
    except keyring.errors.PasswordDeleteError:
        errors.append(f"メールアドレスエントリ（キー: {EMAIL_KEY}）の削除に失敗しました。")

    if errors:
        for e in errors:
            print(f"警告: {e}")
        print("一部の削除に失敗しました。「キーチェーンアクセス.app」で手動確認してください。")
        sys.exit(1)

    print("\n認証情報を削除しました。")
    print("再度利用する場合は setup_credentials.py を実行してください。")


if __name__ == "__main__":
    main()
