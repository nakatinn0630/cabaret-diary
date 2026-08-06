#!/usr/bin/env python3
"""
delete_credentials.py

macOS Keychain に保存した note のログイン情報を削除する。

使い方:
    python delete_credentials.py
"""

import sys

try:
    import keyring
except ImportError:
    print("エラー: keyring がインストールされていません。")
    sys.exit(1)

SERVICE_NAME = "note-auto-poster"
EMAIL_KEY = "note_email"


def main():
    email = keyring.get_password(SERVICE_NAME, EMAIL_KEY)
    if not email:
        print("保存された認証情報が見つかりませんでした。")
        return

    confirm = input(f"{email} の認証情報を削除しますか？ [y/N]: ").strip().lower()
    if confirm != "y":
        print("中止しました。")
        return

    try:
        keyring.delete_password(SERVICE_NAME, email)
    except keyring.errors.PasswordDeleteError:
        pass
    try:
        keyring.delete_password(SERVICE_NAME, EMAIL_KEY)
    except keyring.errors.PasswordDeleteError:
        pass

    print("認証情報を削除しました。")


if __name__ == "__main__":
    main()
