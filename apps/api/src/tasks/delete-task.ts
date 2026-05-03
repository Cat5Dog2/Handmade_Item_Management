import type { TaskDeleteData } from "@handmade/shared";
import type { Firestore } from "firebase-admin/firestore";
import { createApiError } from "../errors/api-errors";
import { getFirestoreDb } from "../firebase/firebase-admin";
import {
  assertRelatedProductAvailable,
  type SnapshotLike
} from "../guards/firestore-business-guards";

interface TaskDocument {
  productId: string;
  taskId: string;
}

interface FirestoreTransactionLike {
  delete(reference: unknown): void;
  get(reference: unknown): Promise<SnapshotLike<unknown>>;
}

interface DeleteTaskOptions {
  db?: Firestore;
}

function createTaskNotFoundError() {
  return createApiError({
    statusCode: 404,
    code: "TASK_NOT_FOUND",
    message: "対象のタスクが見つかりません。"
  });
}

export async function deleteTask(
  taskId: string,
  options: DeleteTaskOptions = {}
): Promise<TaskDeleteData> {
  const db = options.db ?? getFirestoreDb();
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

    typedTransaction.delete(taskReference);

    return {
      taskId: task.taskId
    };
  });
}
