import { vi } from "vitest";
import { getProduct } from "./get-product";

function createTimestamp(isoString: string) {
  return {
    toDate: () => new Date(isoString)
  };
}

function createDocumentSnapshot<T>(data: T, exists = true) {
  return {
    data: () => data,
    exists
  };
}

describe("getProduct", () => {
  it("returns product details with signed image URLs and task summary", async () => {
    const productId = "HM-000001";
    const productRef = {
      get: vi.fn().mockResolvedValue(
        createDocumentSnapshot({
          categoryId: "cat-a",
          createdAt: createTimestamp("2026-04-18T08:00:00.000Z"),
          description: "Handmade pin",
          images: [
            {
              displayPath: "products/HM-000001/display/img-002.webp",
              imageId: "img-002",
              isPrimary: false,
              sortOrder: 2,
              thumbnailPath: "products/HM-000001/thumb/img-002.webp"
            },
            {
              displayPath: "products/HM-000001/display/img-001.webp",
              imageId: "img-001",
              isPrimary: true,
              sortOrder: 1,
              thumbnailPath: "products/HM-000001/thumb/img-001.webp"
            }
          ],
          isDeleted: false,
          name: "Fancy Pin",
          price: 2800,
          productId,
          qrCodeValue: productId,
          soldAt: createTimestamp("2026-04-18T08:30:00.000Z"),
          status: "onDisplay",
          tagIds: ["tag-b", "tag-a"],
          updatedAt: createTimestamp("2026-04-18T09:30:00.000Z")
        })
      )
    };
    const categoryRef = {
      get: vi.fn().mockResolvedValue(
        createDocumentSnapshot({
          name: "Accessories"
        })
      )
    };
    const tagRefA = {
      get: vi.fn().mockResolvedValue(
        createDocumentSnapshot({
          name: "Spring"
        })
      )
    };
    const tagRefB = {
      get: vi.fn().mockResolvedValue(
        createDocumentSnapshot({
          name: "Featured"
        })
      )
    };
    const tasksWhere = vi.fn().mockReturnValue({
      get: vi.fn().mockResolvedValue({
        docs: [
          createDocumentSnapshot({
            isCompleted: false
          }),
          createDocumentSnapshot({
            isCompleted: true
          }),
          createDocumentSnapshot({
            isCompleted: false
          })
        ]
      })
    });
    const fileMock = vi.fn((path: string) => ({
      getSignedUrl: vi.fn().mockResolvedValue([`https://example.com/${path}`])
    }));
    const db = {
      collection: vi.fn((collectionName: string) => {
        if (collectionName === "products") {
          return {
            doc: vi.fn((inputProductId: string) => {
              if (inputProductId === productId) {
                return productRef;
              }

              throw new Error(`Unexpected product ${inputProductId}`);
            })
          };
        }

        if (collectionName === "categories") {
          return {
            doc: vi.fn((categoryId: string) => {
              if (categoryId === "cat-a") {
                return categoryRef;
              }

              throw new Error(`Unexpected category ${categoryId}`);
            })
          };
        }

        if (collectionName === "tags") {
          return {
            doc: vi.fn((tagId: string) => {
              if (tagId === "tag-a") {
                return tagRefA;
              }

              if (tagId === "tag-b") {
                return tagRefB;
              }

              throw new Error(`Unexpected tag ${tagId}`);
            })
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

    await expect(
      getProduct(productId, {
        bucket: {
          file: fileMock
        } as never,
        db: db as never,
        now: () => new Date("2026-04-18T09:00:00.000Z"),
        signedUrlExpiresMinutes: 60
      })
    ).resolves.toEqual({
      product: {
        categoryId: "cat-a",
        categoryName: "Accessories",
        createdAt: "2026-04-18T08:00:00.000Z",
        description: "Handmade pin",
        name: "Fancy Pin",
        price: 2800,
        productId,
        soldAt: "2026-04-18T08:30:00.000Z",
        status: "onDisplay",
        tagIds: ["tag-b", "tag-a"],
        tagNames: ["Featured", "Spring"],
        updatedAt: "2026-04-18T09:30:00.000Z"
      },
      images: [
        {
          displayUrl:
            "https://example.com/products/HM-000001/display/img-001.webp",
          imageId: "img-001",
          isPrimary: true,
          sortOrder: 1,
          thumbnailUrl:
            "https://example.com/products/HM-000001/thumb/img-001.webp",
          urlExpiresAt: "2026-04-18T10:00:00.000Z"
        },
        {
          displayUrl:
            "https://example.com/products/HM-000001/display/img-002.webp",
          imageId: "img-002",
          isPrimary: false,
          sortOrder: 2,
          thumbnailUrl:
            "https://example.com/products/HM-000001/thumb/img-002.webp",
          urlExpiresAt: "2026-04-18T10:00:00.000Z"
        }
      ],
      tasksSummary: {
        completedCount: 1,
        openCount: 2
      },
      qrCodeValue: productId
    });

    expect(tasksWhere).toHaveBeenCalledWith("productId", "==", productId);
    expect(fileMock).toHaveBeenCalledTimes(4);
    expect(fileMock).toHaveBeenCalledWith(
      "products/HM-000001/display/img-001.webp"
    );
    expect(fileMock).toHaveBeenCalledWith(
      "products/HM-000001/thumb/img-001.webp"
    );
    expect(fileMock).toHaveBeenCalledWith(
      "products/HM-000001/display/img-002.webp"
    );
    expect(fileMock).toHaveBeenCalledWith(
      "products/HM-000001/thumb/img-002.webp"
    );
  });

  it("returns PRODUCT_NOT_FOUND when the product does not exist", async () => {
    const productRef = {
      get: vi.fn().mockResolvedValue(
        createDocumentSnapshot(
          {
            productId: "HM-000999"
          },
          false
        )
      )
    };
    const db = {
      collection: vi.fn((collectionName: string) => {
        if (collectionName === "products") {
          return {
            doc: vi.fn(() => productRef)
          };
        }

        throw new Error(`Unexpected collection ${collectionName}`);
      })
    };

    await expect(
      getProduct("HM-000999", {
        bucket: {
          file: vi.fn()
        } as never,
        db: db as never
      })
    ).rejects.toMatchObject({
      code: "PRODUCT_NOT_FOUND",
      message: "対象の商品が見つかりません。",
      statusCode: 404
    });
  });

  it("returns PRODUCT_DELETED when the product is logically deleted", async () => {
    const productId = "HM-000003";
    const productRef = {
      get: vi.fn().mockResolvedValue(
        createDocumentSnapshot({
          categoryId: "cat-a",
          createdAt: createTimestamp("2026-04-18T08:00:00.000Z"),
          description: "Deleted pin",
          images: [],
          isDeleted: true,
          name: "Deleted Pin",
          price: 1800,
          productId,
          qrCodeValue: productId,
          soldAt: null,
          status: "onDisplay",
          tagIds: [],
          updatedAt: createTimestamp("2026-04-18T09:00:00.000Z")
        })
      )
    };
    const db = {
      collection: vi.fn((collectionName: string) => {
        if (collectionName === "products") {
          return {
            doc: vi.fn(() => productRef)
          };
        }

        throw new Error(`Unexpected collection ${collectionName}`);
      })
    };
    const fileMock = vi.fn();

    await expect(
      getProduct(productId, {
        bucket: {
          file: fileMock
        } as never,
        db: db as never
      })
    ).rejects.toMatchObject({
      code: "PRODUCT_DELETED",
      message: "対象の商品はすでに利用できません。",
      statusCode: 404
    });

    expect(fileMock).not.toHaveBeenCalled();
  });
});
