// キャバ帳サーバー(VPS)との接続口。以前の src/lib/firebase.ts を置き換えたもの。
// - データ: ./fsdb(Firestore 互換の書き方で /api/db に保存)
// - ログイン: サーバーが Google ログインを処理し、Cookie(HttpOnly)でログイン状態を保つ
export { db } from './fsdb'

export type AppUser = {
  uid: string
  displayName: string | null
  email: string | null
  photoURL: string | null
}

/** ログイン中のユーザー。AuthContext が設定する(Firebase の auth.currentUser と同じ使い方) */
export const auth: { currentUser: AppUser | null } = { currentUser: null }

/** Googleカレンダー連携用スコープ(F-04)。連携ボタンを押したときだけ、ブラウザから追加で求める */
export const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar'

type ServerConfig = { googleClientId: string | null; devLogin: boolean }
let configPromise: Promise<ServerConfig> | null = null
export function getServerConfig(): Promise<ServerConfig> {
  configPromise ??= fetch('/api/config', { credentials: 'same-origin' })
    .then((r) => (r.ok ? (r.json() as Promise<ServerConfig>) : { googleClientId: null, devLogin: false }))
    .catch(() => ({ googleClientId: null, devLogin: false }))
  return configPromise
}

export async function fetchMe(): Promise<AppUser | null> {
  const r = await fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store' })
  if (!r.ok) throw new Error(`ログイン状態を確認できませんでした (HTTP ${r.status})`)
  const { user } = (await r.json()) as { user: AppUser | null }
  return user
}

export async function logout(): Promise<void> {
  await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'X-Kyabacho': '1' },
  })
}

// ---------- Googleカレンダー連携のアクセストークン(Google Identity Services) ----------
type TokenResponse = { access_token?: string; error?: string }
type TokenClient = { requestAccessToken: (o?: { prompt?: string }) => void }
declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (c: {
            client_id: string
            scope: string
            callback: (r: TokenResponse) => void
            error_callback?: (e: { type?: string }) => void
          }) => TokenClient
        }
      }
    }
  }
}

let gisPromise: Promise<void> | null = null
function loadGis(): Promise<void> {
  gisPromise ??= new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve()
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => {
      gisPromise = null
      reject(new Error('Google の読み込みに失敗しました'))
    }
    document.head.appendChild(s)
  })
  return gisPromise
}

/** カレンダー用のアクセストークンを取得(ポップアップ)。ボタン操作の中で呼ぶこと */
export async function requestCalendarToken(): Promise<string> {
  const { googleClientId } = await getServerConfig()
  if (!googleClientId) throw new Error('Googleカレンダー連携の設定がありません')
  await loadGis()
  const oauth2 = window.google?.accounts?.oauth2
  if (!oauth2) throw new Error('Google の読み込みに失敗しました')
  return new Promise((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: googleClientId,
      scope: GOOGLE_CALENDAR_SCOPE,
      callback: (r) => (r.access_token ? resolve(r.access_token) : reject(new Error(r.error ?? '連携できませんでした'))),
      error_callback: (e) => reject(new Error(e.type === 'popup_closed' ? '連携をキャンセルしました' : '連携できませんでした')),
    })
    client.requestAccessToken({ prompt: '' })
  })
}
