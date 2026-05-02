import { randomUUID } from "node:crypto";
import type { TaskCreateData, TaskCreateInput } from "@handmade/shared";
import { taskCreateInputSchema } from "@handmade/shared";
import type { Firestore, Timestamp } from "firebase-admin/firestore";
import { Timestamp as FirestoreTimestamp } from "firebase-admin/firestore";
import type { ZodError } from "zod";
import { createValidationError } from "../errors/api-errors";
import { getFirestoreDb } from "../firebase/firebase-admin";
import {
  assertRelatedProductAvailable,
  type SnapshotLike
} from "../guards/firestore-business-guards";

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
    assertRelatedProductAvailable(productSnapshot);

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
