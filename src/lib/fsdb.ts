// VPS のキャバ帳サーバー(/api/db)に保存するための、Firestore 互換の小さなクライアント。
// 以前は firebase/firestore を直接使っていた。呼び出し側のコードをほぼそのまま使えるよう、
// 使っていた関数(doc / collection / query / onSnapshot など)だけを同じ名前・同じ使い方で用意している。
//
// リアルタイム更新(onSnapshot)は「最初に取得 → 自分が書き込んだら取り直す → 画面表示中は 15 秒ごとと
// 画面に戻ったときに取り直す」方式。他の端末での変更は最大 15 秒ほど遅れて反映される。

/* eslint-disable @typescript-eslint/no-explicit-any */

export type DocumentData = Record<string, any>

// ---------- 日時 ----------
export class Timestamp {
  readonly seconds: number
  readonly nanoseconds: number
  constructor(seconds: number, nanoseconds: number) {
    this.seconds = seconds
    this.nanoseconds = nanoseconds
  }
  static fromMillis(ms: number): Timestamp {
    const s = Math.floor(ms / 1000)
    return new Timestamp(s, Math.round((ms - s * 1000) * 1e6))
  }
  static fromDate(d: Date): Timestamp {
    return Timestamp.fromMillis(d.getTime())
  }
  static now(): Timestamp {
    return Timestamp.fromMillis(Date.now())
  }
  toMillis(): number {
    return this.seconds * 1000 + Math.floor(this.nanoseconds / 1e6)
  }
  toDate(): Date {
    return new Date(this.toMillis())
  }
  isEqual(o: Timestamp): boolean {
    return o instanceof Timestamp && o.seconds === this.seconds && o.nanoseconds === this.nanoseconds
  }
  valueOf(): string {
    // 比較演算子(<, >)で使えるよう、桁をそろえた文字列にする(Firestore と同じ)
    return `${String(this.seconds + 1e12).padStart(14, '0')}.${String(this.nanoseconds).padStart(9, '0')}`
  }
  toJSON() {
    return { $ts: this.toMillis() }
  }
}

// ---------- 書き込み時の特殊値 ----------
export class FieldValue {
  readonly kind: string
  readonly v?: unknown
  constructor(kind: string, v?: unknown) {
    this.kind = kind
    this.v = v
  }
  toJSON() {
    return this.v === undefined ? { $sv: this.kind } : { $sv: this.kind, v: this.v }
  }
}
export const serverTimestamp = () => new FieldValue('serverTimestamp')
export const arrayUnion = (...v: unknown[]) => new FieldValue('arrayUnion', v)
export const arrayRemove = (...v: unknown[]) => new FieldValue('arrayRemove', v)
export const increment = (n: number) => new FieldValue('increment', n)
export const deleteField = () => new FieldValue('delete')

// ---------- 参照 ----------
export type Firestore = { readonly kind: 'kyabacho-db' }
export const db: Firestore = { kind: 'kyabacho-db' }

export class DocumentReference<T = DocumentData> {
  readonly type = 'document' as const
  readonly path: string
  declare readonly _t?: T
  constructor(path: string) {
    this.path = path
  }
  get id(): string {
    return this.path.split('/').pop() as string
  }
  get parent(): CollectionReference<T> {
    return new CollectionReference<T>(this.path.split('/').slice(0, -1).join('/'))
  }
}

type Filter = { field: string; op: WhereFilterOp; value: unknown }
type Order = { field: string; dir: 'asc' | 'desc' }
type Source = { kind: 'coll'; path: string } | { kind: 'group'; coll: string }

export class Query<T = DocumentData> {
  readonly type: 'query' | 'collection' = 'query'
  readonly source: Source
  readonly filters: Filter[]
  readonly orders: Order[]
  readonly max?: number
  declare readonly _t?: T
  constructor(source: Source, filters: Filter[] = [], orders: Order[] = [], max?: number) {
    this.source = source
    this.filters = filters
    this.orders = orders
    this.max = max
  }
}

