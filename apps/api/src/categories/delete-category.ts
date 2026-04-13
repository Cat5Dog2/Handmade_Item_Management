import type { CategoryMutationData } from "@handmade/shared";
import type { Firestore, Timestamp } from "firebase-admin/firestore";
import { createApiError } from "../errors/api-errors";
import { getFirestoreDb } from "../firebase/firebase-admin";

interface CategoryDocument {
  categoryId: string;
  createdAt: Timestamp;
  name: string;
  sortOrder: number;
  updatedAt: Timestamp;
}

interface DeleteCategoryOptions {
  db?: Firestore;
}

async function assertCategoryExists(db: Firestore, categoryId: string) {
  const snapshot = (await db
    .collection("categories")
    .doc(categoryId)
    .get()) as unknown as {
    exists: boolean;
    data: () => CategoryDocument;
  };

  if (!snapshot.exists) {
    throw createApiError({
      statusCode: 404,
      code: "CATEGORY_NOT_FOUND",
      message: "対象のカテゴリが見つかりません。最新の一覧を確認してください。"
    });
  }
}

async function assertCategoryIsUnused(db: Firestore, categoryId: string) {
  const snapshot = (await db
    .collection("products")
    .where("isDeleted", "==", false)
    .where("categoryId", "==", categoryId)
    .limit(1)
    .get()) as unknown as {
    docs: Array<unknown>;
  };

  if (snapshot.docs.length > 0) {
    throw createApiError({
      statusCode: 400,
      code: "CATEGORY_IN_USE",
      message: "使用中のカテゴリは削除できません。参照中の商品を確認してください。"
    });
  }
}

export async function deleteCategory(
  categoryId: string,
  options: DeleteCategoryOptions = {}
): Promise<CategoryMutationData> {
  const db = options.db ?? getFirestoreDb();
  const categoryReference = db.collection("categories").doc(categoryId);

  await assertCategoryExists(db, categoryId);
  await assertCategoryIsUnused(db, categoryId);
  await categoryReference.delete();

  return {
    categoryId
  };
}
