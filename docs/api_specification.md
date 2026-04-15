# ハンドメイド在庫・販売管理アプリ API仕様書

## 1. 文書概要

### 1.1 目的
本書は、ハンドメイド在庫・販売管理アプリのMVPで利用するAPIの仕様を定義する。
要件定義書・基本設計書・詳細設計書をもとに、実装者とテスト担当者が共通認識を持てるよう、エンドポイント、入出力、業務ルール、エラー仕様をAPI単位で整理する。

### 1.2 対象範囲
MVPで対象とするAPIは以下とする。

- ヘルスチェック（運用確認用）
- ダッシュボード
- 商品一覧 / 登録 / 詳細 / 更新 / 論理削除
- 商品画像追加 / 差し替え / 削除
- タスク一覧 / 登録 / 更新 / 完了切替 / 削除
- カテゴリ一覧 / 登録 / 更新 / 削除
- タグ一覧 / 登録 / 更新 / 削除
- QRコード読取結果照会 / 販売済更新

### 1.3 前提
- 利用者はアプリ利用者本人のみ
- 認証は Firebase Authentication を利用する
- API は Express on Cloud Run で提供する
- データは Firestore、画像は Cloud Storage に保存する
- 商品は一点物であり、数量在庫は持たない
- 商品削除は論理削除、タスク・カテゴリ・タグ削除は物理削除とする
- API はトークン検証後、MVPでは `APP_OWNER_EMAIL` と一致するメールアドレスのみ許可する

---

## 2. API共通仕様

### 2.1 ベースパス
```text
/api
```

### 2.2 通信方式
- プロトコル: HTTPS
- データ形式: JSON
- 文字コード: UTF-8
- 画像アップロード系: `multipart/form-data`

### 2.3 認証
- 業務APIは認証必須とする
- `GET /api/health` は運用確認用のため認証不要とする
- API はトークン検証後、MVPでは `APP_OWNER_EMAIL` と一致するメールアドレスのみ許可し、不一致は `403` を返す

#### リクエストヘッダ
```http
Authorization: Bearer {Firebase ID Token}
```

### 2.4 正常時HTTPステータス
| メソッド / 用途 | ステータス |
|---|---|
| GET | 200 OK |
| POST（新規作成） | 201 Created |
| POST（照会・状態更新などの非作成処理） | 200 OK |
| PUT | 200 OK |
| PATCH | 200 OK |
| DELETE | 200 OK |

- 本書では、**新しいリソースを作成するPOST**に `201 Created` を適用する
- **照会・判定・状態更新などのアクション系POST** は `200 OK` を適用する
- 個別APIで明記がある場合は、個別APIの記載を優先する

### 2.5 共通レスポンス形式

#### 正常系
```json
{
  "data": {},
  "meta": {}
}
```

- `meta` はページングを行う一覧APIでのみ返却する
- MVPで `meta` を返すのは `GET /api/products` のみとする
- ページングしない一覧APIは `data.items` のみ返し、`meta` は省略可とする

#### エラー系
```json
{
  "code": "VALIDATION_ERROR",
  "message": "入力内容を確認してください。",
  "details": [
    {
      "field": "name",
      "message": "商品名を入力してください。"
    }
  ]
}
```

- `code`: エラーコード
- `message`: 利用者向けまたは共通処理向けメッセージ
- `details`: 項目単位エラーがある場合のみ返却

### 2.6 日時仕様
- 保存時: UTC Timestamp
- レスポンス時: ISO 8601文字列
- 画面表示時: JSTへ変換
- 表示形式
  - 日時: `YYYY/MM/DD HH:mm`
  - 日付: `YYYY/MM/DD`

### 2.7 論理削除方針
- 商品は `isDeleted=true` により論理削除する
- 論理削除済み商品は通常APIの参照対象外とする
- 論理削除済み商品に紐づく画像・タスクは保持するが、通常APIでは参照不可とする
- 論理削除済み商品に対する通常参照系APIは HTTP 404 を返す
- ただし `POST /api/qr/lookup` は読取結果照会APIのため例外とし、未登録商品・論理削除済み商品も HTTP 200 で `reasonCode` により返却する

### 2.8 入力値・正規化方針
APIで扱う文字列入力には以下の共通ルールを適用する。個別APIに追加記載がある場合は、その記載を優先する。

#### 2.8.1 名称系項目
対象: `name`（商品名 / タスク名 / カテゴリ名 / タグ名）

- 保存前に前後空白を除去する
- 前後空白除去後に空文字または空白のみとなる値は不可とする
- 改行不可
- タブ不可
- システム上の制御文字や表示崩れを招く不正文字列は入力不可または無害化して保存する
- 最大文字数は各APIの項目定義に従う

#### 2.8.2 複数行テキスト項目
対象: `description`, `content`, `memo`

- 改行を許容する
- 改行コードは保存時に LF に正規化する
- システム上の制御文字や表示崩れを招く不正文字列は入力不可または無害化して保存する
- 最大文字数は各APIの項目定義に従う

#### 2.8.3 検索キーワード
キーワード検索では以下を適用する。

- 検索キーワードは最大100文字とする
- 前後空白を除去する
- 連続空白を単一空白相当として扱う
- 改行不可
- タブ不可
- システム上の制御文字や表示崩れを招く不正文字列は入力不可または無害化して扱う
- 英字は大文字・小文字を区別しない
- 英数字および記号の全角/半角差は可能な範囲で吸収する
- ひらがな/カタカナは別文字として扱う
- 空文字のみはキーワード未指定として扱う

### 2.9 画像URL方針
- `displayUrl` / `thumbnailUrl` は永続保存しない
- 取得系APIのレスポンス生成時に `displayPath` / `thumbnailPath` から期限付きURLとして生成する
- 既定有効期限は60分とする
- 期限切れ時は対象の取得系APIを再取得して最新URLを受け取る