export class CollectionReference<T = DocumentData> extends Query<T> {
  override readonly type = 'collection' as const
  readonly path: string
  constructor(path: string) {
    super({ kind: 'coll', path })
    this.path = path
  }
  get id(): string {
    return this.path.split('/').pop() as string
  }
}

const joinPath = (segs: string[]) => {
  const p = segs.join('/')
  if (!p || p.split('/').some((s) => !s)) throw new Error(`パスが不正です: ${p}`)
  return p
}

const ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
function autoId(): string {
  const a = new Uint8Array(20)
  crypto.getRandomValues(a)
  return Array.from(a, (x) => ID_CHARS[x % ID_CHARS.length]).join('')
}

export function doc(parent: Firestore | CollectionReference<any>, ...segs: string[]): DocumentReference {
  if (parent instanceof CollectionReference) {
    return new DocumentReference(joinPath([parent.path, ...(segs.length ? segs : [autoId()])]))
  }
  const p = joinPath(segs)
  if (p.split('/').length % 2 !== 0) throw new Error(`文書のパスではありません: ${p}`)
  return new DocumentReference(p)
}

export function collection(_db: Firestore, ...segs: string[]): CollectionReference {
  const p = joinPath(segs)
  if (p.split('/').length % 2 !== 1) throw new Error(`コレクションのパスではありません: ${p}`)
  return new CollectionReference(p)
}

export function collectionGroup(_db: Firestore, id: string): Query {
  return new Query({ kind: 'group', coll: id })
}

export type WhereFilterOp = '<' | '<=' | '==' | '!=' | '>=' | '>' | 'array-contains' | 'in' | 'not-in' | 'array-contains-any'
type Constraint =
  | { kind: 'where'; f: Filter }
  | { kind: 'orderBy'; o: Order }
  | { kind: 'limit'; n: number }
export const where = (field: string, op: WhereFilterOp, value: unknown): Constraint => ({
  kind: 'where',
  f: { field, op, value },
})
export const orderBy = (field: string, dir: 'asc' | 'desc' = 'asc'): Constraint => ({ kind: 'orderBy', o: { field, dir } })
export const limit = (n: number): Constraint => ({ kind: 'limit', n })

export function query<T>(base: Query<T>, ...cs: Constraint[]): Query<T> {
  let filters = [...base.filters]
  let orders = [...base.orders]
  let max = base.max
  for (const c of cs) {
    if (c.kind === 'where') filters = [...filters, c.f]
    else if (c.kind === 'orderBy') orders = [...orders, c.o]
    else max = c.n
  }
  return new Query<T>(base.source, filters, orders, max)
}

// ---------- スナップショット ----------
export class DocumentSnapshot<T = DocumentData> {
  readonly ref: DocumentReference<T>
  private readonly _data: T | undefined
  constructor(ref: DocumentReference<T>, data: T | undefined) {
    this.ref = ref
    this._data = data
  }
  get id(): string {
    return this.ref.id
  }
  exists(): this is QueryDocumentSnapshot<T> {
    return this._data !== undefined
  }
  data(): T | undefined {
    return this._data
  }
}
export class QueryDocumentSnapshot<T = DocumentData> extends DocumentSnapshot<T> {
  override data(): T {
    return super.data() as T
  }
}
export class QuerySnapshot<T = DocumentData> {
  readonly docs: QueryDocumentSnapshot<T>[]
  constructor(docs: QueryDocumentSnapshot<T>[]) {
    this.docs = docs
  }
  get size() {
    return this.docs.length
  }
  get empty() {
    return this.docs.length === 0
  }
  forEach(cb: (d: QueryDocumentSnapshot<T>) => void) {
    this.docs.forEach(cb)
  }
}

export class FirestoreError extends Error {
  readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'FirestoreError'
  }
}

