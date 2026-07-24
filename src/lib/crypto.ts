// SEC-07 クライアント側フィールド暗号化（AES-256-GCM / PBKDF2）
//   パスフレーズから鍵を導出し、本名・相談本文などの機微フィールドを暗号化して保存する。
//   鍵・パスフレーズはサーバに送らない（真のE2E）。導出鍵は端末(IndexedDB)にキャッシュし、
//   別端末では都度パスフレーズ入力で復号する。パスフレーズを失うと復号は不可能。

const encoder = new TextEncoder()
const decoder = new TextDecoder()
const PREFIX = 'enc:v1:'
const CHECK_PLAINTEXT = 'kyabacho-ok'
const ITER = 210000

const toB64 = (buf: ArrayBuffer | Uint8Array): string => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return btoa(s)
}
// ArrayBuffer 実体の Uint8Array を返す（Web Crypto の BufferSource 要件を満たす）
const fromB64 = (s: string): Uint8Array<ArrayBuffer> => {
  const bin = atob(s)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return arr
}
const utf8 = (s: string): Uint8Array<ArrayBuffer> => {
  const src = encoder.encode(s)
  const arr = new Uint8Array(src.length)
  arr.set(src)
  return arr
}

export function isEncrypted(s: unknown): s is string {
  return typeof s === 'string' && s.startsWith(PREFIX)
}

export function randomSaltB64(): string {
  return toB64(crypto.getRandomValues(new Uint8Array(16)))
}

export async function deriveKey(passphrase: string, saltB64: string): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    utf8(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: fromB64(saltB64), iterations: ITER, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false, // 非抽出（端末キャッシュしても鍵バイト列は取り出せない）
    ['encrypt', 'decrypt'],
  )
}

async function encWith(key: CryptoKey, plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, utf8(plain))
  return `${PREFIX}${toB64(iv)}:${toB64(ct)}`
}
async function decWith(key: CryptoKey, payload: string): Promise<string> {
  if (!isEncrypted(payload)) return payload
  const parts = payload.split(':') // ['enc','v1',iv,ct]
  const iv = fromB64(parts[2])
  const ct = fromB64(parts[3])
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct)
  return decoder.decode(pt)
}

/** パスフレーズ検証用トークンを生成（プロフィールに保存） */
export async function makeCheckToken(key: CryptoKey): Promise<string> {
  return encWith(key, CHECK_PLAINTEXT)
}
export async function verifyKey(key: CryptoKey, checkToken: string): Promise<boolean> {
  try {
    return (await decWith(key, checkToken)) === CHECK_PLAINTEXT
  } catch {
    return false
  }
}

// ---- アクティブ鍵（モジュール単位。libの書込/読取から参照） ----
let activeKey: CryptoKey | null = null
export function setActiveKey(k: CryptoKey | null): void {
  activeKey = k
}
export function hasKey(): boolean {
  return activeKey !== null
}

/** 平文→暗号文。鍵未ロード時は例外（LOCKED）。空文字はそのまま */
export async function encField(plain: string | undefined): Promise<string> {
  if (!plain) return ''
  if (!activeKey) throw new Error('LOCKED')
  return encWith(activeKey, plain)
}
/** 鍵があれば暗号化、無ければ平文のまま（安全機能=黒服相談を止めないための寛容版） */
export async function encFieldMaybe(plain: string | undefined): Promise<string> {
  if (!plain) return ''
  if (!activeKey) return plain
  return encWith(activeKey, plain)
}
/** 暗号文→平文。非暗号化はそのまま返す（既存平文の後方互換）。ロック中/失敗は目印を返す */
export async function decField(payload: string | undefined | null): Promise<string> {
  if (!payload) return ''
  if (!isEncrypted(payload)) return payload
  if (!activeKey) return '🔒 ロック中'
  try {
    return await decWith(activeKey, payload)
  } catch {
    return '🔒 復号失敗'
  }
}

// ---- 端末内キャッシュ（IndexedDBに非抽出CryptoKeyを保存） ----
const DB_NAME = 'kyabacho-sec'
const STORE = 'keys'
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}
export async function cacheKey(uid: string, key: CryptoKey): Promise<void> {
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(key, uid)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    /* キャッシュ失敗は致命的でない（毎回パスフレーズ入力になるだけ） */
  }
}
export async function loadCachedKey(uid: string): Promise<CryptoKey | null> {
  try {
    const db = await openDb()
    return await new Promise<CryptoKey | null>((resolve) => {
      const tx = db.transaction(STORE, 'readonly')
      const rq = tx.objectStore(STORE).get(uid)
      rq.onsuccess = () => resolve((rq.result as CryptoKey) ?? null)
      rq.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}
export async function clearCachedKey(uid: string): Promise<void> {
  try {
    const db = await openDb()
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).delete(uid)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    })
  } catch {
    /* ignore */
  }
}