### 2.10 ステータスコード
| 表示名 | 内部コード |
|---|---|
| 制作前 | `beforeProduction` |
| 制作中 | `inProduction` |
| 制作済 | `completed` |
| 展示中 | `onDisplay` |
| 在庫中 | `inStock` |
| 販売済 | `sold` |

- APIのリクエスト / レスポンスでは内部コードを使用する
- 画面表示ラベル（例: 「展示中」）はUI側で変換する

---

## 3. エラーコード一覧

| エラーコード | HTTP | 説明 |
|---|---:|---|
| `AUTH_REQUIRED` | 401 | 認証が必要、またはセッション切れ |
| `AUTH_FORBIDDEN` | 403 | 認証済みだが利用不可（`APP_OWNER_EMAIL` 不一致を含む） |
| `VALIDATION_ERROR` | 400 | 入力不正 |
| `PRODUCT_NOT_FOUND` | 404 | 商品が存在しない |
| `PRODUCT_DELETED` | 404 | 論理削除済み商品 |
| `PRODUCT_RELATED_RESOURCE_UNAVAILABLE` | 404 | 論理削除済み商品の関連情報参照不可 |
| `CATEGORY_NOT_FOUND` | 400 / 404 | `POST /api/products` / `PUT /api/products/:productId` では指定カテゴリ未存在のため `400`。`PUT /api/categories/:categoryId` / `DELETE /api/categories/:categoryId` では対象カテゴリ未存在のため `404` |
| `TAG_NOT_FOUND` | 400 / 404 | `POST /api/products` / `PUT /api/products/:productId` では指定タグ未存在のため `400`。`PUT /api/tags/:tagId` / `DELETE /api/tags/:tagId` では対象タグ未存在のため `404` |
| `TASK_NOT_FOUND` | 404 | タスクが存在しない |
| `CATEGORY_IN_USE` | 400 | 使用中カテゴリのため削除不可 |
| `TAG_IN_USE` | 400 | 使用中タグのため削除不可 |
| `DUPLICATE_NAME` | 400 | 同名カテゴリ/タグが存在する |
| `IMAGE_LIMIT_EXCEEDED` | 400 | 画像上限超過 |
| `UNSUPPORTED_IMAGE_TYPE` | 400 | 非対応画像形式 |
| `IMAGE_TOO_LARGE` | 400 | 画像サイズ超過 |
| `IMAGE_NOT_FOUND` | 404 | 画像が存在しない |
| `INVALID_STATUS_FOR_QR_SELL` | 400 | QR販売更新不可ステータス |
| `ALREADY_SOLD` | 400 | 既に販売済 |
| `INTERNAL_ERROR` | 500 | 想定外障害 |

---

## 4. 認証・セッション

### 4.1 認証方式
- Firebase Authentication のメールアドレス + パスワード認証を利用する
- フロントエンドは Firebase SDK で認証し、取得した ID トークンを API に付与する
- API はトークンを検証し、認証済み要求のみ処理する
- API はトークン検証後、MVPでは `APP_OWNER_EMAIL` と一致するメールアドレスのみ許可し、不一致時は `AUTH_FORBIDDEN` を返す

### 4.2 認証エラー時のレスポンス例

#### 401 Unauthorized
```json
{
  "code": "AUTH_REQUIRED",
  "message": "認証が必要です。"
}
```

#### 403 Forbidden
```json
{
  "code": "AUTH_FORBIDDEN",
  "message": "この操作は実行できません。"
}
```

### 4.3 POST /api/auth/login-record

### 概要
Firebase Authentication による本人認証成功後、`operationLogs` に `LOGIN` を1件記録する。

### 認証
必須

### 正常時HTTPステータス
`201 Created`

### リクエストボディ
なし

### 業務ルール
- フロントは `signInWithEmailAndPassword` 成功後、ID トークン取得後に本 API を 1 回呼ぶ
- 本 API は認証済みかつ allowlist 一致の要求のみ受け付ける
- 成功時は `operationLogs` に `eventType=LOGIN`, `targetId=null`, `summary=ログインしました`, `actorUid=<認証ユーザーUID>`, `detail.result=success` を記録する
- 本 API 自体は Firebase 認証失敗を記録対象にしない
- MVP では重複抑止を行わず、成功呼び出しごとに 1 件記録する

### レスポンス
```json
{
  "data": {
    "recorded": true
  }
}
```

### 主なエラー
- `AUTH_REQUIRED`
- `AUTH_FORBIDDEN`
- `INTERNAL_ERROR`

---

## 5. API一覧