// ---------- 値の変換 ----------
function encode(v: unknown): unknown {
  if (v === undefined) return undefined
  if (v instanceof Timestamp) return { $ts: v.toMillis() }
  if (v instanceof Date) return { $ts: v.getTime() }
  if (v instanceof FieldValue) {
    const j = v.toJSON() as { $sv: string; v?: unknown }
    return j.v === undefined ? j : { $sv: j.$sv, v: encode(j.v) }
  }
  if (Array.isArray(v)) return v.map((x) => (x === undefined ? null : encode(x)))
  if (v !== null && typeof v === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, x] of Object.entries(v)) {
      if (x !== undefined) out[k] = encode(x) // undefined のフィールドは送らない
    }
    return out
  }
  return v
}

function decode(v: any): any {
  if (Array.isArray(v)) return v.map(decode)
  if (v !== null && typeof v === 'object') {
    if (typeof v.$ts === 'number' && Object.keys(v).length === 1) return Timestamp.fromMillis(v.$ts)
    const out: Record<string, unknown> = {}
    for (const [k, x] of Object.entries(v)) out[k] = decode(x)
    return out
  }
  return v
}

// ---------- 通信(同じ瞬間の要求は 1 回の通信にまとめる) ----------
type Op = Record<string, unknown>
type Pending = { op: Op; resolve: (r: any) => void; reject: (e: unknown) => void }
const queue: Pending[] = []
let scheduled = false

/** ログインが切れたとき(401)に呼ばれる。AuthContext が設定する */
let onUnauthenticated: (() => void) | null = null
export function setUnauthenticatedHandler(fn: (() => void) | null) {
  onUnauthenticated = fn
}

function send(op: Op): Promise<any> {
  return new Promise((resolve, reject) => {
    queue.push({ op, resolve, reject })
    if (!scheduled) {
      scheduled = true
      setTimeout(flush, 0)
    }
  })
}

async function flush() {
  scheduled = false
  const batch = queue.splice(0, 50)
  if (queue.length) {
    scheduled = true
    setTimeout(flush, 0)
  }
  if (!batch.length) return
  try {
    const res = await fetch('/api/db', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-Kyabacho': '1' },
      body: JSON.stringify({ ops: batch.map((b) => b.op) }),
    })
    if (res.status === 401) {
      onUnauthenticated?.()
      throw new FirestoreError('unauthenticated', 'ログインが必要です')
    }
    if (!res.ok) throw new FirestoreError('unavailable', `サーバーエラー (HTTP ${res.status})`)
    const { results } = (await res.json()) as { results: any[] }
    batch.forEach((b, i) => {
      const r = results[i]
      if (r?.ok) b.resolve(r)
      else b.reject(new FirestoreError(r?.code ?? 'internal', r?.message ?? 'エラーが発生しました'))
    })
  } catch (e) {
    const err = e instanceof FirestoreError ? e : new FirestoreError('unavailable', '通信できませんでした。電波の良い場所で再度お試しください。')
    batch.forEach((b) => b.reject(err))
  }
}

const queryOp = (q: Query<any>): Op => {
  const query = {
    where: q.filters.map((f) => ({ field: f.field, op: f.op, value: encode(f.value) })),
    orderBy: q.orders,
    limit: q.max,
  }
  return q.source.kind === 'coll' ? { op: 'list', path: q.source.path, query } : { op: 'group', coll: q.source.coll, query }
}

const toQuerySnap = (docs: any[]) =>
  new QuerySnapshot(docs.map((d) => new QueryDocumentSnapshot(new DocumentReference(d.path), decode(d.data))))

// ---------- 読み取り ----------
export async function getDoc<T = DocumentData>(ref: DocumentReference<T>): Promise<DocumentSnapshot<T>> {
  const r = await send({ op: 'get', path: ref.path })
  return new DocumentSnapshot<T>(ref, r.doc.exists ? decode(r.doc.data) : undefined)
}

export async function getDocs<T = DocumentData>(q: Query<T>): Promise<QuerySnapshot<T>> {
  const r = await send(queryOp(q))
  return toQuerySnap(r.docs) as QuerySnapshot<T>
}

