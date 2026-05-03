import { vi } from "vitest";
import {
  createDocumentSnapshot,
  createTimestamp
} from "../test/firestore-test-helpers";
import { updateTaskCompletion } from "./update-task-completion";

function createDb({
  taskExists = true,
  taskIsCompleted = false,
  taskCompletedAt = null,
  productExists = true,
  productIsDeleted = false
}: {
  taskExists?: boolean;
  taskIsCompleted?: boolean;
  taskCompletedAt?: ReturnType<typeof createTimestamp> | null;
  productExists?: boolean;
  productIsDeleted?: boolean;
} = {}) {
  const taskRef = {
    id: "task_000001"
  };
  const productRef = {
    id: "HM-000001"
  };
  const taskSnapshot = createDocumentSnapshot(
    {
      completedAt: taskCompletedAt,
      isCompleted: taskIsCompleted,
      productId: "HM-000001",
      taskId: "task_000001"
    },
    taskExists
  );
  const productSnapshot = createDocumentSnapshot(
    {
      isDeleted: productIsDeleted
    },
    productExists
  );
  const transaction = {
    get: vi.fn(async (reference: unknown) => {
      if (reference === taskRef) {
        return taskSnapshot;
      }

      if (reference === productRef) {
        return productSnapshot;
      }

      throw new Error("Unexpected transaction get reference");
    }),
    update: vi.fn()
  };
  const db = {
    collection: vi.fn((collectionName: string) => {
      if (collectionName === "tasks") {
        return {
          doc: vi.fn(() => taskRef)
        };
      }

      if (collectionName === "products") {
        return {
          doc: vi.fn(() => productRef)
        };
      }

      throw new Error(`Unexpected collection ${collectionName}`);
    }),
    runTransaction: vi.fn(async (callback: (tx: unknown) => unknown) =>
      callback(transaction)
    )
  };

  return {
    db,
    productRef,
    taskRef,
    transaction
  };
}

describe("updateTaskCompletion", () => {
  it("sets completedAt and updatedAt when completing an open task", async () => {
    const { db, taskRef, transaction } = createDb();
    const now = createTimestamp("2026-04-25T09:00:00.000Z");

    await expect(
      updateTaskCompletion(
        "task_000001",
        {
          isCompleted: true
        },
        {
          db: db as never,
          now: () => now as never
        }
      )
    ).resolves.toEqual({
      completedAt: "2026-04-25T09:00:00.000Z",
      isCompleted: true,
      taskId: "task_000001",
      updatedAt: "2026-04-25T09:00:00.000Z"
    });

    expect(transaction.update).toHaveBeenCalledWith(taskRef, {
      completedAt: now,
      isCompleted: true,
      updatedAt: now
    });
  });

  it("keeps an existing completedAt when the task is already completed", async () => {
    const completedAt = createTimestamp("2026-04-20T09:00:00.000Z");
    const { db, taskRef, transaction } = createDb({
      taskCompletedAt: completedAt,
      taskIsCompleted: true
    });
    const now = createTimestamp("2026-04-25T09:00:00.000Z");

    await expect(
      updateTaskCompletion(
        "task_000001",
        {
          isCompleted: true
        },
        {
          db: db as never,
          now: () => now as never
        }
      )
    ).resolves.toEqual({
      completedAt: "2026-04-20T09:00:00.000Z",
      isCompleted: true,
      taskId: "task_000001",
      updatedAt: "2026-04-25T09:00:00.000Z"
    });

    expect(transaction.update).toHaveBeenCalledWith(taskRef, {
      completedAt,
      isCompleted: true,
      updatedAt: now
    });
  });

  it("clears completedAt when returning a completed task to open", async () => {
    const { db, taskRef, transaction } = createDb({
      taskCompletedAt: createTimestamp("2026-04-20T09:00:00.000Z"),
      taskIsCompleted: true
    });
    const now = createTimestamp("2026-04-25T09:00:00.000Z");

    await expect(
      updateTaskCompletion(
        "task_000001",
        {
          isCompleted: false
        },
        {
          db: db as never,
          now: () => now as never
        }
      )
    ).resolves.toEqual({
      completedAt: null,
      isCompleted: false,
      taskId: "task_000001",
      updatedAt: "2026-04-25T09:00:00.000Z"
    });

    expect(transaction.update).toHaveBeenCalledWith(taskRef, {
      completedAt: null,
      isCompleted: false,
      updatedAt: now
    });
  });

  it("returns TASK_NOT_FOUND when the task does not exist", async () => {
    const { db, transaction } = createDb({
      taskExists: false
    });

    await expect(
      updateTaskCompletion(
        "task_missing",
        {
          isCompleted: true
        },
        { db: db as never }
      )
    ).rejects.toMatchObject({
      code: "TASK_NOT_FOUND",
      statusCode: 404
    });
    expect(transaction.update).not.toHaveBeenCalled();
  });

  it("returns PRODUCT_RELATED_RESOURCE_UNAVAILABLE for deleted products", async () => {
    const { db, transaction } = createDb({
      productIsDeleted: true
    });

    await expect(
      updateTaskCompletion(
        "task_000001",
        {
          isCompleted: true
        },
        { db: db as never }
      )
    ).rejects.toMatchObject({
      code: "PRODUCT_RELATED_RESOURCE_UNAVAILABLE",
      statusCode: 404
    });
    expect(transaction.update).not.toHaveBeenCalled();
  });

  it("returns VALIDATION_ERROR for invalid input", async () => {
    const { db } = createDb();

    await expect(
      updateTaskCompletion(
        "task_000001",
        {
          isCompleted: "true"
        },
        { db: db as never }
      )
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      details: expect.arrayContaining([
        expect.objectContaining({
          field: "isCompleted"
        })
      ]),
      statusCode: 400
    });
    expect(db.runTransaction).not.toHaveBeenCalled();
  });
});