| 区分 | メソッド | パス | 正常時HTTP | 用途 |
|---|---|---|---|---|
| Health | GET | `/api/health` | 200 OK | 運用確認用ヘルスチェック |
| Auth | POST | `/api/auth/login-record` | 201 Created | LOGIN 記録 |
| Dashboard | GET | `/api/dashboard` | 200 OK | ダッシュボード情報取得 |
| Products | GET | `/api/products` | 200 OK | 商品一覧取得 |
| Products | POST | `/api/products` | 201 Created | 商品登録 |
| Products | GET | `/api/products/:productId` | 200 OK | 商品詳細取得 |
| Products | PUT | `/api/products/:productId` | 200 OK | 商品更新 |
| Products | DELETE | `/api/products/:productId` | 200 OK | 商品論理削除 |
| Product Images | POST | `/api/products/:productId/images` | 201 Created | 商品画像追加 |
| Product Images | PUT | `/api/products/:productId/images/:imageId` | 200 OK | 商品画像差し替え |
| Product Images | DELETE | `/api/products/:productId/images/:imageId` | 200 OK | 商品画像削除 |
| Tasks | GET | `/api/products/:productId/tasks` | 200 OK | タスク一覧取得 |
| Tasks | POST | `/api/products/:productId/tasks` | 201 Created | タスク登録 |
| Tasks | PUT | `/api/tasks/:taskId` | 200 OK | タスク更新 |
| Tasks | PATCH | `/api/tasks/:taskId/completion` | 200 OK | タスク完了状態切替 |
| Tasks | DELETE | `/api/tasks/:taskId` | 200 OK | タスク削除 |
| Categories | GET | `/api/categories` | 200 OK | カテゴリ一覧取得 |
| Categories | POST | `/api/categories` | 201 Created | カテゴリ登録 |
| Categories | PUT | `/api/categories/:categoryId` | 200 OK | カテゴリ更新 |
| Categories | DELETE | `/api/categories/:categoryId` | 200 OK | カテゴリ削除 |
| Tags | GET | `/api/tags` | 200 OK | タグ一覧取得 |
| Tags | POST | `/api/tags` | 201 Created | タグ登録 |
| Tags | PUT | `/api/tags/:tagId` | 200 OK | タグ更新 |
| Tags | DELETE | `/api/tags/:tagId` | 200 OK | タグ削除 |
| QR | POST | `/api/qr/lookup` | 200 OK | QR読取結果から商品特定 |
| QR | POST | `/api/qr/sell` | 200 OK | 販売済更新 |

---

## 6. Dashboard API

## 6.1 GET /api/dashboard

### 概要
ダッシュボード集計情報を取得する。

### 認証
必須

### 業務ルール
- 論理削除済み商品を除外する
- 論理削除済み商品に紐づくタスクも除外する
- 納期が近いタスクは、当日を含む7日以内の未完了タスクを対象とする
- `dueSoonTasks[]` は `taskId`, `taskName`, `productId`, `productName`, `dueDate` を返す
- 最近更新商品は更新日時降順で最大5件とする
- `recentProducts[].thumbnailUrl` は取得時生成の期限付きURLとし、既定有効期限は60分とする
- `thumbnailUrl` の期限切れ時は `GET /api/dashboard` を再取得して最新URLを受け取る

### レスポンス
```json
{
  "data": {
    "statusCounts": {
      "beforeProduction": 1,
      "inProduction": 2,
      "completed": 3,
      "onDisplay": 4,
      "inStock": 5,
      "sold": 6
    },
    "soldCount": 6,
    "openTaskCount": 8,
    "dueSoonTasks": [
      {
        "taskId": "task_001",
        "taskName": "台紙を準備する",
        "productId": "HM-000001",
        "productName": "春色ピアス",
        "dueDate": "2026-03-22"
      }
    ],
    "recentProducts": [
      {
        "productId": "HM-000010",
        "name": "青のブローチ",
        "status": "onDisplay",
        "updatedAt": "2026-03-20T08:30:00Z",
        "thumbnailUrl": "https://example.com/thumbnail.jpg"
      }
    ]
  }
}
```

### 主なエラー
- `AUTH_REQUIRED`
- `AUTH_FORBIDDEN`
- `INTERNAL_ERROR`

---

## 7. Products API

## 7.1 GET /api/products

### 概要
商品一覧を取得する。

### 認証
必須

### クエリパラメータ
| パラメータ | 型 | 必須 | 既定値 | 説明 |
|---|---|---|---|---|
| `page` | number | 任意 | `1` | 1以上の整数 |
| `pageSize` | number | 任意 | `50` | 1〜100 |
| `sortBy` | string | 任意 | `updatedAt` | `updatedAt` / `name` |
| `sortOrder` | string | 任意 | `desc` | `asc` / `desc` |
| `keyword` | string | 任意 | - | 最大100文字、前後空白除去、改行不可、タブ不可、制御文字不可または無害化 |
| `categoryId` | string | 任意 | - | カテゴリID |
| `tagId` | string | 任意 | - | タグID |
| `status` | string | 任意 | - | 商品ステータス内部コード |
| `includeSold` | boolean | 任意 | `true` | `false` の場合は販売済を除外 |

### 業務ルール
- 検索対象: `name`, `description`, `productId`, `categoryName`, `tagNames`
- `keyword` は共通の検索キーワード正規化方針を適用し、違反時は `VALIDATION_ERROR` とする
- `isDeleted=true` の商品は常に除外する
- `data.items[].thumbnailUrl` は取得時生成の期限付きURLとし、既定有効期限は60分とする
- `thumbnailUrl` の期限切れ時は `GET /api/products` を再取得して最新URLを受け取る
- `status=sold` 指定時は `includeSold` の値に関わらず販売済を検索対象に含める
- カテゴリ・タグ・ステータスの絞り込みは AND 条件で判定する
- 並び替えは全条件適用後に実施する

### レスポンス
```json
{
  "data": {
    "items": [
      {
        "productId": "HM-000001",
        "name": "春色ピアス",
        "status": "onDisplay",
        "categoryName": "ピアス",
        "updatedAt": "2026-03-20T08:30:00Z",
        "thumbnailUrl": "https://example.com/thumbnail.jpg"
      }
    ]
  },
  "meta": {
    "page": 1,
    "pageSize": 50,
    "totalCount": 1,
    "hasNext": false
  }
}
```

### 主なエラー
- `AUTH_REQUIRED`
- `VALIDATION_ERROR`
- `INTERNAL_ERROR`

---

## 7.2 POST /api/products

### 概要
商品を新規登録する。

### 認証
必須

### 正常時HTTPステータス
`201 Created`

