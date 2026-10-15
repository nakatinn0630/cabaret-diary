// SQLite への保存と、Firestore 互換の文書操作(取得・一覧・追加・更新・削除)。
import Database from 'better-sqlite3'
import { randomInt } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import {
  BadRequest,
  applyUpdate,
  compareValues,
  getField,
  isPlainObject,
  matchFilter,
  mergeInto,
  resolveValue,
  validateValue,
} from './values.js'
import { canRead, canWrite, isCollPath, isDocPath, splitPath } from './rules.js'

export class Forbidden extends Error {
  constructor(msg = '権限がありません') {
    super(msg)
    this.code = 'permission-denied'
  }
}
export class NotFound extends Error {
  constructor(msg = '文書がありません') {
    super(msg)
    this.code = 'not-found'
  }
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS docs (
  path       TEXT PRIMARY KEY,
  parent     TEXT NOT NULL,   -- 親コレクションのパス(例 users/u1/customers)
  coll       TEXT NOT NULL,   -- コレクション名(collectionGroup 用。例 customers)
  id         TEXT NOT NULL,
  data       TEXT NOT NULL,   -- JSON(日時は {"$ts": ミリ秒})
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS docs_parent ON docs(parent);
CREATE INDEX IF NOT EXISTS docs_coll ON docs(coll);

CREATE TABLE IF NOT EXISTS users (
  uid           TEXT PRIMARY KEY,
  google_sub    TEXT UNIQUE,
  email         TEXT,
  display_name  TEXT,
  photo_url     TEXT,
  created_at    INTEGER NOT NULL,
  last_login_at INTEGER
);

CREATE TABLE IF NOT EXISTS sessions (
  id_hash    TEXT PRIMARY KEY,  -- Cookie の値そのものは保存しない(SHA-256)
  uid        TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_uid ON sessions(uid);

CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
`

const ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
export function newId(len = 20) {
  let s = ''
  for (let i = 0; i < len; i++) s += ID_CHARS[randomInt(ID_CHARS.length)]
  return s
}

export function openDb(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true })
  const db = new Database(file)
  db.pragma('journal_mode = WAL')
  db.pragma('synchronous = NORMAL')
  db.pragma('foreign_keys = ON')
  db.pragma('busy_timeout = 5000')
  db.exec(SCHEMA)
  return db
}

export function createStore(db, { now = () => Date.now() } = {}) {
  const st = {
    get: db.prepare('SELECT data FROM docs WHERE path = ?'),
    listParent: db.prepare('SELECT path, id, data FROM docs WHERE parent = ?'),
    listGroupUser: db.prepare("SELECT path, id, data FROM docs WHERE coll = ? AND path LIKE ? ESCAPE '\\'"),
    listGroupStores: db.prepare("SELECT path, id, data FROM docs WHERE coll = ? AND path LIKE 'stores/%'"),
    insert: db.prepare(
      'INSERT INTO docs (path, parent, coll, id, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ),
    update: db.prepare('UPDATE docs SET data = ?, updated_at = ? WHERE path = ?'),
    del: db.prepare('DELETE FROM docs WHERE path = ?'),
  }

  const readRaw = (p) => {
    const row = st.get.get(p)
    return row ? JSON.parse(row.data) : null
  }

  const ctxFor = (uid) => ({ uid, get: readRaw })

  function docSegs(p) {
    const segs = splitPath(p)
    if (!segs || !isDocPath(segs)) throw new BadRequest(`文書のパスが不正です: ${p}`)
    return segs
  }
  function collSegs(p) {
    const segs = splitPath(p)
    if (!segs || !isCollPath(segs)) throw new BadRequest(`コレクションのパスが不正です: ${p}`)
    return segs
  }

  function getDoc(uid, p) {
    const segs = docSegs(p)
    const data = readRaw(p)
    if (!canRead(ctxFor(uid), segs, data)) throw new Forbidden()
    return { path: p, id: segs[segs.length - 1], exists: data != null, data }
  }

  function applyQuery(rows, q) {
    let out = rows
    for (const f of q.where ?? []) out = out.filter((r) => matchFilter(r.data, f))
    const orders = q.orderBy ?? []
    // orderBy のフィールドが無い文書は結果に含めない(Firestore と同じ)
    for (const o of orders) out = out.filter((r) => getField(r.data, o.field) !== undefined)
    out = [...out].sort((a, b) => {
      for (const o of orders) {
        const c = compareValues(getField(a.data, o.field), getField(b.data, o.field))
        if (c) return o.dir === 'desc' ? -c : c
      }
      return a.path < b.path ? -1 : a.path > b.path ? 1 : 0
    })
    if (q.limit != null) out = out.slice(0, q.limit)
    return out
  }

  function validateQuery(q) {
    if (!isPlainObject(q)) throw new BadRequest('query が不正です')
    for (const f of q.where ?? []) {
      if (typeof f.field !== 'string' || typeof f.op !== 'string') throw new BadRequest('where が不正です')
      validateValue(f.value)
    }
    for (const o of q.orderBy ?? []) {
      if (typeof o.field !== 'string' || !['asc', 'desc'].includes(o.dir ?? 'asc')) throw new BadRequest('orderBy が不正です')
    }
    if (q.limit != null && !(Number.isInteger(q.limit) && q.limit > 0 && q.limit <= 10000)) throw new BadRequest('limit が不正です')
  }

  /**
   * コレクションの一覧。Firestore のルールは「クエリ全体が許可されるか」で判定するが、ここでは
   * 文書ごとに読み取り可否を見て、読めない文書が 1 件でもあれば拒否する(結果を黙って欠けさせない)。
   * ただし penalties / messages のように「自分宛だけ読める」コレクションは、where で自分宛に
   * 絞っていれば通る(Firestore と同じ考え方)。
   */
  function list(uid, collPath, q = {}) {
    const segs = collSegs(collPath)
    validateQuery(q)
    const ctx = ctxFor(uid)
    // 読めるかどうかを文書の内容に依存しない場所は、空でも判定できるようにダミーの文書パスで確認する
    const probe = [...segs, '__probe__']
    const rows = st.listParent.all(collPath).map((r) => ({ path: r.path, id: r.id, data: JSON.parse(r.data) }))
    const matched = applyQuery(rows, { where: q.where })
    if (matched.length === 0) {
      if (!canRead(ctx, probe, null) && !canReadIfOwnFiltered(ctx, probe, q)) throw new Forbidden()
    }
    for (const r of matched) if (!canRead(ctx, splitPath(r.path), r.data)) throw new Forbidden()
    return applyQuery(matched, { orderBy: q.orderBy, limit: q.limit }).map(toResult)
  }

  // 「castUid == 自分」で絞ったクエリは、該当 0 件でも許可する(自分宛のみ読める場所)
  function canReadIfOwnFiltered(ctx, probe, q) {
    const own = (q.where ?? []).find((f) => f.field === 'castUid' && f.op === '==' && f.value === ctx.uid)
    return own ? canRead(ctx, probe, { castUid: ctx.uid }) : false
  }

  /** collectionGroup。自分が読める文書だけを返す(本人の users 配下と、所属店舗の配下) */
  function group(uid, collId, q = {}) {
    if (!/^[A-Za-z0-9_\-]{1,100}$/.test(collId)) throw new BadRequest('コレクション名が不正です')
    validateQuery(q)
    if (uid == null) throw new Forbidden()
    const ctx = ctxFor(uid)
    const esc = uid.replace(/[\\%_]/g, (c) => '\\' + c)
    const rows = [...st.listGroupUser.all(collId, `users/${esc}/%`), ...st.listGroupStores.all(collId)]
      .map((r) => ({ path: r.path, id: r.id, data: JSON.parse(r.data) }))
      .filter((r) => canRead(ctx, splitPath(r.path), r.data))
    return applyQuery(rows, q).map(toResult)
  }

  const toResult = (r) => ({ path: r.path, id: r.id, exists: true, data: r.data })

  function write(uid, p, before, after) {
    const segs = docSegs(p)
    const op = after == null ? 'delete' : before == null ? 'create' : 'update'
    if (!canWrite(ctxFor(uid), segs, op, before, after)) throw new Forbidden()
    const t = now()
    if (op === 'delete') st.del.run(p)
    else if (op === 'create') {
      const json = JSON.stringify(after)
      if (json.length > 1_048_576) throw new BadRequest('文書が大きすぎます(1MB まで)')
      st.insert.run(p, segs.slice(0, -1).join('/'), segs[segs.length - 2], segs[segs.length - 1], json, t, t)
    } else {
      const json = JSON.stringify(after)
      if (json.length > 1_048_576) throw new BadRequest('文書が大きすぎます(1MB まで)')
      st.update.run(json, t, p)
    }
  }

  const setDoc = db.transaction((uid, p, data, merge) => {
    docSegs(p)
    if (!isPlainObject(data)) throw new BadRequest('data が不正です')
    validateValue(data)
    const before = readRaw(p)
    const t = now()
    const after = merge ? mergeInto(before, data, t) : resolveValue(stripDeletes(data), null, t)
    write(uid, p, before, after)
    return { path: p, id: p.split('/').pop() }
  })

  const updateDoc = db.transaction((uid, p, data) => {
    docSegs(p)
    if (!isPlainObject(data)) throw new BadRequest('data が不正です')
    validateValue(data)
    const before = readRaw(p)
    if (before == null) {
      // 存在しない文書への update は、読めない場所なら「権限なし」と区別しない
      if (!canRead(ctxFor(uid), splitPath(p), null)) throw new Forbidden()
      throw new NotFound()
    }
    write(uid, p, before, applyUpdate(before, data, now()))
    return { path: p, id: p.split('/').pop() }
  })

  const addDoc = db.transaction((uid, collPath, data) => {
    const segs = collSegs(collPath)
    if (!isPlainObject(data)) throw new BadRequest('data が不正です')
    validateValue(data)
    let id = newId()
    while (readRaw(`${collPath}/${id}`)) id = newId()
    const p = [...segs, id].join('/')
    write(uid, p, null, resolveValue(stripDeletes(data), null, now()))
    return { path: p, id }
  })

  const deleteDoc = db.transaction((uid, p) => {
    docSegs(p)
    const before = readRaw(p)
    if (before == null) {
      if (!canWrite(ctxFor(uid), splitPath(p), 'delete', null, null)) throw new Forbidden()
      return { path: p }
    }
    write(uid, p, before, null)
    return { path: p }
  })

  return { getDoc, list, group, setDoc, updateDoc, addDoc, deleteDoc, readRaw }
}

function stripDeletes(v) {
  if (!isPlainObject(v)) return v
  const out = {}
  for (const [k, x] of Object.entries(v)) {
    if (isPlainObject(x) && x.$sv === 'delete') continue
    out[k] = stripDeletes(x)
  }
  return out
}

// ---------- ユーザーとセッション ----------
export function createAccounts(db, { now = () => Date.now() } = {}) {
  const st = {
    bySub: db.prepare('SELECT * FROM users WHERE google_sub = ?'),
    byUid: db.prepare('SELECT * FROM users WHERE uid = ?'),
    insert: db.prepare(
      'INSERT INTO users (uid, google_sub, email, display_name, photo_url, created_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ),
    touch: db.prepare('UPDATE users SET email = ?, display_name = ?, photo_url = ?, last_login_at = ? WHERE uid = ?'),
    sessIns: db.prepare('INSERT INTO sessions (id_hash, uid, created_at, expires_at) VALUES (?, ?, ?, ?)'),
    sessGet: db.prepare('SELECT * FROM sessions WHERE id_hash = ?'),
    sessDel: db.prepare('DELETE FROM sessions WHERE id_hash = ?'),
    sessExtend: db.prepare('UPDATE sessions SET expires_at = ? WHERE id_hash = ?'),
    sessGc: db.prepare('DELETE FROM sessions WHERE expires_at < ?'),
  }

  /** Google のアカウント(sub)でログイン。初回なら uid を発行する */
  const loginWithGoogle = db.transaction((profile) => {
    const t = now()
    let u = st.bySub.get(profile.sub)
    if (!u) {
      const uid = newId(28)
      st.insert.run(uid, profile.sub, profile.email ?? null, profile.name ?? null, profile.picture ?? null, t, t)
      u = st.byUid.get(uid)
    } else {
      st.touch.run(profile.email ?? u.email, profile.name ?? u.display_name, profile.picture ?? u.photo_url, t, u.uid)
    }
    return u.uid
  })

  return {
    loginWithGoogle,
    getUser: (uid) => st.byUid.get(uid) ?? null,
    createSession(idHash, uid, ttlMs) {
      const t = now()
      st.sessIns.run(idHash, uid, t, t + ttlMs)
    },
    /** 有効なセッションの uid。期限の半分を過ぎていたら延長する */
    sessionUid(idHash, ttlMs) {
      const s = st.sessGet.get(idHash)
      if (!s) return null
      const t = now()
      if (s.expires_at < t) {
        st.sessDel.run(idHash)
        return null
      }
      if (s.expires_at - t < ttlMs / 2) st.sessExtend.run(t + ttlMs, idHash)
      return s.uid
    },
    deleteSession: (idHash) => st.sessDel.run(idHash),
    gcSessions: () => st.sessGc.run(now()),
  }
}
