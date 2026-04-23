# 実装補足メモ（implementation-notes）

## 1. 目的

本書は、設計書群で未確定または実装時に迷いやすい事項について、**MVP実装の既定判断**を固定するための補足文書である。  
Codex / 生成AI / 開発者は、実装時に本書を参照し、不要な解釈差分や過剰実装を避けること。

本書で定めた内容は、`AGENTS.md` の「既定の実装判断」を補強する。  
仕様衝突時の優先順位は次のとおりとする。

1. `docs/requirements.md`
2. `docs/basic_design.md`
3. `docs/detail_design.md`
4. `docs/api_specification.md`
5. `docs/data_design.md`
6. `docs/screen_design.md`
7. 本書 `docs/implementation-notes.md`

ただし、本書は**未確定事項を埋めるための実装判断書**として扱い、上位設計書に矛盾しない範囲で適用する。

---

## 2. この文書で固定する事項

本書では主に次を固定する。

- フロント状態管理の具体方針
- QRコード生成 / 読み取りライブラリ
- 画像変換の詳細ルール
- 画像ID・Storage保存パス・URL再取得方針
- Firestoreインデックス運用の基準
- エラーメッセージ実装の最低方針
- operationLogs の記録範囲と保持方針
- 実装時に採用する最小ディレクトリ / モジュール構成

---

## 3. 実装全体の基本判断

### 3.1 実装単位

MVPでは、次の単位で機能を分けて実装する。

```text
/apps
  /web
  /api
/packages
  /shared
/docs
/firebase
```

- `apps/web`: React + Vite のフロントエンド
- `apps/api`: Express + TypeScript のAPI
- `packages/shared`: 型、zod schema、定数、ステータス、API契約補助
- `docs`: 補足設計、実装メモ、運用メモ
- `firebase`: rules / indexes / Firebase設定

### 3.2 Firebaseへのアクセス方針

- **フロントから Firestore / Storage へ直接アクセスしない**
- フロントからの業務データ取得・更新はすべて Cloud Run の API 経由とする
- Firebase Authentication はフロントで利用する
- Firestore / Storage の rules は、クライアントSDKからの直接 read/write を許可しない前提で運用する

### 3.3 用語の固定

- 画面・API・DB・ログで用語を統一する
- 商品ステータス内部値は以下で固定する

```text
beforeProduction
inProduction
completed
onDisplay
inStock
sold
```

### 3.3.1 顧客項目名の固定

顧客関連の内部項目名は次で固定する。

- `gender`: 性別
- `ageGroup`: 年代
- `customerStyle`: 系統メモ
- `snsAccounts`: SNSアカウント一覧
- `memo`: 顧客メモ
- `isArchived`: アーカイブフラグ

補足:
- UIラベルは「年代」「系統メモ」を用いる
- `ageRange`、`styleTags` などの別名はMVPでは採用しない

---

## 4. フロントエンド実装方針

## 4.1 状態管理

状態管理は以下で固定する。

- サーバー状態: **TanStack Query**
- フォーム状態: **React Hook Form + Zod**
- 画面ローカル状態: `useState` / `useMemo` / `useReducer` の範囲で扱う
- グローバル状態: 認証情報と最小限のUI状態のみ

### 4.1.1 グローバル状態に置いてよいもの

- ログインユーザー情報
- 共通トーストやダイアログの表示要求
- レイアウトレベルの UI 状態

### 4.1.2 グローバル状態に置かないもの

- 商品一覧の絞り込み条件
- 商品編集フォームの入力値
- ダッシュボード取得結果
- 商品詳細取得結果
- QR読取結果の永続保持

### 4.1.3 一覧条件の保持方法

商品一覧の検索条件は **URLクエリ文字列** で保持する。

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

理由:

- リロードや戻る操作で状態を復元しやすい
- TanStack Query の queryKey と整合しやすい
- グローバルストアを不要に増やさずに済む

補足:

- ログアウト時は一覧条件を復元対象外とする
- 再ログイン後はダッシュボードを初期画面とし、商品一覧へ遷移した場合も初期条件から開始する
- URLに過去のクエリが残っていても、ログアウト直後の再ログインではその条件を自動復元しない

### 4.1.4 Query Key の基本

以下のような queryKey で統一する。

```text
['auth', 'me']
['dashboard']
['products', 'list', filters]
['products', 'detail', productId]
['products', 'tasks', productId, showCompleted]
['categories', 'list']
['tags', 'list']
['customers', 'list', filters]
['customers', 'detail', customerId]
['customers', 'purchases', customerId]
```

