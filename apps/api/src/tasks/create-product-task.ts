import { randomUUID } from "node:crypto";
import type { TaskCreateData, TaskCreateInput } from "@handmade/shared";
import { taskCreateInputSchema } from "@handmade/shared";
import type { Firestore, Timestamp } from "firebase-admin/firestore";
import { Timestamp as FirestoreTimestamp } from "firebase-admin/firestore";
import type { ZodError } from "zod";
import { createApiError, createValidationError } from "../errors/api-errors";
import { getFirestoreDb } from "../firebase/firebase-admin";

interface ProductDocument {
  isDeleted: boolean;
}

interface TaskDocument {
  completedAt: Timestamp | null;
  content: string;
  createdAt: Timestamp;
  dueDate: string | null;
  isCompleted: boolean;
  memo: string;
  name: string;
  productId: string;
  taskId: string;
  updatedAt: Timestamp;
}

interface SnapshotLike<T> {
  data: () => T;
  exists: boolean;
}

interface FirestoreTransactionLike {
  get(reference: unknown): Promise<SnapshotLike<unknown>>;
  set(reference: unknown, data: unknown): void;
}

interface CreateProductTaskOptions {
  db?: Firestore;
  now?: () => Timestamp;
  taskIdFactory?: () => string;
}

function createTaskId() {
  return `task_${randomUUID().replace(/-/g, "").slice(0, 8)}`;
}

function toValidationErrorDetails(error: ZodError<TaskCreateInput>) {
  return error.issues.map((issue) => ({
    field: typeof issue.path[0] === "string" ? issue.path[0] : "requestBody",
    message: issue.message
  }));
}

function createProductNotFoundError() {
  return createApiError({
    statusCode: 404,
    code: "PRODUCT_NOT_FOUND",
    message: "対象の商品が見つかりません。"
  });
}

function createRelatedResourceUnavailableError() {
  return createApiError({
    statusCode: 404,
    code: "PRODUCT_RELATED_RESOURCE_UNAVAILABLE",
    message: "この商品の関連情報は表示できません。"
  });
}

export async function createProductTask(
  productId: string,
  input: unknown,
  options: CreateProductTaskOptions = {}
): Promise<TaskCreateData> {
  const parsedInput = taskCreateInputSchema.safeParse(input);

  if (!parsedInput.success) {
    throw createValidationError(toValidationErrorDetails(parsedInput.error));
  }

  const db = options.db ?? getFirestoreDb();
  const now = options.now ?? FirestoreTimestamp.now;
  const taskId = options.taskIdFactory?.() ?? createTaskId();
  const productReference = db.collection("products").doc(productId);
  const taskReference = db.collection("tasks").doc(taskId);

  return db.runTransaction(async (transaction) => {
    const typedTransaction = transaction as unknown as FirestoreTransactionLike;
    const productSnapshot = await typedTransaction.get(productReference);

    if (!productSnapshot.exists) {
      throw createProductNotFoundError();
    }

    const product = productSnapshot.data() as ProductDocument;

    if (product.isDeleted) {
      throw createRelatedResourceUnavailableError();
    }

    const createdAt = now();
    const taskDocument: TaskDocument = {
      taskId,
      productId,
      name: parsedInput.data.name,
      content: parsedInput.data.content ?? "",
      dueDate: parsedInput.data.dueDate ?? null,
      isCompleted: false,
      completedAt: null,
      memo: parsedInput.data.memo ?? "",
      createdAt,
      updatedAt: createdAt
    };

    typedTransaction.set(taskReference, taskDocument);

    return {
      taskId,
      updatedAt: createdAt.toDate().toISOString()
    };
  });
}
