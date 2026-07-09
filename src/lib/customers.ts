import { useEffect, useState } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  arrayUnion,
  Timestamp,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { auth, db } from './firebase'
import { computeRisk } from './risk'
import type { Customer, Visit, CustomerRank, PaymentMethod, Bottle, Fit } from '../types'

function requireUid(): string {
  const u = auth.currentUser
  if (!u) throw new Error('サインインが必要です')
  return u.uid
}

const customersPath = (uid: string) => collection(db, 'users', uid, 'customers')
const customerRef = (uid: string, cid: string) => doc(db, 'users', uid, 'customers', cid)
const visitsPath = (uid: string, cid: string) => collection(db, 'users', uid, 'customers', cid, 'visits')

function mapCustomer(snap: QueryDocumentSnapshot<DocumentData>): Customer {
  const d = snap.data()
  return { id: snap.id, ...(d as Omit<Customer, 'id'>) }
}
function mapVisit(snap: QueryDocumentSnapshot<DocumentData>): Visit {
  const d = snap.data()
  return { id: snap.id, ...(d as Omit<Visit, 'id'>) }
}

// ---- 入力型（サーバ管理フィールドを除く） ----
export interface NewCustomer {
  nickname: string
  lineName?: string
  realName?: string
  occupation?: string
  companyName?: string
  incomeRange?: string
  paymentMethods?: PaymentMethod[]
  tags?: string[]
  rank?: CustomerRank
  fit?: Fit
  pinnedCautions?: string[]
  memo?: string
}

export interface NewVisit {
  date: Timestamp
  amount: number
  durationMin?: number
  bottles?: Bottle[]
  isDohan?: boolean
  isAfter?: boolean
  payment: PaymentMethod
  urikakePaid?: boolean
  episodeMemo?: string
  storeId?: string
}

// ---- 読み取りフック ----
export function useCustomers(): { customers: Customer[]; loading: boolean } {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const u = auth.currentUser
    if (!u) {
      setLoading(false)
      return
    }
    const q = query(customersPath(u.uid), orderBy('updatedAt', 'desc'))
    return onSnapshot(
      q,
      (snap) => {
        setCustomers(snap.docs.map(mapCustomer))
        setLoading(false)
      },
      () => setLoading(false),
    )
  }, [])
  return { customers, loading }
}

export function useCustomer(cid: string | undefined): { customer: Customer | null; loading: boolean } {
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const u = auth.currentUser
    if (!u || !cid) {
      setLoading(false)
      return
    }
    return onSnapshot(
      customerRef(u.uid, cid),
      (snap) => {
        setCustomer(snap.exists() ? { id: snap.id, ...(snap.data() as Omit<Customer, 'id'>) } : null)
        setLoading(false)
      },
      () => setLoading(false),
    )
  }, [cid])
  return { customer, loading }
}

export function useVisits(cid: string | undefined): { visits: Visit[]; loading: boolean } {
  const [visits, setVisits] = useState<Visit[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const u = auth.currentUser
    if (!u || !cid) {
      setLoading(false)
      return
    }
    const q = query(visitsPath(u.uid, cid), orderBy('date', 'desc'))
    return onSnapshot(
      q,
      (snap) => {
        setVisits(snap.docs.map(mapVisit))
        setLoading(false)
      },
      () => setLoading(false),
    )
  }, [cid])
  return { visits, loading }
}

// ---- 集計・リスク再計算（クライアント側スタンドイン） ----
async function recomputeAggregates(uid: string, cid: string): Promise<void> {
  const [custSnap, visitsSnap] = await Promise.all([
    getDoc(customerRef(uid, cid)),
    getDocs(visitsPath(uid, cid)),
  ])
  if (!custSnap.exists()) return
  const cust = custSnap.data()
  const visits = visitsSnap.docs.map((d) => d.data())
  const totalSpent = visits.reduce((s, v) => s + (v.amount || 0), 0)
  const lastVisitMs = visits.reduce((mx, v) => Math.max(mx, (v.date as Timestamp)?.toMillis?.() ?? 0), 0)
  const risk = computeRisk({
    occupation: cust.occupation,
    incomeRange: cust.incomeRange,
    realName: cust.realName,
    lineName: cust.lineName,
    visits: visits.map((v) => ({
      dateMs: (v.date as Timestamp)?.toMillis?.() ?? 0,
      amount: v.amount || 0,
      payment: v.payment,
      urikakePaid: v.urikakePaid,
    })),
  })
  await updateDoc(customerRef(uid, cid), {
    totalSpent,
    visitCount: visits.length,
    lastVisitAt: lastVisitMs > 0 ? Timestamp.fromMillis(lastVisitMs) : null,
    riskScore: risk.score,
    riskFlags: risk.flags,
    updatedAt: serverTimestamp(),
  })
}

// ---- 書き込み ----
export async function createCustomer(input: NewCustomer): Promise<string> {
  const uid = requireUid()
  const ref = await addDoc(customersPath(uid), {
    nickname: input.nickname,
    lineName: input.lineName ?? '',
    realName: input.realName ?? '',
    occupation: input.occupation ?? '',
    companyName: input.companyName ?? '',
    incomeRange: input.incomeRange ?? '',
    paymentMethods: input.paymentMethods ?? [],
    tags: input.tags ?? [],
    rank: input.rank ?? null,
    rankHistory: input.rank ? [{ rank: input.rank, changedAt: Timestamp.now() }] : [],
    fit: input.fit ?? null,
    pinnedCautions: input.pinnedCautions ?? [],
    memo: input.memo ?? '',
    totalSpent: 0,
    visitCount: 0,
    riskScore: 0,
    riskFlags: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  await recomputeAggregates(uid, ref.id)
  return ref.id
}

export async function updateCustomer(
  cid: string,
  patch: Partial<NewCustomer>,
  rankChanged = false,
): Promise<void> {
  const uid = requireUid()
  const data: DocumentData = { ...patch, updatedAt: serverTimestamp() }
  if (rankChanged && patch.rank) {
    data.rankHistory = arrayUnion({ rank: patch.rank, changedAt: Timestamp.now() })
  }
  await updateDoc(customerRef(uid, cid), data)
  await recomputeAggregates(uid, cid)
}

export async function deleteCustomer(cid: string): Promise<void> {
  const uid = requireUid()
  await deleteDoc(customerRef(uid, cid))
}

export async function addVisit(cid: string, v: NewVisit): Promise<void> {
  const uid = requireUid()
  await addDoc(visitsPath(uid, cid), {
    date: v.date,
    amount: v.amount,
    durationMin: v.durationMin ?? null,
    bottles: v.bottles ?? [],
    isDohan: v.isDohan ?? false,
    isAfter: v.isAfter ?? false,
    payment: v.payment,
    urikakePaid: v.urikakePaid ?? null,
    episodeMemo: v.episodeMemo ?? '',
    photoRefs: [],
    storeId: v.storeId ?? null,
    createdAt: serverTimestamp(),
  })
  await recomputeAggregates(uid, cid)
}
