# デプロイ手順書（deployment）

## 1. 目的

本書は、ハンドメイド在庫・販売管理アプリのMVPを**ローカル確認から本番反映まで一貫して進めるための手順書**である。  
対象は次の構成とする。

- フロントエンド: Firebase Hosting
- API: Cloud Run
- 認証: Firebase Authentication
- データベース: Firestore
- 画像保存: Cloud Storage
- コンテナ保管 / ビルド: Artifact Registry / Cloud Build

本書は `README.md` の実行概要を、実運用向けにもう一段具体化したものである。

補足:

- 本書は、**実装済みの workspace 基盤が揃っている段階**を前提とする
- 設計書・Firebase設定・Docker雛形のみの初期状態では、後述の `npm` / Docker / Cloud Run コマンドはまだ実行できない

---

## 2. 配置構成

本アプリのデプロイ構成は次のとおりとする。

```text
利用者ブラウザ
  ↓
Firebase Hosting (apps/web/dist)
  ↓  /api は Hosting rewrite 経由
Cloud Run API
  ↓
Firestore
Cloud Storage

認証のみ Firebase Authentication をフロントで利用
```

重要事項:

- フロントから Firestore / Storage へ直接 read/write しない
- 業務データの取得・更新は Cloud Run API 経由に統一する
- フロントからの API 呼び出しは **Firebase Hosting 経由の `/api`** に統一する
- Firebase Authentication はフロントで利用し、取得した ID Token を API に付与する
- API は Firebase Admin SDK でトークン検証を行う

---

## 3. 前提条件

## 3.1 必須アカウント / 権限

少なくとも次を扱える権限が必要である。

- Firebase プロジェクトの管理権限
- Google Cloud プロジェクトの編集権限
- Firestore / Cloud Storage / Firebase Hosting の利用権限
- Cloud Run のデプロイ権限
- Artifact Registry の作成 / 参照権限
- Cloud Build の実行権限

MVPでは個人利用前提のため、**単一の Firebase / GCP プロジェクト**で運用してよい。

## 3.2 ローカル前提

- Node.js LTS
- npm
- Firebase CLI
- Google Cloud CLI (`gcloud`)
- Docker または Cloud Build を使える状態
- Java 実行環境（Firestore Emulator 利用時）

## 3.3 想定するリポジトリ内ファイル

最低限、次がある前提で進める。

```text
AGENTS.md
README.md
.env.example
firebase.json
.firebaserc
package.json
apps/web/package.json
apps/api/package.json
packages/shared/package.json
tsconfig.base.json
firebase/firestore.indexes.json
firebase/firestore.rules
firebase/storage.rules
docs/implementation-notes.md
docs/error-messages.md
```

補足:

- 現在のリポジトリが設計書先行の初期セットである場合、上記の workspace 基盤ファイルは未配置のことがある
- その場合は、先に `README.md` 記載の基盤ファイルを追加してから本手順へ進む

---

## 4. デプロイ対象の命名方針

MVPでは、次のようなシンプルな命名を推奨する。

| 対象 | 推奨例 |
|---|---|
| Firebase / GCP Project ID | `your-project-id` |
| Cloud Run service | `handmade-sales-api` |
| Artifact Registry repository | `handmade-sales-api` |
| Cloud Run region | `asia-northeast1` |
| Hosting site | default site |

リージョンは利用者が日本前提のため、**`asia-northeast1` を第一候補**とする。

---

## 5. 初回セットアップ

## 5.1 Firebase / GCP プロジェクトを作成する

1. Firebase プロジェクトを作成する
2. 同じプロジェクトで Google Cloud を利用可能にする
3. `.firebaserc` の `default` を実プロジェクトIDへ置き換える

例:

```json
{
  "projects": {
    "default": "your-project-id"
  }
}
```

## 5.2 必要なプロダクトを有効化する

Firebase 側で少なくとも次を有効化する。

- Authentication
- Firestore Database
- Cloud Storage for Firebase
- Firebase Hosting

Google Cloud 側で少なくとも次を有効化する。

- Cloud Run API
- Cloud Build API
- Artifact Registry API

## 5.3 Authentication を設定する

本アプリは**利用者本人のみ**を想定する。  
MVPでは新規登録画面を持たないため、Firebase Authentication で以下を事前に行う。

- Email/Password 認証を有効化する
- ログイン用ユーザーを手動作成する
- パスワード再設定メールが送れる状態にする
- API 側の allowlist 用に `APP_OWNER_EMAIL` を決め、環境変数へ設定する

## 5.4 Firestore / Storage を初期化する

