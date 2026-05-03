import type { TaskUpdateData, TaskUpdateInput } from "@handmade/shared";
import { taskUpdateInputSchema } from "@handmade/shared";
import type { Firestore, Timestamp } from "firebase-admin/firestore";
import { Timestamp as FirestoreTimestamp } from "firebase-admin/firestore";
import type { ZodError } from "zod";
import { createApiError, createValidationError } from "../errors/api-errors";
import { getFirestoreDb } from "../firebase/firebase-admin";
import {
  assertRelatedProductAvailable,
  type SnapshotLike
} from "../guards/firestore-business-guards";

interface TaskDocument {
  completedAt?: Timestamp | null;
  isCompleted: boolean;
  productId: string;
  taskId: string;
}

interface FirestoreTransactionLike {
  get(reference: unknown): Promise<SnapshotLike<unknown>>;
  update(reference: unknown, data: unknown): void;
}

interface UpdateTaskOptions {
  db?: Firestore;
  now?: () => Timestamp;
}

function toValidationErrorDetails(error: ZodError<TaskUpdateInput>) {
  return error.issues.map((issue) => ({
    field: typeof issue.path[0] === "string" ? issue.path[0] : "requestBody",
    message: issue.message
  }));
}

function createTaskNotFoundError() {
  return createApiError({
    statusCode: 404,
    code: "TASK_NOT_FOUND",
    message: "対象のタスクが見つかりません。"
  });
}

function resolveCompletedAt(
  task: TaskDocument,
  isCompleted: boolean,
  updatedAt: Timestamp
) {
  if (!isCompleted) {
    return null;
  }

  return task.isCompleted ? task.completedAt ?? updatedAt : updatedAt;
}

export async function updateTask(
  taskId: string,
  input: unknown,
  options: UpdateTaskOptions = {}
): Promise<TaskUpdateData> {
  const parsedInput = taskUpdateInputSchema.safeParse(input);

  if (!parsedInput.success) {
    throw createValidationError(toValidationErrorDetails(parsedInput.error));
  }

  const db = options.db ?? getFirestoreDb();
  const now = options.now ?? FirestoreTimestamp.now;
  const taskReference = db.collection("tasks").doc(taskId);

  return db.runTransaction(async (transaction) => {
    const typedTransaction = transaction as unknown as FirestoreTransactionLike;
    const taskSnapshot = await typedTransaction.get(taskReference);

    if (!taskSnapshot.exists) {
      throw createTaskNotFoundError();
    }

    const task = taskSnapshot.data() as TaskDocument;
    const productReference = db.collection("products").doc(task.productId);
    const productSnapshot = await typedTransaction.get(productReference);
    assertRelatedProductAvailable(productSnapshot);

    const updatedAt = now();
    const completedAt = resolveCompletedAt(
      task,
      parsedInput.data.isCompleted,
      updatedAt
    );

    typedTransaction.update(taskReference, {
      name: parsedInput.data.name,
      content: parsedInput.data.content ?? "",
      dueDate: parsedInput.data.dueDate ?? null,
      memo: parsedInput.data.memo ?? "",
      isCompleted: parsedInput.data.isCompleted,
      completedAt,
      updatedAt
    });

    return {
      taskId: task.taskId,
      completedAt: completedAt?.toDate().toISOString() ?? null
    };
  });
}
