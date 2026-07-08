# キャバ帳 データベース設計書 v1.0

| 項目 | 内容 |
|---|---|
| 文書名 | キャバ帳 データベース設計書 |
| 版数 | 1.0 |
| 作成日 | 2026-07-08 |
| 対象 | 要件定義書 v1.0 ＋ 業務要件定義 v1.1（F-01〜F-19） |
| 前提 | Firebase / Firestore（asia-northeast1）、React PWA（D-3）、認証=Google OAuth（SEC-01） |

---

## 1. 格納先の全体像（どのデータをどこに置くか）

データは性質ごとに格納先を分ける。**キャストの個人領域と店舗領域は物理的に別ツリー**とし、秘匿度の高いフィールドはアプリ層で暗号化する。

| データ種別 | 格納先 | 暗号化 | 主な根拠 |
|---|---|---|---|
| 構造化データ（顧客・来店・予定・売上・ランク・占い診断・店舗情報） | **Cloud Firestore** | 標準（保存時暗号化＝GCP標準） | 検索・集計・リアルタイム同期 |
| 顧客本名・LINEトーク本文・黒服相談ログ本文 | **Firestore（暗号化フィールド）** | **アプリ層 AES-256-GCM（SEC-07）** | 特に秘匿度が高く、鍵はKMS/Secret Manager管理 |
| 思い出写真・LINEエクスポート原本 | **Cloud Storage** | 標準＋アクセス制御 | バイナリ/大容量、EXIF位置情報は保存時除去（SEC-16） |
| APIキー・チャネルシークレット・暗号鍵 | **Secret Manager / Cloud KMS** | 標準 | SEC-08：コード/DBに置かない |
| AI応答の分析用ログ | Firestore（**本文非保存**・メタのみ） | ― | SEC-12：黒服相談は特に本文をログしない |
| セッション/認証情報 | Firebase Authentication | ― | SEC-01 |

- **リージョン**：`asia-northeast1`（東京）。Firestore・Storage・Functionsを同一リージョンに寄せる。
- **プロジェクト**：`points-optimizer-app`。

---

## 2. Firestore 論理設計：キャスト個人領域 `users/{uid}`

`{uid}` = Firebase Auth UID。**本人以外アクセス不可（SEC-02）**。店舗ロールからも不可視。

型記法：`?`=任意、`enum(...)`=列挙、`ts`=Timestamp、`ref`=DocumentReference、`🔒`=アプリ層暗号化フィールド。

### 2.1 プロフィール・契約・設定
```
users/{uid}
  profile (doc: profile)
    displayName: string
    storeNames: string[]                      // 所属店の表示名（キャッシュ）
    guaranteeEndDate?: date                    // 保証期間終了日（F-09）
    targetShimei?: number                      // 目標指名本数
    targetSales?: number
    fortuneBase: {                             // F-14 自分の占い基礎（主軸）
      birthday: date                           // 必須
      birthTime?: string
      birthPlace?: string
      bloodType?: enum(A|B|O|AB)
      traits?: string
    }
    createdAt: ts, updatedAt: ts

  subscription (doc: subscription)            // F-19 個人契約
    plan: enum(personal)
    status: enum(active|past_due|canceled)
    currentPeriodEnd: ts
    provider: enum(stripe), providerRef?: string
```

### 2.2 顧客・来店・相性診断
```
users/{uid}/customers/{cid}
  nickname: string                            // あだ名（必須）
  lineName?: string
  realName?: string 🔒                         // SEC-07 暗号化
  occupation?: string, companyName?: string
  incomeRange?: string
  firstVisitDate?: date
  paymentMethods: enum(cash|card|urikake)[]
  tags: string[]                              // 補助タグ（複数）
  rank?: enum(VVIP|VIP|IP|LOVE|BADBOY)         // F-12（単一・任意）
  rankHistory: [{ rank, changedAt: ts, note? }]
  fit: {                                       // F-13
    level: enum(得意|普通|苦手)
    reasonTags: string[]
    fatigue: enum(低|中|高)
    note?: string
  }
  fortune: { birthday?: date, bloodType?: enum, birthTime?: string, traits?: string }  // F-14（相手＝任意）
  pinnedCautions: string[]                     // F-14 ピン留めした注意点
  // --- 集計（Cloud Functionが来店書込時に再計算：非正規化）---
  totalSpent: number                           // 累計
  visitCount: number
  riskScore: number                            // F-02（0-100）
  riskFlags: string[]
  memo?: string
  createdAt: ts, updatedAt: ts

users/{uid}/customers/{cid}/visits/{vid}       // F-03
  date: ts
  durationMin?: number
  amount: number
  bottles: [{ name: string, price: number }]
  isDohan: boolean, isAfter: boolean
  payment: enum(cash|card|urikake)
  urikakePaid?: boolean                         // 売掛回収フラグ（F-02加点に влияние）
  episodeMemo?: string
  photoRefs: string[]                           // Storageパスの配列（本体はStorage）
  storeId?: ref                                 // どの店の売上か（F-16集計用・顧客情報は店へ渡さない）
  createdAt: ts

users/{uid}/customers/{cid}/compatibility/{diagId}   // F-14 診断履歴
  relationshipTypes: enum(友人|仕事|恋愛|客|家族その他)[]
  persona: string                               // 例 assertive_saiki
  methods: string[]                             // 使用した占い方式
  rankResult: enum(S|A|B|C|D)
  scoresByRelationship: [{ type, score: number, reason: string }]
  summary: string
  cautionCandidates: string[]
  pinnedCautions: string[]
  createdAt: ts
```

