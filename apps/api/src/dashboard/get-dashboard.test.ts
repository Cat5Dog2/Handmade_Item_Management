import { PRODUCT_STATUSES } from "@handmade/shared";
import { vi } from "vitest";
import {
  createDocumentSnapshot,
  createTimestamp
} from "../test/firestore-test-helpers";
import { getDashboard } from "./get-dashboard";

function createProduct(overrides: {
  images?: Array<{
    displayPath: string;
    imageId: string;
    isPrimary: boolean;
    sortOrder: number;
    thumbnailPath: string;
  }>;
  name?: string;
  productId: string;
  status?: (typeof PRODUCT_STATUSES)[number];
  updatedAt: string;
}) {
  return createDocumentSnapshot({
    images: overrides.images ?? [],
    isDeleted: false,
    name: overrides.name ?? `Product ${overrides.productId}`,
    productId: overrides.productId,
    status: overrides.status ?? "onDisplay",
    updatedAt: createTimestamp(overrides.updatedAt)
  });
}

function createTask(overrides: {
  dueDate?: string | null;
  name?: string;
  productId: string;
  taskId: string;
}) {
  return createDocumentSnapshot({
    dueDate: overrides.dueDate ?? null,
    isCompleted: false,
    name: overrides.name ?? `Task ${overrides.taskId}`,
    productId: overrides.productId,
    taskId: overrides.taskId
  });
}

describe("getDashboard", () => {
  it("returns dashboard aggregates and excludes tasks for deleted products", async () => {
    const productDocs = [
      createProduct({
        images: [
          {
            displayPath: "products/HM-000001/display/img-secondary.webp",
            imageId: "img-secondary",
            isPrimary: false,
            sortOrder: 1,
            thumbnailPath: "products/HM-000001/thumb/img-secondary.webp"
          },
          {
            displayPath: "products/HM-000001/display/img-primary.webp",
            imageId: "img-primary",
            isPrimary: true,
            sortOrder: 2,
            thumbnailPath: "products/HM-000001/thumb/img-primary.webp"
          }
        ],
        name: "Blue Brooch",
        productId: "HM-000001",
        status: "onDisplay",
        updatedAt: "2026-04-24T01:00:00.000Z"
      }),
      createProduct({
        name: "Sold Pin",
        productId: "HM-000002",
        status: "sold",
        updatedAt: "2026-04-23T01:00:00.000Z"
      }),
      createProduct({
        name: "Production Charm",
        productId: "HM-000003",
        status: "inProduction",
        updatedAt: "2026-04-22T01:00:00.000Z"
      })
    ];
    const taskDocs = [
      createTask({
        dueDate: "2026-04-24",
        name: "Prepare backing card",
        productId: "HM-000001",
        taskId: "task_today"
      }),
      createTask({
        dueDate: "2026-05-01",
        name: "Pack display set",
        productId: "HM-000002",
        taskId: "task_day7"
      }),
      createTask({
        dueDate: "2026-05-02",
        name: "Future task",
        productId: "HM-000003",
        taskId: "task_day8"
      }),
      createTask({
        dueDate: "2026-04-25",
        name: "Deleted product task",
        productId: "HM-999999",
        taskId: "task_deleted_product"
      })
    ];
    const productsGet = vi.fn().mockResolvedValue({
      docs: productDocs
    });
    const tasksGet = vi.fn().mockResolvedValue({
      docs: taskDocs
    });
    const productsWhere = vi.fn().mockReturnValue({
      get: productsGet
    });
    const tasksWhere = vi.fn().mockReturnValue({
      get: tasksGet
    });
    const db = {
      collection: vi.fn((collectionName: string) => {
        if (collectionName === "products") {
          return {
            where: productsWhere
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
    const fileMock = vi.fn((path: string) => ({
      getSignedUrl: vi.fn().mockResolvedValue([`https://example.com/${path}`])
    }));
    const bucket = {
      file: fileMock
    };

    await expect(
      getDashboard({
        bucket: bucket as never,
        db: db as never,
        now: () => new Date("2026-04-24T03:00:00.000Z"),
        signedUrlExpiresMinutes: 60
      })
    ).resolves.toEqual({
      statusCounts: {
        beforeProduction: 0,
        inProduction: 1,
        completed: 0,
        onDisplay: 1,
        inStock: 0,
        sold: 1
      },
      soldCount: 1,
      openTaskCount: 3,
      dueSoonTasks: [
        {
          dueDate: "2026-04-24",
          productId: "HM-000001",
          productName: "Blue Brooch",
          taskId: "task_today",
          taskName: "Prepare backing card"
        },
        {
          dueDate: "2026-05-01",
          productId: "HM-000002",
          productName: "Sold Pin",
          taskId: "task_day7",
          taskName: "Pack display set"
        }
      ],
      recentProducts: [
        {
          productId: "HM-000001",
          name: "Blue Brooch",
          status: "onDisplay",
          updatedAt: "2026-04-24T01:00:00.000Z",
          thumbnailUrl: "https://example.com/products/HM-000001/thumb/img-primary.webp"
        },
        {
          productId: "HM-000002",
          name: "Sold Pin",
          status: "sold",
          updatedAt: "2026-04-23T01:00:00.000Z",
          thumbnailUrl: null
        },
        {
          productId: "HM-000003",
          name: "Production Charm",
          status: "inProduction",
          updatedAt: "2026-04-22T01:00:00.000Z",
          thumbnailUrl: null
        }
      ]
    });

    expect(productsWhere).toHaveBeenCalledWith("isDeleted", "==", false);
    expect(tasksWhere).toHaveBeenCalledWith("isCompleted", "==", false);
    expect(fileMock).toHaveBeenCalledWith(
      "products/HM-000001/thumb/img-primary.webp"
    );
  });

  it("limits recent products to five items in updatedAt descending order", async () => {
    const productDocs = Array.from({ length: 6 }, (_, index) =>
      createProduct({
        productId: `HM-00000${index + 1}`,
        updatedAt: `2026-04-${String(index + 10).padStart(2, "0")}T01:00:00.000Z`
      })
    );
    const db = {
      collection: vi.fn((collectionName: string) => {
        if (collectionName === "products") {
          return {
            where: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                docs: productDocs
              })
            })
          };
        }

        if (collectionName === "tasks") {
          return {
            where: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                docs: []
              })
            })
          };
        }

        throw new Error(`Unexpected collection ${collectionName}`);
      })
    };

    const result = await getDashboard({
      bucket: {
        file: vi.fn()
      } as never,
      db: db as never
    });

    expect(result.recentProducts.map((product) => product.productId)).toEqual([
      "HM-000006",
      "HM-000005",
      "HM-000004",
      "HM-000003",
      "HM-000002"
    ]);
  });

  it("returns zero aggregates when there are no products or tasks", async () => {
    const db = {
      collection: vi.fn(() => ({
        where: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({
            docs: []
          })
        })
      }))
    };

    await expect(
      getDashboard({
        bucket: {
          file: vi.fn()
        } as never,
        db: db as never
      })
    ).resolves.toEqual({
      statusCounts: {
        beforeProduction: 0,
        inProduction: 0,
        completed: 0,
        onDisplay: 0,
        inStock: 0,
        sold: 0
      },
      soldCount: 0,
      openTaskCount: 0,
      dueSoonTasks: [],
      recentProducts: []
    });
  });
});
