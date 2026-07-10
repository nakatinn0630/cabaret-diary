import { useEffect, useState } from 'react'
import {
  addDoc,
  collection,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  Timestamp,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { auth, db } from './firebase'
import { demoActive } from './demo'
import type { LineImport } from '../types'
import { analyzeTone, type ParsedLine } from './lineParser'

function requireUid(): string {
  const u = auth.currentUser
  if (!u) throw new Error('サインインが必要です')
  return u.uid
}

const importsPath = (uid: string) => collection(db, 'users', uid, 'lineImports')

function mapImport(snap: QueryDocumentSnapshot<DocumentData>): LineImport {
  const d = snap.data()
  return { id: snap.id, ...(d as Omit<LineImport, 'id'>) }
}

/**
 * パース結果を保存（F-05）。
 * ※ messages[].text は本番ではアプリ層暗号化（SEC-07）。MVPは平文保存（TODO: ai-proxy/暗号化ヘルパ経由）。
 */
export async function createLineImport(input: {
  customerId: string
  myName: string
  parsed: ParsedLine
}): Promise<string> {
  if (demoActive()) return 'demo_import'
  const uid = requireUid()
  const { customerId, myName, parsed } = input
  const stats = analyzeTone(parsed.messages, myName)
  const messages = parsed.messages.map((m) => ({
    at: Timestamp.fromMillis(m.tsMs ?? Date.now()),
    from: m.sender === myName ? 'me' : 'other',
    text: m.text,
  }))
  const ref = await addDoc(importsPath(uid), {
    customerId,
    importedAt: serverTimestamp(),
    stats,
    messages,
  })
  return ref.id
}

/** 顧客のトーク取込を取得（新しい順・クライアントソート） */
export function useCustomerImports(cid: string | undefined): {
  imports: LineImport[]
  loading: boolean
} {
  const [imports, setImports] = useState<LineImport[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const u = auth.currentUser
    if (!u || !cid) {
      setLoading(false)
      return
    }
    const q = query(importsPath(u.uid), where('customerId', '==', cid))
    return onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map(mapImport)
        list.sort((a, b) => (b.importedAt?.toMillis?.() ?? 0) - (a.importedAt?.toMillis?.() ?? 0))
        setImports(list)
        setLoading(false)
      },
      () => setLoading(false),
    )
  }, [cid])
  return { imports, loading }
}
