---
name: handmade-sales-manager-implementation
description: >-
  ハンドメイド在庫・販売管理アプリのMVPを、設計書とAGENTS.mdに従って
  最小差分で実装・修正・調査・検証するためのCodex用スキル。
---

# Handmade Sales Manager Implementation Skill

## 1. このスキルの目的
このスキルは、**ハンドメイド在庫・販売管理アプリ**のリポジトリで、Codex が実装・修正・調査を一貫した手順で進めるための共通ワークフローを定義する。

本スキルの目的は次のとおり。

- 設計書に沿った実装判断を行う
- 既存構成を崩さず、最小差分で修正する
- フロント / API / 共有型 / ドキュメントの整合を保つ
- MVP 範囲外の過剰実装を防ぐ
- 実装後の確認観点を統一する

このスキルは、ルートの `AGENTS.md` を補助し、**作業の進め方**をより具体化するために使う。

---

## 2. このスキルを使う場面
以下のような依頼で使う。

- 商品、タスク、カテゴリ、タグ、QR、ダッシュボードなどの機能追加・修正
- API 実装、バリデーション修正、エラー処理修正
- 画像アップロード、画像変換、Storage パス、署名付き URL 周りの修正
- Firestore データ構造、インデックス、検索条件、一覧ロジックの調整
- 設計書準拠の確認、仕様差分の洗い出し
- テスト追加、テスト修正、リファクタリングを伴わない不具合修正

以下では原則として使わない。

- MVP 範囲外の新機能を自由提案するとき
- 大規模な再設計を前提とする抜本改修
- 設計書よりも新しい方針へ全面移行するとき

---

## 3. 前提として読むもの
作業開始時は、まず以下を確認する。

### 必読
1. `AGENTS.md`
2. 変更対象に関係する設計書

### 仕様優先順位
判断に迷う場合は、次の順で優先する。

1. `requirements.md`
2. `basic_design.md`
3. `detail_design.md`
4. `api_specification.md`
5. `data_design.md`
6. `screen_design.md`
7. `implementation-notes.md`
8. `error-messages.md`
9. `AGENTS.md`
10. 本ファイル `SKILL.md`

### 主要参照ファイル
- `requirements.md`
- `basic_design.md`
- `detail_design.md`
- `api_specification.md`
- `data_design.md`
- `screen_design.md`
- `test_design.md`
- `test_cases.md`
- `implementation-notes.md`
- `error-messages.md`
- `deployment.md`
- `backup-and-restore.md`
- `firebase.json`
- `firestore.indexes.json`
- `firestore.rules`
- `storage.rules`

---

## 4. このプロジェクトの固定前提

### 対象
- MVP 初期リリース
- 利用者本人のみ
- モバイルファースト、PC レスポンシブ対応

### 技術構成
- フロントエンド: React + TypeScript + Vite
- バックエンド: Node.js + TypeScript + Express
- 認証: Firebase Authentication
- データベース: Firestore
- 画像保存: Cloud Storage
- ホスティング: Firebase Hosting
- 実行基盤: Cloud Run

### 標準ディレクトリ構成
```text
/apps
  /web
  /api
/packages
  /shared
/docs
/firebase
```

### アーキテクチャの固定ルール
- フロントから Firestore / Storage へ直接アクセスしない
- 業務データの read/write は必ず API 経由にする
- ブラウザからの業務 API 呼び出しは `/api` に統一する
- Firebase をフロントで直接使うのは Authentication のみ
- API では Firebase ID Token を検証する

---

## 5. 実装時の判断原則

### 基本原則
- **最小差分** を優先する
- 無関係なリファクタリングを混ぜない
- 既存の命名・責務分担・レイヤ構造に合わせる
- まず既存ファイルを活かし、必要な場合のみ新規ファイルを追加する
- 設計に未記載の挙動を勝手に拡張しない
- MVP 対象外は実装しない

