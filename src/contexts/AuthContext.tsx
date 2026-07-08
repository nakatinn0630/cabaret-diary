import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth'
import { auth, googleProvider, isFirebaseConfigured } from '../lib/firebase'

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
    if (!isFirebaseConfigured) {
      setLoading(false)
      return
    }
    return onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
    })
  }, [])

  const runGooglePopup = async () => {
    const result = await signInWithPopup(auth, googleProvider)
    const cred = GoogleAuthProvider.credentialFromResult(result)
    setGoogleAccessToken(cred?.accessToken ?? null)
  }

  const signInWithGoogle = async () => {
    if (!isFirebaseConfigured) {
      throw new Error('Firebaseが未設定です。.env に設定を追加してください（.env.example 参照）。')
    }
    await runGooglePopup()
  }

  const reconnectGoogle = async () => {
    if (!isFirebaseConfigured) return
    await runGooglePopup()
  }

  const signOut = async () => {
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
