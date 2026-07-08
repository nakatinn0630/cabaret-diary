import { useEffect, useState } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  Timestamp,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { auth, db } from './firebase'
import type { Schedule, ScheduleType } from '../types'

function requireUid(): string {
  const u = auth.currentUser
  if (!u) throw new Error('サインインが必要です')
  return u.uid
}

const schedulesPath = (uid: string) => collection(db, 'users', uid, 'schedules')
const scheduleRef = (uid: string, sid: string) => doc(db, 'users', uid, 'schedules', sid)

function mapSchedule(snap: QueryDocumentSnapshot<DocumentData>): Schedule {
  const d = snap.data()
  return { id: snap.id, ...(d as Omit<Schedule, 'id'>) }
}

export const SCHEDULE_LABEL: Record<ScheduleType, string> = {
  shift: '出勤',
  dohan: '同伴',
  after: 'アフター',
  appointment: '約束',
}

export interface NewSchedule {
  type: ScheduleType
  customerId?: string
  start: Timestamp
  end: Timestamp
  memo?: string
}

export function useSchedules(): { schedules: Schedule[]; loading: boolean } {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const u = auth.currentUser
    if (!u) {
      setLoading(false)
      return
    }
    const q = query(schedulesPath(u.uid), orderBy('start', 'asc'))
    return onSnapshot(
      q,
      (snap) => {
        setSchedules(snap.docs.map(mapSchedule))
        setLoading(false)
      },
      () => setLoading(false),
    )
  }, [])
  return { schedules, loading }
}

export async function createSchedule(input: NewSchedule): Promise<string> {
  const uid = requireUid()
  const ref = await addDoc(schedulesPath(uid), {
    type: input.type,
    customerId: input.customerId ?? null,
    start: input.start,
    end: input.end,
    memo: input.memo ?? '',
    googleEventId: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateSchedule(sid: string, patch: Partial<NewSchedule>): Promise<void> {
  const uid = requireUid()
  await updateDoc(scheduleRef(uid, sid), { ...patch, updatedAt: serverTimestamp() })
}

export async function setGoogleEventId(sid: string, googleEventId: string | null): Promise<void> {
  const uid = requireUid()
  await updateDoc(scheduleRef(uid, sid), { googleEventId })
}

export async function deleteSchedule(sid: string): Promise<void> {
  const uid = requireUid()
  await deleteDoc(scheduleRef(uid, sid))
}
