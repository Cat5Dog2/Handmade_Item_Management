import { vi } from "vitest";
import { listProducts } from "./list-products";

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

describe("listProducts", () => {
  it("returns filtered products with thumbnail URLs and pagination meta", async () => {
    const productsGet = vi.fn().mockResolvedValue({
      docs: [
        createDocumentSnapshot({
          categoryId: "cat-a",
          description: "Plain piece",
          images: [
            {
              displayPath: "products/HM-000001/display/img-001.webp",
              imageId: "img-001",
              isPrimary: true,
              sortOrder: 1,
              thumbnailPath: "products/HM-000001/thumb/img-001.webp"
            }
          ],
          isDeleted: false,
          name: "Plain Pin",
          productId: "HM-000001",
          soldAt: null,
          status: "onDisplay",
          tagIds: ["tag-a"],
          updatedAt: createTimestamp("2026-04-17T12:00:00.000Z")
        }),
        createDocumentSnapshot({
          categoryId: "cat-a",
          description: "Plain piece",
          images: [
            {
              displayPath: "products/HM-000002/display/img-001.webp",
              imageId: "img-001",
              isPrimary: true,
              sortOrder: 1,
              thumbnailPath: "products/HM-000002/thumb/img-001.webp"
            }
          ],
          isDeleted: false,
          name: "Plain Pin Sold",
          productId: "HM-000002",
          soldAt: createTimestamp("2026-04-18T00:00:00.000Z"),
          status: "sold",
          tagIds: ["tag-a"],
          updatedAt: createTimestamp("2026-04-18T12:00:00.000Z")
        }),
        createDocumentSnapshot({
          categoryId: "cat-b",
          description: "Other piece",
          images: [],
          isDeleted: false,
          name: "Other",
          productId: "HM-000003",
          soldAt: null,
          status: "onDisplay",
          tagIds: ["tag-b"],
          updatedAt: createTimestamp("2026-04-16T12:00:00.000Z")
        })
      ]
    });
    const productsWhere = vi.fn().mockReturnValue({
      get: productsGet
    });
    const categoriesGet = vi.fn().mockResolvedValue({
      docs: [
        createDocumentSnapshot({
          categoryId: "cat-a",
          name: "Accessories"
        }),
        createDocumentSnapshot({
          categoryId: "cat-b",
          name: "Bags"
        })
      ]
    });
    const tagsGet = vi.fn().mockResolvedValue({
      docs: [
        createDocumentSnapshot({
          name: "Spring",
          tagId: "tag-a"
        }),
        createDocumentSnapshot({
          name: "Featured",
          tagId: "tag-b"
        })
      ]
    });
    const fileMock = vi.fn().mockReturnValue({
      getSignedUrl: vi.fn().mockResolvedValue([
        "https://example.com/products/HM-000001/thumb/img-001.webp"
      ])
    });
    const bucket = {
      file: fileMock
    };
    const db = {
      collection: vi.fn((collectionName: string) => {
        if (collectionName === "products") {
          return {
            where: productsWhere
          };
        }

        if (collectionName === "categories") {
          return {
            get: categoriesGet
          };
        }

        if (collectionName === "tags") {
          return {
            get: tagsGet
          };
        }

        throw new Error(`Unexpected collection ${collectionName}`);
      })
    };

    await expect(
      listProducts(
        {
          categoryId: "cat-a",
          includeSold: "false",
          keyword: " spring ",
          page: "1",
          pageSize: "1",
          sortBy: "updatedAt",
          sortOrder: "desc",
          status: "onDisplay",
          tagId: "tag-a"
        },
        {
          bucket: bucket as never,
          db: db as never,
          now: () => new Date("2026-04-18T00:00:00.000Z"),
          signedUrlExpiresMinutes: 60
        }
      )
    ).resolves.toEqual({
      data: {
        items: [
          {
            productId: "HM-000001",
            name: "Plain Pin",
            status: "onDisplay",
            categoryName: "Accessories",
            updatedAt: "2026-04-17T12:00:00.000Z",
            thumbnailUrl:
              "https://example.com/products/HM-000001/thumb/img-001.webp"
          }
        ]
      },
      meta: {
        page: 1,
        pageSize: 1,
        totalCount: 1,
        hasNext: false
      }
    });

    expect(productsWhere).toHaveBeenCalledWith("isDeleted", "==", false);
    expect(fileMock).toHaveBeenCalledWith("products/HM-000001/thumb/img-001.webp");
  });

  it("keeps sold products when status=sold even if includeSold is false", async () => {
    const productsGet = vi.fn().mockResolvedValue({
      docs: [
        createDocumentSnapshot({
          categoryId: "cat-a",
          description: "Sold piece",
          images: [
            {
              displayPath: "products/HM-000010/display/img-010.webp",
              imageId: "img-010",
              isPrimary: true,
              sortOrder: 1,
              thumbnailPath: "products/HM-000010/thumb/img-010.webp"
            }
          ],
          isDeleted: false,
          name: "Sold Pin",
          productId: "HM-000010",
          soldAt: createTimestamp("2026-04-18T00:00:00.000Z"),
          status: "sold",
          tagIds: ["tag-a"],
          updatedAt: createTimestamp("2026-04-18T12:00:00.000Z")
        })
      ]
    });
    const db = {
      collection: vi.fn((collectionName: string) => {
        if (collectionName === "products") {
          return {
            where: vi.fn().mockReturnValue({
              get: productsGet
            })
          };
        }

        if (collectionName === "categories") {
          return {
            get: vi.fn().mockResolvedValue({
              docs: [
                createDocumentSnapshot({
                  categoryId: "cat-a",
                  name: "Accessories"
                })
              ]
            })
          };
        }

        if (collectionName === "tags") {
          return {
            get: vi.fn().mockResolvedValue({
              docs: [
                createDocumentSnapshot({
                  name: "Spring",
                  tagId: "tag-a"
                })
              ]
            })
          };
        }

        throw new Error(`Unexpected collection ${collectionName}`);
      })
    };

    await expect(
      listProducts(
        {
          includeSold: "false",
          status: "sold"
        },
        {
          db: db as never,
          bucket: {
            file: vi.fn().mockReturnValue({
              getSignedUrl: vi.fn().mockResolvedValue(["https://example.com"])
            })
          } as never
        }
      )
    ).resolves.toMatchObject({
      data: {
        items: [
          {
            productId: "HM-000010",
            status: "sold"
          }
        ]
      },
      meta: {
        totalCount: 1
      }
    });
  });

  it("rejects invalid list queries", async () => {
    await expect(
      listProducts({
        keyword: "a".repeat(101)
      })
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR"
    });
  });
});
