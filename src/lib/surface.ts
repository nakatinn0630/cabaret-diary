// キャスト／店舗の「完全分離」用サーフェス判定。
// 同一コードベースを2つのデプロイ（キャストURL・店舗URL）へ配布し、
// それぞれのビルド/ホストで露出する画面を排他的に絞る。
//
// 判定順:
//   1. ビルド時 env `VITE_SURFACE`（'cast' | 'store'）… 分離デプロイはこれで固定
//   2. デモモード → 'both'（/demo は全画面を確認できる）
//   3. ホスト名ヒューリスティック（*-store / *-admin / *-console → store, *-cast → cast）
//   4. 既定 → 'both'（単一URL運用・開発時は従来どおり両方を露出＝後方互換）
import { demoActive } from './demo'

export type Surface = 'cast' | 'store' | 'both'

function fromEnv(): Surface | null {
  const v = (import.meta.env.VITE_SURFACE as string | undefined)?.toLowerCase()
  return v === 'cast' || v === 'store' ? v : null
}

function fromHost(): Surface | null {
  if (typeof window === 'undefined') return null
  const h = window.location.hostname.toLowerCase()
  if (/(^|[-.])(store|admin|console)([-.]|$)/.test(h)) return 'store'
  if (/(^|[-.])cast([-.]|$)/.test(h)) return 'cast'
  return null
}

/** 現在のデプロイが担うサーフェス。 */
export function currentSurface(): Surface {
  const env = fromEnv()
  if (env) return env
  if (demoActive()) return 'both'
  return fromHost() ?? 'both'
}

export const showsCast = (): boolean => currentSurface() !== 'store'
export const showsStore = (): boolean => currentSurface() !== 'cast'