### 2.3 スケジュール・LINE・相談・売上
```
users/{uid}/schedules/{sid}                     // F-04
  type: enum(shift|dohan|after|appointment)
  customerId?: ref
  start: ts, end: ts
  googleEventId?: string                        // GCal双方向同期キー
  memo?: string

users/{uid}/lineImports/{lid}                   // F-05
  customerId: ref
  importedAt: ts
  stats: { emojiRate: number, avgLen: number, tone: string }   // 口調分析結果
  sourceRef?: string                            // 原本txtのStorageパス
  messages: [{ at: ts, from: enum(me|other), text: string 🔒 }]  // SEC-07 本文暗号化

users/{uid}/consultations/{tid}                 // F-08 黒服相談
  category?: enum(愚痴|ストーカー|売掛詐欺|メンタル)
  escalatedTo?: enum(police|store|window)
  messages: [{ at: ts, role: enum(user|assistant), text: string 🔒 }]  // SEC-07/12
  createdAt: ts, updatedAt: ts

users/{uid}/salesRecords/{month}                // F-09（month = 'YYYY-MM'）
  selfReported: { totalSales, shimeiCount, dohanCount, joCount }   // 自己申告
  storeConfirmed?: { totalSales, shimeiCount, dohanCount, joCount, storeId: ref }  // 店確定の写し（F-16）
  storeRank?: number                            // 店内順位（手入力 or F-18連携）
  updatedAt: ts

users/{uid}/recommendationsState/{date}         // F-07 特別連絡レコメンドの既読/実施
  dismissed: ref[], contactedAt: { cid: ts }
```

---

## 3. Firestore 論理設計：店舗領域 `stores/{storeId}`

**店舗ロール（キャスト/担当黒服/店長）のみアクセス**。ここには**顧客個人情報を一切置かない**（金額・本数・匿名ラベルのみ）。

```
stores/{storeId}
  name: string
  createdBy: string(uid=店長)
  settings: { ... }
  subscription: { plan: enum(store), status, currentPeriodEnd }   // F-19 店舗契約（個人契約と独立）

stores/{storeId}/memberships/{uid}              // F-15
  role: enum(cast|kurofuku|manager)
  displayName: string                           // 源氏名（店内表示）
  assignedKurofuku?: string(uid)                // 担当黒服（castの場合）
  joinedAt: ts, active: boolean

stores/{storeId}/invites/{code}                 // F-15 招待コード
  role: enum(cast|kurofuku), createdBy, expiresAt: ts, usedBy?: string(uid)

stores/{storeId}/sales/{month}/casts/{uid}      // F-16 店計上（店確定）
  totalSales, shimeiCount, dohanCount, joCount, bottles?: number
  selfReported?: { ... }                        // 突合用の自己申告写し（顧客情報は含めない）
  confirmedBy: string(uid), confirmedAt: ts

stores/{storeId}/broadcasts/{bid}               // F-17 発信
  type: enum(event|birthdayQuota|shift|notice|direct)
  title: string, body: string
  audience: enum(all|role|castIds)
  targetCastIds?: string[]
  quota?: number, eventDate?: ts
  createdBy: string(uid), createdAt: ts
  └ reads/{uid}   readAt: ts, reaction?: string

stores/{storeId}/rankings/{rankId}              // F-18
  metric: enum(sales|shimei|dohan|newCustomer|mom)
  period: enum(day|week|month)
  visibility: enum(public|topN|selfOnly|anonymous|private)
  n?: number
  computedAt: ts
  entries: [{ castUid: string, displayName?: string, rank: number, value: number }]
```

---

## 4. Cloud Storage 設計

| 用途 | パス | アクセス | 備考 |
|---|---|---|---|
| 思い出写真（F-03） | `users/{uid}/customers/{cid}/{vid}/{file}` | 本人uidのみ | アップロード時に**EXIF位置情報を除去**（SEC-16）、MIME検証＋10MB上限（SEC-15） |
| LINEエクスポート原本（F-05） | `users/{uid}/lineImports/{lid}/source.txt` | 本人uidのみ | パース後は保持要否を検討（Open Issue） |

- Storageルールも `request.auth.uid == uid` を強制（Firestore SEC-02と同一境界）。
- Firestoreには**Storageパス（参照）のみ**を保存し、バイナリは持たせない。

---

## 5. 暗号化・シークレット（SEC-07/08/10）

- **アプリ層暗号化（AES-256-GCM）対象フィールド**：`customers.realName`、`lineImports.messages[].text`、`consultations.messages[].text`。
  - 鍵はCloud KMS/Secret Managerで管理し**年1ローテーション**。暗号化はCloud Functions（`ai-proxy`と分離した暗号化ヘルパ）で実施。管理者でも復号鍵は保持しない（SEC-16）。
  - 保存形式：`{ ciphertext, iv, keyVersion }` のオブジェクトとしてフィールドに格納。
