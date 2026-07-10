import { useEffect, useState } from 'react'
import {
  addDoc,
  collection,
  doc,
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
import { demoActive, demoConsultations } from './demo'
import { encFieldMaybe, decField } from './crypto'
import type { Consultation, ConsultationMessage, ConsultationCategory, EscalationTarget } from '../types'

function requireUid(): string {
  const u = auth.currentUser
  if (!u) throw new Error('サインインが必要です')
  return u.uid
}

const consultsPath = (uid: string) => collection(db, 'users', uid, 'consultations')
const consultRef = (uid: string, tid: string) => doc(db, 'users', uid, 'consultations', tid)

function mapConsult(snap: QueryDocumentSnapshot<DocumentData>): Consultation {
  const d = snap.data()
  return { id: snap.id, ...(d as Omit<Consultation, 'id'>) }
}

export function useConsultations(): { consultations: Consultation[]; loading: boolean } {
  const [consultations, setConsultations] = useState<Consultation[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (demoActive()) {
      setConsultations(demoConsultations)
      setLoading(false)
      return
    }
    const u = auth.currentUser
    if (!u) {
      setLoading(false)
      return
    }
    const q = query(consultsPath(u.uid), orderBy('updatedAt', 'desc'))
    return onSnapshot(
      q,
      (snap) => {
        setConsultations(snap.docs.map(mapConsult))
        setLoading(false)
      },
      () => setLoading(false),
    )
  }, [])
  return { consultations, loading }
}

export function useConsultation(tid: string | undefined): Consultation | null {
  const [c, setC] = useState<Consultation | null>(null)
  useEffect(() => {
    if (demoActive()) {
      setC(demoConsultations.find((x) => x.id === tid) ?? null)
      return
    }
    const u = auth.currentUser
    if (!u || !tid) return
    return onSnapshot(consultRef(u.uid, tid), (snap) => {
      if (!snap.exists()) {
        setC(null)
        return
      }
      const raw = { id: snap.id, ...(snap.data() as Omit<Consultation, 'id'>) }
      // SEC-07 本文を復号（ロック中は目印を表示）
      void Promise.all(
        (raw.messages ?? []).map(async (m) => ({ ...m, text: await decField(m.text) })),
      ).then((messages) => setC({ ...raw, messages }))
    })
  }, [tid])
  return c
}

// ※ messages[].text は本番でアプリ層暗号化（SEC-07）。相談ログは本人以外閲覧不可（店にも共有しない）。
export async function createConsultation(first: ConsultationMessage): Promise<string> {
  if (demoActive()) return 'dc_1'
  const uid = requireUid()
  const ref = await addDoc(consultsPath(uid), {
    messages: [{ ...first, text: await encFieldMaybe(first.text) }],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function appendMessage(
  tid: string,
  msg: ConsultationMessage,
  meta?: { category?: ConsultationCategory; escalatedTo?: EscalationTarget },
): Promise<void> {
  if (demoActive()) return
  const uid = requireUid()
  const stored = { ...msg, text: await encFieldMaybe(msg.text) }
  const data: DocumentData = { messages: arrayUnion(stored), updatedAt: serverTimestamp() }
  if (meta?.category) data.category = meta.category
  if (meta?.escalatedTo) data.escalatedTo = meta.escalatedTo
  await updateDoc(consultRef(uid, tid), data)
}

export function nowMsg(role: 'user' | 'assistant', text: string): ConsultationMessage {
  return { at: Timestamp.now(), role, text }
}
