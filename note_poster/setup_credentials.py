#!/usr/bin/env python3
"""
setup_credentials.py

note のログイン情報を macOS Keychain / システムの keyring に保存する。
note_poster.py を使う前に一度だけ実行する。

使い方:
    python setup_credentials.py

保存先:
    サービス名 "note-auto-poster" として keyring に保存される。
    macOS では Keychain、Linux では Secret Service (kwallet / gnome-keyring) が使われる。

削除したい場合:
    python -c "import keyring; keyring.delete_password('note-auto-poster', 'note_email')"
"""

import getpass
import sys

try:
    import keyring
except ImportError:
    print("エラー: keyring が必要です。 pip install keyring")
    sys.exit(1)

SERVICE_NAME = "note-auto-poster"
EMAIL_KEY = "note_email"


def main():
    print("note の認証情報を Keychain / keyring に保存します。")
    print("入力内容はターミナルには表示されません。")
    print()

    email = input("note のメールアドレス: ").strip()
    if not email:
        print("エラー: メールアドレスが空です。")
        sys.exit(1)

    password = getpass.getpass("note のパスワード: ")
    if not password:
        print("エラー: パスワードが空です。")
        sys.exit(1)

    password_confirm = getpass.getpass("パスワード（確認）: ")
    if password != password_confirm:
        print("エラー: パスワードが一致しません。")
        sys.exit(1)

    keyring.set_password(SERVICE_NAME, EMAIL_KEY, email)
    keyring.set_password(SERVICE_NAME, email, password)

    print()
    print(f"保存しました（サービス名: {SERVICE_NAME}）。")
    print("note_poster.py を実行できます。")
    print()
    print("削除する場合:")
    print(f'  python -c "import keyring; keyring.delete_password(\'{SERVICE_NAME}\', \'{EMAIL_KEY}\')"')


if __name__ == "__main__":
    main()
