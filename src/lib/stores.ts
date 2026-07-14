import { useEffect, useState } from 'react'
import {
  addDoc,
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  Timestamp,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { auth, db } from './firebase'
import {
  demoActive,
  demoMemberships,
  demoStore,
  demoStoreMembers,
  demoBroadcasts,
  demoStoreSales,
  demoRankings,
  demoPenalties,
  demoStoreMessages,
} from './demo'
import type {
  Broadcast,
  BroadcastType,
  Membership,
  Penalty,
  Ranking,
  RankingMetric,
  RankingPeriod,
  RankingVisibility,
  SalesFigures,
  Store,
  StoreCastSales,
  StoreMessage,
  StoreRole,
} from '../types'

function requireUser(): { uid: string; name: string } {
  const u = auth.currentUser
  if (!u) throw new Error('サインインが必要です')
  return { uid: u.uid, name: u.displayName ?? u.email ?? 'キャスト' }
}

// ---- 所属店舗（自分がメンバーの店） ----
export interface MyMembership {
  storeId: string
  role: StoreRole
  displayName: string
}

export function useMyMemberships(): { memberships: MyMembership[]; loading: boolean } {
  const [memberships, setMemberships] = useState<MyMembership[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (demoActive()) {
      setMemberships(demoMemberships)
      setLoading(false)
      return
    }
    const u = auth.currentUser
    if (!u) {
      setLoading(false)
      return
    }
    const q = query(collectionGroup(db, 'memberships'), where('uid', '==', u.uid))
    return onSnapshot(
      q,
      (snap) => {
        setMemberships(
          snap.docs.map((d) => {
            const data = d.data()
            return { storeId: data.storeId, role: data.role, displayName: data.displayName }
          }),
        )
        setLoading(false)
      },
      () => setLoading(false),
    )
  }, [])
  return { memberships, loading }
}

// ---- 店舗（F-15） ----
export async function createStore(name: string, displayName: string): Promise<string> {
  if (demoActive()) return 'demo_store'
  const { uid } = requireUser()
  const ref = await addDoc(collection(db, 'stores'), {
    name,
    createdBy: uid,
    createdAt: serverTimestamp(),
  })
  await setDoc(doc(db, 'stores', ref.id, 'memberships', uid), {
    uid,
    storeId: ref.id,
    role: 'manager',
    displayName,
    joinedAt: serverTimestamp(),
    active: true,
  })
  return ref.id
}

export function useStore(storeId: string | undefined): Store | null {
  const [store, setStore] = useState<Store | null>(null)
  useEffect(() => {
    if (demoActive()) {
      setStore(demoStore)
      return
    }
    if (!storeId) return
    return onSnapshot(doc(db, 'stores', storeId), (snap) =>
      setStore(snap.exists() ? ({ id: snap.id, ...(snap.data() as Omit<Store, 'id'>) }) : null),
    )
  }, [storeId])
  return store
}

// ---- 招待・参加（F-15） ----
/** 招待コードを発行（storeId を含めることで参加時の検索を不要にする） */
export async function createInvite(storeId: string, role: Exclude<StoreRole, 'manager'>): Promise<string> {
  if (demoActive()) return 'demo_store.DEMO01'
  const { uid } = requireUser()
  const rand = Array.from({ length: 6 }, (_, i) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[(storeId.charCodeAt(i % storeId.length) + i * 7) % 31]).join('')
  const code = `${storeId}.${rand}`
  await setDoc(doc(db, 'stores', storeId, 'invites', code), {
    code,
    role,
    createdBy: uid,
    createdAt: serverTimestamp(),
  })
  return code
}

export async function joinByCode(code: string, displayName: string): Promise<string> {
  if (demoActive()) return 'demo_store'
  const { uid } = requireUser()
  const storeId = code.split('.')[0]
  if (!storeId) throw new Error('招待コードが不正です')
  const invite = await getDoc(doc(db, 'stores', storeId, 'invites', code))
  if (!invite.exists()) throw new Error('招待コードが見つかりません')
  const role = (invite.data().role as StoreRole) ?? 'cast'
  await setDoc(doc(db, 'stores', storeId, 'memberships', uid), {
    uid,
    storeId,
    role,
    displayName,
    joinedAt: serverTimestamp(),
    active: true,
  })
  return storeId
}

