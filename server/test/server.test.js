// サーバーの自動テスト: node --test test/
import { test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createAccounts, createStore, openDb } from '../lib/db.js'
import { createApp } from '../lib/app.js'

function setup() {
  const db = openDb(':memory:')
  let t = 1_700_000_000_000
  const now = () => t
  return { db, store: createStore(db, { now }), accounts: createAccounts(db, { now }), tick: (ms) => (t += ms) }
}

test('users/{uid} 配下は本人だけが読み書きできる', () => {
  const { store } = setup()
  store.setDoc('alice', 'users/alice/customers/c1', { name: 'A', updatedAt: { $sv: 'serverTimestamp' } }, false)
  assert.equal(store.getDoc('alice', 'users/alice/customers/c1').data.name, 'A')
  assert.throws(() => store.getDoc('bob', 'users/alice/customers/c1'), { code: 'permission-denied' })
  assert.throws(() => store.list('bob', 'users/alice/customers'), { code: 'permission-denied' })
  assert.throws(() => store.setDoc('bob', 'users/alice/customers/c2', { x: 1 }, false), { code: 'permission-denied' })
  assert.throws(() => store.getDoc(null, 'users/alice/customers/c1'), { code: 'permission-denied' })
  // 空のコレクションでも本人なら一覧できる
  assert.deepEqual(store.list('alice', 'users/alice/schedules'), [])
})

test('add / update / merge / arrayUnion / delete', () => {
  const { store, tick } = setup()
  const { id } = store.addDoc('u', 'users/u/customers', { name: 'X', tags: ['a'], meta: { k: 1, j: 2 } })
  const p = `users/u/customers/${id}`
  tick(1000)
  store.updateDoc('u', p, { 'meta.k': 9, tags: { $sv: 'arrayUnion', v: ['a', 'b'] }, at: { $sv: 'serverTimestamp' } })
  let d = store.getDoc('u', p).data
  assert.deepEqual(d.meta, { k: 9, j: 2 })
  assert.deepEqual(d.tags, ['a', 'b'])
  assert.equal(d.at.$ts, 1_700_000_001_000)
  store.setDoc('u', p, { meta: { z: 3 } }, true)
  d = store.getDoc('u', p).data
  assert.deepEqual(d.meta, { k: 9, j: 2, z: 3 })
  assert.equal(d.name, 'X')
  store.setDoc('u', p, { only: 1 }, false)
  assert.deepEqual(store.getDoc('u', p).data, { only: 1 })
  assert.throws(() => store.updateDoc('u', 'users/u/customers/none', { a: 1 }), { code: 'not-found' })
  store.deleteDoc('u', p)
  assert.equal(store.getDoc('u', p).exists, false)
})

test('where / orderBy / limit と日時の比較', () => {
  const { store } = setup()
  for (const [i, ms] of [[1, 300], [2, 100], [3, 200]]) {
    store.setDoc('u', `users/u/schedules/s${i}`, { start: { $ts: ms }, kind: i % 2 ? 'odd' : 'even' }, false)
  }
  store.setDoc('u', 'users/u/schedules/s4', { kind: 'odd' }, false) // start なし → orderBy で除外
  const asc = store.list('u', 'users/u/schedules', { orderBy: [{ field: 'start', dir: 'asc' }] })
  assert.deepEqual(asc.map((d) => d.id), ['s2', 's3', 's1'])
  const odd = store.list('u', 'users/u/schedules', {
    where: [{ field: 'kind', op: '==', value: 'odd' }, { field: 'start', op: '>=', value: { $ts: 250 } }],
  })
  assert.deepEqual(odd.map((d) => d.id), ['s1'])
  const lim = store.list('u', 'users/u/schedules', { orderBy: [{ field: 'start', dir: 'desc' }], limit: 1 })
  assert.deepEqual(lim.map((d) => d.id), ['s1'])
})

test('collectionGroup は自分の文書だけを返す', () => {
  const { store } = setup()
  store.setDoc('a', 'users/a/customers/c/visits/v1', { date: { $ts: 10 }, amount: 1 }, false)
  store.setDoc('b', 'users/b/customers/c/visits/v2', { date: { $ts: 10 }, amount: 2 }, false)
  const mine = store.group('a', 'visits', { where: [{ field: 'date', op: '>=', value: { $ts: 0 } }] })
  assert.deepEqual(mine.map((d) => d.path), ['users/a/customers/c/visits/v1'])
})

