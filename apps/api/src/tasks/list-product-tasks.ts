import type { TaskItem, TaskListData, TaskListQuery } from "@handmade/shared";
import { taskListQuerySchema } from "@handmade/shared";
import type {
  Firestore,
  QueryDocumentSnapshot,
  Timestamp
} from "firebase-admin/firestore";
import type { ZodError } from "zod";
import { createValidationError } from "../errors/api-errors";
import { getFirestoreDb } from "../firebase/firebase-admin";
import {
  assertRelatedProductAvailable,
  type SnapshotLike
} from "../guards/firestore-business-guards";

interface TaskDocument {
  completedAt?: Timestamp | null;
  content?: string;
  dueDate?: string | null;
  isCompleted: boolean;
  memo?: string;
  name: string;
  taskId: string;
  updatedAt: Timestamp;
}

interface ListProductTasksOptions {
  db?: Firestore;
}

function toValidationErrorDetails(error: ZodError<TaskListQuery>) {
  return error.issues.map((issue) => ({
    field: typeof issue.path[0] === "string" ? issue.path[0] : "requestQuery",
    message: issue.message
  }));
}

function toIsoString(value: Timestamp | null | undefined) {
  return value ? value.toDate().toISOString() : null;
}

function toTaskItem(snapshot: QueryDocumentSnapshot<TaskDocument>): TaskItem {
  const task = snapshot.data();

  return {
    taskId: task.taskId,
    name: task.name,
    content: task.content ?? "",
    dueDate: task.dueDate ?? null,
    isCompleted: task.isCompleted,
    completedAt: toIsoString(task.completedAt),
    memo: task.memo ?? "",
    updatedAt: task.updatedAt.toDate().toISOString()
  };
}

function compareTasks(left: TaskItem, right: TaskItem) {
  if (left.isCompleted !== right.isCompleted) {
    return left.isCompleted ? 1 : -1;
  }

  if (left.dueDate && right.dueDate && left.dueDate !== right.dueDate) {
    return left.dueDate.localeCompare(right.dueDate);
  }

  if (left.dueDate && !right.dueDate) {
    return -1;
  }

  if (!left.dueDate && right.dueDate) {
    return 1;
  }

  return left.taskId.localeCompare(right.taskId);
}

export async function listProductTasks(
  productId: string,
  input: unknown,
  options: ListProductTasksOptions = {}
): Promise<TaskListData> {
  const parsedInput = taskListQuerySchema.safeParse(input);

  if (!parsedInput.success) {
    throw createValidationError(toValidationErrorDetails(parsedInput.error));
  }

  const db = options.db ?? getFirestoreDb();
  const productSnapshot = (await db
    .collection("products")
    .doc(productId)
    .get()) as unknown as SnapshotLike<unknown>;
  assertRelatedProductAvailable(productSnapshot);

  const taskSnapshot = (await db
    .collection("tasks")
    .where("productId", "==", productId)
    .get()) as unknown as {
    docs: Array<QueryDocumentSnapshot<TaskDocument>>;
  };
  const showCompleted = parsedInput.data.showCompleted ?? false;
  const items = taskSnapshot.docs
    .map(toTaskItem)
    .filter((task) => showCompleted || !task.isCompleted)
    .sort(compareTasks);

  return {
    items
  };
}
