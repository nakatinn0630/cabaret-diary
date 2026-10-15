// キャバ帳サーバーの起動口。VPS では systemd(app-kyabacho.service)が `node server.js` で起動する。
//
// 環境変数(VPS では /srv/apps/kyabacho/.env):
//   PORT / HOSTNAME          待ち受け(既定 127.0.0.1:3010)
//   DATA_DIR                 SQLite の置き場所(既定 ./data)
//   APP_ORIGIN               公開 URL(例 https://kyabacho.ainowa.net)。Google のリダイレクト先に使う
//   GOOGLE_CLIENT_ID         Google ログイン用(Google Cloud の OAuth クライアント)
//   GOOGLE_CLIENT_SECRET     同上(秘密。Git や GitHub に置かない)
//   PUBLIC_DIR               画面のビルド成果物(既定 ./public)
//   DEV_LOGIN=1              テスト用ログイン(NODE_ENV=production では無効)
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createAccounts, createStore, openDb } from './lib/db.js'
import { createApp } from './lib/app.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const env = process.env
const PORT = Number(env.PORT || 3010)
const HOST = env.HOSTNAME || '127.0.0.1'
const DATA_DIR = path.resolve(env.DATA_DIR || path.join(here, 'data'))
const DB_FILE = path.join(DATA_DIR, 'kyabacho.db')
const ORIGIN = (env.APP_ORIGIN || `http://localhost:${PORT}`).replace(/\/$/, '')
const isProd = env.NODE_ENV === 'production'

if (isProd && !env.APP_ORIGIN) console.warn('[起動] APP_ORIGIN が未設定です。Google ログインのリダイレクト先が正しく作れません')
if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
  console.warn('[起動] GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET が未設定です。Google ログインは使えません')
}

const db = openDb(DB_FILE)
const store = createStore(db)
const accounts = createAccounts(db)
const handler = createApp({
  store,
  accounts,
  google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET },
  origin: ORIGIN,
  publicDir: path.resolve(env.PUBLIC_DIR || path.join(here, 'public')),
  devLogin: env.DEV_LOGIN === '1' && !isProd,
})

// バックアップ: 1 時間ごとに整合性の取れた写し(snapshot.db)を data/ に作る。
// add-app.sh の日次 cron は data/ を tar で固めるため、書き込み途中の本体ではなくこの写しから復元できる。
async function snapshot() {
  try {
    await db.backup(path.join(DATA_DIR, 'snapshot.db.tmp'))
    const fs = await import('node:fs')
    fs.renameSync(path.join(DATA_DIR, 'snapshot.db.tmp'), path.join(DATA_DIR, 'snapshot.db'))
    accounts.gcSessions()
  } catch (e) {
    console.error('[backup] 写しの作成に失敗:', e.message)
  }
}
setTimeout(snapshot, 60_000).unref()
setInterval(snapshot, 60 * 60 * 1000).unref()

const server = http.createServer(handler)
server.requestTimeout = 30_000
server.headersTimeout = 20_000
server.listen(PORT, HOST, () => {
  console.log(`[起動] キャバ帳 http://${HOST}:${PORT} (公開 URL ${ORIGIN} / DB ${DB_FILE})`)
})

function shutdown() {
  server.close(() => {
    db.close()
    process.exit(0)
  })
  setTimeout(() => process.exit(0), 5000).unref()
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
