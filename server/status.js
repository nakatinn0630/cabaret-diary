// DB の状態を JSON で表示する(セットアップ用。個人情報は出さない)。
//   sudo -u app-kyabacho env DATA_DIR=/srv/apps/kyabacho/data node /srv/apps/kyabacho/app/status.js
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'

const here = path.dirname(fileURLToPath(import.meta.url))
const file = path.join(path.resolve(process.env.DATA_DIR || path.join(here, 'data')), 'kyabacho.db')
if (!fs.existsSync(file)) {
  console.log(JSON.stringify({ exists: false, docs: 0, users: 0, imported: null }))
  process.exit(0)
}
const db = new Database(file, { readonly: true, fileMustExist: true })
const n = (sql) => {
  try {
    return db.prepare(sql).get()?.n ?? 0
  } catch {
    return 0
  }
}
let imported = null
try {
  imported = JSON.parse(db.prepare("SELECT value FROM meta WHERE key = 'imported_from_firebase'").get()?.value ?? 'null')
} catch {
  imported = null
}
console.log(
  JSON.stringify({ exists: true, docs: n('SELECT COUNT(*) AS n FROM docs'), users: n('SELECT COUNT(*) AS n FROM users'), imported }),
)
