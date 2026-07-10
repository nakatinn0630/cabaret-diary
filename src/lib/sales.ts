import { useEffect, useState } from 'react'
import {
  collectionGroup,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  Timestamp,
} from 'firebase/firestore'
import { auth, db } from './firebase'

export interface ProfileSettings {
  /** 源氏名（キャスト自身の表示名。Google名は使わずこれを表示） */
  stageName?: string
  guaranteeEndDate?: Timestamp
  targetShimei?: number
  targetSales?: number
}

export interface MonthlyStats {
  totalSales: number
  visitCount: number
  dohanCount: number
}

/** 現在の 'YYYY-MM' */
export function currentMonthKey(nowMs: number = Date.now()): string {
  const d = new Date(nowMs)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthRange(monthKey: string): { start: Timestamp; end: Timestamp } {
  const [y, m] = monthKey.split('-').map(Number)
  const start = new Date(y, m - 1, 1)
  const end = new Date(y, m, 1)
  return { start: Timestamp.fromDate(start), end: Timestamp.fromDate(end) }
}

/** プロフィール設定（保証終了日・目標）を購読 */
export function useProfileSettings(): { settings: ProfileSettings; loading: boolean } {
  const [settings, setSettings] = useState<ProfileSettings>({})
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const u = auth.currentUser
    if (!u) {
      setLoading(false)
      return
    }
    return onSnapshot(
      doc(db, 'users', u.uid, 'profile', 'main'),
      (snap) => {
        setSettings(snap.exists() ? (snap.data() as ProfileSettings) : {})
        setLoading(false)
      },
      () => setLoading(false),
    )
  }, [])
  return { settings, loading }
}

export async function saveProfileSettings(patch: ProfileSettings): Promise<void> {
  const u = auth.currentUser
  if (!u) throw new Error('サインインが必要です')
  await setDoc(
    doc(db, 'users', u.uid, 'profile', 'main'),
    { ...patch, updatedAt: serverTimestamp() },
    { merge: true },
  )
}

/** 当月の売上集計（全顧客の visits を collectionGroup で集計） */
export function useMonthlyStats(monthKey: string): { stats: MonthlyStats; loading: boolean } {
  const [stats, setStats] = useState<MonthlyStats>({ totalSales: 0, visitCount: 0, dohanCount: 0 })
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const u = auth.currentUser
    if (!u) {
      setLoading(false)
      return
    }
    const { start, end } = monthRange(monthKey)
    // collectionGroup('visits') は自分の users/{uid} 配下に限定（ルールで uid 一致を強制）
    const q = query(
      collectionGroup(db, 'visits'),
      where('date', '>=', start),
      where('date', '<', end),
    )
    let alive = true
    getDocs(q)
      .then((snap) => {
        if (!alive) return
        let totalSales = 0
        let dohanCount = 0
        snap.forEach((d) => {
          const v = d.data()
          totalSales += v.amount || 0
          if (v.isDohan) dohanCount += 1
        })
        setStats({ totalSales, visitCount: snap.size, dohanCount })
        setLoading(false)
      })
      .catch(() => setLoading(false))
    return () => {
      alive = false
    }
  }, [monthKey])
  return { stats, loading }
}

/** 自己申告の指名本数を月次に保存（selfReported.shimeiCount） */
export async function saveShimeiCount(monthKey: string, shimeiCount: number): Promise<void> {
  const u = auth.currentUser
  if (!u) throw new Error('サインインが必要です')
  await setDoc(
    doc(db, 'users', u.uid, 'salesRecords', monthKey),
    { selfReported: { shimeiCount }, updatedAt: serverTimestamp() },
    { merge: true },
  )
}

export function useSalesRecord(monthKey: string): { shimeiCount: number } {
  const [shimeiCount, setShimei] = useState(0)
  useEffect(() => {
    const u = auth.currentUser
    if (!u) return
    return onSnapshot(doc(db, 'users', u.uid, 'salesRecords', monthKey), (snap) => {
      const d = snap.data()
      setShimei(d?.selfReported?.shimeiCount ?? 0)
    })
  }, [monthKey])
  return { shimeiCount }
}
