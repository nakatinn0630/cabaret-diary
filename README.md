# Points Optimizer App

Firebase Auth/Firestoreを使用したiOSアプリです。

## 機能
- メール認証（登録/ログイン/ログアウト）
- Firestoreユーザープロファイル管理
- 認証状態に応じた画面遷移

## 技術スタック
- SwiftUI + Swift
- iOS 17+
- Firebase Auth
- Firebase Firestore

## セットアップ

1. Firebase プロジェクトの設定
   - プロジェクトID: points-optimizer-app
   - リージョン: asia-northeast1
   - Firestoreルール: テストモード

2. GoogleService-Info.plist の設定
   - Firebase Console からダウンロードしたファイルで置き換えてください

3. 依存関係のインストール
   ```bash
   swift package resolve
   ```

## ファイル構成
```
/App
  ├── MainApp.swift           # エントリーポイント
  ├── AuthManager.swift       # 認証管理
  ├── UserProfile.swift       # ユーザーモデル
  ├── Views
  │   ├── LoginView.swift
  │   ├── ProfileView.swift
  │   └── DashboardView.swift
  └── Utilities
      └── FirebaseConfig.swift # Firebase初期化
```
