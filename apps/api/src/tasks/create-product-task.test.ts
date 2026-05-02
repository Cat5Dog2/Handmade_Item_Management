import { vi } from "vitest";
import {
  createDocumentSnapshot,
  createTimestamp
} from "../test/firestore-test-helpers";
import { createProductTask } from "./create-product-task";

function createDb({
  productExists = true,
  productIsDeleted = false
}: {
  productExists?: boolean;
  productIsDeleted?: boolean;
} = {}) {
  const productRef = {
    get: vi.fn().mockResolvedValue(
      createDocumentSnapshot(
        {
          isDeleted: productIsDeleted
        },
        productExists
      )
    )
  };
  const taskRef = {
    id: "task_000001"
  };
  const transaction = {
    get: vi.fn(async (reference: unknown) => {
      if (reference === productRef) {
        return productRef.get();
      }

      throw new Error("Unexpected transaction get reference");
    }),
    set: vi.fn()
  };
  const db = {
    collection: vi.fn((collectionName: string) => {
      if (collectionName === "products") {
        return {
          doc: vi.fn(() => productRef)
        };
      }

      if (collectionName === "tasks") {
        return {
          doc: vi.fn(() => taskRef)
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

describe("createProductTask", () => {
  it("creates an open task for an existing product", async () => {
    const { db, taskRef, transaction } = createDb();
    const createdAt = createTimestamp("2026-04-25T09:00:00.000Z");

    await expect(
      createProductTask(
        "HM-000001",
        {
          content: "  Prepare display\r\nCheck stock ",
          dueDate: " 2026-04-30 ",
          memo: " Bring labels ",
          name: "  Display setup "
        },
        {
          db: db as never,
          now: () => createdAt as never,
          taskIdFactory: () => "task_fixed001"
        }
      )
    ).resolves.toEqual({
      taskId: "task_fixed001",
      updatedAt: "2026-04-25T09:00:00.000Z"
    });

    expect(transaction.set).toHaveBeenCalledWith(taskRef, {
      completedAt: null,
      content: "  Prepare display\nCheck stock ",
      createdAt,
      dueDate: "2026-04-30",
      isCompleted: false,
      memo: " Bring labels ",
      name: "Display setup",
      productId: "HM-000001",
      taskId: "task_fixed001",
      updatedAt: createdAt
    });
  });

  it("stores optional fields as empty strings or null when omitted", async () => {
    const { db, taskRef, transaction } = createDb();
    const createdAt = createTimestamp("2026-04-25T09:00:00.000Z");

    await createProductTask(
      "HM-000001",
      {
        name: "Price tag"
      },
      {
        db: db as never,
        now: () => createdAt as never,
        taskIdFactory: () => "task_fixed002"
      }
    );

    expect(transaction.set).toHaveBeenCalledWith(taskRef, {
      completedAt: null,
      content: "",
      createdAt,
      dueDate: null,
      isCompleted: false,
      memo: "",
      name: "Price tag",
      productId: "HM-000001",
      taskId: "task_fixed002",
      updatedAt: createdAt
    });
  });

  it("returns PRODUCT_NOT_FOUND when the product does not exist", async () => {
    const { db, transaction } = createDb({
      productExists: false
    });

    await expect(
      createProductTask(
        "HM-000999",
        {
          name: "Display setup"
        },
        { db: db as never }
      )
    ).rejects.toMatchObject({
      code: "PRODUCT_NOT_FOUND",
      statusCode: 404
    });
    expect(transaction.set).not.toHaveBeenCalled();
  });

  it("returns PRODUCT_RELATED_RESOURCE_UNAVAILABLE for deleted products", async () => {
    const { db, transaction } = createDb({
      productIsDeleted: true
    });

    await expect(
      createProductTask(
        "HM-000001",
        {
          name: "Display setup"
        },
        { db: db as never }
      )
    ).rejects.toMatchObject({
      code: "PRODUCT_RELATED_RESOURCE_UNAVAILABLE",
      statusCode: 404
    });
    expect(transaction.set).not.toHaveBeenCalled();
  });

  it("returns VALIDATION_ERROR for invalid input", async () => {
    const { db } = createDb();

    await expect(
      createProductTask(
        "HM-000001",
        {
          dueDate: "2026-02-30",
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
        })
      ]),
      statusCode: 400
    });
    expect(db.runTransaction).not.toHaveBeenCalled();
  });
});
