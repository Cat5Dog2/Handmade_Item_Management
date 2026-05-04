export type CategoryFormFieldName = "name" | "sortOrder";

export function getCategoryFormFieldErrorMessage(
  fieldName: CategoryFormFieldName,
  fallbackMessage?: string
) {
  if (fieldName === "name") {
    return fallbackMessage?.includes("50")
      ? "カテゴリ名は50文字以内で入力してください。"
      : "カテゴリ名を入力してください。";
  }

  return "表示順を入力してください。";
}

export type CustomerFormFieldName =
  | "ageGroup"
  | "customerStyle"
  | "gender"
  | "memo"
  | "name"
  | "snsAccounts";

export function getCustomerFormFieldErrorMessage(
  fieldName: CustomerFormFieldName,
  fallbackMessage?: string
) {
  if (fieldName === "name") {
    return fallbackMessage?.includes("100")
      ? "顧客名は100文字以内で入力してください。"
      : "顧客名を入力してください。";
  }

  if (fieldName === "customerStyle") {
    return "系統メモは100文字以内で入力してください。";
  }

  if (fieldName === "memo") {
    return "顧客メモは1000文字以内で入力してください。";
  }

  if (fieldName === "snsAccounts") {
    return "SNSアカウントの入力内容を確認してください。";
  }

  return fallbackMessage ?? "入力内容を確認してください。";
}

export type ProductFormFieldName =
  | "categoryId"
  | "description"
  | "name"
  | "price"
  | "primaryImageId"
  | "soldCustomerId"
  | "status"
  | "tagIds";

export function getProductFormFieldErrorMessage(
  fieldName: ProductFormFieldName,
  fallbackMessage?: string
) {
  if (fieldName === "name") {
    return fallbackMessage?.includes("100")
      ? "商品名は100文字以内で入力してください。"
      : "商品名を入力してください。";
  }

  if (fieldName === "description") {
    return "商品説明は2000文字以内で入力してください。";
  }

  if (fieldName === "price") {
    return "価格は0以上の整数で入力してください。";
  }

  if (fieldName === "categoryId") {
    return "カテゴリを選択してください。";
  }

  if (fieldName === "tagIds") {
    return "タグを選択してください。";
  }

  if (fieldName === "status") {
    return "ステータスを選択してください。";
  }

  if (fieldName === "primaryImageId") {
    return "代表画像の指定を確認してください。";
  }

  if (fieldName === "soldCustomerId") {
    return "選択した顧客を確認してください。";
  }

  return fallbackMessage ?? "入力内容を確認してください。";
}

export type TagFormFieldName = "name";

export function getTagFormFieldErrorMessage(
  fieldName: TagFormFieldName,
  fallbackMessage?: string
) {
  if (fieldName === "name") {
    return fallbackMessage?.includes("50")
      ? "タグ名は50文字以内で入力してください。"
      : "タグ名を入力してください。";
  }

  return fallbackMessage ?? "入力内容を確認してください。";
}

export type TaskFormFieldName = "content" | "dueDate" | "memo" | "name";

export function getTaskFieldErrorMessage(
  fieldName: TaskFormFieldName,
  fallbackMessage?: string
) {
  if (fieldName === "name") {
    return fallbackMessage?.includes("100")
      ? "タスク名は100文字以内で入力してください。"
      : "タスク名を入力してください。";
  }

  if (fieldName === "content") {
    return "タスク内容は2000文字以内で入力してください。";
  }

  if (fieldName === "dueDate") {
    return "納期は YYYY-MM-DD 形式で入力してください。";
  }

  return "メモは1000文字以内で入力してください。";
}
