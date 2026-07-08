import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { auth, db } from './firebase'
import type { CompatibilityRank, RelationshipType } from '../types'

function requireUid(): string {
  const u = auth.currentUser
  if (!u) throw new Error('サインインが必要です')
  return u.uid
}

export interface DiagnosisToSave {
  relationshipTypes: RelationshipType[]
  persona: string
  methods: string[]
  rankResult: CompatibilityRank
  scoresByRelationship: { type: RelationshipType; score: number; reason: string }[]
  summary: string
  cautionCandidates: string[]
  pinnedCautions: string[]
}

export async function saveDiagnosis(cid: string, d: DiagnosisToSave): Promise<string> {
  const uid = requireUid()
  const ref = await addDoc(collection(db, 'users', uid, 'customers', cid, 'compatibility'), {
    ...d,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

/** F-14 選択した注意点を顧客に保存（接客前・返信生成前に表示） */
export async function setPinnedCautions(cid: string, pinned: string[]): Promise<void> {
  const uid = requireUid()
  await updateDoc(doc(db, 'users', uid, 'customers', cid), {
    pinnedCautions: pinned,
    updatedAt: serverTimestamp(),
  })
}