export function useMemberships(storeId: string | undefined): Membership[] {
  const [list, setList] = useState<Membership[]>([])
  useEffect(() => {
    if (demoActive()) {
      setList(demoStoreMembers)
      return
    }
    if (!storeId) return
    return onSnapshot(collection(db, 'stores', storeId, 'memberships'), (snap) =>
      setList(snap.docs.map((d) => d.data() as Membership)),
    )
  }, [storeId])
  return list
}

// ---- 発信（F-17） ----
export interface NewBroadcast {
  type: BroadcastType
  title: string
  body: string
  audience: Broadcast['audience']
  targetCastIds?: string[]
  quota?: number
  eventDate?: Timestamp
}

export async function createBroadcast(storeId: string, b: NewBroadcast): Promise<string> {
  if (demoActive()) return 'demo_bc'
  const { uid } = requireUser()
  const ref = await addDoc(collection(db, 'stores', storeId, 'broadcasts'), {
    ...b,
    createdBy: uid,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

function mapBroadcast(snap: QueryDocumentSnapshot<DocumentData>): Broadcast {
  return { id: snap.id, ...(snap.data() as Omit<Broadcast, 'id'>) }
}

export function useBroadcasts(storeId: string | undefined): Broadcast[] {
  const [list, setList] = useState<Broadcast[]>([])
  useEffect(() => {
    if (demoActive()) {
      setList(demoBroadcasts)
      return
    }
    if (!storeId) return
    const q = query(collection(db, 'stores', storeId, 'broadcasts'), orderBy('createdAt', 'desc'))
    return onSnapshot(q, (snap) => setList(snap.docs.map(mapBroadcast)))
  }, [storeId])
  return list
}

export async function markBroadcastRead(storeId: string, bid: string): Promise<void> {
  if (demoActive()) return
  const { uid } = requireUser()
  await setDoc(doc(db, 'stores', storeId, 'broadcasts', bid, 'reads', uid), {
    uid,
    readAt: serverTimestamp(),
  })
}

// ---- 売上確定（F-16） ----
export async function confirmCastSales(
  storeId: string,
  month: string,
  castUid: string,
  figures: SalesFigures,
): Promise<void> {
  if (demoActive()) return
  const { uid } = requireUser()
  await setDoc(
    doc(db, 'stores', storeId, 'sales', month, 'casts', castUid),
    { uid: castUid, figures, confirmedBy: uid, confirmedAt: serverTimestamp() },
    { merge: true },
  )
}

export function useStoreMonthSales(storeId: string | undefined, month: string): StoreCastSales[] {
  const [list, setList] = useState<StoreCastSales[]>([])
  useEffect(() => {
    if (demoActive()) {
      setList(demoStoreSales)
      return
    }
    if (!storeId) return
    return onSnapshot(collection(db, 'stores', storeId, 'sales', month, 'casts'), (snap) =>
      setList(snap.docs.map((d) => d.data() as StoreCastSales)),
    )
  }, [storeId, month])
  return list
}

// ---- ランキング（F-18） ----
export async function publishRanking(
  storeId: string,
  input: {
    metric: RankingMetric
    period: RankingPeriod
    visibility: RankingVisibility
    n?: number
    entries: Ranking['entries']
  },
): Promise<void> {
  if (demoActive()) return
  const id = `${storeId}_${input.period}_${input.metric}`
  await setDoc(doc(db, 'stores', storeId, 'rankings', id), {
    ...input,
    computedAt: serverTimestamp(),
  })
}

export function useRankings(storeId: string | undefined): Ranking[] {
  const [list, setList] = useState<Ranking[]>([])
  useEffect(() => {
    if (demoActive()) {
      setList(demoRankings)
      return
    }
    if (!storeId) return
    return onSnapshot(collection(db, 'stores', storeId, 'rankings'), (snap) =>
      setList(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Ranking, 'id'>) }))),
    )
  }, [storeId])
  return list
}

// ============================================================================
// F-15b 担当付け / F-21 罰金 / ノルマ / F-20 店舗⇄キャスト連絡
// ============================================================================

/** キャストに担当黒服を割り当てる（店長/黒服） */
export async function assignKurofuku(storeId: string, castUid: string, kurofukuUid: string): Promise<void> {
  if (demoActive()) return
  await setDoc(
    doc(db, 'stores', storeId, 'memberships', castUid),
    { assignedKurofuku: kurofukuUid || null },
    { merge: true },
  )
}