test('店舗: 作成・招待・参加・役割の変更防止', () => {
  const { store } = setup()
  const { id: sid } = store.addDoc('boss', 'stores', { name: '店', createdBy: 'boss' })
  // 他人の名義で店は作れない
  assert.throws(() => store.addDoc('x', 'stores', { createdBy: 'boss' }), { code: 'permission-denied' })
  store.setDoc('boss', `stores/${sid}/memberships/boss`, { uid: 'boss', storeId: sid, role: 'manager' }, false)
  // 招待なしでは参加できない(移植元より締めた点)
  assert.throws(
    () => store.setDoc('cast', `stores/${sid}/memberships/cast`, { uid: 'cast', storeId: sid, role: 'manager' }, false),
    { code: 'permission-denied' },
  )
  const code = `${sid}.ABC123`
  store.setDoc('boss', `stores/${sid}/invites/${code}`, { role: 'cast' }, false)
  // 招待と違う役割では参加できない
  assert.throws(
    () =>
      store.setDoc('cast', `stores/${sid}/memberships/cast`, { uid: 'cast', storeId: sid, role: 'manager', inviteCode: code }, false),
    { code: 'permission-denied' },
  )
  store.setDoc('cast', `stores/${sid}/memberships/cast`, { uid: 'cast', storeId: sid, role: 'cast', inviteCode: code }, false)
  // 本人が役割を上げることはできない
  assert.throws(() => store.setDoc('cast', `stores/${sid}/memberships/cast`, { role: 'manager' }, true), {
    code: 'permission-denied',
  })
  store.setDoc('cast', `stores/${sid}/memberships/cast`, { displayName: 'あや' }, true)
  // 店長は役割を変えられる
  store.setDoc('boss', `stores/${sid}/memberships/cast`, { role: 'kurofuku' }, true)
  assert.equal(store.getDoc('boss', `stores/${sid}/memberships/cast`).data.role, 'kurofuku')
  // メンバー以外は店を読めない
  assert.throws(() => store.getDoc('stranger', `stores/${sid}`), { code: 'permission-denied' })
  // collectionGroup で自分の所属を探せる
  const mine = store.group('cast', 'memberships', { where: [{ field: 'uid', op: '==', value: 'cast' }] })
  assert.equal(mine.length, 1)
})

test('店舗: 罰金と連絡は本人宛だけ読める', () => {
  const { store } = setup()
  const { id: sid } = store.addDoc('boss', 'stores', { createdBy: 'boss' })
  store.setDoc('boss', `stores/${sid}/memberships/boss`, { uid: 'boss', storeId: sid, role: 'manager' }, false)
  store.setDoc('boss', `stores/${sid}/invites/${sid}.C`, { role: 'cast' }, false)
  for (const u of ['c1', 'c2']) {
    store.setDoc(u, `stores/${sid}/memberships/${u}`, { uid: u, storeId: sid, role: 'cast', inviteCode: `${sid}.C` }, false)
  }
  store.addDoc('boss', `stores/${sid}/penalties`, { castUid: 'c1', amount: 1000, createdAt: { $ts: 1 } })
  store.addDoc('boss', `stores/${sid}/penalties`, { castUid: 'c2', amount: 2000, createdAt: { $ts: 2 } })
  // 全件は店のスタッフだけ
  assert.equal(store.list('boss', `stores/${sid}/penalties`).length, 2)
  assert.throws(() => store.list('c1', `stores/${sid}/penalties`), { code: 'permission-denied' })
  // 自分宛に絞れば読める
  const own = store.list('c1', `stores/${sid}/penalties`, { where: [{ field: 'castUid', op: '==', value: 'c1' }] })
  assert.deepEqual(own.map((d) => d.data.amount), [1000])
  // 罰金はキャストが作れない
  assert.throws(() => store.addDoc('c1', `stores/${sid}/penalties`, { castUid: 'c1' }), { code: 'permission-denied' })
  // 連絡: キャストは自分のスレッドに自分名義でだけ投稿できる
  store.addDoc('c1', `stores/${sid}/messages`, { castUid: 'c1', fromUid: 'c1', text: 'hi' })
  assert.throws(() => store.addDoc('c1', `stores/${sid}/messages`, { castUid: 'c2', fromUid: 'c1' }), {
    code: 'permission-denied',
  })
  // 0 件でも自分宛の絞り込みなら許可
  assert.deepEqual(store.list('c2', `stores/${sid}/messages`, { where: [{ field: 'castUid', op: '==', value: 'c2' }] }), [])
})

