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

// 既定(メモリ)キャッシュを使う。永続キャッシュ(IndexedDB)は、collectionGroup 集計が
// アカウント切替時に別アカウントのキャッシュ結果を返し得る（データ分離の懸念）ため使わない。
export const db: Firestore = app ? getFirestore(app) : (null as unknown as Firestore)

// SEC-01: 認証はGoogle OAuthを標準とする。
// 初回ログインは標準スコープ(email/profile)のみ＝センシティブ権限を含まないため、
// 「未確認アプリ」警告が出ずクリーンなGoogleログインになる。
// prompt:'select_account' で常にアカウント選択画面を出す（別アカウントに切替できるように）。
export const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })
// F-04: Googleカレンダー連携用スコープ（専用カレンダー作成＋イベント読み書き）。
// センシティブ権限のため初回ログインでは要求せず、連携ボタン押下時のみ追加要求する。
export const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar'
