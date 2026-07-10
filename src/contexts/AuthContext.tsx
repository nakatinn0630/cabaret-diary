import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth'
import { auth, googleProvider, isFirebaseConfigured, GOOGLE_CALENDAR_SCOPE } from '../lib/firebase'
import { demoActive, disableDemo, DEMO_UID } from '../lib/demo'

// デモモード用のダミーユーザー（Firebase認証を通さず画面を表示するため）
const demoUser = { uid: DEMO_UID, displayName: 'デモ', email: 'demo@example.com' } as unknown as User

type AuthState = {
  user: User | null
  loading: boolean
  /** F-04 Googleカレンダー連携用のアクセストークン（サインイン/再連携時のみ取得。リロードで消える） */
  googleAccessToken: string | null
  signInWithGoogle: () => Promise<void>
  /** カレンダー連携のためトークンを再取得（期限切れ・リロード後に使う） */
  reconnectGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null)

  useEffect(() => {
    if (demoActive()) {
      setUser(demoUser)
      setLoading(false)
      return
    }
    if (!isFirebaseConfigured) {
      setLoading(false)
      return
    }
    return onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
    })
  }, [])

  // withCalendar=false: 標準ログイン（センシティブ権限なし＝未確認アプリ警告が出ない）
  // withCalendar=true: カレンダー連携用に追加スコープを要求（連携ボタン押下時のみ）
  const runGooglePopup = async (withCalendar: boolean) => {
    let provider = googleProvider
    if (withCalendar) {
      provider = new GoogleAuthProvider()
      provider.addScope(GOOGLE_CALENDAR_SCOPE)
    }
    const result = await signInWithPopup(auth, provider)
    const cred = GoogleAuthProvider.credentialFromResult(result)
    setGoogleAccessToken(cred?.accessToken ?? null)
  }

  const signInWithGoogle = async () => {
    if (!isFirebaseConfigured) {
      throw new Error('Firebaseが未設定です。.env に設定を追加してください（.env.example 参照）。')
    }
    await runGooglePopup(false)
  }

  const reconnectGoogle = async () => {
    if (!isFirebaseConfigured) return
    await runGooglePopup(true)
  }

  const signOut = async () => {
    if (demoActive()) {
      disableDemo()
      setGoogleAccessToken(null)
      setUser(null)
      return
    }
    if (!isFirebaseConfigured) return
    setGoogleAccessToken(null)
    await fbSignOut(auth)
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, googleAccessToken, signInWithGoogle, reconnectGoogle, signOut }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
