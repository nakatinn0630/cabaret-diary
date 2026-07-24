import { auth } from './firebase'
import { demoActive, DEMO_UID } from './demo'

// ローカル保存(kyabacho_*)のキーなどに使う uid の解決を一元化する。
// デモモードでは firebase の currentUser が無い（AuthContext 側の擬似ユーザーのみ）ため DEMO_UID を返す。

/** ログイン中 or デモの uid。どちらでもなければ null。 */
export function currentUid(): string | null {
  const u = auth.currentUser
  if (u) return u.uid
  if (demoActive()) return DEMO_UID
  return null
}

/** currentUid の必須版。未ログインは例外。 */
export function requireUid(): string {
  const uid = currentUid()
  if (!uid) throw new Error('ログインが必要です')
  return uid
}