- **AI送信前マスキング（SEC-10）**：本名・電話・住所を仮名トークン化してからClaude APIへ。応答後に復元。DBには生値のみ暗号化保存し、マスキングは送信時処理（保存不要）。
- **シークレット**：APIキー・LINEチャネルシークレット・Calendar OAuthトークンはSecret Manager。Firestore/コードに置かない。

---

## 6. 集計・非正規化・トリガ

Firestoreは集計が弱いため、**書き込み時にCloud Functionで非正規化**する。

| 集計対象 | トリガ | 出力先 |
|---|---|---|
| `customers.totalSpent / visitCount` | `visits/{vid}` 作成・更新・削除 | 親 `customers/{cid}` |
| `customers.riskScore / riskFlags`（F-02） | 同上＋顧客更新 | 親 `customers/{cid}` |
| `users/{uid}/salesRecords/{month}`（自己申告） | `visits` 書込 | 月次ドキュメント |
| `stores/.../sales/{month}/casts/{uid}`（店確定） | 店長/黒服の確定操作 | 店舗売上 → 個人 `salesRecords.storeConfirmed` へ写経 |
| `stores/.../rankings/{rankId}`（F-18） | スケジュール/確定時に再計算 | ランキングドキュメント |

- **突合（F-16）**：店確定額を正とし、`selfReported` との差分をキャストへ通知。顧客個人情報は店側に渡さない（内部uid/匿名ラベルで集計）。

---

## 7. インデックス設計（`firestore.indexes.json`）

主なクエリと必要な複合インデックス：

| クエリ | インデックス |
|---|---|
| 顧客をランク別に売上降順（F-09/F-12） | `customers`：`rank ASC, totalSpent DESC` |
| 苦手客を更新順（F-13） | `customers`：`fit.level ASC, updatedAt DESC` |
| リスク高い順（F-02） | `customers`：`riskScore DESC`（単一・自動） |
| 予定を種別×開始時刻（F-04） | `schedules`：`type ASC, start ASC` |
| 発信を新着順（F-17） | `broadcasts`：`createdAt DESC`（単一・自動） |
| 月次の全キャスト来店集計（collectionGroup） | `visits`（CG）：`date ASC` |

単一フィールドのみのクエリはFirestore自動インデックスで足りるため、複合のみ定義する。

---

## 8. アクセス制御（`firestore.rules` との対応）

| ツリー | 読み | 書き |
|---|---|---|
| `users/{uid}/**` | 本人uidのみ | 本人uidのみ |
| `stores/{storeId}`・サブコレクション | 所属メンバー | 店長（詳細権限は実装時に細分化：黒服＝発信/確定、店長＝全権） |
| Storage `users/{uid}/**` | 本人uidのみ | 本人uidのみ |

現行の `firestore.rules`（SEC-02準拠）とこの設計は整合済み。今後、店舗サブコレクションごとの黒服/店長の権限差（発信は黒服可、契約変更は店長のみ 等）を細分化する。

---

## 9. データ保持・削除

- **退会（F-11）**：`users/{uid}` 配下と対応Storageを完全削除。バックアップにも90日以内に反映（v1.0非機能要件）。
- **写真**：保存時にEXIF位置情報を除去。元データは復元不可。
- **占い診断・相談ログ**：本人削除で即時削除。AI分析ログは本文を保持しない。
- **バックアップ**：Firestore日次エクスポート（GCS・保持30日、v1.0）。
- **店舗離脱**：キャスト個人領域は本人手元に残す。店へ渡した実績（`stores/.../sales`）は店側集計に残存（雇用記録として）。

---

## 10. 命名・ID規約

- ドキュメントID：原則Firestore自動ID。月次系は `YYYY-MM`、日次系は `YYYY-MM-DD`。招待は短縮コード。
- 参照はできるだけ `ref`（DocumentReference）で持ち、表示名など変わりうる値はキャッシュとして別途保持。
- タイムスタンプは `createdAt`/`updatedAt` を基本セットとして持たせる。

---

## 11. 未決事項（DB観点）

1. 暗号化フィールドの検索要否（暗号化すると全文検索不可 → 検索は平文の `nickname` 等に限定でよいか）。
2. `visits` のcollectionGroup集計 vs 事前集計ドキュメントのどちらを主にするか（コスト最適化）。
3. LINEエクスポート原本の保持期間（パース後に破棄するか）。
4. ランキング（F-18）の再計算頻度とコスト（リアルタイム vs スケジュール実行）。
5. 店確定売上の入力単位（キャスト単位 / 伝票単位）と突合粒度。

---

*本書は要件定義 v1.0 ＋ 業務要件定義 v1.1 を元に、格納先（Firestore / Cloud Storage / Secret Manager）を含めた物理寄りの論理設計を定義したもの。次工程で `firestore.rules` の権限細分化と Cloud Functions（集計・暗号化・突合）の設計へ展開する。*
