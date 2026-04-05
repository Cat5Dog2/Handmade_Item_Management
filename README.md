# ハンドメイド販売管理アプリ

ハンドメイド作品を一点物単位で管理する、モバイルファーストの在庫・販売管理アプリです。  
商品情報、画像、カテゴリ、タグ、商品別タスク、QRコードによる識別と販売済更新、ダッシュボード集計をまとめて扱います。

この README は、**Codex で実装を始めるための最小ガイド**として作成しています。仕様の正本は設計書群です。

> 補足:
> - 現在のこのリポジトリは、設計書・Firebase設定に加えて、**最小の workspace 基盤** まで含む初期実装セットです。
> - `npm install`、`npm run dev`、`docker compose up --build` などの実行系コマンドは利用できますが、業務機能はこれから段階的に実装する前提です。
> - フロントの API 呼び出し先は `/api` に統一し、ローカル開発時は Vite dev server の proxy で API へ中継します。

## 1. MVPの対象

実装対象:

- ログイン / ログアウト / パスワード再設定
- 商品登録 / 一覧 / 詳細 / 編集 / 論理削除
- 商品画像登録 / 差し替え / 削除
- カテゴリ管理
- タグ管理
- 商品別タスク管理
- ダッシュボード表示
- 商品ごとのQRコード表示
- QRコード読み取りによる販売済更新
- 共通バリデーション / エラー表示

対象外:

- 複数ユーザー対応
- ロール管理
- 顧客管理
- 決済機能
- 配送連携
- 会計処理
- 外部EC自動連携
- 複数個在庫管理

## 2. 設計書の読み順

Codex / 開発者は、まず `AGENTS.md` の作業ルールを確認してください。  
そのうえで、**プロダクト仕様の衝突**は次の順で判断します。

1. `docs/requirements.md`
2. `docs/basic_design.md`
3. `docs/detail_design.md`
4. `docs/api_specification.md`
5. `docs/data_design.md`
6. `docs/screen_design.md`
7. `docs/test_design.md`
8. `docs/test_cases.md`
9. `docs/implementation-notes.md`
10. `docs/error-messages.md`
11. `AGENTS.md`

補足:
- `AGENTS.md` は Codex の作業ルールの正本です
- 商品仕様・API仕様・画面仕様の判断は、上記の `docs/` 配下の順序に従います

## 3. 想定技術構成

- フロントエンド: React + TypeScript + Vite
- バックエンド: Node.js + TypeScript + Express
- 認証: Firebase Authentication
- データベース: Firestore
- 画像保存: Cloud Storage
- フロント配信: Firebase Hosting
- API実行基盤: Cloud Run
- 状態管理: TanStack Query
- フォーム: React Hook Form + Zod
- QR読取: `html5-qrcode`
- 画像変換: `sharp`

## 4. 推奨ディレクトリ構成

```text
/
├─ AGENTS.md
├─ README.md
├─ .env.example
├─ .env.docker.example
├─ firebase.json
├─ /apps
│  ├─ /web
│  │  └─ Dockerfile.dev
│  └─ /api
│     └─ Dockerfile
├─ /packages
│  └─ /shared
├─ /firebase
│  ├─ firestore.indexes.json
│  ├─ firestore.rules
│  └─ storage.rules
└─ /docs
   ├─ requirements.md
   ├─ basic_design.md
   ├─ detail_design.md
   ├─ api_specification.md
   ├─ data_design.md
   ├─ screen_design.md
   ├─ test_design.md
   ├─ test_cases.md
   ├─ implementation-notes.md
   ├─ error-messages.md
   ├─ deployment.md
   └─ backup-and-restore.md
```

現在含まれている基盤ファイル:

- ルート `package.json`
- `apps/web/package.json`
- `apps/api/package.json`
- `packages/shared/package.json`
- `tsconfig.base.json` またはそれに準ずる TypeScript 共通設定

## 5. ローカル開発を始める手順

### 5.1 前提

準備しておくもの:

- Node.js の LTS
- npm
- Firebase プロジェクト
- GCP プロジェクト
- Firebase Authentication / Firestore / Cloud Storage / Hosting が利用可能な状態
- Cloud Run にデプロイ可能な権限