### リクエストボディ
| 項目 | 型 | 必須 | 説明 |
|---|---|---|---|
| `name` | string | 必須 | 最大100文字、前後空白除去後に空白のみ不可、改行不可、タブ不可 |
| `description` | string | 任意 | 最大2000文字、改行可 |
| `price` | number | 必須 | 0以上の整数 |
| `categoryId` | string | 必須 | カテゴリID |
| `tagIds` | string[] | 任意 | タグID配列 |
| `status` | string | 必須 | ステータス内部コード |

### リクエスト例
```json
{
  "name": "春色ピアス",
  "description": "淡い色合いのハンドメイドピアス",
  "price": 2800,
  "categoryId": "cat_001",
  "tagIds": ["tag_001", "tag_002"],
  "status": "completed"
}
```

### 業務ルール
- 商品IDは `HM-000001` 形式で自動採番する
- 採番には `counters/product` をトランザクション更新して用いる
- 新規登録時は画像を受け付けない
- 新規登録成功後、画像追加は別APIで実施する
- `status=sold` で登録された場合は `soldAt` を設定する
- それ以外のステータスでは `soldAt` は未設定とする

### レスポンス
```json
{
  "data": {
    "productId": "HM-000001",
    "createdAt": "2026-03-20T08:30:00Z",
    "updatedAt": "2026-03-20T08:30:00Z"
  }
}
```

### 主なエラー
- `VALIDATION_ERROR`（400）
- `CATEGORY_NOT_FOUND`（400）
- `TAG_NOT_FOUND`（400）
- `INTERNAL_ERROR`（500）

---

## 7.3 GET /api/products/:productId

### 概要
商品詳細を取得する。

### 認証
必須

### 業務ルール
- 論理削除されていない商品のみ取得可
- 関連タスク一覧は本APIには含めない
- 商品詳細画面では本APIと `GET /api/products/:productId/tasks` を併用する
- `GET /api/products/:productId` の `data.product.qrCodeValue` は商品詳細画面のQR表示に利用する
- `images[].displayUrl` / `images[].thumbnailUrl` は取得時生成の期限付きURLとする
- 既定有効期限は60分とし、`urlExpiresAt` に期限日時を返却する
- 期限切れ時は `GET /api/products/:productId` を再取得して最新URLを受け取る

### レスポンス
```json
{
  "data": {
    "product": {
      "productId": "HM-000001",
      "name": "春色ピアス",
      "description": "淡い色合いのハンドメイドピアス",
      "price": 2800,
      "categoryId": "cat_001",
      "categoryName": "ピアス",
      "tagIds": ["tag_001", "tag_002"],
      "tagNames": ["春", "パステル"],
      "status": "onDisplay",
      "soldAt": null,
      "createdAt": "2026-03-17T10:00:00Z",
      "updatedAt": "2026-03-20T08:30:00Z"
    },
    "images": [
      {
        "imageId": "img_001",
        "displayUrl": "https://example.com/display.jpg",
        "thumbnailUrl": "https://example.com/thumb.jpg",
        "urlExpiresAt": "2026-03-20T09:30:00Z",
        "sortOrder": 1,
        "isPrimary": true
      }
    ],
    "tasksSummary": {
      "openCount": 2,
      "completedCount": 1
    },
    "qrCodeValue": "HM-000001"
  }
}
```

### 主なエラー
- `PRODUCT_NOT_FOUND`
- `PRODUCT_DELETED`

---

## 7.4 PUT /api/products/:productId

### 概要
商品情報を更新する。

### 認証
必須

### 更新方針
- 全項目送信を前提とする
- 未送信項目は現状維持しない
- 空値にしたい項目も明示送信する

### リクエストボディ
| 項目 | 型 | 必須 | 説明 |
|---|---|---|---|
| `name` | string | 必須 | 最大100文字、前後空白除去後に空白のみ不可、改行不可、タブ不可 |
| `description` | string | 必須 | 未設定にする場合は空文字。最大2000文字、改行可 |
| `price` | number | 必須 | 0以上整数 |
| `categoryId` | string | 必須 | カテゴリID |
| `tagIds` | string[] | 必須 | 未設定にする場合は `[]` |
| `status` | string | 必須 | ステータス内部コード |
| `primaryImageId` | string \| null | 必須 | 対象商品の `images[].imageId` を指定。代表画像なしは `null` |

### リクエスト例
```json
{
  "name": "春色ピアス",
  "description": "展示用に更新",
  "price": 3000,
  "categoryId": "cat_001",
  "tagIds": ["tag_001"],
  "status": "sold",
  "primaryImageId": "img_001"
}
```

### 業務ルール
- `status` を `sold` に変更した場合、既存 `soldAt` 未設定時のみ現在時刻を設定する
- 既に `sold` の場合は `soldAt` を上書きしない
- `sold` から他ステータスへ戻す場合は `soldAt=null` とする
- `updatedAt` は保存成功時に必ず更新する
- `primaryImageId` は対象商品の `images[].imageId` のいずれか、または `null` のみ指定可とする
- `primaryImageId=null` の場合、全画像の `isPrimary=false` とする
- `primaryImageId` に該当画像が存在する場合、指定画像のみ `isPrimary=true`、その他は `false` に正規化する
- `primaryImageId` に該当画像が存在しない場合は `VALIDATION_ERROR` とする

### レスポンス
```json
{
  "data": {
    "productId": "HM-000001",
    "updatedAt": "2026-03-20T08:40:00Z"
  }
}
```

### 主なエラー
- `PRODUCT_NOT_FOUND`（404）
- `PRODUCT_DELETED`（404）
- `CATEGORY_NOT_FOUND`（400）
- `TAG_NOT_FOUND`（400）
- `VALIDATION_ERROR`（400、`primaryImageId` に存在しない `imageId` を指定した場合を含む）

