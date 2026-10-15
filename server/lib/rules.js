// アクセス制限。Firebase 時代の firestore.rules をサーバー側に移植したもの。
// 判定に使う ctx: { uid: ログイン中の uid(未ログインは null), get(path): 既存文書のデータ or null }
//
// 移植元との違い(締めた点):
//   - 店舗メンバーシップを本人が作るときは「店の作成者が店長として作る」か
//     「有効な招待コード(inviteCode)を添えて、招待と同じ役割で参加する」場合に限る。
//     移植元は本人なら役割を問わず作成できたため、招待なしで店長になれた。
//   - 本人によるメンバーシップ更新では役割(role)・店(storeId)・uid を変えられない。

export function splitPath(path) {
  if (typeof path !== 'string' || path.length === 0 || path.length > 1024) return null
  const segs = path.split('/')
  if (segs.some((s) => !/^[A-Za-z0-9_\-.:@]{1,200}$/.test(s) || s === '.' || s === '..')) return null
  return segs
}

export const isDocPath = (segs) => segs.length % 2 === 0
export const isCollPath = (segs) => segs.length % 2 === 1

function storeHelpers(ctx, storeId) {
  const memberPath = (uid) => `stores/${storeId}/memberships/${uid}`
  const signedIn = () => ctx.uid != null
  const myMembership = () => (signedIn() ? ctx.get(memberPath(ctx.uid)) : null)
  const isMember = () => myMembership() != null
  const myRole = () => myMembership()?.role
  const isManager = () => isMember() && myRole() === 'manager'
  const isStaff = () => isMember() && (myRole() === 'manager' || myRole() === 'kurofuku')
  return { signedIn, isMember, isManager, isStaff, myRole }
}

/** 読み取り可否。data は対象文書の現在の内容(存在しなければ null) */
export function canRead(ctx, segs, data) {
  if (!isDocPath(segs)) return false
  if (ctx.uid == null) return false
  // users/{uid}/** : 本人のみ
  if (segs[0] === 'users') return segs[1] === ctx.uid
  if (segs[0] !== 'stores') return false
  const h = storeHelpers(ctx, segs[1])
  if (segs.length === 2) return h.isMember()
  const sub = segs[2]
  if (segs.length === 4) {
    switch (sub) {
      case 'memberships':
        return h.isMember()
      case 'invites':
        return h.signedIn()
      case 'broadcasts':
      case 'rankings':
        return h.isMember()
      case 'penalties':
      case 'messages':
        return h.isStaff() || (data != null && data.castUid === ctx.uid)
      default:
        return false
    }
  }
  if (segs.length === 6 && sub === 'broadcasts' && segs[4] === 'reads') return h.isMember()
  if (segs.length === 6 && sub === 'sales' && segs[4] === 'casts') return h.isMember()
  return false
}

/**
 * 書き込み可否。op は 'create' | 'update' | 'delete'。
 * before: 既存の内容(無ければ null) / after: 書き込み後の内容(delete は null)
 */
export function canWrite(ctx, segs, op, before, after) {
  if (!isDocPath(segs)) return false
  if (ctx.uid == null) return false
  if (segs[0] === 'users') return segs[1] === ctx.uid
  if (segs[0] !== 'stores') return false
  const storeId = segs[1]
  const h = storeHelpers(ctx, storeId)

  if (segs.length === 2) {
    if (op === 'create') return after?.createdBy === ctx.uid
    return h.isManager()
  }
  const sub = segs[2]
  if (segs.length === 4) {
    const id = segs[3]
    switch (sub) {
      case 'memberships': {
        if (h.isManager()) return true
        if (id !== ctx.uid) return false
        if (op === 'delete') return false
        if (op === 'create') {
          if (after?.uid !== ctx.uid || after?.storeId !== storeId) return false
          const store = ctx.get(`stores/${storeId}`)
          // 店の作成者が店長として最初の所属を作る
          if (store && store.createdBy === ctx.uid && after.role === 'manager') return true
          // 招待コードで参加する(招待と同じ役割に限る)
          const code = after.inviteCode
          if (typeof code !== 'string') return false
          const invite = ctx.get(`stores/${storeId}/invites/${code}`)
          return invite != null && (invite.role ?? 'cast') === after.role
        }
        // update(本人): 役割・店・uid は変えられない
        return before?.role === after?.role && before?.storeId === after?.storeId && before?.uid === after?.uid
      }
      case 'invites':
        return h.isManager()
      case 'broadcasts':
        return h.isStaff()
      case 'rankings':
        return h.isManager()
      case 'penalties':
        return h.isStaff()
      case 'messages':
        if (op !== 'create') return false
        return (
          h.isStaff() ||
          (h.isMember() && after?.castUid === ctx.uid && after?.fromUid === ctx.uid)
        )
      default:
        return false
    }
  }
  if (segs.length === 6 && sub === 'broadcasts' && segs[4] === 'reads') return segs[5] === ctx.uid
  if (segs.length === 6 && sub === 'sales' && segs[4] === 'casts') return h.isManager() || segs[5] === ctx.uid
  return false
}
