# バリデーション / エラー要約

## 名称系項目
- 前後空白除去
- 空白のみ不可
- 改行不可
- タブ不可
- 制御文字不可または無害化

## 複数行テキスト
- 改行可
- LF正規化
- 最大文字数を守る

## 検索キーワード
- 最大100文字
- 前後空白除去
- 連続空白は単一空白相当
- 改行不可
- タブ不可
- 英字は大文字小文字を区別しない

## 代表エラーコード
- `AUTH_REQUIRED`
- `AUTH_FORBIDDEN`
- `VALIDATION_ERROR`
- `PRODUCT_NOT_FOUND`
- `PRODUCT_DELETED`
- `CATEGORY_NOT_FOUND`
- `TAG_NOT_FOUND`
- `TASK_NOT_FOUND`
- `DUPLICATE_NAME`
- `IMAGE_LIMIT_EXCEEDED`
- `UNSUPPORTED_IMAGE_TYPE`
- `IMAGE_TOO_LARGE`
- `IMAGE_NOT_FOUND`
- `INVALID_STATUS_FOR_QR_SELL`
- `ALREADY_SOLD`
- `INTERNAL_ERROR`

## 画面導線の基本
- 401: セッション切れ表示後にログイン画面へ
- 403: 利用不可表示後にログイン画面へ
- 404: 対象なし導線を表示
- 400: 項目エラーまたは画面上部エラー