---

## 7.5 DELETE /api/products/:productId

### 概要
商品を論理削除する。

### 認証
必須

### 業務ルール
- `isDeleted=true`
- `deletedAt=現在時刻`
- `updatedAt=現在時刻`
- 画像・タスクは保持するが、通常APIでは参照不可とする
- 一覧 / 検索 / ダッシュボード / QR 利用対象から除外する

### レスポンス
```json
{
  "data": {
    "productId": "HM-000001",
    "deletedAt": "2026-03-20T08:45:00Z"
  }
}
```

### 主なエラー
- `PRODUCT_NOT_FOUND`
- `PRODUCT_DELETED`

---

## 8. Product Images API

### 補足
- 取得系APIが返す `displayUrl` / `thumbnailUrl` はすべて期限付きURLとする
- 画像系APIは期限付きURLをレスポンスに含めない
- フロントエンドは画像追加・差し替え・削除成功後に `GET /api/products/:productId` を再取得する
- 代表画像の切替は `PUT /api/products/:productId` の `primaryImageId` で行い、画像差し替えAPIでは変更しない

## 8.1 POST /api/products/:productId/images

### 概要
商品画像を追加する。

### 認証
必須

### 正常時HTTPステータス
`201 Created`

### Content-Type
```http
multipart/form-data
```

### フォーム項目
| 項目 | 型 | 必須 | 説明 |
|---|---|---|---|
| `file` | binary | 必須 | JPEG / PNG / WebP、10MB以下 |

### 業務ルール
- 1商品あたり最大10枚
- 長辺2000px超は縮小保存する
- 表示用画像とサムネイルを生成する
- `sortOrder` は既存最大値 + 1 を採番する
- 追加画像の `isPrimary` は `false` とする
- 明示的な代表画像が存在しない場合の表示上の代表画像は、`sortOrder` 最小画像とする
- 代表画像の設定・変更は `PUT /api/products/:productId` の `primaryImageId` で行う

### レスポンス
```json
{
  "data": {
    "imageId": "img_002",
    "isPrimary": false,
    "updatedAt": "2026-03-20T08:50:00Z"
  }
}
```

### 主なエラー
- `PRODUCT_NOT_FOUND`
- `PRODUCT_RELATED_RESOURCE_UNAVAILABLE`
- `IMAGE_LIMIT_EXCEEDED`
- `UNSUPPORTED_IMAGE_TYPE`
- `IMAGE_TOO_LARGE`

---

## 8.2 PUT /api/products/:productId/images/:imageId

### 概要
商品画像を差し替える。画像メタ情報は維持し、画像実体のみ更新する。

### 認証
必須

### Content-Type
```http
multipart/form-data
```

### フォーム項目
| 項目 | 型 | 必須 | 説明 |
|---|---|---|---|
| `file` | binary | 必須 | 差し替え画像 |

### 業務ルール
- `imageId` と `sortOrder` は維持する
- `isPrimary` は既存値を維持し、このAPIでは変更しない
- 画像変換ルールは追加時と同じ
- 商品の `updatedAt` を更新する

### レスポンス
```json
{
  "data": {
    "imageId": "img_001",
    "updatedAt": "2026-03-20T08:55:00Z"
  }
}
```

### 主なエラー
- `PRODUCT_NOT_FOUND`
- `PRODUCT_RELATED_RESOURCE_UNAVAILABLE`
- `IMAGE_NOT_FOUND`
- `UNSUPPORTED_IMAGE_TYPE`

---

## 8.3 DELETE /api/products/:productId/images/:imageId

### 概要
商品画像を削除する。

### 認証
必須

### 業務ルール
- Storage 実体を削除する
- 画像配列を更新する
- 残画像の `sortOrder` を 1 から詰め直す
- 削除対象が代表画像なら、残画像のうち `sortOrder` 最小画像を代表扱いとする

### レスポンス
```json
{
  "data": {
    "imageId": "img_001",
    "updatedAt": "2026-03-20T09:00:00Z"
  }
}
```

### 主なエラー
- `PRODUCT_NOT_FOUND`
- `PRODUCT_RELATED_RESOURCE_UNAVAILABLE`
- `IMAGE_NOT_FOUND`

---

## 9. Tasks API

## 9.1 GET /api/products/:productId/tasks

### 概要
対象商品のタスク一覧を取得する。

### 認証
必須

### クエリパラメータ
| パラメータ | 型 | 必須 | 既定値 | 説明 |
|---|---|---|---|---|
| `showCompleted` | boolean | 任意 | `false` | true の場合は完了済み含む |

### 業務ルール
- 未完了優先
- `dueDate` 昇順
- `dueDate` 未設定は後ろ
- 論理削除済み商品は参照不可

### レスポンス
```json
{
  "data": {
    "items": [
      {
        "taskId": "task_001",
        "name": "台紙を準備する",
        "content": "イベント用の台紙を作成",
        "dueDate": "2026-03-22",
        "isCompleted": false,
        "completedAt": null,
        "memo": "ラッピングも確認",
        "updatedAt": "2026-03-20T08:30:00Z"
      }
    ]
  }
}
```

### 主なエラー
- `PRODUCT_RELATED_RESOURCE_UNAVAILABLE`
- `PRODUCT_NOT_FOUND`

---

## 9.2 POST /api/products/:productId/tasks

### 概要
対象商品にタスクを登録する。

### 認証
必須

### 正常時HTTPステータス
`201 Created`

### リクエストボディ
| 項目 | 型 | 必須 | 説明 |
|---|---|---|---|
| `name` | string | 必須 | 最大100文字、前後空白除去後に空白のみ不可、改行不可、タブ不可 |
| `content` | string | 任意 | 最大2000文字、改行可 |
| `dueDate` | string | 任意 | `YYYY-MM-DD` |
| `memo` | string | 任意 | 最大1000文字、改行可 |

