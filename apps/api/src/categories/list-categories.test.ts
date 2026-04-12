import { vi } from "vitest";
import { listCategories } from "./list-categories";

function createTimestamp(isoString: string) {
  return {
    toDate: () => new Date(isoString)
  };
}

function createDocumentSnapshot<T>(data: T) {
  return {
    data: () => data
  };
}

describe("listCategories", () => {
  it("returns categories sorted by sortOrder and name with usage counts", async () => {
    const categoriesGet = vi.fn().mockResolvedValue({
      docs: [
        createDocumentSnapshot({
          categoryId: "cat-002",
          name: "イヤリング",
          sortOrder: 10,
          updatedAt: createTimestamp("2026-04-10T00:00:00.000Z")
        }),
        createDocumentSnapshot({
          categoryId: "cat-001",
          name: "ピアス",
          sortOrder: 20,
          updatedAt: createTimestamp("2026-04-11T00:00:00.000Z")
        })
      ]
    });
    const productsGet = vi.fn().mockResolvedValue({
      docs: [
        createDocumentSnapshot({
          categoryId: "cat-001"
        }),
        createDocumentSnapshot({
          categoryId: "cat-001"
        }),
        createDocumentSnapshot({
          categoryId: "cat-002"
        }),
        createDocumentSnapshot({
          categoryId: null
        })
      ]
    });
    const productsSelect = vi.fn().mockReturnValue({
      get: productsGet
    });
    const productsWhere = vi.fn().mockReturnValue({
      select: productsSelect
    });
    const categoriesOrderByName = vi.fn().mockReturnValue({
      get: categoriesGet
    });
    const categoriesOrderBySort = vi.fn().mockReturnValue({
      orderBy: categoriesOrderByName
    });
    const db = {
      collection: vi.fn((collectionName: string) => {
        if (collectionName === "categories") {
          return {
            orderBy: categoriesOrderBySort
          };
        }

        if (collectionName === "products") {
          return {
            where: productsWhere
          };
        }

        throw new Error(`Unexpected collection ${collectionName}`);
      })
    };

    const result = await listCategories({
      db: db as never
    });

    expect(categoriesOrderBySort).toHaveBeenCalledWith("sortOrder", "asc");
    expect(categoriesOrderByName).toHaveBeenCalledWith("name", "asc");
    expect(productsWhere).toHaveBeenCalledWith("isDeleted", "==", false);
    expect(productsSelect).toHaveBeenCalledWith("categoryId");
    expect(result).toEqual({
      items: [
        {
          categoryId: "cat-002",
          name: "イヤリング",
          sortOrder: 10,
          updatedAt: "2026-04-10T00:00:00.000Z",
          usedProductCount: 1,
          isInUse: true
        },
        {
          categoryId: "cat-001",
          name: "ピアス",
          sortOrder: 20,
          updatedAt: "2026-04-11T00:00:00.000Z",
          usedProductCount: 2,
          isInUse: true
        }
      ]
    });
  });

  it("returns zero usage for categories that are not referenced", async () => {
    const db = {
      collection: vi.fn((collectionName: string) => {
        if (collectionName === "categories") {
          return {
            orderBy: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                get: vi.fn().mockResolvedValue({
                  docs: [
                    createDocumentSnapshot({
                      categoryId: "cat-003",
                      name: "ブローチ",
                      sortOrder: 30,
                      updatedAt: createTimestamp("2026-04-12T00:00:00.000Z")
                    })
                  ]
                })
              })
            })
          };
        }

        if (collectionName === "products") {
          return {
            where: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                get: vi.fn().mockResolvedValue({
                  docs: [
                    createDocumentSnapshot({
                      categoryId: "cat-999"
                    })
                  ]
                })
              })
            })
          };
        }

        throw new Error(`Unexpected collection ${collectionName}`);
      })
    };

    const result = await listCategories({
      db: db as never
    });

    expect(result).toEqual({
      items: [
        {
          categoryId: "cat-003",
          name: "ブローチ",
          sortOrder: 30,
          updatedAt: "2026-04-12T00:00:00.000Z",
          usedProductCount: 0,
          isInUse: false
        }
      ]
    });
  });
});
