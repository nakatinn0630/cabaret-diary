import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { Timestamp } from 'firebase/firestore'
import { demoActive, demoConsultations } from './demo'
import { currentUid } from './uid'
import type { Consultation, ConsultationMessage, ConsultationCategory, EscalationTarget } from '../types'

// AI黒服「クロ」の相談は、プライバシー最優先で **DB(Firestore)に保存せず、自端末のローカル(localStorage)にのみ保存**する。
// 端末外に一切出さない（他端末同期なし・店/他キャストからも到達不可）。localStorage を消すと履歴も消える。

type StoredMsg = { role: 'user' | 'assistant'; text: string; at: number }
type StoredConsult = {
  id: string
  category?: ConsultationCategory
  escalatedTo?: EscalationTarget
  messages: StoredMsg[]
  createdAt: number
  updatedAt: number
}

const storeKey = (): string | null => {
  const uid = currentUid()
  return uid ? `kyabacho_consults_${uid}` : null
}

const listeners = new Set<() => void>()
function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}
function notify() {
  listeners.forEach((l) => l())
}

/** getSnapshot: 参照安定のため生JSON文字列を返す（変化が無ければ同一文字列） */
function rawSnapshot(): string {
  const k = storeKey()
  if (!k) return '[]'
  return localStorage.getItem(k) ?? '[]'
}
function readStore(): StoredConsult[] {
  try {
    return JSON.parse(rawSnapshot()) as StoredConsult[]
  } catch {
    return []
  }
}
function writeStore(list: StoredConsult[]): void {
  const k = storeKey()
  if (!k) return
  localStorage.setItem(k, JSON.stringify(list))
  notify()
}

const msgToStored = (m: ConsultationMessage): StoredMsg => ({
  role: m.role,
  text: m.text,
  at: m.at?.toMillis?.() ?? Date.now(),
})
const toDomain = (s: StoredConsult): Consultation => ({
  id: s.id,
  category: s.category,
  escalatedTo: s.escalatedTo,
  messages: s.messages.map((m) => ({ role: m.role, text: m.text, at: Timestamp.fromMillis(m.at) })),
  createdAt: Timestamp.fromMillis(s.createdAt),
  updatedAt: Timestamp.fromMillis(s.updatedAt),
})

const consultToStored = (c: Consultation): StoredConsult => ({
  id: c.id,
  category: c.category,
  escalatedTo: c.escalatedTo,
  messages: c.messages.map(msgToStored),
  createdAt: c.createdAt?.toMillis?.() ?? Date.now(),
  updatedAt: c.updatedAt?.toMillis?.() ?? Date.now(),
})

export function useConsultations(): { consultations: Consultation[]; loading: boolean } {
  const raw = useSyncExternalStore(subscribe, rawSnapshot, () => '[]')
  // デモ初回はサンプル相談で種まき（以降は実際に会話でき、AIも応答する）。
  useEffect(() => {
    if (demoActive() && readStore().length === 0) writeStore(demoConsultations.map(consultToStored))
  }, [])
  const local = useMemo(() => {
    let list: StoredConsult[] = []
    try {
      list = JSON.parse(raw) as StoredConsult[]
    } catch {
      list = []
    }
    return list.sort((a, b) => b.updatedAt - a.updatedAt).map(toDomain)
  }, [raw])
  return { consultations: local, loading: false }
}

export function useConsultation(tid: string | undefined): Consultation | null {
  const { consultations } = useConsultations()
  return consultations.find((c) => c.id === tid) ?? null
}

function newId(): string {
  return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export async function createConsultation(first: ConsultationMessage): Promise<string> {
  const now = Date.now()
  const id = newId()
  const list = readStore()
  list.unshift({ id, messages: [msgToStored(first)], createdAt: now, updatedAt: now })
  writeStore(list)
  return id
}

export async function appendMessage(
  tid: string,
  msg: ConsultationMessage,
  meta?: { category?: ConsultationCategory; escalatedTo?: EscalationTarget },
): Promise<void> {
  const list = readStore()
  const c = list.find((x) => x.id === tid)
  if (!c) return
  c.messages.push(msgToStored(msg))
  c.updatedAt = Date.now()
  if (meta?.category) c.category = meta.category
  if (meta?.escalatedTo) c.escalatedTo = meta.escalatedTo
  writeStore(list)
}

/** 端末ローカルの相談履歴を全消去（設定からの手動削除用） */
export function clearConsultations(): void {
  const k = storeKey()
  if (!k) return
  localStorage.removeItem(k)
  notify()
}

export function nowMsg(role: 'user' | 'assistant', text: string): ConsultationMessage {
  return { at: Timestamp.now(), role, text }
}
