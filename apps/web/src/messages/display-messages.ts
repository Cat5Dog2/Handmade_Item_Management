export const APP_NAME = "Handmade Item Management";

export const AUTH_MESSAGES = {
  loginFailed: "メールアドレスまたはパスワードが正しくありません。",
  loginRecordFailed:
    "ログイン記録の送信に失敗しました。しばらくしてから再度お試しください。",
  passwordResetFailed:
    "パスワード再設定メールを送信できませんでした。入力内容を確認してください。",
  passwordResetSucceeded: "パスワード再設定メールを送信しました。"
} as const;

export const DASHBOARD_ERROR_MESSAGES = {
  fetchFailed: "ダッシュボードの取得に失敗しました。"
} as const;

export const PRODUCT_ERROR_MESSAGES = {
  createFailed: "商品を登録できませんでした。",
  deleteFailed: "商品を削除できませんでした。",
  deleted: "対象の商品は削除済みです。",
  detailFetchFailed: "商品詳細の取得に失敗しました。再度お試しください。",
  editLookupFailed:
    "商品編集に必要な情報を取得できませんでした。再試行してください。",
  listFetchFailed: "商品一覧の取得に失敗しました。再度お試しください。",
  notFound: "対象の商品が見つかりません。",
  taskCompletionFailed: "タスクの完了状態を更新できませんでした。再度お試しください。",
  taskCreateFailed: "タスクを保存できませんでした。",
  taskDeleteFailed: "タスクを削除できませんでした。",
  taskNotFound: "対象のタスクが見つかりません。最新の一覧を確認してください。",
  taskUpdateFailed: "タスクを更新できませんでした。",
  tasksFetchFailed: "タスク一覧を取得できませんでした。再度お試しください。",
  tasksUnavailable: "この商品のタスクは表示できません。",
  updateFailed: "商品を更新できませんでした。"
} as const;

export const PRODUCT_ERROR_MESSAGE_OVERRIDES = {
  PRODUCT_DELETED: PRODUCT_ERROR_MESSAGES.deleted,
  PRODUCT_NOT_FOUND: PRODUCT_ERROR_MESSAGES.notFound
} as const;

export const PRODUCT_IMAGE_ERROR_MESSAGES = {
  addFailed: "画像を追加できませんでした。再度お試しください。",
  deleteFailed: "画像を削除できませんでした。再度お試しください。",
  replaceFailed: "画像を差し替えできませんでした。再度お試しください。"
} as const;

export const PRODUCT_IMAGE_ERROR_MESSAGE_OVERRIDES = {
  IMAGE_LIMIT_EXCEEDED:
    "画像は最大10枚まで登録できます。不要な画像を削除してから追加してください。",
  IMAGE_NOT_FOUND: "対象の画像が見つかりません。最新の情報を読み込み直してください。",
  IMAGE_TOO_LARGE:
    "画像サイズが大きすぎます。10MB以下の画像を選択してください。",
  PRODUCT_DELETED: PRODUCT_ERROR_MESSAGES.deleted,
  PRODUCT_NOT_FOUND: PRODUCT_ERROR_MESSAGES.notFound,
  PRODUCT_RELATED_RESOURCE_UNAVAILABLE: "この商品の画像は操作できません。",
  UNSUPPORTED_IMAGE_TYPE:
    "JPEG、PNG、WebP 形式の画像を選択してください。"
} as const;

export const PRODUCT_TASK_ERROR_MESSAGE_OVERRIDES = {
  PRODUCT_NOT_FOUND: PRODUCT_ERROR_MESSAGES.notFound,
  PRODUCT_RELATED_RESOURCE_UNAVAILABLE: PRODUCT_ERROR_MESSAGES.tasksUnavailable,
  TASK_NOT_FOUND: PRODUCT_ERROR_MESSAGES.taskNotFound
} as const;

export const CATEGORY_ERROR_MESSAGES = {
  createFailed: "カテゴリを登録できませんでした。",
  deleteFailed: "カテゴリを削除できませんでした。",
  listFetchFailed: "カテゴリ一覧を取得できませんでした。",
  updateFailed: "カテゴリを更新できませんでした。"
} as const;

export const TAG_ERROR_MESSAGES = {
  createFailed: "タグを登録できませんでした。",
  deleteFailed: "タグを削除できませんでした。",
  listFetchFailed: "タグ一覧を取得できませんでした。",
  updateFailed: "タグを更新できませんでした。"
} as const;

export const CUSTOMER_ERROR_MESSAGES = {
  archiveFailed: "顧客をアーカイブできませんでした。",
  archivedEditUnavailable:
    "アーカイブ済みの顧客は編集できません。詳細画面で内容をご確認ください。",
  createFailed: "顧客を登録できませんでした。",
  detailFetchFailed: "顧客情報を取得できませんでした。",
  listFetchFailed: "顧客一覧を取得できませんでした。",
  notFound: "対象の顧客が見つかりません。",
  updateFailed: "顧客情報を更新できませんでした。"
} as const;

export const CUSTOMER_ERROR_MESSAGE_OVERRIDES = {
  CUSTOMER_NOT_FOUND: CUSTOMER_ERROR_MESSAGES.notFound
} as const;

export const CUSTOMER_FORM_ERROR_MESSAGE_OVERRIDES = {
  CUSTOMER_ARCHIVED: CUSTOMER_ERROR_MESSAGES.archivedEditUnavailable,
  CUSTOMER_NOT_FOUND: CUSTOMER_ERROR_MESSAGES.notFound
} as const;
