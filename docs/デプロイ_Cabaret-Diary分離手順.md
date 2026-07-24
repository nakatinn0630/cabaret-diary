# Cabaret Diary（キャバ帳）新プロジェクト＋キャスト/店舗 完全分離 デプロイ手順

旧名 `points-optimizer` を廃し、ブランドを **Cabaret Diary（和名：キャバ帳）** に統一する。
Firebase プロジェクトidは不変のため、現行 `cabaret-diary` の URL は改名できない。
そこで **新プロジェクト `cabaret-diary` を作成**し、**キャスト用URL・店舗用URLを別サイトとして分離**して配信する。

> コード側の分離は実装済み（`src/lib/surface.ts` / `VITE_SURFACE`）。以下はインフラ（あなたのFirebase Console操作）と最終デプロイの手順。

---

## 全体像

| サーフェス | ビルド | 配信サイト（例） | 露出する画面 |
|---|---|---|---|
| キャスト | `npm run build:cast`（`dist-cast`） | `cabaret-diary-cast.web.app` | 顧客・予定・占い・売上・AI黒服など個人領域のみ |
| 店舗 | `npm run build:store`（`dist-store`） | `cabaret-diary-store.web.app` | 店舗コンソールのみ |

いずれも同じ新プロジェクト `cabaret-diary` 配下の **Hosting マルチサイト**として作成する（1プロジェクトで2URL）。

---

## STEP 1. 新Firebaseプロジェクトを作成（あなたの操作）

1. https://console.firebase.google.com/ →「プロジェクトを追加」
2. プロジェクト名：`cabaret-diary`（プロジェクトidも `cabaret-diary` を推奨。重複時は `cabaret-diary-app` 等）
3. リージョンは **asia-northeast1（東京）**。
4. 作成後、**Authentication → Sign-in method → Google を有効化**（前回と同じ手順）。
5. **Firestore Database を作成**（本番モード・asia-northeast1）。

## STEP 2. Web アプリを登録して firebaseConfig を取得（あなたの操作）

1. プロジェクト設定 → 「マイアプリ」→ Web アプリ（`</>`）を追加。
2. 表示される `firebaseConfig` の6値（apiKey / authDomain / projectId / storageBucket / messagingSenderId / appId）を控える。
3. その6値をこのチャットに貼ってください。→ こちらで `.env.production`（gitignore・非コミット）へ反映します。

## STEP 3. Hosting マルチサイトを2つ作成（あなたの操作 or CLI）

Console：Hosting →「別のサイトを追加」で以下2サイトを作成。
- `cabaret-diary-cast`
- `cabaret-diary-store`

（CLI で行う場合）
```bash
firebase hosting:sites:create cabaret-diary-cast  --project cabaret-diary
firebase hosting:sites:create cabaret-diary-store --project cabaret-diary
```

## STEP 4. デプロイ設定（この手順のコミットに同梱予定）

`.firebaserc` にターゲットを紐付け、`firebase.json` を2サイト構成にする。
```bash
firebase target:apply hosting cast  cabaret-diary-cast  --project cabaret-diary
firebase target:apply hosting store cabaret-diary-store --project cabaret-diary
```

`firebase.json`（マルチサイト形）:
```json
{
  "hosting": [
    { "target": "cast",  "public": "dist-cast",  "ignore": ["firebase.json","**/.*","**/node_modules/**"],
      "rewrites": [{ "source": "**", "destination": "/index.html" }] },
    { "target": "store", "public": "dist-store", "ignore": ["firebase.json","**/.*","**/node_modules/**"],
      "rewrites": [{ "source": "**", "destination": "/index.html" }] }
  ]
}
```

## STEP 5. ビルド＆デプロイ（こちらで実行 or CI）

```bash
npm run build:cast      # → dist-cast（VITE_SURFACE=cast）
npm run build:store     # → dist-store（VITE_SURFACE=store）
firebase deploy --only hosting:cast,hosting:store --project cabaret-diary
firebase deploy --only firestore:rules --project cabaret-diary
```

## STEP 6. 認可ドメイン（あなたの操作）

Authentication → Settings → 承認済みドメインに
`cabaret-diary-cast.web.app` と `cabaret-diary-store.web.app` を追加。

---

## 補足

- **現行 `cabaret-diary.web.app` はそのまま残せます**（単一URL・両サーフェス表示のまま）。新URLへ移行後に停止・非公開化するか、案内リンクを置くかは任意。
- **より短いURL**（例 `cabaret-diary.web.app` を1つだけ）にしたい場合は、分離せず単一サイト（`VITE_SURFACE` 未指定＝both）で配信する構成にも即切替できます。
- 独自ドメイン（例 `cast.example.com` / `store.example.com`）が欲しい場合は、各Hostingサイトにカスタムドメインを追加してください。
