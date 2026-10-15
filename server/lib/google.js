// Google ログイン(OAuth 2.0 / OpenID Connect の認可コードフロー + PKCE)。
// Firebase Authentication を使わず、サーバーが直接 Google とやり取りする。
import { createHash, randomBytes } from 'node:crypto'

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'

export const b64url = (buf) => Buffer.from(buf).toString('base64url')
export const randomToken = (bytes = 32) => b64url(randomBytes(bytes))
export const sha256 = (s) => createHash('sha256').update(s).digest('base64url')

/** ログイン開始用の URL と、Cookie に保存する検証用の値 */
export function buildAuthRequest({ clientId, redirectUri }) {
  const state = randomToken(24)
  const nonce = randomToken(24)
  const verifier = randomToken(48)
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    nonce,
    code_challenge: sha256(verifier),
    code_challenge_method: 'S256',
    prompt: 'select_account',
  })
  return { url: `${AUTH_URL}?${params}`, state, nonce, verifier }
}

/**
 * 認可コードを ID トークンに交換し、中身(本人情報)を返す。
 * ID トークンは Google のトークン窓口から TLS で直接受け取るため、署名の検証は省略できる
 * (OpenID Connect Core 3.1.3.7)。発行者・宛先・期限・nonce は確認する。
 */
export async function exchangeCode({ clientId, clientSecret, redirectUri, code, verifier, nonce, fetchImpl = fetch }) {
  const res = await fetchImpl(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code_verifier: verifier,
    }),
  })
  if (!res.ok) throw new Error(`Google のトークン交換に失敗しました (HTTP ${res.status})`)
  const body = await res.json()
  const claims = decodeIdToken(body.id_token)
  const now = Math.floor(Date.now() / 1000)
  if (!['https://accounts.google.com', 'accounts.google.com'].includes(claims.iss)) throw new Error('発行者が不正です')
  if (claims.aud !== clientId) throw new Error('宛先が不正です')
  if (typeof claims.exp !== 'number' || claims.exp < now - 60) throw new Error('期限切れです')
  if (claims.nonce !== nonce) throw new Error('nonce が一致しません')
  if (typeof claims.sub !== 'string' || !claims.sub) throw new Error('sub がありません')
  if (claims.email && claims.email_verified === false) throw new Error('メールアドレスが未確認のアカウントです')
  return { sub: claims.sub, email: claims.email, name: claims.name, picture: claims.picture }
}

export function decodeIdToken(token) {
  if (typeof token !== 'string') throw new Error('ID トークンがありません')
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('ID トークンの形式が不正です')
  return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
}