/** キャストの今月ノルマ（売上目標）を設定 */
export async function setCastQuota(storeId: string, castUid: string, quota: number): Promise<void> {
  if (demoActive()) return
  await setDoc(
    doc(db, 'stores', storeId, 'memberships', castUid),
    { monthlyQuota: quota || null },
    { merge: true },
  )
}

// ---- 罰金（F-21） ----
export async function addPenalty(storeId: string, castUid: string, amount: number, reason: string): Promise<void> {
  if (demoActive()) return
  const { uid } = requireUser()
  await addDoc(collection(db, 'stores', storeId, 'penalties'), {
    castUid,
    amount,
    reason,
    paid: false,
    createdBy: uid,
    createdAt: serverTimestamp(),
  })
}

export async function setPenaltyPaid(storeId: string, penaltyId: string, paid: boolean): Promise<void> {
  if (demoActive()) return
  await updateDoc(doc(db, 'stores', storeId, 'penalties', penaltyId), { paid })
}

export async function deletePenalty(storeId: string, penaltyId: string): Promise<void> {
  if (demoActive()) return
  await deleteDoc(doc(db, 'stores', storeId, 'penalties', penaltyId))
}

function mapPenalty(snap: QueryDocumentSnapshot<DocumentData>): Penalty {
  return { id: snap.id, ...(snap.data() as Omit<Penalty, 'id'>) }
}

/** 店側：全キャストの罰金一覧 */
export function usePenalties(storeId: string | undefined): Penalty[] {
  const [list, setList] = useState<Penalty[]>([])
  useEffect(() => {
    if (demoActive()) {
      setList(demoPenalties)
      return
    }
    if (!storeId) return
    const q = query(collection(db, 'stores', storeId, 'penalties'), orderBy('createdAt', 'desc'))
    return onSnapshot(q, (snap) => setList(snap.docs.map(mapPenalty)), () => setList([]))
  }, [storeId])
  return list
}

/** キャスト側：自分の罰金のみ */
export function useMyPenalties(storeId: string | undefined): Penalty[] {
  const [list, setList] = useState<Penalty[]>([])
  useEffect(() => {
    const u = auth.currentUser
    if (demoActive()) {
      setList(demoPenalties.filter((p) => p.castUid === (u?.uid ?? 'demo-user') || true))
      return
    }
    if (!storeId || !u) return
    const q = query(collection(db, 'stores', storeId, 'penalties'), where('castUid', '==', u.uid))
    return onSnapshot(q, (snap) => setList(snap.docs.map(mapPenalty)), () => setList([]))
  }, [storeId])
  return list
}

// ---- 店舗⇄キャスト連絡（F-20・本人と店のみ可視） ----
export async function sendStoreMessage(
  storeId: string,
  castUid: string,
  text: string,
  fromRole: 'store' | 'cast',
): Promise<void> {
  if (demoActive()) return
  const { uid, name } = requireUser()
  await addDoc(collection(db, 'stores', storeId, 'messages'), {
    castUid,
    fromUid: uid,
    fromRole,
    fromName: name,
    text,
    createdAt: serverTimestamp(),
  })
}

function mapMessage(snap: QueryDocumentSnapshot<DocumentData>): StoreMessage {
  return { id: snap.id, ...(snap.data() as Omit<StoreMessage, 'id'>) }
}

/** 特定キャストのスレッド（店側＝任意のcastUid、キャスト側＝自分のuid） */
export function useStoreMessages(storeId: string | undefined, castUid: string | undefined): StoreMessage[] {
  const [list, setList] = useState<StoreMessage[]>([])
  useEffect(() => {
    if (demoActive()) {
      setList(demoStoreMessages.filter((m) => !castUid || m.castUid === castUid))
      return
    }
    if (!storeId || !castUid) {
      setList([])
      return
    }
    const q = query(
      collection(db, 'stores', storeId, 'messages'),
      where('castUid', '==', castUid),
      orderBy('createdAt', 'asc'),
    )
    return onSnapshot(q, (snap) => setList(snap.docs.map(mapMessage)), () => setList([]))
  }, [storeId, castUid])
  return list
}