### リクエスト例
```json
{
  "name": "台紙を準備する",
  "content": "イベント用の台紙を作成",
  "dueDate": "2026-03-22",
  "memo": "ラッピングも確認"
}
```

### 業務ルール
- 初期値は `isCompleted=false`
- 初期値は `completedAt=null`
- `name` には共通の名称系入力ルール、`content` / `memo` には共通の複数行テキスト入力ルールを適用する

### レスポンス
```json
{
  "data": {
    "taskId": "task_001",
    "updatedAt": "2026-03-20T09:05:00Z"
  }
}
```

### 主なエラー
- `VALIDATION_ERROR`
- `PRODUCT_NOT_FOUND`
- `PRODUCT_RELATED_RESOURCE_UNAVAILABLE`

---

## 9.3 PUT /api/tasks/:taskId

### 概要
タスク内容を更新する。

### 認証
必須

### リクエストボディ
| 項目 | 型 | 必須 | 説明 |
|---|---|---|---|
| `name` | string | 必須 | 最大100文字、前後空白除去後に空白のみ不可、改行不可、タブ不可 |
| `content` | string | 任意 | 最大2000文字、改行可 |
| `dueDate` | string \| null | 任意 | 未設定可 |
| `memo` | string | 任意 | 最大1000文字、改行可 |
| `isCompleted` | boolean | 必須 | 完了状態 |

### 業務ルール
- `false -> true` で `completedAt=現在時刻`
- `true -> false` で `completedAt=null`
- `updatedAt` を更新する
- `name` には共通の名称系入力ルール、`content` / `memo` には共通の複数行テキスト入力ルールを適用する

### レスポンス
```json
{
  "data": {
    "taskId": "task_001",
    "completedAt": "2026-03-20T09:10:00Z"
  }
}
```

### 主なエラー
- `TASK_NOT_FOUND`
- `PRODUCT_RELATED_RESOURCE_UNAVAILABLE`
- `VALIDATION_ERROR`

---

## 9.4 PATCH /api/tasks/:taskId/completion

### 概要
タスクの完了状態のみを切り替える。

### 認証
必須

### リクエストボディ
| 項目 | 型 | 必須 | 説明 |
|---|---|---|---|
| `isCompleted` | boolean | 必須 | 切替後状態 |

### リクエスト例
```json
{
  "isCompleted": true
}
```

### 業務ルール
- 更新対象は `isCompleted`, `completedAt`, `updatedAt` のみ
- `false -> true` で `completedAt=現在時刻`
- `true -> false` で `completedAt=null`

### レスポンス
```json
{
  "data": {
    "taskId": "task_001",
    "isCompleted": true,
    "completedAt": "2026-03-20T09:15:00Z",
    "updatedAt": "2026-03-20T09:15:00Z"
  }
}
```

### 主なエラー
- `TASK_NOT_FOUND`
- `PRODUCT_RELATED_RESOURCE_UNAVAILABLE`
- `VALIDATION_ERROR`

---

## 9.5 DELETE /api/tasks/:taskId

### 概要
タスクを削除する。

### 認証
必須

### 業務ルール
- 物理削除
- 復元不可

### レスポンス
```json
{
  "data": {
    "taskId": "task_001"
  }
}
```

### 主なエラー
- `TASK_NOT_FOUND`
- `PRODUCT_RELATED_RESOURCE_UNAVAILABLE`

---

## 10. Categories API

## 10.1 GET /api/categories

### 概要
カテゴリ一覧を取得する。

### 認証
必須

### 業務ルール
- `sortOrder` 昇順、同値時は `name` 昇順
- `usedProductCount` は `isDeleted=false` の商品からの参照件数
- `isInUse = usedProductCount > 0`

### レスポンス
```json
{
  "data": {
    "items": [
      {
        "categoryId": "cat_001",
        "name": "ピアス",
        "sortOrder": 10,
        "updatedAt": "2026-03-20T08:00:00Z",
        "usedProductCount": 5,
        "isInUse": true
      }
    ]
  }
}
```

---

## 10.2 POST /api/categories

### 概要
カテゴリを登録する。

### 認証
必須

### 正常時HTTPステータス
`201 Created`

### リクエストボディ
| 項目 | 型 | 必須 | 説明 |
|---|---|---|---|
| `name` | string | 必須 | 最大50文字、前後空白除去後に空白のみ不可、改行不可、タブ不可 |
| `sortOrder` | number \| null | 任意 | 未指定または `null` で末尾 |

### 業務ルール
- 前後空白除去後の名称で一意判定
- 前後空白除去後に空文字となる名称は不可
- 同名は不可
- `name` には共通の名称系入力ルールを適用する
- `sortOrder` 未指定時は既存最大値 + 1

### レスポンス
```json
{
  "data": {
    "categoryId": "cat_010"
  }
}
```

### 主なエラー
- `VALIDATION_ERROR`
- `DUPLICATE_NAME`

---

## 10.3 PUT /api/categories/:categoryId

### 概要
カテゴリを更新する。

### 認証
必須

### 正常時HTTPステータス
`200 OK`

### リクエストボディ
| 項目 | 型 | 必須 | 説明 |
|---|---|---|---|
| `name` | string | 必須 | 最大50文字、前後空白除去後に空白のみ不可、改行不可、タブ不可 |
| `sortOrder` | number \| null | 任意 | 未指定または `null` で末尾へ移動 |

### 業務ルール
- 自身を除く同名は不可
- 前後空白除去後に空文字となる名称は不可
- `name` には共通の名称系入力ルールを適用する
- `updatedAt` を更新する

