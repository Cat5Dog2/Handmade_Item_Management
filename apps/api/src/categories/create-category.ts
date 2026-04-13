import { randomUUID } from "node:crypto";
import type { CategoryInput, CategoryMutationData } from "@handmade/shared";
import { categoryInputSchema } from "@handmade/shared";
import type { Firestore, Timestamp } from "firebase-admin/firestore";
import { Timestamp as FirestoreTimestamp } from "firebase-admin/firestore";
import type { ZodError } from "zod";
import { createApiError, createValidationError } from "../errors/api-errors";
import { getFirestoreDb } from "../firebase/firebase-admin";

interface CategoryDocument {
  categoryId: string;
  createdAt: Timestamp;
  name: string;
  sortOrder: number;
  updatedAt: Timestamp;
}

interface CreateCategoryOptions {
  categoryIdFactory?: () => string;
  db?: Firestore;
  now?: () => Timestamp;
}

function createCategoryId() {
  return `cat_${randomUUID().replace(/-/g, "").slice(0, 8)}`;
}

function toValidationErrorDetails(error: ZodError<CategoryInput>) {
  return error.issues.map((issue) => ({
    field: typeof issue.path[0] === "string" ? issue.path[0] : "requestBody",
    message: issue.message
  }));
}

async function getNextCategorySortOrder(db: Firestore) {
  const snapshot = (await db
    .collection("categories")
    .orderBy("sortOrder", "desc")
    .limit(1)
    .get()) as unknown as {
    docs: Array<{
      data: () => {
        sortOrder: number;
      };
    }>;
  };
  const currentMaxSortOrder = snapshot.docs[0]?.data().sortOrder ?? 0;

  return currentMaxSortOrder + 1;
}

async function assertCategoryNameIsUnique(db: Firestore, categoryName: string) {
  const snapshot = (await db
    .collection("categories")
    .where("name", "==", categoryName)
    .limit(1)
    .get()) as unknown as {
    docs: Array<unknown>;
  };

  if (snapshot.docs.length > 0) {
    throw createApiError({
      statusCode: 400,
      code: "DUPLICATE_NAME",
      details: [
        {
          field: "name",
          message: "同じ名前のカテゴリは登録できません。"
        }
      ],
      message: "同じ名前は登録できません。"
    });
  }
}

export async function createCategory(
  input: unknown,
  options: CreateCategoryOptions = {}
): Promise<CategoryMutationData> {
  const parsedInput = categoryInputSchema.safeParse(input);

  if (!parsedInput.success) {
    throw createValidationError(toValidationErrorDetails(parsedInput.error));
  }

  const db = options.db ?? getFirestoreDb();
  const now = options.now ?? FirestoreTimestamp.now;
  const categoryId = options.categoryIdFactory?.() ?? createCategoryId();
  const categoryName = parsedInput.data.name;

  await assertCategoryNameIsUnique(db, categoryName);

  const sortOrder =
    parsedInput.data.sortOrder ?? (await getNextCategorySortOrder(db));
  const createdAt = now();
  const categoryDocument: CategoryDocument = {
    categoryId,
    name: categoryName,
    sortOrder,
    createdAt,
    updatedAt: createdAt
  };

  await db.collection("categories").doc(categoryId).set(categoryDocument);

  return {
    categoryId
  };
}
