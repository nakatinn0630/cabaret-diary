// Firebase(Firestore の全文書と Authentication のユーザー)を 1 つの JSON ファイルに書き出す。
// キャバ帳サーバーの server/import.js で取り込む。Mac で一度だけ実行する想定。
//
//   node export-firebase.mjs <サービスアカウント鍵.json> <出力先.json>
//
// サービスアカウント鍵: Firebase コンソール → プロジェクトの設定 → サービスアカウント →「新しい秘密鍵を生成」。
// 強い権限の鍵なので、移行が終わったら Mac から削除し、Google Cloud の「IAM → サービスアカウント → 鍵」でも無効化すること。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { cert, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { DocumentReference, GeoPoint, Timestamp, getFirestore } from 'firebase-admin/firestore'

const warnings = []

function convert(v, where) {
  if (v === null || v === undefined) return null
  if (v instanceof Timestamp) return { $ts: v.toMillis() }
  if (v instanceof Date) return { $ts: v.getTime() }
  if (v instanceof DocumentReference) {
    warnings.push(`${where}: 文書参照を文字列(パス)に変換しました`)
    return v.path
  }
  if (v instanceof GeoPoint) return { latitude: v.latitude, longitude: v.longitude }
  if (Buffer.isBuffer(v) || v instanceof Uint8Array) {
    warnings.push(`${where}: バイナリを base64 文字列に変換しました`)
    return Buffer.from(v).toString('base64')
  }
  if (Array.isArray(v)) return v.map((x, i) => convert(x, `${where}[${i}]`))
  if (typeof v === 'object') {
    const out = {}
    for (const [k, x] of Object.entries(v)) {
      if (k.startsWith('$')) {
        warnings.push(`${where}.${k}: $ で始まるフィールド名は使えないため _${k.slice(1)} に変更しました`)
        out['_' + k.slice(1)] = convert(x, `${where}.${k}`)
      } else out[k] = convert(x, `${where}.${k}`)
    }
    return out
  }
  if (typeof v === 'number' && !Number.isFinite(v)) return null
  return v
}

/**
 * Firestore と Authentication の中身を書き出し用の形にまとめる。
 * @param {{ db: import('firebase-admin/firestore').Firestore, auth: import('firebase-admin/auth').Auth, projectId: string, log?: (s: string) => void }} o
 */
export async function exportAll({ db, auth, projectId, log = console.log }) {
  warnings.length = 0
  const docs = []
  async function walkCollection(col) {
    // listDocuments は、中身が無くてもサブコレクションを持つ文書も返す
    const refs = await col.listDocuments()
    for (const ref of refs) {
      const snap = await ref.get()
      if (snap.exists) {
        docs.push({
          path: ref.path,
          data: convert(snap.data(), ref.path),
          createTime: snap.createTime?.toMillis(),
          updateTime: snap.updateTime?.toMillis(),
        })
      }
      for (const sub of await ref.listCollections()) await walkCollection(sub)
    }
  }

  log(`Firebase プロジェクト: ${projectId}`)
  log('Firestore を読み込んでいます…')
  for (const col of await db.listCollections()) await walkCollection(col)
  log(`  文書 ${docs.length} 件`)

  log('Authentication のユーザーを読み込んでいます…')
  const users = []
  let pageToken
  do {
    const page = await auth.listUsers(1000, pageToken)
    for (const u of page.users) {
      const google = u.providerData.find((p) => p.providerId === 'google.com')
      users.push({
        uid: u.uid,
        googleSub: google?.uid ?? null,
        email: u.email ?? google?.email ?? null,
        displayName: u.displayName ?? google?.displayName ?? null,
        photoURL: u.photoURL ?? null,
        createdAt: u.metadata.creationTime ? Date.parse(u.metadata.creationTime) : null,
      })
    }
    pageToken = page.pageToken
  } while (pageToken)
  log(`  ユーザー ${users.length} 人(Google 連携あり ${users.filter((u) => u.googleSub).length} 人)`)

  return {
    dump: { format: 'kyabacho-firebase-export/1', exportedAt: new Date().toISOString(), projectId, users, docs },
    warnings: [...warnings],
  }
}

// ---------- コマンドとして実行されたとき ----------
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [keyFile, outFile] = process.argv.slice(2)
  if (!keyFile || !outFile) {
    console.error('使い方: node export-firebase.mjs <サービスアカウント鍵.json> <出力先.json>')
    process.exit(2)
  }
  const key = JSON.parse(fs.readFileSync(keyFile, 'utf8'))
  const app = initializeApp({ credential: cert(key), projectId: key.project_id })
  const { dump, warnings: warns } = await exportAll({
    db: getFirestore(app),
    auth: getAuth(app),
    projectId: key.project_id,
  })
  fs.writeFileSync(outFile, JSON.stringify(dump), { mode: 0o600 })
  console.log(`書き出しました: ${outFile}(${(fs.statSync(outFile).size / 1024).toFixed(1)} KB)`)
  if (warns.length) {
    console.log(`注意 ${warns.length} 件(先頭 10 件):`)
    warns.slice(0, 10).forEach((w) => console.log('  - ' + w))
  }
  process.exit(0)
}
