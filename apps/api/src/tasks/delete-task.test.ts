import { vi } from "vitest";
import { createDocumentSnapshot } from "../test/firestore-test-helpers";
import { deleteTask } from "./delete-task";

function createDb({
  taskExists = true,
  productExists = true,
  productIsDeleted = false
}: {
  taskExists?: boolean;
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
    delete: vi.fn(),
    get: vi.fn(async (reference: unknown) => {
      if (reference === taskRef) {
        return taskSnapshot;
      }

      if (reference === productRef) {
        return productSnapshot;
      }

      throw new Error("Unexpected transaction get reference");
    })
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

describe("deleteTask", () => {
  it("physically deletes an existing task for an available product", async () => {
    const { db, taskRef, transaction } = createDb();

    await expect(
      deleteTask("task_000001", {
        db: db as never
      })
    ).resolves.toEqual({
      taskId: "task_000001"
    });

    expect(transaction.delete).toHaveBeenCalledWith(taskRef);
  });

  it("returns TASK_NOT_FOUND when the task does not exist", async () => {
    const { db, transaction } = createDb({
      taskExists: false
    });

    await expect(
      deleteTask("task_missing", {
        db: db as never
      })
    ).rejects.toMatchObject({
      code: "TASK_NOT_FOUND",
      statusCode: 404
    });
    expect(transaction.delete).not.toHaveBeenCalled();
  });

  it("returns PRODUCT_RELATED_RESOURCE_UNAVAILABLE for deleted products", async () => {
    const { db, transaction } = createDb({
      productIsDeleted: true
    });

    await expect(
      deleteTask("task_000001", {
        db: db as never
      })
    ).rejects.toMatchObject({
      code: "PRODUCT_RELATED_RESOURCE_UNAVAILABLE",
      statusCode: 404
    });
    expect(transaction.delete).not.toHaveBeenCalled();
  });
});
