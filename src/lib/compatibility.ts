import { doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { auth, db } from './firebase'
import { demoActive } from './demo'
import { currentUid, requireUid } from './uid'
import type { CompatibilityRank, RelationshipType } from '../types'

// 保存先の切り分け（ユーザー要件）：
//  ・占い/相性診断の「診断結果・履歴」→ 端末ローカル（localStorage）。DBには保存しない。
//  ・診断から「ピン留めした注意点(pinnedCautions)」→ これは“顧客情報”として接客前表示や
//    顧客編集に使うため、顧客ドキュメント(DB)に保存する。

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

type StoredDiagnosis = DiagnosisToSave & { id: string; cid: string; at: number }

const diagKey = (uid: string) => `kyabacho_diagnoses_${uid}`
function readDiag(uid: string): StoredDiagnosis[] {
  try {
    return JSON.parse(localStorage.getItem(diagKey(uid)) ?? '[]') as StoredDiagnosis[]
  } catch {
    return []
  }
}

/** F-14 占い診断結果を端末ローカルに保存（DB非保存）。 */
export async function saveDiagnosis(cid: string, d: DiagnosisToSave): Promise<string> {
  const uid = requireUid()
  const id = 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  const list = readDiag(uid)
  list.unshift({ ...d, id, cid, at: Date.now() })
  localStorage.setItem(diagKey(uid), JSON.stringify(list.slice(0, 200)))
  return id
}

/** ある顧客の過去診断（端末ローカル）を新しい順に取得。 */
export function getDiagnoses(cid: string): StoredDiagnosis[] {
  const uid = currentUid()
  if (!uid) return []
  return readDiag(uid).filter((x) => x.cid === cid)
}

/** F-14 選択した注意点を顧客に保存（接客前・返信生成前に表示）＝顧客情報なのでDB保存。 */
export async function setPinnedCautions(cid: string, pinned: string[]): Promise<void> {
  if (demoActive()) return
  const u = auth.currentUser
  if (!u) throw new Error('ログインが必要です')
  await updateDoc(doc(db, 'users', u.uid, 'customers', cid), {
    pinnedCautions: pinned,
    updatedAt: serverTimestamp(),
  })
}