test('不正な入力は拒否する', () => {
  const { store } = setup()
  assert.throws(() => store.setDoc('u', '../etc/passwd', { a: 1 }, false), { code: 'invalid-argument' })
  assert.throws(() => store.setDoc('u', 'users/u/customers', { a: 1 }, false), { code: 'invalid-argument' })
  assert.throws(() => store.setDoc('u', 'users/u/c/x', { $bad: 1 }, false), { code: 'invalid-argument' })
  assert.throws(() => store.setDoc('u', 'other/u', { a: 1 }, false), { code: 'permission-denied' })
})

// ---------- HTTP ----------
async function withServer(fn, extra = {}) {
  const s = setup()
  const pub = fs.mkdtempSync(path.join(os.tmpdir(), 'kyabacho-pub-'))
  fs.writeFileSync(path.join(pub, 'index.html'), '<!doctype html><title>キャバ帳</title>')
  fs.mkdirSync(path.join(pub, 'assets'))
  fs.writeFileSync(path.join(pub, 'assets', 'a.js'), 'console.log(1)')
  const app = createApp({
    store: s.store,
    accounts: s.accounts,
    google: { clientId: 'cid.apps.googleusercontent.com', clientSecret: 'sec' },
    origin: 'https://kyabacho.example',
    publicDir: pub,
    devLogin: true,
    ...extra,
  })
  const server = http.createServer(app)
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const base = `http://127.0.0.1:${server.address().port}`
  try {
    await fn(base, s)
  } finally {
    server.close()
  }
}

const cookieOf = (res) => (res.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ')

test('HTTP: 画面の配信と SPA のフォールバック', async () => {
  await withServer(async (base) => {
    let r = await fetch(`${base}/customers/abc`)
    assert.equal(r.status, 200)
    assert.match(await r.text(), /キャバ帳/)
    assert.equal(r.headers.get('cache-control'), 'no-cache')
    r = await fetch(`${base}/assets/a.js`)
    assert.match(r.headers.get('cache-control'), /immutable/)
    r = await fetch(`${base}/assets/missing.js`)
    assert.equal(r.status, 404)
    // 上の階層のファイルは返さない(画面の index.html になる)
    r = await fetch(`${base}/%2e%2e/%2e%2e/etc/passwd`)
    assert.doesNotMatch(await r.text(), /root:/)
    r = await fetch(`${base}/..%2f..%2fetc%2fpasswd`)
    assert.doesNotMatch(await r.text(), /root:/)
  })
})

test('HTTP: ログイン前は API を使えず、独自ヘッダー無しの書き込みは拒否', async () => {
  await withServer(async (base) => {
    let r = await fetch(`${base}/api/db`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Kyabacho': '1' },
      body: JSON.stringify({ ops: [{ op: 'get', path: 'users/x/profile/main' }] }),
    })
    assert.equal(r.status, 401)
    r = await fetch(`${base}/api/auth/dev-login`, { method: 'POST', body: '{}' })
    assert.equal(r.status, 403)
    r = await fetch(`${base}/api/auth/me`)
    assert.deepEqual(await r.json(), { user: null })
  })
})

