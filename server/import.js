// Firebase から書き出したデータ(scripts/migrate/export-firebase.mjs の出力)を SQLite に取り込む。
// VPS 上で、アプリの実行ユーザーとして実行する:
//   sudo -u app-kyabacho env DATA_DIR=/srv/apps/kyabacho/data node /srv/apps/kyabacho/app/import.js <export.json> [--dry-run] [--replace]
//
//   --dry-run  件数と検証結果を表示するだけ(書き込まない)
//   --replace  既存の文書・ユーザーを消してから取り込む(既定では、空でない DB には取り込まない)
//
// ルール(アクセス制限)は通さず、そのまま書き込む。uid は Firebase と同じ値を引き継ぐため、
// 移行後も同じ Google アカウントでログインすれば、今までのデータが見える。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { openDb } from './lib/db.js'
import { isDocPath, splitPath } from './lib/rules.js'
import { validateValue } from './lib/values.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const file = args.find((a) => !a.startsWith('--'))
const dry = args.includes('--dry-run')
const replace = args.includes('--replace')
if (!file) {
  console.error('使い方: node import.js <export.json> [--dry-run] [--replace]')
  process.exit(2)
}

const dump = JSON.parse(fs.readFileSync(file, 'utf8'))
if (dump.format !== 'kyabacho-firebase-export/1') {
  console.error('エラー: 書き出しファイルの形式が違います(format が kyabacho-firebase-export/1 ではありません)')
  process.exit(1)
}
const users = dump.users ?? []
const docs = dump.docs ?? []

// 検証
const problems = []
const seen = new Set()
for (const d of docs) {
  const segs = splitPath(d.path)
  if (!segs || !isDocPath(segs)) problems.push(`パスが不正: ${d.path}`)
  else if (seen.has(d.path)) problems.push(`パスが重複: ${d.path}`)
  seen.add(d.path)
  try {
    validateValue(d.data)
  } catch (e) {
    problems.push(`${d.path}: ${e.message}`)
  }
}
for (const u of users) if (!u.uid) problems.push('uid の無いユーザーがあります')
const byTop = {}
for (const d of docs) {
  const k = d.path.split('/').filter((_, i) => i % 2 === 0).join('/')
  byTop[k] = (byTop[k] ?? 0) + 1
}
console.log(`書き出し日時: ${dump.exportedAt ?? '不明'} / Firebase プロジェクト: ${dump.projectId ?? '不明'}`)
console.log(`ユーザー: ${users.length} 人(Google 連携あり ${users.filter((u) => u.googleSub).length} 人)`)
console.log(`文書: ${docs.length} 件`)
for (const [k, n] of Object.entries(byTop).sort()) console.log(`  ${k}: ${n}`)
if (problems.length) {
  console.error(`\nエラー: 取り込めない内容が ${problems.length} 件あります(先頭 20 件):`)
  problems.slice(0, 20).forEach((p) => console.error('  - ' + p))
  process.exit(1)
}
if (dry) {
  console.log('\n--dry-run のため書き込みません。問題はありませんでした。')
  process.exit(0)
}

const dataDir = path.resolve(process.env.DATA_DIR || path.join(here, 'data'))
const db = openDb(path.join(dataDir, 'kyabacho.db'))
const existing = db.prepare('SELECT (SELECT COUNT(*) FROM docs) AS d, (SELECT COUNT(*) FROM users) AS u').get()
if ((existing.d > 0 || existing.u > 0) && !replace) {
  console.error(`\nエラー: DB は空ではありません(文書 ${existing.d} 件 / ユーザー ${existing.u} 人)。上書きする場合は --replace を付けてください。`)
  process.exit(1)
}

const now = Date.now()
const run = db.transaction(() => {
  if (replace) {
    db.exec('DELETE FROM docs; DELETE FROM sessions; DELETE FROM users;')
  }
  const insDoc = db.prepare(
    'INSERT INTO docs (path, parent, coll, id, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  )
  for (const d of docs) {
    const segs = d.path.split('/')
    insDoc.run(
      d.path,
      segs.slice(0, -1).join('/'),
      segs[segs.length - 2],
      segs[segs.length - 1],
      JSON.stringify(d.data),
      d.createTime ?? now,
      d.updateTime ?? now,
    )
  }
  const insUser = db.prepare(
    'INSERT INTO users (uid, google_sub, email, display_name, photo_url, created_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?, NULL)',
  )
  for (const u of users) {
    insUser.run(u.uid, u.googleSub ?? null, u.email ?? null, u.displayName ?? null, u.photoURL ?? null, u.createdAt ?? now)
  }
  db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('imported_from_firebase', ?)").run(
    JSON.stringify({ at: now, exportedAt: dump.exportedAt, projectId: dump.projectId, docs: docs.length, users: users.length }),
  )
})
run()
db.pragma('wal_checkpoint(TRUNCATE)')
db.close()
console.log(`\n取り込み完了: 文書 ${docs.length} 件 / ユーザー ${users.length} 人 → ${path.join(dataDir, 'kyabacho.db')}`)
const noSub = users.filter((u) => !u.googleSub)
if (noSub.length) {
  console.log(`注意: Google 連携の無いユーザーが ${noSub.length} 人います(メール/パスワード等)。この人たちは新しいログインでは元のデータに入れません。`)
}