### レスポンス
```json
{
  "data": {
    "categoryId": "cat_001"
  }
}
```

### 主なエラー
- `CATEGORY_NOT_FOUND`（404）
- `VALIDATION_ERROR`（400）
- `DUPLICATE_NAME`（400）

---

## 10.4 DELETE /api/categories/:categoryId

### 概要
カテゴリを削除する。

### 認証
必須

### 業務ルール
- 論理削除されていない商品から参照されていない場合のみ削除可
- 物理削除

### レスポンス
```json
{
  "data": {
    "categoryId": "cat_001"
  }
}
```

### 主なエラー
- `CATEGORY_NOT_FOUND`（404）
- `CATEGORY_IN_USE`（400）

---

## 11. Tags API

## 11.1 GET /api/tags

### 概要
タグ一覧を取得する。

### 認証
必須

### 業務ルール
- `name` 昇順
- `usedProductCount` は `isDeleted=false` 商品からの参照件数
- `isInUse = usedProductCount > 0`

### レスポンス
```json
{
  "data": {
    "items": [
      {
        "tagId": "tag_001",
        "name": "春",
        "updatedAt": "2026-03-20T08:00:00Z",
        "usedProductCount": 3,
        "isInUse": true
      }
    ]
  }
}
```

---

## 11.2 POST /api/tags

### 概要
タグを登録する。

### 認証
必須

### 正常時HTTPステータス
`201 Created`

### リクエストボディ
| 項目 | 型 | 必須 | 説明 |
|---|---|---|---|
| `name` | string | 必須 | 最大50文字、前後空白除去後に空白のみ不可、改行不可、タブ不可 |

### 業務ルール
- 前後空白除去後の名称で一意判定
- 前後空白除去後に空文字となる名称は不可
- 同名は不可
- `name` には共通の名称系入力ルールを適用する

### レスポンス
```json
{
  "data": {
    "tagId": "tag_010"
  }
}
```

### 主なエラー
- `VALIDATION_ERROR`
- `DUPLICATE_NAME`

---

## 11.3 PUT /api/tags/:tagId

### 概要
タグを更新する。

### 認証
必須

### リクエストボディ
| 項目 | 型 | 必須 | 説明 |
|---|---|---|---|
| `name` | string | 必須 | 最大50文字、前後空白除去後に空白のみ不可、改行不可、タブ不可 |

### 業務ルール
- 自身を除く同名は不可
- 前後空白除去後に空文字となる名称は不可
- `name` には共通の名称系入力ルールを適用する
- `updatedAt` を更新する

### レスポンス
```json
{
  "data": {
    "tagId": "tag_001"
  }
}
```

### 主なエラー
- `TAG_NOT_FOUND`（404）
- `VALIDATION_ERROR`（400）
- `DUPLICATE_NAME`（400）

---

## 11.4 DELETE /api/tags/:tagId

### 概要
タグを削除する。

### 認証
必須

### 業務ルール
- 論理削除されていない商品から参照されていない場合のみ削除可
- 物理削除

### レスポンス
```json
{
  "data": {
    "tagId": "tag_001"
  }
}
```

### 主なエラー
- `TAG_NOT_FOUND`（404）
- `TAG_IN_USE`（400）

---

## 12. QR API

## 12.1 POST /api/qr/lookup

### 概要
QRコード読取値から商品を特定し、販売済更新可否を返す。

### 認証
必須

### 正常時HTTPステータス
`200 OK`

### リクエストボディ
| 項目 | 型 | 必須 | 説明 |
|---|---|---|---|
| `qrCodeValue` | string | 必須 | MVPでは productId ベースの識別値 |

### リクエスト例
```json
{
  "qrCodeValue": "HM-000001"
}
```

### 業務ルール
- `status=onDisplay` または `inStock` の場合のみ `canSell=true`
- `sold` は重複更新せず `ALREADY_SOLD`
- `beforeProduction` / `inProduction` / `completed` は更新不可
- 論理削除済み商品は無効QR扱い
- `POST /api/qr/lookup` は通常参照系APIの 404 ルールの例外とし、`PRODUCT_DELETED` / `PRODUCT_NOT_FOUND` も HTTP 200 + `reasonCode` で返す

### レスポンス
```json
{
  "data": {
    "productId": "HM-000001",
    "name": "春色ピアス",
    "status": "onDisplay",
    "canSell": true,
    "reasonCode": "CAN_SELL",
    "message": "販売済更新が可能です。"
  }
}
```

### `reasonCode` 一覧
| 値 | 説明 |
|---|---|
| `CAN_SELL` | 販売済更新可能 |
| `ALREADY_SOLD` | 既に販売済 |
| `INVALID_STATUS` | 制作系ステータスなど更新不可 |
| `PRODUCT_DELETED` | 論理削除済み |
| `PRODUCT_NOT_FOUND` | 未登録商品 |

---

## 12.2 POST /api/qr/sell

### 概要
対象商品を販売済に更新する。

### 認証
必須

### 正常時HTTPステータス
`200 OK`

### リクエストボディ
| 項目 | 型 | 必須 | 説明 |
|---|---|---|---|
| `productId` | string | 条件付き必須 | `lookup` 結果で特定済みの商品ID。`qrCodeValue` 未指定時は必須 |
| `qrCodeValue` | string | 条件付き必須 | `productId` 未指定時の代替入力 |

### リクエスト例
```json
{
  "productId": "HM-000001"
}
```

### 業務ルール
- `productId` と `qrCodeValue` は少なくとも一方を必須とし、両方未指定は `VALIDATION_ERROR` とする
- 通常は `POST /api/qr/lookup` の結果で取得した `productId` を送信する
- 対象ステータスは `onDisplay` / `inStock` のみ
- 更新直前に最新状態を再取得して可否判定を再実施する
- `soldAt` 未設定時のみ現在時刻を設定する
- 既に `sold` の場合は更新せず `ALREADY_SOLD` を返す