// ---------- 書き込み ----------
function afterWrite<R>(p: Promise<R>): Promise<R> {
  return p.then((r) => {
    scheduleRefreshAll()
    return r
  })
}

export function setDoc(ref: DocumentReference<any>, data: DocumentData, opts?: { merge?: boolean }): Promise<void> {
  return afterWrite(send({ op: 'set', path: ref.path, data: encode(data), merge: Boolean(opts?.merge) })).then(() => {})
}

export function updateDoc(ref: DocumentReference<any>, data: DocumentData): Promise<void> {
  return afterWrite(send({ op: 'update', path: ref.path, data: encode(data) })).then(() => {})
}

export async function addDoc(coll: CollectionReference<any>, data: DocumentData): Promise<DocumentReference> {
  const r = await afterWrite(send({ op: 'add', path: coll.path, data: encode(data) }))
  return new DocumentReference(r.path)
}

export function deleteDoc(ref: DocumentReference<any>): Promise<void> {
  return afterWrite(send({ op: 'delete', path: ref.path })).then(() => {})
}

// ---------- 監視(onSnapshot) ----------
type Listener = { refresh: () => void }
const listeners = new Set<Listener>()
const POLL_MS = 15_000
let pollTimer: ReturnType<typeof setInterval> | null = null
let refreshTimer: ReturnType<typeof setTimeout> | null = null

function scheduleRefreshAll() {
  if (refreshTimer) return
  refreshTimer = setTimeout(() => {
    refreshTimer = null
    listeners.forEach((l) => l.refresh())
  }, 30)
}

function ensurePolling() {
  if (typeof window === 'undefined') return
  if (listeners.size > 0 && !pollTimer) {
    pollTimer = setInterval(() => {
      if (document.visibilityState === 'visible') listeners.forEach((l) => l.refresh())
    }, POLL_MS)
  } else if (listeners.size === 0 && pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

if (typeof window !== 'undefined') {
  const wake = () => {
    if (document.visibilityState === 'visible') scheduleRefreshAll()
  }
  document.addEventListener('visibilitychange', wake)
  window.addEventListener('focus', wake)
  window.addEventListener('online', wake)
}

type DocNext<T> = (s: DocumentSnapshot<T>) => void
type QueryNext<T> = (s: QuerySnapshot<T>) => void
type ErrorCb = (e: FirestoreError) => void

export function onSnapshot<T = DocumentData>(ref: DocumentReference<T>, next: DocNext<T>, error?: ErrorCb): () => void
export function onSnapshot<T = DocumentData>(q: Query<T>, next: QueryNext<T>, error?: ErrorCb): () => void
export function onSnapshot(target: DocumentReference<any> | Query<any>, next: (s: any) => void, error?: ErrorCb): () => void {
  let active = true
  let last: string | null = null
  let inflight = false
  let again = false
  const op: Op = target instanceof DocumentReference ? { op: 'get', path: target.path } : queryOp(target)

  const refresh = () => {
    if (!active) return
    if (inflight) {
      again = true
      return
    }
    inflight = true
    send(op)
      .then((r) => {
        if (!active) return
        const raw = JSON.stringify(r.doc ?? r.docs)
        if (raw === last) return // 変化が無ければ画面を描き直さない
        last = raw
        if (target instanceof DocumentReference) {
          next(new DocumentSnapshot(target, r.doc.exists ? decode(r.doc.data) : undefined))
        } else {
          next(toQuerySnap(r.docs))
        }
      })
      .catch((e: FirestoreError) => {
        if (!active) return
        last = null
        if (error) error(e)
        else console.warn('[db] 取得に失敗しました:', e.message)
      })
      .finally(() => {
        inflight = false
        if (again && active) {
          again = false
          refresh()
        }
      })
  }

  const l: Listener = { refresh }
  listeners.add(l)
  ensurePolling()
  refresh()
  return () => {
    active = false
    listeners.delete(l)
    ensurePolling()
  }
}
