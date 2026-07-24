# キャバ帳 Cloud Functions

バックエンド（asia-northeast1 / Node 20）。

## 関数
- **`aiProxy`**（HTTPS）— AI生成の集約プロキシ。クライアント `lib/ai.ts` の `VITE_AI_PROXY_URL` 契約に一致。
  - `POST /replies`（F-06 返信案3案）
  - `POST /special-contact`（F-07 特別連絡の一言）
  - `POST /consult`（F-08 黒服相談＋エスカレーション判定）
  - `POST /compatibility`（F-14 占い・相性診断／断言型ペルソナ）
  - 認証: Firebase IDトークン（`Authorization: Bearer`）を検証（SEC-01/11）
  - モデル: `claude-opus-4-8`（adaptive thinking / effort でコスト調整）
  - SEC-10: 送信前に電話番号等を軽くマスキング
- **`riskRecalc`**（Firestoreトリガー）— `users/{uid}/customers/{cid}/visits/{vid}` の書込で顧客の
  `totalSpent`/`visitCount`/`lastVisitAt`/`riskScore`/`riskFlags` を再計算（F-02・サーバ権威版）。

## セットアップ / デプロイ
```bash
cd functions
npm install

# Anthropic APIキーを Secret Manager に登録（SEC-08）
firebase functions:secrets:set ANTHROPIC_API_KEY

npm run build
firebase deploy --only functions
```

デプロイ後、`aiProxy` のURLを取得し、フロントの `.env` に設定:
```
VITE_AI_PROXY_URL=https://asia-northeast1-cabaret-diary.cloudfunctions.net/aiProxy
```
これでクライアントのAI機能がローカル簡易生成 → Claude生成へ切り替わる。

## ローカル実行（エミュレータ）
```bash
npm run serve   # firebase emulators:start --only functions
```

## 未実装（後続）
`gcal-sync`（GCal双方向pull＋push通知・SEC-09）、暗号化ヘルパ（SEC-07 AES-256-GCM）、
売上突合（F-16）、レート制限の本実装（SEC-11）。
