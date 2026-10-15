// HTTP の窓口。/api/* は API、それ以外は画面(ビルド済みの静的ファイル。未知のパスは index.html)。
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { buildAuthRequest, exchangeCode, randomToken, sha256 } from './google.js'
import { BadRequest } from './values.js'

const SESSION_COOKIE = 'kyabacho_sid'
const OAUTH_COOKIE = 'kyabacho_oauth'
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000
const MAX_BODY = 2 * 1024 * 1024
const MAX_OPS = 50

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.map': 'application/json; charset=utf-8',
}
const COMPRESSIBLE = /^(text\/|application\/(json|manifest\+json)|image\/svg)/

/**
 * @param {object} o
 * @param {ReturnType<import('./db.js').createStore>} o.store
 * @param {ReturnType<import('./db.js').createAccounts>} o.accounts
 * @param {{clientId?: string, clientSecret?: string}} o.google
 * @param {string} o.origin 公開 URL(例 https://kyabacho.ainowa.net)。Cookie の Secure とリダイレクト先に使う
 * @param {string} o.publicDir 画面のビルド成果物
 * @param {boolean} [o.devLogin] テスト用ログインを有効にする(本番では使わない)
 * @param {typeof fetch} [o.fetchImpl]
 */
export function createApp(o) {
  const secure = o.origin.startsWith('https://')
  const redirectUri = `${o.origin}/api/auth/google/callback`
  const gz = new Map()

  function setCookie(res, name, value, { maxAge, path: p = '/', httpOnly = true } = {}) {
    const parts = [`${name}=${value}`, `Path=${p}`, 'SameSite=Lax']
    if (httpOnly) parts.push('HttpOnly')
    if (secure) parts.push('Secure')
    if (maxAge != null) parts.push(`Max-Age=${Math.floor(maxAge / 1000)}`)
    const prev = res.getHeader('Set-Cookie')
    res.setHeader('Set-Cookie', [...(Array.isArray(prev) ? prev : prev ? [prev] : []), parts.join('; ')])
  }

  function cookies(req) {
    const out = {}
    for (const part of (req.headers.cookie ?? '').split(';')) {
      const i = part.indexOf('=')
      if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim()
    }
    return out
  }

  function sessionUid(req, res) {
    const sid = cookies(req)[SESSION_COOKIE]
    if (!sid || sid.length > 200) return null
    const s = o.accounts.session(sha256(sid), SESSION_TTL_MS)
    if (!s) return null
    // 使い続けている人がログアウトされないよう、延長したら Cookie の期限も延ばす
    if (s.extended) setCookie(res, SESSION_COOKIE, sid, { maxAge: SESSION_TTL_MS })
    return s.uid
  }

  function json(res, status, body) {
    const s = JSON.stringify(body)
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Length': Buffer.byteLength(s),
    })
    res.end(s)
  }

  function redirect(res, to) {
    res.writeHead(302, { Location: to, 'Cache-Control': 'no-store' })
    res.end()
  }

  async function readJson(req) {
    const chunks = []
    let size = 0
    for await (const c of req) {
      size += c.length
      if (size > MAX_BODY) throw Object.assign(new BadRequest('リクエストが大きすぎます'), { status: 413 })
      chunks.push(c)
    }
    try {
      return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
    } catch {
      throw new BadRequest('JSON が不正です')
    }
  }

  // 他サイトからの書き込み要求(CSRF)を防ぐ: 独自ヘッダーは他サイトのフォームやリンクでは付けられない
  function requireApiHeader(req) {
    if (req.headers['x-kyabacho'] !== '1') throw Object.assign(new Error('不正なリクエストです'), { status: 403, code: 'csrf' })
  }

  // 戻り先は自サイト内のパスだけ許可(外部サイトへの転送に悪用されないように)
  const safeNext = (n) => (typeof n === 'string' && /^\/(?!\/)[^\\\s]*$/.test(n) && !n.startsWith('/api/') ? n : '/')

  // ---------- API ----------
  async function handleApi(req, res, url) {
    const p = url.pathname
    if (p === '/api/health' && req.method === 'GET') return json(res, 200, { ok: true })

    if (p === '/api/config' && req.method === 'GET') {
      return json(res, 200, { googleClientId: o.google.clientId ?? null, devLogin: Boolean(o.devLogin) })
    }

    if (p === '/api/auth/google' && req.method === 'GET') {
      if (!o.google.clientId || !o.google.clientSecret) {
        return json(res, 503, { error: 'Google ログインの設定(GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)がありません' })
      }
      const a = buildAuthRequest({ clientId: o.google.clientId, redirectUri })
      const payload = Buffer.from(
        JSON.stringify({ s: a.state, n: a.nonce, v: a.verifier, next: safeNext(url.searchParams.get('next')) }),
      ).toString('base64url')
      setCookie(res, OAUTH_COOKIE, payload, { maxAge: 10 * 60 * 1000, path: '/api/auth/' })
      return redirect(res, a.url)
    }

    if (p === '/api/auth/google/callback' && req.method === 'GET') {
      const raw = cookies(req)[OAUTH_COOKIE]
      setCookie(res, OAUTH_COOKIE, '', { maxAge: 0, path: '/api/auth/' })
      let saved
      try {
        saved = JSON.parse(Buffer.from(raw ?? '', 'base64url').toString('utf8'))
      } catch {
        saved = null
      }
      const err = url.searchParams.get('error')
      if (err) return redirect(res, `/login?error=${encodeURIComponent(err === 'access_denied' ? 'cancelled' : 'google')}`)
      const code = url.searchParams.get('code')
      const state = url.searchParams.get('state')
      if (!saved || !code || !state || state !== saved.s) return redirect(res, '/login?error=state')
      try {
        const profile = await exchangeCode({
          clientId: o.google.clientId,
          clientSecret: o.google.clientSecret,
          redirectUri,
          code,
          verifier: saved.v,
          nonce: saved.n,
          fetchImpl: o.fetchImpl,
        })
        const uid = o.accounts.loginWithGoogle(profile)
        const sid = randomToken(32)
        o.accounts.createSession(sha256(sid), uid, SESSION_TTL_MS)
        setCookie(res, SESSION_COOKIE, sid, { maxAge: SESSION_TTL_MS })
        return redirect(res, safeNext(saved.next))
      } catch (e) {
        console.error('[auth] Google ログインに失敗:', e.message)
        return redirect(res, '/login?error=google')
      }
    }

    if (p === '/api/auth/dev-login' && req.method === 'POST') {
      if (!o.devLogin) return json(res, 404, { error: 'not found' })
      requireApiHeader(req)
      const b = await readJson(req)
      const uid = o.accounts.loginWithGoogle({
        sub: `dev:${String(b.sub ?? 'tester')}`,
        email: b.email ?? 'tester@example.com',
        name: b.name ?? 'テスター',
      })
      const sid = randomToken(32)
      o.accounts.createSession(sha256(sid), uid, SESSION_TTL_MS)
      setCookie(res, SESSION_COOKIE, sid, { maxAge: SESSION_TTL_MS })
      return json(res, 200, { uid })
    }

    if (p === '/api/auth/me' && req.method === 'GET') {
      const uid = sessionUid(req, res)
      const u = uid ? o.accounts.getUser(uid) : null
      if (!u) return json(res, 200, { user: null })
      return json(res, 200, {
        user: { uid: u.uid, email: u.email, displayName: u.display_name, photoURL: u.photo_url },
      })
    }

    if (p === '/api/auth/logout' && req.method === 'POST') {
      requireApiHeader(req)
      const sid = cookies(req)[SESSION_COOKIE]
      if (sid) o.accounts.deleteSession(sha256(sid))
      setCookie(res, SESSION_COOKIE, '', { maxAge: 0 })
      return json(res, 200, { ok: true })
    }

    if (p === '/api/db' && req.method === 'POST') {
      requireApiHeader(req)
      const uid = sessionUid(req, res)
      if (!uid) return json(res, 401, { error: 'ログインが必要です', code: 'unauthenticated' })
      const body = await readJson(req)
      if (!Array.isArray(body.ops) || body.ops.length === 0 || body.ops.length > MAX_OPS) {
        throw new BadRequest('ops が不正です')
      }
      const results = body.ops.map((op) => runOp(uid, op))
      return json(res, 200, { results })
    }

    return json(res, 404, { error: 'not found' })
  }

  function runOp(uid, op) {
    try {
      const s = o.store
      switch (op?.op) {
        case 'get':
          return { ok: true, doc: s.getDoc(uid, op.path) }
        case 'list':
          return { ok: true, docs: s.list(uid, op.path, op.query ?? {}) }
        case 'group':
          return { ok: true, docs: s.group(uid, op.coll, op.query ?? {}) }
        case 'set':
          return { ok: true, ...s.setDoc(uid, op.path, op.data, Boolean(op.merge)) }
        case 'update':
          return { ok: true, ...s.updateDoc(uid, op.path, op.data) }
        case 'add':
          return { ok: true, ...s.addDoc(uid, op.path, op.data) }
        case 'delete':
          return { ok: true, ...s.deleteDoc(uid, op.path) }
        default:
          throw new BadRequest('op が不正です')
      }
    } catch (e) {
      if (!e.code) console.error('[db]', e)
      return { ok: false, code: e.code ?? 'internal', message: e.code ? e.message : 'サーバーでエラーが発生しました' }
    }
  }

  // ---------- 画面(静的ファイル) ----------
  function serveStatic(req, res, url) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' })
      return res.end()
    }
    let rel
    try {
      rel = decodeURIComponent(url.pathname)
    } catch {
      rel = '/'
    }
    const root = path.resolve(o.publicDir)
    let file = path.resolve(root, '.' + path.posix.normalize(rel))
    if (!file.startsWith(root + path.sep) && file !== root) file = path.join(root, 'index.html')
    let st = statFile(file)
    let spaFallback = false
    if (!st) {
      // assets/ などの実ファイル置き場で見つからないものは 404(古い画面が存在しない JS を読み続けないように)
      if (/^\/assets\//.test(rel) || path.extname(rel)) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' })
        return res.end('Not Found')
      }
      file = path.join(root, 'index.html')
      st = statFile(file)
      spaFallback = true
      if (!st) {
        res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' })
        return res.end('画面のファイルがありません(配備前)')
      }
    }
    const ext = path.extname(file).toLowerCase()
    const type = MIME[ext] ?? 'application/octet-stream'
    const base = path.basename(file)
    let cache = 'public, max-age=3600'
    if (/^\/assets\//.test(rel) && !spaFallback) cache = 'public, max-age=31536000, immutable'
    if (spaFallback || /^(index\.html|sw\.js|registerSW\.js|manifest\.webmanifest)$/.test(base) || /^workbox-.*\.js$/.test(base)) {
      cache = 'no-cache'
    }
    const headers = {
      'Content-Type': type,
      'Cache-Control': cache,
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Last-Modified': st.mtime.toUTCString(),
    }
    if (type.startsWith('text/html')) headers['X-Frame-Options'] = 'DENY'
    let body = fs.readFileSync(file)
    if (COMPRESSIBLE.test(type) && body.length > 1024 && /\bgzip\b/.test(req.headers['accept-encoding'] ?? '')) {
      const key = `${file}:${st.mtimeMs}`
      let z = gz.get(key)
      if (!z) {
        z = zlib.gzipSync(body)
        gz.set(key, z)
      }
      body = z
      headers['Content-Encoding'] = 'gzip'
      headers.Vary = 'Accept-Encoding'
    }
    headers['Content-Length'] = body.length
    res.writeHead(200, headers)
    res.end(req.method === 'HEAD' ? undefined : body)
  }

  function statFile(f) {
    try {
      const st = fs.statSync(f)
      return st.isFile() ? st : null
    } catch {
      return null
    }
  }

  return async function handler(req, res) {
    let url
    try {
      url = new URL(req.url ?? '/', 'http://localhost')
    } catch {
      res.writeHead(400)
      return res.end()
    }
    try {
      if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url)
      return serveStatic(req, res, url)
    } catch (e) {
      const status = e.status ?? (e instanceof BadRequest ? 400 : 500)
      if (status >= 500) console.error('[http]', e)
      if (!res.headersSent) json(res, status, { error: status >= 500 ? 'サーバーでエラーが発生しました' : e.message, code: e.code })
      else res.end()
    }
  }
}
