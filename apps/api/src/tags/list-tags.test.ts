import { vi } from "vitest";
import { listTags } from "./list-tags";

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

describe("listTags", () => {
  it("returns tags sorted by name with usage counts", async () => {
    const tagsGet = vi.fn().mockResolvedValue({
      docs: [
        createDocumentSnapshot({
          tagId: "tag-002",
          name: "夏",
          updatedAt: createTimestamp("2026-04-10T00:00:00.000Z")
        }),
        createDocumentSnapshot({
          tagId: "tag-001",
          name: "春",
          updatedAt: createTimestamp("2026-04-11T00:00:00.000Z")
        })
      ]
    });
    const productsGet = vi.fn().mockResolvedValue({
      docs: [
        createDocumentSnapshot({
          tagIds: ["tag-001", "tag-002"]
        }),
        createDocumentSnapshot({
          tagIds: ["tag-001", "tag-001"]
        }),
        createDocumentSnapshot({
          tagIds: null
        })
      ]
    });
    const productsSelect = vi.fn().mockReturnValue({
      get: productsGet
    });
    const productsWhere = vi.fn().mockReturnValue({
      select: productsSelect
    });
    const tagsOrderByName = vi.fn().mockReturnValue({
      get: tagsGet
    });
    const db = {
      collection: vi.fn((collectionName: string) => {
        if (collectionName === "tags") {
          return {
            orderBy: tagsOrderByName
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

    const result = await listTags({
      db: db as never
    });

    expect(tagsOrderByName).toHaveBeenCalledWith("name", "asc");
    expect(productsWhere).toHaveBeenCalledWith("isDeleted", "==", false);
    expect(productsSelect).toHaveBeenCalledWith("tagIds");
    expect(result).toEqual({
      items: [
        {
          tagId: "tag-002",
          name: "夏",
          updatedAt: "2026-04-10T00:00:00.000Z",
          usedProductCount: 1,
          isInUse: true
        },
        {
          tagId: "tag-001",
          name: "春",
          updatedAt: "2026-04-11T00:00:00.000Z",
          usedProductCount: 2,
          isInUse: true
        }
      ]
    });
  });

  it("returns zero usage for tags that are not referenced", async () => {
    const db = {
      collection: vi.fn((collectionName: string) => {
        if (collectionName === "tags") {
          return {
            orderBy: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                docs: [
                  createDocumentSnapshot({
                    tagId: "tag-003",
                    name: "秋",
                    updatedAt: createTimestamp("2026-04-12T00:00:00.000Z")
                  })
                ]
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
                      tagIds: ["tag-999"]
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

    const result = await listTags({
      db: db as never
    });

    expect(result).toEqual({
      items: [
        {
          tagId: "tag-003",
          name: "秋",
          updatedAt: "2026-04-12T00:00:00.000Z",
          usedProductCount: 0,
          isInUse: false
        }
      ]
    });
  });
});