test('HTTP: テスト用ログイン → 読み書き → ログアウト', async () => {
  await withServer(async (base) => {
    const h = { 'Content-Type': 'application/json', 'X-Kyabacho': '1' }
    let r = await fetch(`${base}/api/auth/dev-login`, { method: 'POST', headers: h, body: JSON.stringify({ sub: 'a' }) })
    const { uid } = await r.json()
    const cookie = cookieOf(r)
    assert.match(cookie, /kyabacho_sid=/)
    r = await fetch(`${base}/api/db`, {
      method: 'POST',
      headers: { ...h, cookie },
      body: JSON.stringify({
        ops: [
          { op: 'add', path: `users/${uid}/customers`, data: { name: 'テスト' } },
          { op: 'get', path: `users/other/customers/x` },
        ],
      }),
    })
    const { results } = await r.json()
    assert.equal(results[0].ok, true)
    assert.equal(results[1].ok, false)
    assert.equal(results[1].code, 'permission-denied')
    r = await fetch(`${base}/api/auth/me`, { headers: { cookie } })
    assert.equal((await r.json()).user.uid, uid)
    r = await fetch(`${base}/api/auth/logout`, { method: 'POST', headers: { ...h, cookie } })
    r = await fetch(`${base}/api/auth/me`, { headers: { cookie } })
    assert.deepEqual(await r.json(), { user: null })
  })
})

test('HTTP: Google ログイン(state / nonce の検証と uid の引き継ぎ)', async () => {
  let lastNonce
  const fakeFetch = async (_url, init) => {
    const body = new URLSearchParams(init.body)
    assert.equal(body.get('code'), 'CODE')
    assert.ok(body.get('code_verifier'))
    const payload = {
      iss: 'https://accounts.google.com',
      aud: 'cid.apps.googleusercontent.com',
      exp: Math.floor(Date.now() / 1000) + 300,
      nonce: lastNonce,
      sub: 'google-sub-1',
      email: 'a@example.com',
      email_verified: true,
      name: '如月',
    }
    const tok = ['e30', Buffer.from(JSON.stringify(payload)).toString('base64url'), 'sig'].join('.')
    return new Response(JSON.stringify({ id_token: tok }), { status: 200 })
  }
  await withServer(
    async (base, s) => {
      // 移行済みユーザー(Firebase の uid を引き継ぐ)
      s.db.prepare('INSERT INTO users (uid, google_sub, created_at) VALUES (?, ?, 0)').run('FIREBASE_UID_1', 'google-sub-1')
      let r = await fetch(`${base}/api/auth/google?next=/customers`, { redirect: 'manual' })
      assert.equal(r.status, 302)
      const loc = new URL(r.headers.get('location'))
      assert.equal(loc.origin, 'https://accounts.google.com')
      assert.equal(loc.searchParams.get('redirect_uri'), 'https://kyabacho.example/api/auth/google/callback')
      lastNonce = loc.searchParams.get('nonce')
      const state = loc.searchParams.get('state')
      const oauthCookie = cookieOf(r)
      // state が違えば拒否
      r = await fetch(`${base}/api/auth/google/callback?code=CODE&state=WRONG`, { headers: { cookie: oauthCookie }, redirect: 'manual' })
      assert.equal(r.headers.get('location'), '/login?error=state')
      r = await fetch(`${base}/api/auth/google/callback?code=CODE&state=${state}`, {
        headers: { cookie: oauthCookie },
        redirect: 'manual',
      })
      assert.equal(r.headers.get('location'), '/customers')
      const sc = r.headers.getSetCookie().find((c) => c.startsWith('kyabacho_sid='))
      assert.match(sc, /HttpOnly/)
      assert.match(sc, /Secure/)
      r = await fetch(`${base}/api/auth/me`, { headers: { cookie: sc.split(';')[0] } })
      const me = (await r.json()).user
      assert.equal(me.uid, 'FIREBASE_UID_1')
      assert.equal(me.displayName, '如月')
    },
    { fetchImpl: fakeFetch, devLogin: false },
  )
})

test('HTTP: 外部サイトへの転送に使われない', async () => {
  await withServer(async (base) => {
    for (const next of ['//evil.example', 'https://evil.example', '/\\evil.example']) {
      const r = await fetch(`${base}/api/auth/google?next=${encodeURIComponent(next)}`, { redirect: 'manual' })
      const raw = cookieOf(r).split('=')[1]
      const saved = JSON.parse(Buffer.from(raw, 'base64url').toString())
      assert.equal(saved.next, '/')
    }
  })
})
