// Firestore 互換の値表現と、比較・書き込み変換(serverTimestamp / arrayUnion など)。
//
// 通信と保存は JSON。JSON に無い型は次の形で表す:
//   日時(Timestamp)        { "$ts": ミリ秒 }
//   書き込み時の特殊値      { "$sv": "serverTimestamp" } / { "$sv": "arrayUnion", "v": [...] }
//                           { "$sv": "arrayRemove", "v": [...] } / { "$sv": "increment", "v": 数 } / { "$sv": "delete" }
// 特殊値($sv)は書き込み時に解決され、保存されるのは解決後の値だけ。

export const isPlainObject = (v) =>
  v !== null && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype

export const isTs = (v) => isPlainObject(v) && typeof v.$ts === 'number' && Object.keys(v).length === 1
export const isSentinel = (v) => isPlainObject(v) && typeof v.$sv === 'string'

/** 受け取った値が保存してよい形か(深さ・型)。不正なら例外 */
export function validateValue(v, depth = 0) {
  if (depth > 20) throw new BadRequest('値の入れ子が深すぎます')
  if (v === null || typeof v === 'boolean' || typeof v === 'string') return
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) throw new BadRequest('数値が不正です')
    return
  }
  if (Array.isArray(v)) {
    for (const x of v) {
      if (Array.isArray(x)) throw new BadRequest('配列の中に配列は入れられません')
      validateValue(x, depth + 1)
    }
    return
  }
  if (isPlainObject(v)) {
    if (isTs(v)) return
    if (isSentinel(v)) {
      const ok = ['serverTimestamp', 'arrayUnion', 'arrayRemove', 'increment', 'delete']
      if (!ok.includes(v.$sv)) throw new BadRequest('不明な特殊値です')
      if ((v.$sv === 'arrayUnion' || v.$sv === 'arrayRemove') && !Array.isArray(v.v)) throw new BadRequest('配列が必要です')
      if (v.$sv === 'increment' && !Number.isFinite(v.v)) throw new BadRequest('数値が必要です')
      if (Array.isArray(v.v)) v.v.forEach((x) => validateValue(x, depth + 1))
      return
    }
    for (const [k, x] of Object.entries(v)) {
      if (k.startsWith('$')) throw new BadRequest('$ で始まるフィールド名は使えません')
      if (k.split('.').some((seg) => FORBIDDEN_KEYS.has(seg))) throw new BadRequest(`使えないフィールド名です: ${k}`)
      if (k.length === 0 || k.length > 1500) throw new BadRequest('フィールド名が不正です')
      validateValue(x, depth + 1)
    }
    return
  }
  throw new BadRequest('保存できない値です')
}

// オブジェクトの仕組み(プロトタイプ)に触れる名前は、保存内容とアクセス判定がずれる原因になるため使わせない
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

export class BadRequest extends Error {
  constructor(msg) {
    super(msg)
    this.code = 'invalid-argument'
  }
}

export function deepEqual(a, b) {
  if (a === b) return true
  if (typeof a !== typeof b || a === null || b === null) return false
  if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((x, i) => deepEqual(x, b[i]))
  if (typeof a === 'object') {
    const ka = Object.keys(a)
    const kb = Object.keys(b)
    return ka.length === kb.length && ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k]))
  }
  return false
}

/** 特殊値を解決する。prev は同じ位置の既存値 */
function resolveSentinel(sv, prev, now) {
  switch (sv.$sv) {
    case 'serverTimestamp':
      return { $ts: now }
    case 'arrayUnion': {
      const base = Array.isArray(prev) ? [...prev] : []
      for (const x of sv.v) if (!base.some((y) => deepEqual(x, y))) base.push(x)
      return base
    }
    case 'arrayRemove': {
      const base = Array.isArray(prev) ? prev : []
      return base.filter((y) => !sv.v.some((x) => deepEqual(x, y)))
    }
    case 'increment':
      return (typeof prev === 'number' ? prev : 0) + sv.v
    default:
      throw new BadRequest('不明な特殊値です')
  }
}

/** 値の中の特殊値を(既存値を参照しながら)解決した新しい値を返す。delete はここでは扱わない */
export function resolveValue(v, prev, now) {
  if (isSentinel(v)) {
    if (v.$sv === 'delete') throw new BadRequest('deleteField は update / merge でだけ使えます')
    return resolveSentinel(v, prev, now)
  }
  if (Array.isArray(v)) return v.map((x) => resolveValue(x, undefined, now))
  if (isPlainObject(v) && !isTs(v)) {
    const out = {}
    for (const [k, x] of Object.entries(v)) out[k] = resolveValue(x, isPlainObject(prev) ? prev[k] : undefined, now)
    return out
  }
  return v
}