### レスポンス
```json
{
  "data": {
    "productId": "HM-000001",
    "status": "sold",
    "soldAt": "2026-03-20T09:20:00Z",
    "updatedAt": "2026-03-20T09:20:00Z"
  }
}
```

### 主なエラー
- `VALIDATION_ERROR`（400）
- `INVALID_STATUS_FOR_QR_SELL`（400）
- `ALREADY_SOLD`（400）
- `PRODUCT_DELETED`（404）
- `PRODUCT_NOT_FOUND`（404）

---

## 13. 運用補助API

## 13.1 GET /api/health

### 概要
サービスの疎通確認および運用時のヘルスチェックに利用する。

### 認証
不要

### 正常時HTTPステータス
`200 OK`

### 業務ルール
- Cloud Run の稼働確認および Hosting rewrite 経由の疎通確認に利用する
- 業務データの参照や更新は行わない
- 業務認証の代替用途には使用しない

### レスポンス例
```json
{
  "data": {
    "status": "ok",
    "service": "handmade-sales-api"
  }
}
```

### 主なエラー
- `INTERNAL_ERROR`

---

## 14. 主要データ項目

## 14.1 Product
| 項目 | 型 | 説明 |
|---|---|---|
| `productId` | string | `HM-000001` 形式の業務ID |
| `name` | string | 商品名 |
| `description` | string | 商品説明 |
| `price` | number | 価格（円単位整数） |
| `categoryId` | string | カテゴリID |
| `tagIds` | string[] | タグID配列 |
| `status` | string | ステータス内部コード |
| `images` | object[] | 画像メタ情報配列 |
| `qrCodeValue` | string | MVPでは `productId` と同値 |
| `soldAt` | string \| null | 販売日時 |
| `createdAt` | string | 作成日時 |
| `updatedAt` | string | 更新日時 |
| `isDeleted` | boolean | 論理削除フラグ |
| `deletedAt` | string \| null | 削除日時 |

## 14.2 Product Image
| 項目 | 型 | 説明 |
|---|---|---|
| `imageId` | string | 商品内画像ID |
| `displayPath` | string | 表示用画像パス |
| `thumbnailPath` | string | サムネイル画像パス |
| `sortOrder` | number | 表示順 |
| `isPrimary` | boolean | 代表画像フラグ |

## 14.3 Task
| 項目 | 型 | 説明 |
|---|---|---|
| `taskId` | string | タスクID |
| `productId` | string | 商品ID |
| `name` | string | タスク名 |
| `content` | string | タスク内容 |
| `dueDate` | string \| null | 納期 `YYYY-MM-DD` |
| `isCompleted` | boolean | 完了フラグ |
| `completedAt` | string \| null | 完了日時 |
| `memo` | string | メモ |
| `createdAt` | string | 作成日時 |
| `updatedAt` | string | 更新日時 |

## 14.4 Category
| 項目 | 型 | 説明 |
|---|---|---|
| `categoryId` | string | カテゴリID |
| `name` | string | カテゴリ名 |
| `sortOrder` | number | 表示順 |
| `createdAt` | string | 作成日時 |
| `updatedAt` | string | 更新日時 |

## 14.5 Tag
| 項目 | 型 | 説明 |
|---|---|---|
| `tagId` | string | タグID |
| `name` | string | タグ名 |
| `createdAt` | string | 作成日時 |
| `updatedAt` | string | 更新日時 |

---

## 15. バリデーション要約

| 項目 | 制約 |
|---|---|
| 商品名 | 必須、最大100文字、空白のみ不可、改行不可 |
| 商品説明 | 最大2000文字 |
| 価格 | 必須、0以上整数、小数不可 |
| カテゴリ名 | 必須、最大50文字、同名不可 |
| タグ名 | 必須、最大50文字、同名不可 |
| タスク名 | 必須、最大100文字、空白のみ不可 |
| タスク内容 | 最大2000文字 |
| メモ | 最大1000文字 |
| 検索キーワード | 最大100文字 |
| 画像 | JPEG / PNG / WebP、10MB以下、最大10枚 |

---

## 16. 実装・テスト上の注意

- 商品一覧APIのみページング対象とする
- 商品詳細画面では商品詳細APIとタスク一覧APIを併用する
- 画像系API成功後は商品詳細API再取得を前提とする
- 商品詳細画面からのQR読み取り導線自体は画面仕様で定義し、読取後の照会・販売更新は `POST /api/qr/lookup` / `POST /api/qr/sell` を利用する
- 論理削除済み商品の関連情報参照は `PRODUCT_RELATED_RESOURCE_UNAVAILABLE` を返してよい
- QR販売済更新では排他を意識し、更新直前に最新状態を再判定する
- `soldAt` は未設定時のみ設定し、再度販売済更新しても上書きしない

---

## 17. 付録: 代表レスポンス例

### 16.1 入力エラー
```json
{
  "code": "VALIDATION_ERROR",
  "message": "入力内容を確認してください。",
  "details": [
    {
      "field": "price",
      "message": "価格は0以上の整数で入力してください。"
    }
  ]
}
```

### 16.2 未認証
```json
{
  "code": "AUTH_REQUIRED",
  "message": "認証が必要です。"
}
```

### 16.3 利用不可
```json
{
  "code": "AUTH_FORBIDDEN",
  "message": "この操作は実行できません。"
}
```

### 16.4 論理削除済み商品
```json
{
  "code": "PRODUCT_DELETED",
  "message": "対象商品は利用できません。"
}
```