Firestore Database と Cloud Storage バケットを作成する。  
バケットは `.env.example` に合わせ、`FIREBASE_STORAGE_BUCKET` で参照する。

## 5.5 Artifact Registry リポジトリを作成する

Cloud Run に渡す API コンテナを保存するため、Docker リポジトリを1つ作成する。

例:

```bash
gcloud artifacts repositories create handmade-sales-api \
  --repository-format=docker \
  --location=asia-northeast1 \
  --description="Handmade sales API images"
```

---

## 6. 環境変数の整理

## 6.1 ローカル開発用

`.env.example` をコピーして利用する。

```bash
cp .env.example .env
```

実リポジトリでは次のどちらかで運用する。

- ルート `.env`
- `apps/web/.env.local` と `apps/api/.env` に分割

## 6.2 代表的な設定値

### Web 側

- `VITE_API_BASE_URL`
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

### API 側

- `PORT`
- `API_BASE_PATH`
- `APP_OWNER_EMAIL`
- `CORS_ORIGIN`
- `GOOGLE_CLOUD_PROJECT`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_STORAGE_BUCKET`
- `SIGNED_URL_EXPIRES_MINUTES`
- `IMAGE_MAX_FILE_SIZE_MB`
- `IMAGE_MAX_COUNT_PER_PRODUCT`
- `IMAGE_DISPLAY_MAX_EDGE_PX`
- `IMAGE_THUMB_MAX_EDGE_PX`
- `IMAGE_OUTPUT_FORMAT`
- `IMAGE_DISPLAY_WEBP_QUALITY`
- `IMAGE_THUMB_WEBP_QUALITY`
- `PRODUCT_ID_PREFIX`
- `PRODUCT_ID_DIGITS`
- `PRODUCT_COUNTER_DOCUMENT_PATH`

## 6.3 ローカルだけで使う値

`GOOGLE_APPLICATION_CREDENTIALS` は**ローカル実行時のみ**使う前提とする。  
Cloud Run 本番ではサービスアカウント経由の Application Default Credentials を使うため、通常は不要。

## 6.4 本番反映時の注意

- シークレット値を Git に含めない
- Web 用公開値と API 用秘密値を混在させない
- `VITE_` 付き変数だけをフロントへ渡す
- Cloud Run には必要な値だけを環境変数として設定する

---

## 7. ローカル動作確認

本番反映前に、少なくとも次を通す。

```bash
npm install
npm run lint
npm run typecheck
npm run test
npm run build:web
```

以後、本書では **フロントのビルドコマンドを `npm run build:web` に統一**する。  
リポジトリ側で `npm run build` を全体ビルド用のラッパーとして用意している場合は併用してよいが、運用手順上の正本は `npm run build:web` とする。

## 7.1 Emulator を使う場合

本リポジトリの `firebase.json` では次のポートを前提とする。

- Auth: `9099`
- Firestore: `8081`
- Storage: `9199`
- Hosting: `5000`
- Emulator UI: `4000`

起動例:

```bash
firebase emulators:start --only auth,firestore,storage,hosting
```

補足:

- Firestore Emulator の一般的な既定ポートは `8080` だが、本プロジェクトでは API のローカルポートと衝突しないよう `8081` を採用している
- `singleProjectMode: true` のため、プロジェクトIDは統一する

## 7.2 ローカルAPIの認証

ローカルでも Firebase Authentication のIDトークン検証を行う。  
Web 側でログインし、API呼び出し時に `Authorization: Bearer {idToken}` を送ること。

---

## 8. Firebase リソースの反映

まず rules / indexes を反映する。

```bash
firebase deploy --only firestore:indexes,firestore:rules,storage
```

反映対象:

- `firebase/firestore.indexes.json`
- `firebase/firestore.rules`
- `firebase/storage.rules`

注意:

- `firestore.rules` と `storage.rules` は、クライアントSDKからの直接操作を許可しない設計である
- フロントから直接 Firestore / Storage を触る実装になっていると、この段階で破綻する

---

## 9. API を Cloud Run にデプロイする

## 9.1 前提

API は Node.js + TypeScript + Express をコンテナ化して Cloud Run へ配置する。  
MVPでは Cloud Run 自体は公開エンドポイントとして配置するが、**フロントからの呼び出し先は Firebase Hosting 経由の `/api` に統一**する。アプリケーションレベルでは Firebase ID Token による認証を強制する。

つまり:

- **Cloud Run は公開エンドポイントとして稼働する**
- **ブラウザからの通常アクセスは Hosting rewrite 経由で `/api` に集約する**
- **業務APIとしては認証必須**

という運用にする。

## 9.2 API イメージをビルドする

重要:

- 現在の `apps/api/Dockerfile` は、**リポジトリルートを build context とする前提**で `package*.json`、`apps/*`、`packages/shared` を `COPY` する
- そのため、`apps/api` を単独の source directory にすると build に失敗する
- workspace 基盤未作成の状態でも build に失敗するため、先に manifest / tsconfig を揃える
- Cloud Build / Docker / CI のいずれを使う場合も、**build context はリポジトリルート `.`** にする

ローカルでの確認例:

```bash
docker build -f apps/api/Dockerfile -t handmade-sales-api:local .
```

Cloud Build を使う場合も、上記と同等に「root context + `apps/api/Dockerfile`」で build する設定にすること。

## 9.3 Cloud Run へ初回デプロイする

例:

```bash
gcloud run deploy handmade-sales-api \
  --image asia-northeast1-docker.pkg.dev/your-project-id/handmade-sales-api/api:latest \
  --region asia-northeast1 \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars PORT=8080,API_BASE_PATH=/api,APP_OWNER_EMAIL=your-login-email@example.com,CORS_ORIGIN=https://your-project-id.web.app,GOOGLE_CLOUD_PROJECT=your-project-id,FIREBASE_PROJECT_ID=your-project-id,FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com,SIGNED_URL_EXPIRES_MINUTES=60,IMAGE_MAX_FILE_SIZE_MB=10,IMAGE_MAX_COUNT_PER_PRODUCT=10,IMAGE_DISPLAY_MAX_EDGE_PX=2000,IMAGE_THUMB_MAX_EDGE_PX=400,IMAGE_OUTPUT_FORMAT=webp,IMAGE_DISPLAY_WEBP_QUALITY=82,IMAGE_THUMB_WEBP_QUALITY=75,PRODUCT_ID_PREFIX=HM-,PRODUCT_ID_DIGITS=6,PRODUCT_COUNTER_DOCUMENT_PATH=counters/product
```

補足:

- `--allow-unauthenticated` は Hosting rewrite 経由およびヘルスチェック等で到達可能にするためであり、**アプリの業務認証を省略する意味ではない**
- 実際のアクセス制御は API 内の Firebase ID Token 検証で行う
- 単独利用を担保するため、API 内では `APP_OWNER_EMAIL` による allowlist 確認も行う
- `CORS_ORIGIN` は Hosting の公開URLまたはカスタムドメインに合わせる
- Cloud Run のサービスURL自体は運用確認や直接疎通確認に使うが、**Web アプリの `VITE_API_BASE_URL` には使わない**

## 9.4 Cloud Run のサービスアカウント

推奨:

- 専用サービスアカウントを作成する
- Firestore / Storage に必要な最小権限だけを付与する
- デフォルトサービスアカウントへの過剰権限付与を避ける

MVPではまずデプロイ優先で進めてもよいが、本番利用前には専用サービスアカウントへ切り替える。

## 9.5 デプロイ後に確認すること

- Cloud Run の URL が払い出されていること
- `GET /api/health` などのヘルスチェック相当が通ること
- 認証なしで業務APIを叩いた場合、401/403 が返ること
- 認証ありで一覧取得などの主要APIが正常応答すること
- `APP_OWNER_EMAIL` と一致しないユーザーでは 403 になること
- Storage signed URL が API レスポンス経由で生成されること

---

## 10. Web を Firebase Hosting にデプロイする

## 10.1 Web 用環境変数を本番値に切り替える

少なくとも次を本番値へ置き換える。

- `VITE_API_BASE_URL=/api`
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

## 10.2 フロントをビルドする

```bash
npm run build:web
```

ビルド成果物は `firebase.json` の設定どおり、`apps/web/dist` に出力される前提とする。

## 10.3 Hosting へデプロイする

```bash
firebase deploy --only hosting
```

`firebase.json` では少なくとも次の2系統の rewrite が必要である。

- SPA 画面用: 深いURLでも `/index.html` に rewrite する
- API 用: `/api/**` を Cloud Run サービスへ rewrite する

これにより、ブラウザからは同一オリジンの `/api` として API を呼び出せる。

## 10.4 デプロイ後に確認すること

- Hosting の公開URLにアクセスできること
- ログイン画面が表示されること
- ログイン成功後にダッシュボードへ遷移すること
- 商品一覧 / 詳細 / 編集 / 画像操作 / カテゴリ / タグ / タスク / QR の主要画面が動くこと
- API 呼び出し先が同一オリジンの `/api` になっていること
- `firebase.json` の `/api/**` rewrite が意図した Cloud Run サービスを向いていること

---

## 11. 本番公開時の確認チェックリスト

公開前に最低限、次を確認する。

### 11.1 認証

- Email/Password ログインができる
- 未ログイン時に保護画面へ直接入れない
- ログアウトできる
- パスワード再設定メールが送れる

### 11.2 商品管理

- 商品登録ができる
- `HM-000001` 形式で採番される
- 商品編集ができる
- 論理削除ができる
- 論理削除済み商品が通常一覧・通常詳細から見えない

### 11.3 画像

- JPEG / PNG / WebP を受け付ける
- WebP 変換後に保存される
- `products/{productId}/display/{imageId}.webp`
- `products/{productId}/thumb/{imageId}.webp`
  の保存パス規約に従っている
- 期限付きURLで表示される

### 11.4 QR販売更新

- 展示中 / 在庫中のみ販売済更新できる
- 販売済は重複更新されない
- 制作前 / 制作中 / 制作済はQR販売更新不可になる

### 11.5 運用基本

- Cloud Run ログで主要エラーを追跡できる
- operationLogs に主要イベントが残る
- CORS 設定が本番ドメインと一致している

---

## 12. 更新デプロイ手順

日常的な更新は次の順でよい。

1. 実装変更
2. `lint` / `typecheck` / `test` / `build:web` 実行
3. 必要なら `firebase deploy --only firestore:indexes,firestore:rules,storage`
4. API イメージ再ビルド
5. Cloud Run に新リビジョンをデプロイ
6. Web を再ビルド
7. `firebase deploy --only hosting`
8. 動作確認

API 契約変更を含む場合は、**先に API を更新し、その後フロントを反映**する。

---

## 13. ロールバック方針

MVPでは高度な自動化は行わず、まずは手動ロールバック前提とする。

### 13.1 Hosting

- 前回ビルド成果物に戻して再デプロイする
- 重大障害時は直前の安定コミットで `build:web` → `firebase deploy --only hosting` を実施する

### 13.2 Cloud Run

- 直前の安定コンテナイメージを再デプロイする
- または Cloud Run の既存リビジョンへトラフィックを戻す

### 13.3 rules / indexes

- Git 管理している安定版 JSON / rules を再デプロイする

---

## 14. セキュリティ上の注意

- サービスアカウント JSON をリポジトリに置かない
- 本番シークレットを `.env.example` に書かない
- フロントに秘密値を埋め込まない
- Cloud Run では最小権限サービスアカウントを使う
- Firestore / Storage は API 経由前提のため、クライアント直接アクセス設計に戻さない

---

## 15. この文書の対象外

次は別文書で定義する。

- Firestore / Cloud Storage のバックアップ / 復旧手順
- Cloud Logging / Error Reporting の詳細運用
- CI/CD パイプライン自動化
- 複数環境（stg / prod）の厳密分離
- カスタムドメイン運用

バックアップ / 復旧については、別途 `docs/backup-and-restore.md` で定義する。

---

## 16. 最小実行コマンドまとめ

### Firebase ルール / インデックス反映

```bash
firebase deploy --only firestore:indexes,firestore:rules,storage
```

### Emulator 起動

```bash
firebase emulators:start --only auth,firestore,storage,hosting
```

### API ビルド & push

```bash
docker build -f apps/api/Dockerfile \
  -t asia-northeast1-docker.pkg.dev/your-project-id/handmade-sales-api/api:latest \
  .
```

### Cloud Run デプロイ

```bash
gcloud run deploy handmade-sales-api \
  --image asia-northeast1-docker.pkg.dev/your-project-id/handmade-sales-api/api:latest \
  --region asia-northeast1 \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars PORT=8080,API_BASE_PATH=/api,APP_OWNER_EMAIL=your-login-email@example.com,CORS_ORIGIN=https://your-project-id.web.app,GOOGLE_CLOUD_PROJECT=your-project-id,FIREBASE_PROJECT_ID=your-project-id,FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com,SIGNED_URL_EXPIRES_MINUTES=60,IMAGE_MAX_FILE_SIZE_MB=10,IMAGE_MAX_COUNT_PER_PRODUCT=10,IMAGE_DISPLAY_MAX_EDGE_PX=2000,IMAGE_THUMB_MAX_EDGE_PX=400,IMAGE_OUTPUT_FORMAT=webp,IMAGE_DISPLAY_WEBP_QUALITY=82,IMAGE_THUMB_WEBP_QUALITY=75,PRODUCT_ID_PREFIX=HM-,PRODUCT_ID_DIGITS=6,PRODUCT_COUNTER_DOCUMENT_PATH=counters/product
```

### Web ビルド

```bash
npm run build:web
```

### Hosting デプロイ

```bash
firebase deploy --only hosting
```