### 再利用原則
変更前に次を確認する。

- 既存の型
- 既存の Zod schema
- 既存の定数
- 既存のユーティリティ
- 既存の API レスポンス形式
- 既存の UI パターン
- 既存のテストパターン

### 共有化原則
以下は再利用性があるなら `packages/shared` に寄せる。

- ステータス定数
- エラーコード定数
- API 共通型
- 共通 Zod schema
- 文字列正規化関数
- 日付 / 日時フォーマット定数

---

## 6. 典型ワークフロー

### Step 1. 依頼を分類する
まず依頼がどの領域かを特定する。

- 画面表示: `screen_design.md`, `detail_design.md`
- API: `api_specification.md`, `detail_design.md`
- データ: `data_design.md`, `detail_design.md`
- テスト: `test_design.md`, `test_cases.md`
- 文言: `error-messages.md`
- Firebase 設定: `firebase.json`, `firestore.indexes.json`, rules
- 運用 / デプロイ: `deployment.md`, `backup-and-restore.md`

### Step 2. 関連仕様を確定する
対象機能に関係する設計書から、以下を抜き出す。

- 目的
- 入出力
- バリデーション
- 状態遷移
- 正常系 / 異常系
- 画面導線
- データ更新ルール
- エラーコード / 表示メッセージ

仕様が複数文書にまたがる場合は、差分を整理してから実装する。

### Step 3. 影響ファイルを特定する
以下を洗い出す。

- 画面コンポーネント
- hooks / query 定義
- API ルート / controller / service
- shared 型 / schema / 定数
- Firebase 設定ファイル
- テストファイル
- 関連ドキュメント

### Step 4. 実装する
次の順で進める。

1. shared の型・定数が必要なら先に更新
2. API 契約変更があるなら API と shared を同期
3. フロントを API 契約に合わせて更新
4. 必要最小限のテストを更新
5. 仕様変更を伴う場合のみ docs を更新

### Step 5. 破壊的影響を確認する
特に以下を確認する。

- API レスポンス形式の互換性
- Firestore データ構造との整合
- クエリ条件とインデックスの整合
- 画像パスや URL 生成方式の整合
- 401 / 403 / 404 / 400 の扱いの整合
- 商品論理削除時の関連機能への影響

### Step 6. 検証する
可能な範囲で次を実行する。

```bash
npm run lint
npm run typecheck
npm run test
npm run build:web
```

必要に応じて追加で確認する。

- 対象画面の表示確認
- 影響 API のリクエスト / レスポンス確認
- 型エラー有無
- import 崩れや未使用コードの有無

### Step 7. 結果を報告する
報告では必ず次を含める。

- 何を変更したか
- なぜ変更したか
- どの仕様に基づいたか
- どのファイルを触ったか
- 実施した確認
- 未対応事項 / 注意点

---

## 7. 領域別の実装ガイド

### 7.1 フロントエンド

#### 状態管理
- サーバー状態: TanStack Query
- フォーム状態: React Hook Form + Zod
- 画面ローカル状態: `useState` / `useMemo` / `useReducer`
- グローバル状態は認証情報と最小限の UI 状態のみ

#### グローバル状態に置かないもの
- 商品一覧の絞り込み条件
- 商品編集フォームの入力値
- ダッシュボード取得結果
- 商品詳細取得結果
- QR 読取結果の永続保持

#### 一覧条件
商品一覧条件は URL クエリで保持する。

対象:
- `keyword`
- `categoryId`
- `tagId`
- `status`
- `includeSold`
- `sortBy`
- `sortOrder`
- `page`
- `pageSize`

#### ルーティング
以下を前提とする。

```text
/login
/dashboard
/products
/products/new
/products/:productId
/products/:productId/edit
/products/:productId/tasks
/categories
/tags
/qr
```