### 5.2 認証の前提

このアプリは**利用者本人のみ**を対象にした単独利用前提です。  
MVPでは新規登録画面は作らないため、ログイン用ユーザーは Firebase Authentication の Email/Password で事前作成してください。  
加えて、API 側で `APP_OWNER_EMAIL` と一致するユーザーのみ許可する前提にしてください。

### 5.3 環境変数を準備する

1. `.env.example` をコピーして使用する
2. 実リポジトリでは次のいずれかで運用する
   - ルート `.env`
   - ルート `.env` を正本にしつつ、必要なら `apps/api/.env` で API 側だけ上書き
3. Firebase / GCP の実値を設定する
4. `APP_OWNER_EMAIL` に利用者本人のログイン用メールアドレスを設定する
5. サービスアカウント JSON をローカルに配置し、`GOOGLE_APPLICATION_CREDENTIALS` を設定する

例:

```bash
cp .env.example .env
```

### 5.4 依存関係をインストールする

```bash
npm install
```

### 5.5 Firebase関連設定を用意する

最低限、次を実装・配置してください。

- `firebase/firestore.indexes.json`
- `firebase/firestore.rules`
- `firebase/storage.rules`

必要に応じて Firebase CLI で反映します。

```bash
firebase deploy --only firestore:indexes,firestore:rules,storage
```

### 5.6 開発サーバーを起動する

最低限、次の script を利用します。

```bash
npm run dev
npm run dev:web
npm run dev:api
```

推奨挙動:

- Web: `http://localhost:5173`
- API: `http://localhost:8080`
- Web から API へは `VITE_API_BASE_URL` 経由で `/api` に接続する
- ローカル開発時は `VITE_API_PROXY_TARGET` の既定値 `http://localhost:8080` を Vite dev server が proxy する

## 6. workspace 基盤に含める推奨 npm scripts

Codex が迷わないよう、少なくとも以下の script を用意しています。

```json
{
  "scripts": {
    "dev": "npm-run-all --parallel dev:web dev:api",
    "dev:web": "npm --workspace apps/web run dev",
    "dev:api": "npm --workspace apps/api run dev",
    "build": "npm run build:shared && npm run build:web && npm run build:api",
    "build:shared": "npm --workspace packages/shared run build",
    "build:web": "npm --workspace apps/web run build",
    "build:api": "npm --workspace apps/api run build",
    "lint": "npm run lint:shared && npm run lint:web && npm run lint:api",
    "lint:shared": "npm --workspace packages/shared run lint",
    "lint:web": "npm --workspace apps/web run lint",
    "lint:api": "npm --workspace apps/api run lint",
    "typecheck": "npm run typecheck:shared && npm run typecheck:web && npm run typecheck:api",
    "typecheck:shared": "npm --workspace packages/shared run typecheck",
    "typecheck:web": "npm --workspace apps/web run typecheck",
    "typecheck:api": "npm --workspace apps/api run typecheck",
    "test": "npm run test:shared && npm run test:web && npm run test:api",
    "test:shared": "npm --workspace packages/shared run test",
    "test:web": "npm --workspace apps/web run test",
    "test:api": "npm --workspace apps/api run test"
  }
}
```

`npm-run-all` は例です。ワークスペース構成に合わせて置き換えて構いません。

## 7. 実装時の主要ルール

### 7.1 共通

- TypeScript は strict 前提
- `any` は原則禁止
- 用語は設計書に合わせる
- 将来拡張のための過剰な抽象化はしない
- MVP外の提案実装はしない

### 7.2 ステータス内部コード

```text
beforeProduction
inProduction
completed
onDisplay
inStock
sold
```

### 7.3 商品ID

- 形式: `HM-000001`
- 固定接頭辞: `HM-`
- 6桁連番
- 再利用不可
- API側で自動採番
- `counters/product` をトランザクション更新して採番

### 7.4 画像

- 受け付け形式: JPEG / PNG / WebP
- 1ファイル最大: 10MB
- 1商品あたり最大: 10枚
- 長辺 2000px 超は縮小
- 保存形式: WebP
- 元画像は保持しない
- 表示用画像とサムネイルを生成する
- URLは保存せず、取得時に期限付きURLを生成する
- 既定有効期限: 60分

