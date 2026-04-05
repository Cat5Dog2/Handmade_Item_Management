# プロジェクト概要

## 対象
- プロジェクト名: ハンドメイド在庫・販売管理アプリ
- リリース対象: MVP 初期リリース
- 利用者: 本人のみ
- UI方針: モバイルファースト、PCレスポンシブ

## 技術構成
- Frontend: React + TypeScript + Vite
- Backend: Node.js + TypeScript + Express
- Auth: Firebase Authentication
- Database: Firestore
- Storage: Cloud Storage
- Hosting: Firebase Hosting
- Runtime: Cloud Run

## 基本ディレクトリ
```text
/apps
  /web
  /api
/packages
  /shared
/docs
/firebase
```

## このスキルの役割
- 変更前に設計書を読む順番を固定する
- 既存構成を崩さず、最小差分で改修する
- API/フロント/shared/docs の整合を保つ