### 7.2 API / バックエンド
- ベースパスは `/api`
- 共通レスポンス形式は設計書準拠
- 業務 API は認証必須、`GET /api/health` は例外
- 論理削除済み商品は通常 API から参照不可
- エラーコードは既存定義を優先し、勝手に増やしすぎない

### 7.3 データ / Firestore
主なコレクション:
- `products`
- `tasks`
- `categories`
- `tags`
- `counters`
- `operationLogs`

#### 固定ルール
- 商品は論理削除
- タスクは物理削除
- カテゴリ / タグは未使用時のみ物理削除
- 商品 ID は `HM-000001` 形式
- 採番は `counters/product`

### 7.4 商品ステータス
内部値は以下で固定する。

```text
beforeProduction
inProduction
completed
onDisplay
inStock
sold
```

- UI で表示名へ変換する
- `soldAt` は `sold` 変更時に未設定なら設定
- `sold` から戻す場合は `soldAt=null`

### 7.5 QR 販売更新
- QR で販売済更新できるのは `onDisplay` / `inStock` のみ
- `sold` は重複更新しない
- `beforeProduction` / `inProduction` / `completed` は QR 販売更新不可

### 7.6 画像処理
#### 受付条件
- JPEG / PNG / WebP
- 最大 10MB
- 1 商品最大 10 枚

#### 変換方針
- API 側で `sharp`
- 元画像は保持しない
- 表示用・サムネイルとも WebP

#### 保存パス
```text
products/{productId}/display/{imageId}.webp
products/{productId}/thumb/{imageId}.webp
```

#### URL 方針
- `displayUrl` / `thumbnailUrl` は永続保存しない
- 取得系 API で signed URL を生成する
- 有効期限は既定 60 分
- 期限切れ時は取得 API を再実行して再取得する

### 7.7 商品一覧検索
- 対象: `name`, `description`, `productId`, `categoryName`, `tagNames`
- キーワード最大 100 文字
- 前後空白除去
- 連続空白は単一空白相当
- 英字は大文字小文字を区別しない
- 全角 / 半角差は可能な範囲で吸収
- ひらがな / カタカナは別文字として扱う
- Firestore で絞れる条件を先に適用し、部分一致は API 後段フィルタ

---

## 8. 絶対に外してはいけないこと
- フロントから Firestore / Storage を直接 read/write しない
- MVP 範囲外の機能を追加しない
- 元画像保存を追加しない
- 画像一括アップロードを追加しない
- QR コード画像の永続保存を追加しない
- ステータス履歴の本格管理を追加しない
- 複数ユーザー前提の権限設計を追加しない
- 無関係なファイルの大規模整形やリネームをしない
- 互換性のない API / データ変更を関連更新なしで入れない

---

## 9. 出力フォーマット
作業完了時は、少なくとも次の形式で報告する。

### 変更概要
- 何を変更したか
- どの画面 / API / データに影響するか

### 根拠
- 参照した仕様ファイル
- 判断の要点

### 変更ファイル
- 追加 / 更新したファイル一覧

### 確認結果
- 実行したコマンド
- 通ったもの / 未実施のもの

### 補足
- 未対応事項
- レビュー時の確認ポイント

---

## 10. 最終チェックリスト
完了前に次を確認する。

- [ ] 仕様優先順位に反していない
- [ ] 変更は最小差分に収まっている
- [ ] 無関係な変更が混ざっていない
- [ ] 共有化できる型 / 定数 / schema を適切に再利用した
- [ ] フロント / API / docs / test の整合が取れている
- [ ] エラーコードと画面メッセージの対応が崩れていない
- [ ] 論理削除、`soldAt`、QR販売更新、画像URL方針を壊していない
- [ ] 実行できる検証を行った
- [ ] 報告に根拠と未対応事項を含めた

---

## 11. ひとことで言うと
このスキルでは、**「設計書を読み、既存構成を尊重し、最小差分で実装し、最後に整合性まで確認する」** を徹底する。
