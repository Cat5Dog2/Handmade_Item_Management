import type { TaskItem, TaskListData, TaskListQuery } from "@handmade/shared";
import { taskListQuerySchema } from "@handmade/shared";
import type {
  Firestore,
  QueryDocumentSnapshot,
  Timestamp
} from "firebase-admin/firestore";
import type { ZodError } from "zod";
import { createApiError, createValidationError } from "../errors/api-errors";
import { getFirestoreDb } from "../firebase/firebase-admin";

interface ProductDocument {
  isDeleted: boolean;
}

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

interface SnapshotLike<T> {
  data: () => T;
  exists: boolean;
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
    .get()) as unknown as SnapshotLike<ProductDocument>;

  if (!productSnapshot.exists) {
    throw createProductNotFoundError();
  }

  const product = productSnapshot.data();

  if (product.isDeleted) {
    throw createRelatedResourceUnavailableError();
  }

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