保存先例:

```text
products/{productId}/display/{imageId}.webp
products/{productId}/thumb/{imageId}.webp
```

### 7.5 QR販売済更新

- `onDisplay` または `inStock` の商品のみ対象
- `sold` は重複更新しない
- `beforeProduction` / `inProduction` / `completed` は QR で販売済更新しない
- 対象外はエラーメッセージまたは警告メッセージを表示する

## 8. 想定API一覧

### Dashboard

- `GET /api/dashboard`

### Products

- `GET /api/products`
- `POST /api/products`
- `GET /api/products/:productId`
- `PUT /api/products/:productId`
- `DELETE /api/products/:productId`
- `POST /api/products/:productId/images`
- `PUT /api/products/:productId/images/:imageId`
- `DELETE /api/products/:productId/images/:imageId`
- `GET /api/products/:productId/tasks`
- `POST /api/products/:productId/tasks`
- `PUT /api/tasks/:taskId`
- `PATCH /api/tasks/:taskId/completion`
- `DELETE /api/tasks/:taskId`

### Categories

- `GET /api/categories`
- `POST /api/categories`
- `PUT /api/categories/:categoryId`
- `DELETE /api/categories/:categoryId`

### Tags

- `GET /api/tags`
- `POST /api/tags`
- `PUT /api/tags/:tagId`
- `DELETE /api/tags/:tagId`

### QR

- `POST /api/qr/lookup`
- `POST /api/qr/sell`

詳細な入出力は `docs/api_specification.md` を正本としてください。

## 9. データモデルの要点

主な永続化対象:

- `products`
- `tasks`
- `categories`
- `tags`
- `counters/product`

補足:

- 商品は論理削除
- タスクは物理削除
- カテゴリ / タグは未使用時のみ物理削除
- 商品画像メタ情報は `products.images[]` に埋め込み
- 画像実体は Cloud Storage に保存

## 10. テスト方針

最低限、以下が通る状態を完了条件にしてください。

```bash
npm run lint
npm run typecheck
npm run build
npm run test
```

推奨:

- Web: Vitest + Testing Library
- API: Vitest または Jest + supertest
- E2E: Playwright

優先して守る導線:

1. ログイン
2. 商品一覧表示
3. 商品登録
4. 商品編集
5. 商品画像追加 / 差し替え / 削除
6. タスク登録 / 更新 / 削除
7. カテゴリ / タグ管理
8. QR読み取りから販売済更新
9. ダッシュボード表示

## 11. 開発時の注意

- 画面・API・DBで名称を揃える
- UIメッセージは `docs/error-messages.md` を正本とし、画面構成は `docs/screen_design.md` に合わせる
- 入力バリデーションはフロントとAPIで二重に担保する
- 画面で必要な派生情報をDBの生値に直接混ぜ込まない
- 商品詳細と商品タスクは別APIで取得する
- 画像URLは期限切れを前提に再取得導線を持たせる
- 単独利用を担保するため、API では Firebase 認証に加えて `APP_OWNER_EMAIL` の一致確認を行う

## 12. まず作るべきもの

実装開始時は、次の順で着手するのが安全です。

1. モノレポ基盤
2. TypeScript / ESLint / Vitest 基盤
3. Firebase 初期化
4. 認証ガード
5. shared 型 / schema / 定数
6. API 基盤
7. Firestore access 層
8. 商品API
9. 商品一覧 / 詳細 / 登録 / 編集画面
10. 画像API / タスクAPI / カテゴリ / タグ / QR / ダッシュボード

## 13. 現在含まれている基盤ファイル

次があるため、Codex が実装を始めやすい状態になっています。

- ルート `package.json`
- `apps/web/package.json`
- `apps/api/package.json`
- `packages/shared/package.json`
- `tsconfig.base.json`
- `apps/web/tsconfig.json`
- `apps/api/tsconfig.json`
- 必要なら `vite.config.ts` とローカル `/api` 接続用設定

## 14. ライセンス / 運用メモ

この README は実装着手用の運用ドキュメントです。  
仕様変更時は README 単体ではなく、必ず設計書群と `AGENTS.md` を合わせて更新してください。
