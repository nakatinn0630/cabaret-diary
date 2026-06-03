#!/usr/bin/env python3
"""
content_loader.py

エピソード番号を受け取り、note 投稿用の「タイトル」と「本文」を
ローカルの Markdown ファイルから読み出すためのモジュール。

想定するファイル配置（CONTENT_DIR 内）:
    episode_01_final.md   （第1話のみ _final が付く想定。無ければ episode_01.md）
    episode_02.md
    episode_03.md
    ...
    note_post_text_ep01.md  （note 掲載用テキスト。任意）

本文ソースの優先順位:
    1) 引数 --source note が指定された場合は note_post_text_epXX.md
    2) それ以外（デフォルト）は episode_XX.md の小説本文

タイトルは本文 Markdown の "## 第X話「...」" 見出しから自動生成する。
"""

import os
import re
import glob

# 各話のファイルが置かれているディレクトリ。
# 環境変数 NOTE_CONTENT_DIR があればそれを優先する。
DEFAULT_CONTENT_DIR = os.environ.get(
    "NOTE_CONTENT_DIR",
    os.path.expanduser("~/sorano-tobikata"),
)

WORK_TITLE = "そらのとびかた"


def _find_episode_file(content_dir: str, ep: int) -> str:
    """episode_XX.md または episode_XX_final.md を探して返す。"""
    n = f"{ep:02d}"
    candidates = [
        os.path.join(content_dir, f"episode_{n}_final.md"),
        os.path.join(content_dir, f"episode_{n}.md"),
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
    # ワイルドカードでの保険
    hits = sorted(glob.glob(os.path.join(content_dir, f"episode_{n}*.md")))
    if hits:
        return hits[0]
    raise FileNotFoundError(
        f"第{ep}話の本文ファイルが見つかりません: {candidates}"
    )


def _find_note_text_file(content_dir: str, ep: int) -> str:
    n = f"{ep:02d}"
    path = os.path.join(content_dir, f"note_post_text_ep{n}.md")
    if os.path.exists(path):
        return path
    raise FileNotFoundError(f"note 掲載用テキストが見つかりません: {path}")


def _extract_title(text: str, ep: int) -> str:
    """
    "## 第5話「OSとしての人類」" のような見出しから
    note の記事タイトルを生成する。
    創作大賞の連載規定に合わせ「作品名 第X話「サブタイトル」」形式にする。
    """
    m = re.search(r"##\s*第(\d+)話[「『](.+?)[」』]", text)
    if m:
        sub = m.group(2).strip()
        return f"{WORK_TITLE} 第{ep}話「{sub}」"
    # 見つからなければ最低限の体裁
    return f"{WORK_TITLE} 第{ep}話"


def _clean_body(text: str) -> str:
    """
    小説本文 Markdown から、note 本文として不要な行を取り除く。
    - 先頭の "# そらのとびかた" タイトル行
    - "## 第X話「...」" 見出し行（タイトルは別途設定するため）
    - 巻末の "> 本作「そらのとびかた」はAI..." 以降のフッター
    """
    lines = text.split("\n")
    out = []
    for line in lines:
        s = line.strip()
        if s == f"# {WORK_TITLE}":
            continue
        if re.match(r"##\s*第\d+話[「『]", s):
            continue
        out.append(line)
    body = "\n".join(out)

    # 巻末のAI明記フッターを除去
    idx = body.find("> 本作「そらのとびかた」はAI")
    if idx != -1:
        body = body[:idx]

    # 先頭・末尾の余分な区切り線や空行を整理
    body = body.strip()
    body = re.sub(r"\n{3,}", "\n\n", body)
    return body


def load_content(ep: int, source: str = "episode",
                 content_dir: str = None) -> dict:
    """
    エピソード番号からタイトルと本文を返す。

    Parameters
    ----------
    ep : int           話数
    source : str       "episode"（小説本文） または "note"（note掲載用テキスト）
    content_dir : str  ファイル配置ディレクトリ

    Returns
    -------
    dict : {"title": str, "body": str, "source_path": str}
    """
    content_dir = content_dir or DEFAULT_CONTENT_DIR

    if source == "note":
        path = _find_note_text_file(content_dir, ep)
        with open(path, encoding="utf-8") as f:
            raw = f.read()
        # note 掲載用テキストはそのまま貼る想定（必要なら手で調整）
        # タイトルは小説本文側から取得する
        ep_path = _find_episode_file(content_dir, ep)
        with open(ep_path, encoding="utf-8") as f:
            ep_raw = f.read()
        title = _extract_title(ep_raw, ep)
        return {"title": title, "body": raw.strip(), "source_path": path}

    # デフォルト: 小説本文
    path = _find_episode_file(content_dir, ep)
    with open(path, encoding="utf-8") as f:
        raw = f.read()
    title = _extract_title(raw, ep)
    body = _clean_body(raw)
    return {"title": title, "body": body, "source_path": path}


if __name__ == "__main__":
    # 動作確認用
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("episode", type=int)
    parser.add_argument("--source", default="episode", choices=["episode", "note"])
    parser.add_argument("--content-dir", default=None)
    args = parser.parse_args()

    data = load_content(args.episode, args.source, args.content_dir)
    print("TITLE:", data["title"])
    print("SOURCE:", data["source_path"])
    print("BODY (先頭300字):")
    print(data["body"][:300])
