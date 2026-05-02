import { vi } from "vitest";
import {
  createDocumentSnapshot,
  createTimestamp
} from "../test/firestore-test-helpers";
import { listProductTasks } from "./list-product-tasks";

function createTask(overrides: {
  completedAt?: ReturnType<typeof createTimestamp> | null;
  content?: string;
  dueDate?: string | null;
  isCompleted?: boolean;
  memo?: string;
  name?: string;
  taskId: string;
  updatedAt?: ReturnType<typeof createTimestamp>;
}) {
  return createDocumentSnapshot({
    completedAt: overrides.completedAt ?? null,
    content: overrides.content ?? "",
    dueDate: overrides.dueDate ?? null,
    isCompleted: overrides.isCompleted ?? false,
    memo: overrides.memo ?? "",
    name: overrides.name ?? `Task ${overrides.taskId}`,
    taskId: overrides.taskId,
    updatedAt:
      overrides.updatedAt ?? createTimestamp("2026-04-18T08:00:00.000Z")
  });
}

function createDb({
  productExists = true,
  productIsDeleted = false,
  tasks = []
}: {
  productExists?: boolean;
  productIsDeleted?: boolean;
  tasks?: Array<ReturnType<typeof createTask>>;
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
  const tasksGet = vi.fn().mockResolvedValue({
    docs: tasks
  });
  const tasksWhere = vi.fn().mockReturnValue({
    get: tasksGet
  });
  const db = {
    collection: vi.fn((collectionName: string) => {
      if (collectionName === "products") {
        return {
          doc: vi.fn(() => productRef)
        };
      }

      if (collectionName === "tasks") {
        return {
          where: tasksWhere
        };
      }

      throw new Error(`Unexpected collection ${collectionName}`);
    })
  };

  return {
    db,
    productRef,
    tasksGet,
    tasksWhere
  };
}

describe("listProductTasks", () => {
  it("returns only open tasks by default sorted by due date with null due dates last", async () => {
    const { db, tasksWhere } = createDb({
      tasks: [
        createTask({
          dueDate: null,
          name: "No due date",
          taskId: "task_003"
        }),
        createTask({
          completedAt: createTimestamp("2026-04-17T10:00:00.000Z"),
          dueDate: "2026-04-19",
          isCompleted: true,
          name: "Completed task",
          taskId: "task_004"
        }),
        createTask({
          content: "Prepare the label",
          dueDate: "2026-04-21",
          memo: "Check stock",
          name: "Label",
          taskId: "task_002",
          updatedAt: createTimestamp("2026-04-18T09:30:00.000Z")
        }),
        createTask({
          dueDate: "2026-04-20",
          name: "Packing",
          taskId: "task_001"
        })
      ]
    });

    await expect(
      listProductTasks("HM-000001", {}, { db: db as never })
    ).resolves.toEqual({
      items: [
        {
          completedAt: null,
          content: "",
          dueDate: "2026-04-20",
          isCompleted: false,
          memo: "",
          name: "Packing",
          taskId: "task_001",
          updatedAt: "2026-04-18T08:00:00.000Z"
        },
        {
          completedAt: null,
          content: "Prepare the label",
          dueDate: "2026-04-21",
          isCompleted: false,
          memo: "Check stock",
          name: "Label",
          taskId: "task_002",
          updatedAt: "2026-04-18T09:30:00.000Z"
        },
        {
          completedAt: null,
          content: "",
          dueDate: null,
          isCompleted: false,
          memo: "",
          name: "No due date",
          taskId: "task_003",
          updatedAt: "2026-04-18T08:00:00.000Z"
        }
      ]
    });
    expect(tasksWhere).toHaveBeenCalledWith("productId", "==", "HM-000001");
  });

  it("includes completed tasks when showCompleted is true while keeping open tasks first", async () => {
    const { db } = createDb({
      tasks: [
        createTask({
          completedAt: createTimestamp("2026-04-17T10:00:00.000Z"),
          dueDate: "2026-04-19",
          isCompleted: true,
          name: "Completed task",
          taskId: "task_002"
        }),
        createTask({
          dueDate: "2026-04-21",
          name: "Open task",
          taskId: "task_001"
        })
      ]
    });

    await expect(
      listProductTasks(
        "HM-000001",
        {
          showCompleted: "true"
        },
        { db: db as never }
      )
    ).resolves.toEqual({
      items: [
        expect.objectContaining({
          isCompleted: false,
          taskId: "task_001"
        }),
        expect.objectContaining({
          completedAt: "2026-04-17T10:00:00.000Z",
          isCompleted: true,
          taskId: "task_002"
        })
      ]
    });
  });

  it("returns PRODUCT_NOT_FOUND when the product does not exist", async () => {
    const { db, tasksWhere } = createDb({
      productExists: false
    });

    await expect(
      listProductTasks("HM-000999", {}, { db: db as never })
    ).rejects.toMatchObject({
      code: "PRODUCT_NOT_FOUND",
      statusCode: 404
    });
    expect(tasksWhere).not.toHaveBeenCalled();
  });

  it("returns PRODUCT_RELATED_RESOURCE_UNAVAILABLE for deleted products", async () => {
    const { db, tasksWhere } = createDb({
      productIsDeleted: true
    });

    await expect(
      listProductTasks("HM-000001", {}, { db: db as never })
    ).rejects.toMatchObject({
      code: "PRODUCT_RELATED_RESOURCE_UNAVAILABLE",
      statusCode: 404
    });
    expect(tasksWhere).not.toHaveBeenCalled();
  });

  it("returns VALIDATION_ERROR for invalid query values", async () => {
    const { db } = createDb();

    await expect(
      listProductTasks(
        "HM-000001",
        {
          showCompleted: "invalid"
        },
        { db: db as never }
      )
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      details: [
        expect.objectContaining({
          field: "showCompleted"
        })
      ],
      statusCode: 400
    });
    expect(db.collection).not.toHaveBeenCalled();
  });
});
