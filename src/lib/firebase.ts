import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'

// Firebase設定は環境変数から注入する（.env参照。値はコミットしない）。
// Firebaseプロジェクト: points-optimizer-app / asia-northeast1
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

// .env 未設定でもアプリが起動できるようにガードする（未設定時はログイン画面で案内）。
export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId)

const app = isFirebaseConfigured ? initializeApp(firebaseConfig) : undefined
export const auth: Auth = app ? getAuth(app) : (null as unknown as Auth)
export const db: Firestore = app ? getFirestore(app) : (null as unknown as Firestore)

// SEC-01: 認証はGoogle OAuthを標準とする
export const googleProvider = new GoogleAuthProvider()
