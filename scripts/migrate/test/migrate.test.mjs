// 移行(書き出し → 取り込み → ログイン)の通しテスト。Firestore は偽物(同じ形の API)を使う。
//   node --test test/   (scripts/migrate で実行)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Timestamp } from 'firebase-admin/firestore'
import { exportAll } from '../export-firebase.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const serverDir = path.resolve(here, '../../../server')

// パス → データ の表から、Firestore Admin SDK と同じ形の偽物を作る
function fakeFirestore(table) {
  const t = (ms) => Timestamp.fromMillis(ms)
  const docPaths = Object.keys(table)
  const childColls = (prefix) => {
    const depth = prefix ? prefix.split('/').length + 1 : 1
    const set = new Set()
    for (const p of docPaths) {
      if (prefix && !p.startsWith(prefix + '/')) continue
      set.add(p.split('/').slice(0, depth).join('/'))
    }
    return [...set].map(coll)
  }
  const coll = (cpath) => ({
    path: cpath,
    async listDocuments() {
      const depth = cpath.split('/').length + 1
      const set = new Set(docPaths.filter((p) => p.startsWith(cpath + '/')).map((p) => p.split('/').slice(0, depth).join('/')))
      return [...set].map(docRef)
    },
  })
  const docRef = (dpath) => ({
    path: dpath,
    async get() {
      const data = table[dpath]
      return { exists: data !== undefined, data: () => data, createTime: t(1000), updateTime: t(2000) }
    },
    async listCollections() {
      return childColls(dpath)
    },
  })
  return { listCollections: async () => childColls('') }
}

test('Firestore + Auth を書き出し、SQLite に取り込み、同じ Google アカウントで元の uid に入れる', async () => {
  const ts = Timestamp.fromMillis(1_760_000_000_000)
  const table = {
    'users/FB_UID_A/profile/main': { stageName: 'れいな', encSalt: 'abc', encCheck: 'enc:v1:x:y', updatedAt: ts },
    'users/FB_UID_A/customers/c1': { nickname: 'タカさん', realName: 'enc:v1:aa:bb', rank: 'VIP', rankHistory: [{ rank: 'VIP', changedAt: ts }], updatedAt: ts },
    'users/FB_UID_A/customers/c1/visits/v1': { date: ts, amount: 35000, isShimei: true },
    // 中身の無い親(users/FB_UID_B)の下にだけ文書がある
    'users/FB_UID_B/schedules/s1': { start: ts, type: 'shift' },
    'stores/S1': { name: '月光', createdBy: 'FB_UID_A', createdAt: ts },
    'stores/S1/memberships/FB_UID_A': { uid: 'FB_UID_A', storeId: 'S1', role: 'manager' },
    'stores/S1/memberships/FB_UID_B': { uid: 'FB_UID_B', storeId: 'S1', role: 'cast' },
    'stores/S1/sales/2026-10/casts/FB_UID_B': { amount: 100, confirmedAt: ts },
  }
  const auth = {
    async listUsers() {
      return {
        users: [
          { uid: 'FB_UID_A', email: 'a@example.com', displayName: 'A', providerData: [{ providerId: 'google.com', uid: 'GSUB_A', email: 'a@example.com' }], metadata: { creationTime: 'Thu, 01 Oct 2026 00:00:00 GMT' } },
          { uid: 'FB_UID_B', email: 'b@example.com', providerData: [{ providerId: 'password', uid: 'b@example.com' }], metadata: {} },
        ],
      }
    },
  }
  const { dump } = await exportAll({ db: fakeFirestore(table), auth, projectId: 'demo', log: () => {} })
  assert.equal(dump.docs.length, Object.keys(table).length)
  const visit = dump.docs.find((d) => d.path.endsWith('/visits/v1'))
  assert.deepEqual(visit.data.date, { $ts: 1_760_000_000_000 })
  assert.equal(dump.users.find((u) => u.uid === 'FB_UID_A').googleSub, 'GSUB_A')
  assert.equal(dump.users.find((u) => u.uid === 'FB_UID_B').googleSub, null)

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kyabacho-mig-'))
  const file = path.join(dir, 'export.json')
  fs.writeFileSync(file, JSON.stringify(dump))
  const run = (...args) => execFileSync('node', [path.join(serverDir, 'import.js'), file, ...args], { env: { ...process.env, DATA_DIR: dir }, encoding: 'utf8' })
  assert.match(run('--dry-run'), /文書: 8 件/)
  assert.match(run(), /取り込み完了: 文書 8 件 \/ ユーザー 2 人/)
  // 2 回目は空でないので拒否
  assert.throws(() => run(), /空ではありません/)

  const { openDb, createStore, createAccounts } = await import(path.join(serverDir, 'lib/db.js'))
  const db = openDb(path.join(dir, 'kyabacho.db'))
  const store = createStore(db)
  const accounts = createAccounts(db)
  // 同じ Google アカウント(sub)でログインすると、Firebase と同じ uid になる
  const uid = accounts.loginWithGoogle({ sub: 'GSUB_A', email: 'a@example.com', name: 'A' })
  assert.equal(uid, 'FB_UID_A')
  const customers = store.list(uid, `users/${uid}/customers`)
  assert.equal(customers[0].data.realName, 'enc:v1:aa:bb') // 暗号文はそのまま
  const visits = store.group(uid, 'visits', { where: [{ field: 'date', op: '>=', value: { $ts: 0 } }] })
  assert.equal(visits.length, 1)
  // 店舗: 店長は B の売上を読める
  assert.equal(store.list(uid, 'stores/S1/sales/2026-10/casts').length, 1)
  // 他人のデータは読めない
  assert.throws(() => store.list(uid, 'users/FB_UID_B/schedules'), { code: 'permission-denied' })
  db.close()
})
