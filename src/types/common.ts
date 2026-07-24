import type { Timestamp } from 'firebase/firestore'

// Firestore の Timestamp をドメイン型でも使う（日時の正本）。
// UI/モックでは Timestamp.toDate() で Date に変換して表示する。
export type { Timestamp }

/** 金額（円・整数） */
export type Yen = number

/**
 * アプリ層で AES-256-GCM 暗号化して保存するフィールドの「保存時」表現（SEC-07）。
 * 復号後の値はドメイン型では平文の string として扱う（UI/モックはこちらを消費）。
 */
export interface EncryptedField {
  ciphertext: string
  iv: string
  keyVersion: number
}

export type BloodType = 'A' | 'B' | 'O' | 'AB'