/** set(merge:true) の意味でのマージ。入れ子のマップは深くマージし、それ以外は置き換える */
export function mergeInto(base, patch, now) {
  const out = isPlainObject(base) ? { ...base } : {}
  for (const [k, v] of Object.entries(patch)) {
    if (isSentinel(v) && v.$sv === 'delete') {
      delete out[k]
    } else if (isPlainObject(v) && !isTs(v) && !isSentinel(v)) {
      out[k] = mergeInto(out[k], v, now)
    } else {
      out[k] = resolveValue(v, out[k], now)
    }
  }
  return out
}

/** update の意味での適用。キーは "a.b" 形式のフィールドパス。指定した位置を丸ごと置き換える */
export function applyUpdate(base, patch, now) {
  const out = structuredClone(isPlainObject(base) ? base : {})
  for (const [path, v] of Object.entries(patch)) {
    const keys = path.split('.')
    if (keys.some((k) => !k || FORBIDDEN_KEYS.has(k))) throw new BadRequest(`フィールドパスが不正です: ${path}`)
    let cur = out
    for (const k of keys.slice(0, -1)) {
      if (!isPlainObject(cur[k]) || isTs(cur[k])) cur[k] = {}
      cur = cur[k]
    }
    const last = keys[keys.length - 1]
    if (isSentinel(v) && v.$sv === 'delete') delete cur[last]
    else cur[last] = resolveValue(v, cur[last], now)
  }
  return out
}

/** "a.b" のフィールドパスで値を取り出す(無ければ undefined) */
export function getField(data, path) {
  let cur = data
  for (const k of path.split('.')) {
    if (!isPlainObject(cur) || isTs(cur)) return undefined
    cur = cur[k]
  }
  return cur
}

// Firestore の型順序: null < 真偽 < 数値 < 日時 < 文字列 < 配列 < マップ
function typeRank(v) {
  if (v === null) return 0
  if (typeof v === 'boolean') return 1
  if (typeof v === 'number') return 2
  if (isTs(v)) return 3
  if (typeof v === 'string') return 4
  if (Array.isArray(v)) return 5
  return 6
}

export function compareValues(a, b) {
  const ra = typeRank(a)
  const rb = typeRank(b)
  if (ra !== rb) return ra - rb
  switch (ra) {
    case 0:
      return 0
    case 1:
    case 2:
      return a === b ? 0 : a < b ? -1 : 1
    case 3:
      return a.$ts === b.$ts ? 0 : a.$ts < b.$ts ? -1 : 1
    case 4:
      return a === b ? 0 : a < b ? -1 : 1
    case 5: {
      for (let i = 0; i < Math.min(a.length, b.length); i++) {
        const c = compareValues(a[i], b[i])
        if (c) return c
      }
      return a.length - b.length
    }
    default:
      return deepEqual(a, b) ? 0 : JSON.stringify(a) < JSON.stringify(b) ? -1 : 1
  }
}

/** where 条件の評価。フィールドが無い文書は(!= / not-in を含め)一致しない(Firestore と同じ) */
export function matchFilter(data, f) {
  const v = getField(data, f.field)
  if (v === undefined) return false
  const x = f.value
  switch (f.op) {
    case '==':
      return compareValues(v, x) === 0 && typeRank(v) === typeRank(x)
    case '!=':
      return v !== null && !(typeRank(v) === typeRank(x) && compareValues(v, x) === 0)
    case '<':
      return typeRank(v) === typeRank(x) && compareValues(v, x) < 0
    case '<=':
      return typeRank(v) === typeRank(x) && compareValues(v, x) <= 0
    case '>':
      return typeRank(v) === typeRank(x) && compareValues(v, x) > 0
    case '>=':
      return typeRank(v) === typeRank(x) && compareValues(v, x) >= 0
    case 'in':
      return Array.isArray(x) && x.some((y) => typeRank(v) === typeRank(y) && compareValues(v, y) === 0)
    case 'not-in':
      return v !== null && Array.isArray(x) && !x.some((y) => typeRank(v) === typeRank(y) && compareValues(v, y) === 0)
    case 'array-contains':
      return Array.isArray(v) && v.some((y) => deepEqual(y, x))
    case 'array-contains-any':
      return Array.isArray(v) && Array.isArray(x) && v.some((y) => x.some((z) => deepEqual(y, z)))
    default:
      throw new BadRequest(`未対応の比較です: ${f.op}`)
  }
}
