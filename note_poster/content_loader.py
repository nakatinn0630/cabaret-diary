"""
content_loader.py

原稿ファイルを読み込み、タイトルと本文を返す。

ディレクトリ構成（例: ~/sorano-tobikata/）:
    ep005/
        episode.txt    # 小説本文（1行目=タイトル、2行目以降=本文）
        note.txt       # note掲載用テキスト（1行目=タイトル、2行目以降=本文）

使い方:
    from content_loader import load_content, DEFAULT_CONTENT_DIR
    data = load_content(5, "episode")
    print(data["title"])
    print(data["body"])
"""

import os

DEFAULT_CONTENT_DIR = os.path.expanduser("~/sorano-tobikata")


def load_content(episode: int, source: str = "episode", content_dir: str = None) -> dict:
    """
    指定された話数の原稿ファイルを読み込む。

    Args:
        episode:     話数（例: 5）
        source:      "episode"（小説本文）または "note"（note掲載用テキスト）
        content_dir: 原稿ルートディレクトリ（省略時は DEFAULT_CONTENT_DIR）

    Returns:
        {
            "title":       str,  # ファイル1行目
            "body":        str,  # ファイル2行目以降
            "source_path": str,  # 読み込んだファイルのパス
        }

    Raises:
        FileNotFoundError: ファイルまたはディレクトリが存在しない場合
        ValueError:        source が不正な値の場合
    """
    if source not in ("episode", "note"):
        raise ValueError(f"source は 'episode' または 'note' を指定してください: {source!r}")

    if content_dir is None:
        content_dir = DEFAULT_CONTENT_DIR

    ep_dir = os.path.join(content_dir, f"ep{episode:03d}")
    filename = "note.txt" if source == "note" else "episode.txt"
    path = os.path.join(ep_dir, filename)

    if not os.path.isdir(ep_dir):
        raise FileNotFoundError(
            f"話数ディレクトリが見つかりません: {ep_dir}\n"
            f"  期待するパス: {content_dir}/ep{episode:03d}/"
        )

    if not os.path.isfile(path):
        raise FileNotFoundError(
            f"原稿ファイルが見つかりません: {path}\n"
            f"  ファイルを作成するか、--source オプションを確認してください。"
        )

    with open(path, encoding="utf-8") as f:
        raw = f.read()

    lines = raw.splitlines()

    title = lines[0].strip() if lines else ""
    body = "\n".join(lines[1:]).lstrip("\n") if len(lines) > 1 else ""

    return {"title": title, "body": body, "source_path": path}