## 4.2 ルーティング

ルーティングは以下で固定する。

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
/customers
/customers/new
/customers/:customerId
/customers/:customerId/edit
/qr
```

商品詳細画面から QR 読み取り画面へ遷移する場合も、専用ルートは `/qr` を利用し、必要な表示文脈はクエリまたは遷移stateで渡す。

## 4.3 UI実装方針

- モバイルファースト
- 主要ボタンは親指で押しやすいサイズを優先
- 一覧 / 詳細 / フォーム / ダイアログの4系統で共通部品を寄せる
- UIライブラリ依存は最小限にし、MVPでは過度なデザインシステム構築を行わない

## 4.4 認証ガード

- 未ログイン時に保護画面へ入った場合は `/login` へ遷移
- 401 受信時は、トークン失効を考慮してログイン導線へ戻す
- 403 受信時は「この操作は実行できません。」を表示し、`/login` へ遷移する

---

## 5. QRコード実装方針

## 5.1 QRコード生成

QRコード生成ライブラリは **`qrcode`** を採用する。

方針:

- 商品詳細画面で `qrCodeValue` から QR を生成する
- 生成方式は **SVG または Data URL** のどちらでもよいが、MVPでは取り回ししやすい SVG 優先とする
- QR画像そのものを永続保存しない
- QRの内容は MVP では `productId` と同値の `qrCodeValue` を用いる

## 5.2 QRコード読み取り

QR読み取りライブラリは **`html5-qrcode`** を採用する。

方針:

- ライブラリは画面コンポーネントへ直接埋め込まず、`qrScannerAdapter` で薄く包む
- スキャン成功時は即座に `POST /api/qr/lookup` を呼ぶ
- 読み取り中の多重呼び出しを防ぐため、lookup 実行中は新規スキャン受付を一時停止する
- エラーまたはキャンセル後は、明示的に再試行操作でスキャン状態へ戻す

## 5.3 QR結果画面の扱い

- `canSell=true` のときのみ販売済更新確認へ進める
- `canSell=false` のときは `reasonCode` とメッセージを表示し、更新ボタンは非活性または非表示とする
- `POST /api/qr/sell` 実行中は確定 / キャンセルともに押下不可にする

---

## 5.4 顧客紐付け実装方針

- 商品編集画面では `status=sold` のときのみ購入者選択UIを表示する
- QR販売済更新画面では購入者選択は任意とし、未選択でも更新できる
- 購入者選択UIは未アーカイブ顧客のみ候補表示する
- 販売済更新時に `soldCustomerId` を保存した場合は、あわせて `soldCustomerNameSnapshot` を更新する
- 顧客別購入履歴は `products` コレクションから導出し、別の `sales` コレクションは作成しない

## 6. 画像アップロード・変換方針

## 6.1 アップロード受付

APIは `multipart/form-data` を受け付ける。  
画像APIの `file` フィールド名は **`file`** で固定する。

- 対応形式: JPEG / PNG / WebP
- 最大サイズ: 10MB
- 1商品あたり最大10枚

## 6.2 一時ファイル方針

MVPでは **メモリ上で処理**する。

- `multer` は `memoryStorage` を利用する
- 画像をローカル一時ファイルへ長時間保持しない
- 変換完了後、Cloud Storage に直接保存する

## 6.3 画像変換ライブラリ

画像変換は API 側で **`sharp`** を使用する。

## 6.4 変換ルール

以下を既定値とする。

### 表示用画像

- 出力形式: WebP
- 長辺最大: 2000px
- 品質: `82`
- Exif向き情報は `rotate()` で補正する

### サムネイル画像

- 出力形式: WebP
- 長辺最大: 400px
- 品質: `75`
- 一覧表示前提のため軽量性を優先する

### 共通

- 元画像は保持しない
- 画像差し替え時は `imageId` と `sortOrder` を維持し、実体のみ更新する
- 画像削除時は残画像の `sortOrder` を `1` から詰め直す
- 代表画像削除時は残画像のうち `sortOrder` 最小を代表扱いとする

## 6.5 画像ID方針

`imageId` は次の形式で採番する。

```text
img_{12〜16文字程度の英数字}
```

実装方針:

- `randomUUID()` を利用して生成してよい
- ハイフン除去後の一部を使ってよい
- **商品内一意** を満たせばよい

推奨例:

```text
img_f3a82c10d9ab
```

## 6.6 Storage保存パス

保存パスは次で固定する。

```text
products/{productId}/display/{imageId}.webp
products/{productId}/thumb/{imageId}.webp
```

補足:

- `thumb` を正式採用し、`thumbnail` ディレクトリ名は使わない
- `displayPath` / `thumbnailPath` を Firestore に永続保存する
- `displayUrl` / `thumbnailUrl` は永続保存しない

## 6.7 期限付きURL

- 取得系APIでのみ生成する
- 有効期限は **60分** を既定値とする
- URL失効後は `GET /api/products/:productId` や一覧APIの再取得で更新する
- 画像追加 / 差し替え / 削除 API は期限付きURLを返さない

## 6.8 プレースホルダー画像

MVPではローカル静的アセットを使用する。

推奨配置:

```text
apps/web/src/assets/product-placeholder.svg
```

---

## 7. API / バックエンド実装方針

## 7.1 レイヤ分割

最低限、以下の責務で分割する。

```text
routes
controllers
services
repositories
validators
middlewares
mappers
utils
```

### 禁止事項

- route に業務ロジックを直接書く
- controller から Firestore を直接触る
- repository で HTTP レスポンス形式を組み立てる

## 7.2 バリデーション

- リクエストバリデーションは Zod で統一する
- multipart/form-data でもメタ情報は明示的に検証する
- エラー応答は `code` / `message` / `details` の形式を守る

## 7.3 エラーマッピング

API内部例外は、最終的に以下へ寄せる。

- 業務エラー: 400 / 404 に整理する
- 認証エラー: 401 / 403
- 想定外障害: 500 + `INTERNAL_ERROR`

`409 Conflict` 相当の競合・重複に見えるケースも、MVPでは専用の HTTP 409 を新設しない。  
設計書どおり、内容に応じて **400 系または 404** へ寄せる。

## 7.4 認証

- Firebase Admin SDK で ID Token を検証する
- 単独利用を担保するため、MVP では `APP_OWNER_EMAIL` と `decodedToken.email` の一致を確認する
- `APP_OWNER_EMAIL` と一致しない、またはメールアドレスを取得できない場合は `AUTH_FORBIDDEN` を返す
- 認証ユーザーは単独利用前提だが、API側では毎回認証と allowlist 確認を実施する
- `actorUid` は operationLogs に転記できるよう request context に保持する

---

## 8. Firestore / 検索 / インデックス方針

## 8.1 Firestoreインデックスの正本

複合インデックス定義の正本は以下とする。

- `firebase/firestore.indexes.json`

ルートに同名ファイルがある場合も、**運用上の正本は `firebase/` 配下**とする。

## 8.2 商品一覧検索

MVPでは次の考え方で実装する。

- `isDeleted=false` は前段で必須適用
- `categoryId` / `tagId` / `status` は Firestore で先行絞り込みする
- `keyword` は API 層で後段フィルタする
- 並び順既定は `updatedAt desc`

## 8.3 キーワード正規化

キーワード検索の正規化は、フロント・APIで同じ関数群を共有する。

最低限実施すること:

- 前後空白除去
- 連続空白を単一空白相当に正規化
- 英字の大小無視
- 全角 / 半角差の吸収を可能な範囲で実施
- 空文字のみは未指定扱い

ひらがな / カタカナの相互吸収は **MVPでは未対応** とする。

## 8.4 ソート

商品一覧のソート条件は MVP では次に限定する。

- `updatedAt desc`
- `updatedAt asc`
- `name asc`
- `name desc`

その他の複雑な複合ソートは導入しない。

---

## 9. operationLogs 方針

## 9.1 MVPで記録するイベント

`operationLogs` には少なくとも以下を記録する。

- `LOGIN`
- `PRODUCT_UPDATED`
- `PRODUCT_DELETED`
- `CUSTOMER_UPDATED`
- `CUSTOMER_ARCHIVED`
- `QR_SOLD`
- `ERROR`

補足:

- `LOGIN` は Firebase Authentication 成功直後に、フロントから認証済み API `POST /api/auth/login-record` を呼んで記録する
- Firebase 認証失敗そのものは、MVP の `operationLogs` 記録対象に含めない

## 9.2 ログ出力項目

原則として以下を記録する。

- `eventType`
- `targetId`
- `summary`
- `actorUid`
- `createdAt`
- `detail`

補足:

- `LOGIN` は `targetId=null`, `summary=ログインしました`, `detail.result=success` を基本とする
- `detail` には原因調査や変更把握に必要な最小限の情報だけを入れる
- `detail` にメールアドレス、ID トークン、画像バイナリなど不要な個人情報や大型データは含めない

## 9.3 detail に含めてよいもの

- changedFields
- previousStatus / newStatus
- requestPath
- errorCode
- imageCount などの補助情報

## 9.4 detail に含めないもの

- パスワード
- 生の Firebase ID Token
- 不要な個人情報
- 画像バイナリ

## 9.5 保持方針

MVPでは **operationLogs の自動削除は実装しない**。

- 保持期間は **無期限** とする
- TTL や定期クリーンアップジョブは MVP 対象外とする
- 単独利用・小規模件数を前提に、まずは障害調査性を優先する

---

## 10. エラーメッセージ実装方針

## 10.1 方針

画面表示用エラーメッセージの**正本は `docs/error-messages.md`** とする。  
本書では実装時の参照を容易にするため、最低限の共通マッピングのみを再掲する。  
文言を更新する場合は **`docs/error-messages.md` を先に修正** し、本書は必要に応じて追随する。

## 10.2 フロント共通マッピング

以下を既定値とする。

| code | 既定メッセージ |
|---|---|
| `AUTH_REQUIRED` | セッションが切れました。再度ログインしてください。 |
| `AUTH_FORBIDDEN` | この操作は実行できません。 |
| `VALIDATION_ERROR` | 入力内容を確認してください。 |
| `PRODUCT_NOT_FOUND` | 対象の商品が見つかりません。 |
| `PRODUCT_DELETED` | 対象の商品はすでに利用できません。 |
| `PRODUCT_RELATED_RESOURCE_UNAVAILABLE` | この商品の関連情報は表示できません。 |
| `CATEGORY_NOT_FOUND` | 指定したカテゴリが見つかりません。 |
| `TAG_NOT_FOUND` | 指定したタグが見つかりません。 |
| `TASK_NOT_FOUND` | 対象のタスクが見つかりません。 |
| `CATEGORY_IN_USE` | 使用中のカテゴリは削除できません。 |
| `TAG_IN_USE` | 使用中のタグは削除できません。 |
| `DUPLICATE_NAME` | 同じ名前は登録できません。 |
| `IMAGE_LIMIT_EXCEEDED` | 画像は最大10枚まで登録できます。 |
| `UNSUPPORTED_IMAGE_TYPE` | JPEG、PNG、WebP 形式の画像を選択してください。 |
| `IMAGE_TOO_LARGE` | 画像サイズが大きすぎます。10MB以下の画像を選択してください。 |
| `IMAGE_NOT_FOUND` | 対象の画像が見つかりません。最新の情報を読み込み直してください。 |
| `INVALID_STATUS_FOR_QR_SELL` | このステータスの商品はQRで販売済に更新できません。 |
| `ALREADY_SOLD` | この商品はすでに販売済みです。 |
| `INTERNAL_ERROR` | 予期しないエラーが発生しました。時間をおいて再度お試しください。 |

## 10.3 details の扱い

- `details` がある場合は、可能な限り項目単位エラー表示に使う
- `details` が無い場合は共通メッセージを表示する
- 項目単位エラーと画面上部の共通エラーを重複表示しすぎない

## 10.4 再試行導線

通信失敗や `INTERNAL_ERROR` は、可能な限り再試行導線を出す。

対象:

- ダッシュボード
- 商品一覧
- 商品詳細
- タスク一覧
- カテゴリ / タグ一覧
- QR lookup / sell

---

## 11. 共通ユーティリティ方針

## 11.1 packages/shared に置くもの

- ステータス定数
- API共通型
- Zod schema の共有可能部分
- 文字列正規化関数
- 日付 / 日時フォーマット定数
- エラーコード定数

## 11.2 web 側の utils

- 認証トークン付与済み fetch client
- API エラー変換
- 画面文言マッピング
- 画像URL失効時の再取得補助

## 11.3 api 側の utils

- Firebase Admin 初期化
- Storage signed URL 生成
- image 変換ユーティリティ
- operationLogs 書き込みユーティリティ
  - `writeOperationLog` を共通 util として用意し、`eventType` / `targetId` / `summary` / `actorUid` / `createdAt` / `detail` を一元化する
  - `logId` は util 側で生成し、保存先は `operationLogs/{logId}` に統一する

---

## 12. 実装時の非対象・禁止事項

以下は MVP で行わない。

- Redux など大規模状態管理ライブラリの導入
- フロントからの Firestore / Storage 直接操作
- 元画像の保存
- 画像一括アップロード
- 画像並び替えUI
- QRコード画像の永続保存
- ステータス履歴の本格管理
- 自動ログ削除バッチ
- 複数ユーザー前提の権限設計

---

## 13. 実装着手順の推奨

実装開始時は以下の順を推奨する。

1. `packages/shared` に定数・型・schema を作る
2. `apps/api` に認証、共通エラーハンドリング、health相当の土台を作る
3. 商品一覧 / 商品詳細 / 商品登録更新 API を作る
4. `apps/web` にログイン、認証ガード、レイアウトを作る
5. 商品一覧 → 詳細 → 登録/編集の順で画面をつなぐ
6. 画像APIを実装する
7. タスク、カテゴリ、タグを追加する
8. ダッシュボードを実装する
9. QR lookup / sell を実装する
10. operationLogs と主要テストを補強する

---

## 14. 最終判断ルール

本書に記載がない事項で迷った場合は、以下の順で判断する。

1. 設計書に明記されている最小要件を満たす
2. API / データ / UI の責務境界を壊さない
3. MVP外の拡張を入れない
4. 複雑さの少ない実装を選ぶ
5. 判断内容を別ドキュメントに残してから進める

---

## 15. 依存脆弱性運用メモ

### 15.1 2026年4月11日時点の監査前提

- 監査はルート `package-lock.json` を生成したうえで実施する
- 確認コマンドは `npm audit` と `npm audit --omit=dev` を使う
- この時点の結果は **全体 13 件（low 8, moderate 5）**、**prod 依存のみでは low 8 / high・critical 0** である

### 15.2 dev-only 脆弱性の扱い

- moderate は主に `vite` / `vitest` / `vite-node` / `@vitest/mocker` / `esbuild` に由来する
- これは開発サーバーとテスト実行系の依存であり、Cloud Run 本番 API や Firebase Hosting 配信物の実行時依存とは切り分けて扱う
- ただし、**Vite dev server を外部公開しない** ことを運用条件とする
- Docker / ローカル起動を含め、開発用途のサーバーは localhost または閉域ネットワーク内に限定する
- `npm audit fix --force` による一括更新は、`vite@8` や `vitest@4` へのメジャー更新を伴うため、別タスクで検証してから実施する

### 15.3 prod-low 許容判断

- prod 側に残る low は `firebase-admin@13.8.0` 配下の推移依存（`@google-cloud/firestore`, `@google-cloud/storage`, `teeny-request`, `retry-request`, `http-proxy-agent`, `@tootallnate/once` など）に由来する
- 2026年4月11日時点では、`npm audit` が提示する自動修正案は **`firebase-admin@10.3.0` へのダウングレード** であり、これは破壊的変更かつ最新版より後退するため採用しない
- 現時点では **high / critical が無いこと、prod 側は low のみであること、非破壊な自動修正手段が無いこと** を根拠に、MVP 開発中は許容とする
- ただし、許容は恒久対応ではなく、次の条件で再評価する
  - `firebase-admin` または配下依存に非破壊更新が出たとき
  - severity が moderate 以上へ上がったとき
  - リリース前確認で `npm audit` の結果が変化したとき

### 15.4 運用ルール

- `package-lock.json` は監査と再現性のため管理対象に含める
- `npm audit fix --force` は、メジャー更新やダウングレードの影響を設計・テストで確認する前には実行しない
- リリース前には `REL-01` の一部として `npm audit` と `npm audit --omit=dev` を再実行し、結果を記録する

---

## 16. フロントビルド警告メモ

### 16.1 2026年4月13日時点の状況

- `npm run build:web` および `npm run ci` 実行時に、Vite から
  `Some chunks are larger than 500 kB after minification` の警告が出る
- 現時点では **ビルド失敗ではなく警告のみ** であり、MVP 開発継続を止める条件とはしない
- ただし、モバイル環境を含む初回表示性能には影響しうるため、**技術負債として管理する**

### 16.2 現時点の判断

- 2026年4月13日時点では、機能開発を優先し **警告は許容** とする
- 単に `chunkSizeWarningLimit` を上げて警告だけを消す対応は行わない
- パフォーマンス対策としては、まず **route 単位の dynamic import による code splitting** を優先検討する
- 必要に応じて `build.rollupOptions.output.manualChunks` を追加する

### 16.3 再評価タイミング

- 画面数や依存ライブラリが増えて、bundle size がさらに拡大したとき
- 体感性能、Lighthouse、または実機確認で初回表示の遅さが問題になったとき
- `REL-01` のリリース前確認で Web 配信物サイズを見直すとき

