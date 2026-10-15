import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { auth, fetchMe, logout, requestCalendarToken, type AppUser } from '../lib/backend'
import { setUnauthenticatedHandler } from '../lib/fsdb'
import { demoActive, disableDemo, DEMO_UID } from '../lib/demo'

// ログインは VPS のキャバ帳サーバーが Google と直接やり取りする(Firebase は使わない)。
// ログイン状態は HttpOnly の Cookie で保たれ、画面からは /api/auth/me で確認する。

// デモモード用のダミーユーザー(ログインせずに画面を表示するため)
const demoUser: AppUser = { uid: DEMO_UID, displayName: 'デモ', email: 'demo@example.com', photoURL: null }

export type User = AppUser

type AuthState = {
  user: User | null
  loading: boolean
  /** F-04 Googleカレンダー連携用のアクセストークン(連携ボタン押下時に取得。リロードで消える) */
  googleAccessToken: string | null
  /** 過去にカレンダー連携したか(永続)。true かつ token 無し=リロードで切れた状態。 */
  calendarLinked: boolean
  signInWithGoogle: () => Promise<void>
  /** カレンダー連携のためトークンを取得(期限切れ・リロード後に使う) */
  reconnectGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const CAL_LINKED_KEY = 'kyabacho_cal_linked'

const AuthContext = createContext<AuthState | undefined>(undefined)

function setCurrent(u: User | null) {
  auth.currentUser = u && u.uid !== DEMO_UID ? u : null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null)
  const [calendarLinked, setCalendarLinked] = useState<boolean>(
    () => typeof localStorage !== 'undefined' && localStorage.getItem(CAL_LINKED_KEY) === '1',
  )

  const setUser = useCallback((u: User | null) => {
    setCurrent(u)
    setUserState(u)
  }, [])

  useEffect(() => {
    if (demoActive()) {
      setUser(demoUser)
      setLoading(false)
      return
    }
    let alive = true
    fetchMe()
      .then((u) => alive && setUser(u))
      .catch(() => alive && setUser(null))
      .finally(() => alive && setLoading(false))
    // 途中でログインが切れたら(サーバーが 401 を返したら)ログイン画面へ
    setUnauthenticatedHandler(() => {
      if (!demoActive()) setUser(null)
    })
    return () => {
      alive = false
      setUnauthenticatedHandler(null)
    }
  }, [setUser])

  const signInWithGoogle = async () => {
    // サーバーの Google ログインへ移動する(戻ってくるとログイン済み)
    window.location.assign('/api/auth/google?next=%2F')
    // 画面が切り替わるまで「ログイン中…」の表示を保つ
    await new Promise(() => {})
  }

  const reconnectGoogle = async () => {
    const token = await requestCalendarToken()
    setGoogleAccessToken(token)
    setCalendarLinked(true)
    localStorage.setItem(CAL_LINKED_KEY, '1')
  }

  const signOut = async () => {
    if (demoActive()) {
      disableDemo()
      setGoogleAccessToken(null)
      setUser(null)
      return
    }
    setGoogleAccessToken(null)
    setCalendarLinked(false)
    localStorage.removeItem(CAL_LINKED_KEY)
    try {
      await logout()
    } finally {
      setUser(null)
    }
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, googleAccessToken, calendarLinked, signInWithGoogle, reconnectGoogle, signOut }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
