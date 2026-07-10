import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { saveProfileSettings } from '../lib/sales'
import { demoActive } from '../lib/demo'
import {
  cacheKey,
  clearCachedKey,
  deriveKey,
  loadCachedKey,
  makeCheckToken,
  randomSaltB64,
  setActiveKey,
  verifyKey,
} from '../lib/crypto'
import { useAuth } from './AuthContext'

// SEC-07 暗号化パスフレーズの状態管理（本名・相談本文のE2E暗号化）
type CryptoState = {
  loading: boolean
  hasPassphrase: boolean // パスフレーズ設定済みか
  unlocked: boolean // この端末で鍵ロード済みか
  setup: (passphrase: string) => Promise<void>
  unlock: (passphrase: string) => Promise<void>
  lock: () => Promise<void>
}

const CryptoCtx = createContext<CryptoState | undefined>(undefined)

async function readEnc(uid: string): Promise<{ salt?: string; check?: string }> {
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'profile', 'main'))
    const d = snap.data()
    return { salt: d?.encSalt, check: d?.encCheck }
  } catch {
    return {}
  }
}

export function CryptoProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [hasPassphrase, setHasPassphrase] = useState(false)
  const [unlocked, setUnlocked] = useState(false)

  useEffect(() => {
    let alive = true
    setActiveKey(null)
    setUnlocked(false)
    setHasPassphrase(false)
    setLoading(true)
    async function init() {
      if (!user || demoActive()) {
        if (alive) setLoading(false)
        return
      }
      const { salt, check } = await readEnc(user.uid)
      if (!alive) return
      setHasPassphrase(Boolean(salt))
      if (salt && check) {
        const cached = await loadCachedKey(user.uid)
        if (cached && (await verifyKey(cached, check))) {
          setActiveKey(cached)
          if (alive) setUnlocked(true)
        }
      }
      if (alive) setLoading(false)
    }
    void init()
    return () => {
      alive = false
    }
  }, [user])

  const setup = async (passphrase: string) => {
    if (!user) throw new Error('ログインが必要です')
    const salt = randomSaltB64()
    const key = await deriveKey(passphrase, salt)
    const check = await makeCheckToken(key)
    await saveProfileSettings({ encSalt: salt, encCheck: check })
    setActiveKey(key)
    await cacheKey(user.uid, key)
    setHasPassphrase(true)
    setUnlocked(true)
  }

  const unlock = async (passphrase: string) => {
    if (!user) throw new Error('ログインが必要です')
    const { salt, check } = await readEnc(user.uid)
    if (!salt || !check) throw new Error('パスフレーズが未設定です')
    const key = await deriveKey(passphrase, salt)
    if (!(await verifyKey(key, check))) throw new Error('パスフレーズが違います')
    setActiveKey(key)
    await cacheKey(user.uid, key)
    setUnlocked(true)
  }

  const lock = async () => {
    setActiveKey(null)
    setUnlocked(false)
    if (user) await clearCachedKey(user.uid)
  }

  return (
    <CryptoCtx.Provider value={{ loading, hasPassphrase, unlocked, setup, unlock, lock }}>
      {children}
    </CryptoCtx.Provider>
  )
}

export function useCrypto(): CryptoState {
  const ctx = useContext(CryptoCtx)
  if (!ctx) throw new Error('useCrypto must be used within CryptoProvider')
  return ctx
}
