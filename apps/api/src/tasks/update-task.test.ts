import { vi } from "vitest";
import {
  createDocumentSnapshot,
  createTimestamp
} from "../test/firestore-test-helpers";
import { updateTask } from "./update-task";

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

describe("updateTask", () => {
  it("updates editable fields and updatedAt for an open task", async () => {
    const { db, taskRef, transaction } = createDb();
    const now = createTimestamp("2026-04-25T09:00:00.000Z");

    await expect(
      updateTask(
        "task_000001",
        {
          content: "  Prepare display\r\nCheck stock ",
          dueDate: " 2026-04-30 ",
          isCompleted: false,
          memo: " Bring labels\r\nCheck price ",
          name: "  Display setup "
        },
        {
          db: db as never,
          now: () => now as never
        }
      )
    ).resolves.toEqual({
      completedAt: null,
      taskId: "task_000001"
    });

    expect(transaction.update).toHaveBeenCalledWith(taskRef, {
      completedAt: null,
      content: "  Prepare display\nCheck stock ",
      dueDate: "2026-04-30",
      isCompleted: false,
      memo: " Bring labels\nCheck price ",
      name: "Display setup",
      updatedAt: now
    });
  });

  it("sets completedAt when completing an open task", async () => {
    const { db, taskRef, transaction } = createDb();
    const now = createTimestamp("2026-04-25T09:00:00.000Z");

    await expect(
      updateTask(
        "task_000001",
        {
          isCompleted: true,
          name: "Display setup"
        },
        {
          db: db as never,
          now: () => now as never
        }
      )
    ).resolves.toEqual({
      completedAt: "2026-04-25T09:00:00.000Z",
      taskId: "task_000001"
    });

    expect(transaction.update).toHaveBeenCalledWith(taskRef, {
      completedAt: now,
      content: "",
      dueDate: null,
      isCompleted: true,
      memo: "",
      name: "Display setup",
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
      updateTask(
        "task_000001",
        {
          content: "Open again",
          dueDate: null,
          isCompleted: false,
          memo: "",
          name: "Display setup"
        },
        {
          db: db as never,
          now: () => now as never
        }
      )
    ).resolves.toEqual({
      completedAt: null,
      taskId: "task_000001"
    });

    expect(transaction.update).toHaveBeenCalledWith(taskRef, {
      completedAt: null,
      content: "Open again",
      dueDate: null,
      isCompleted: false,
      memo: "",
      name: "Display setup",
      updatedAt: now
    });
  });

  it("returns TASK_NOT_FOUND when the task does not exist", async () => {
    const { db, transaction } = createDb({
      taskExists: false
    });

    await expect(
      updateTask(
        "task_missing",
        {
          isCompleted: true,
          name: "Display setup"
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
      updateTask(
        "task_000001",
        {
          isCompleted: true,
          name: "Display setup"
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
      updateTask(
        "task_000001",
        {
          dueDate: "2026-02-30",
          isCompleted: "true",
          name: ""
        },
        { db: db as never }
      )
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      details: expect.arrayContaining([
        expect.objectContaining({
          field: "name"
        }),
        expect.objectContaining({
          field: "dueDate"
        }),
        expect.objectContaining({
          field: "isCompleted"
        })
      ]),
      statusCode: 400
    });
    expect(db.runTransaction).not.toHaveBeenCalled();
  });
});
