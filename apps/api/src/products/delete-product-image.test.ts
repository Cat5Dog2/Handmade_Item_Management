import { vi } from "vitest";
import {
  createDocumentSnapshot,
  createTimestamp,
  expectTimestampLike
} from "../test/firestore-test-helpers";
import { getProductImageStoragePaths } from "../images/product-image-processing";
import { deleteProductImage } from "./delete-product-image";

function createProductImageDocument(
  productId: string,
  imageId: string,
  sortOrder: number,
  overrides: Partial<Record<string, unknown>> = {}
) {
  return {
    displayPath: `products/${productId}/display/${imageId}.webp`,
    imageId,
    isPrimary: sortOrder === 2,
    sortOrder,
    thumbnailPath: `products/${productId}/thumb/${imageId}.webp`,
    ...overrides
  };
}

function createProductDocument(
  productId: string,
  images: Array<ReturnType<typeof createProductImageDocument>>,
  overrides: Partial<Record<string, unknown>> = {}
) {
  return {
    categoryId: "cat-a",
    createdAt: createTimestamp("2026-04-18T08:00:00.000Z"),
    deletedAt: null,
    description: "Handmade pin",
    images,
    isDeleted: false,
    name: "Fancy Pin",
    price: 2800,
    productId,
    qrCodeValue: productId,
    soldAt: null,
    soldCustomerId: null,
    soldCustomerNameSnapshot: null,
    status: "onDisplay",
    tagIds: [],
    updatedAt: createTimestamp("2026-04-18T09:00:00.000Z"),
    ...overrides
  };
}

function createBucketFileMock(deleteMock = vi.fn().mockResolvedValue(undefined)) {
  return {
    delete: deleteMock
  };
}

describe("deleteProductImage", () => {
  it("removes a non-primary image and reindexes the remaining images", async () => {
    const now = createTimestamp("2026-04-18T10:00:00.000Z");
    const productId = "HM-000001";
    const imageId = "img_existing_2";
    const productRef = {
      get: vi.fn().mockResolvedValue(
        createDocumentSnapshot(
          createProductDocument(productId, [
            createProductImageDocument(productId, "img_existing_1", 1, {
              isPrimary: true
            }),
            createProductImageDocument(productId, "img_existing_2", 2, {
              isPrimary: false
            }),
            createProductImageDocument(productId, "img_existing_3", 3, {
              isPrimary: false
            })
          ])
        )
      ),
      path: `products/${productId}`
    };
    const displayFile = createBucketFileMock();
    const thumbnailFile = createBucketFileMock();
    const fileMock = vi.fn((path: string) => {
      const paths = getProductImageStoragePaths(productId, imageId);

      if (path === paths.displayPath) {
        return displayFile;
      }

      if (path === paths.thumbnailPath) {
        return thumbnailFile;
      }

      throw new Error(`Unexpected path ${path}`);
    });
    const transaction = {
      get: vi.fn(async (reference: unknown) => {
        if (reference === productRef) {
          return createDocumentSnapshot(
            createProductDocument(productId, [
              createProductImageDocument(productId, "img_existing_1", 1, {
                isPrimary: true
              }),
              createProductImageDocument(productId, "img_existing_2", 2, {
                isPrimary: false
              }),
              createProductImageDocument(productId, "img_existing_3", 3, {
                isPrimary: false
              })
            ])
          );
        }

        throw new Error("Unexpected transaction reference");
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

        throw new Error(`Unexpected collection ${collectionName}`);
      }),
      runTransaction: vi.fn(async (callback) => callback(transaction as never))
    };

    const result = await deleteProductImage(productId, imageId, {
      bucket: {
        file: fileMock
      } as never,
      db: db as never,
      now: () => now as never
    });

    expect(result).toEqual({
      imageId,
      updatedAt: "2026-04-18T10:00:00.000Z"
    });
    expect(transaction.set).toHaveBeenCalledTimes(1);

    const [calledRef, payload] = transaction.set.mock.calls[0];

    expect(calledRef).toBe(productRef);
    expect(payload.images).toEqual([
      {
        displayPath: "products/HM-000001/display/img_existing_1.webp",
        imageId: "img_existing_1",
        isPrimary: true,
        sortOrder: 1,
        thumbnailPath: "products/HM-000001/thumb/img_existing_1.webp"
      },
      {
        displayPath: "products/HM-000001/display/img_existing_3.webp",
        imageId: "img_existing_3",
        isPrimary: false,
        sortOrder: 2,
        thumbnailPath: "products/HM-000001/thumb/img_existing_3.webp"
      }
    ]);
    expectTimestampLike(payload.createdAt, "2026-04-18T08:00:00.000Z");
    expectTimestampLike(payload.updatedAt, "2026-04-18T10:00:00.000Z");
    expect(fileMock).toHaveBeenCalledTimes(2);
    expect(displayFile.delete).toHaveBeenCalledTimes(1);
    expect(thumbnailFile.delete).toHaveBeenCalledTimes(1);
  });

  it("promotes the smallest remaining image when deleting the primary image", async () => {
    const now = createTimestamp("2026-04-18T10:30:00.000Z");
    const productId = "HM-000002";
    const imageId = "img_existing_2";
    const productRef = {
      get: vi.fn().mockResolvedValue(
        createDocumentSnapshot(
          createProductDocument(productId, [
            createProductImageDocument(productId, "img_existing_1", 1, {
              isPrimary: false
            }),
            createProductImageDocument(productId, "img_existing_2", 2, {
              isPrimary: true
            }),
            createProductImageDocument(productId, "img_existing_3", 3, {
              isPrimary: false
            })
          ])
        )
      ),
      path: `products/${productId}`
    };
    const displayFile = createBucketFileMock();
    const thumbnailFile = createBucketFileMock();
    const fileMock = vi.fn((path: string) => {
      const paths = getProductImageStoragePaths(productId, imageId);

      if (path === paths.displayPath) {
        return displayFile;
      }

      if (path === paths.thumbnailPath) {
        return thumbnailFile;
      }

      throw new Error(`Unexpected path ${path}`);
    });
    const transaction = {
      get: vi.fn(async (reference: unknown) => {
        if (reference === productRef) {
          return createDocumentSnapshot(
            createProductDocument(productId, [
              createProductImageDocument(productId, "img_existing_1", 1, {
                isPrimary: false
              }),
              createProductImageDocument(productId, "img_existing_2", 2, {
                isPrimary: true
              }),
              createProductImageDocument(productId, "img_existing_3", 3, {
                isPrimary: false
              })
            ])
          );
        }

        throw new Error("Unexpected transaction reference");
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

        throw new Error(`Unexpected collection ${collectionName}`);
      }),
      runTransaction: vi.fn(async (callback) => callback(transaction as never))
    };

    const result = await deleteProductImage(productId, imageId, {
      bucket: {
        file: fileMock
      } as never,
      db: db as never,
      now: () => now as never
    });

    expect(result).toEqual({
      imageId,
      updatedAt: "2026-04-18T10:30:00.000Z"
    });

    const [, payload] = transaction.set.mock.calls[0];

    expect(payload.images).toEqual([
      {
        displayPath: "products/HM-000002/display/img_existing_1.webp",
        imageId: "img_existing_1",
        isPrimary: true,
        sortOrder: 1,
        thumbnailPath: "products/HM-000002/thumb/img_existing_1.webp"
      },
      {
        displayPath: "products/HM-000002/display/img_existing_3.webp",
        imageId: "img_existing_3",
        isPrimary: false,
        sortOrder: 2,
        thumbnailPath: "products/HM-000002/thumb/img_existing_3.webp"
      }
    ]);
    expect(displayFile.delete).toHaveBeenCalledTimes(1);
    expect(thumbnailFile.delete).toHaveBeenCalledTimes(1);
  });

  it("does not update product metadata when storage deletion fails", async () => {
    const productId = "HM-000003";
    const imageId = "img_existing_1";
    const product = createProductDocument(productId, [
      createProductImageDocument(productId, "img_existing_1", 1, {
        isPrimary: true
      }),
      createProductImageDocument(productId, "img_existing_2", 2, {
        isPrimary: false
      })
    ]);
    const productRef = {
      get: vi.fn().mockResolvedValue(createDocumentSnapshot(product)),
      path: `products/${productId}`
    };
    const storageError = new Error("Storage delete failed");
    const displayFile = createBucketFileMock(
      vi.fn().mockRejectedValue(storageError)
    );
    const thumbnailFile = createBucketFileMock();
    const fileMock = vi.fn((path: string) => {
      const paths = getProductImageStoragePaths(productId, imageId);

      if (path === paths.displayPath) {
        return displayFile;
      }

      if (path === paths.thumbnailPath) {
        return thumbnailFile;
      }

      throw new Error(`Unexpected path ${path}`);
    });
    const transaction = {
      get: vi.fn(async (reference: unknown) => {
        if (reference === productRef) {
          return createDocumentSnapshot(product);
        }

        throw new Error("Unexpected transaction reference");
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

        throw new Error(`Unexpected collection ${collectionName}`);
      }),
      runTransaction: vi.fn(async (callback) => callback(transaction as never))
    };

    await expect(
      deleteProductImage(productId, imageId, {
        bucket: {
          file: fileMock
        } as never,
        db: db as never
      })
    ).rejects.toBe(storageError);

    expect(db.runTransaction).toHaveBeenCalledTimes(1);
    expect(displayFile.delete).toHaveBeenCalledTimes(1);
    expect(thumbnailFile.delete).toHaveBeenCalledTimes(1);
    expect(transaction.set).not.toHaveBeenCalled();
  });

  it("returns IMAGE_NOT_FOUND when the target image does not exist", async () => {
    const productId = "HM-000004";
    const imageId = "img_missing";
    const productRef = {
      get: vi.fn().mockResolvedValue(
        createDocumentSnapshot(
          createProductDocument(productId, [
            createProductImageDocument(productId, "img_existing_1", 1, {
              isPrimary: true
            })
          ])
        )
      ),
      path: `products/${productId}`
    };
    const db = {
      collection: vi.fn((collectionName: string) => {
        if (collectionName === "products") {
          return {
            doc: vi.fn(() => productRef)
          };
        }

        throw new Error(`Unexpected collection ${collectionName}`);
      }),
      runTransaction: vi.fn()
    };

    await expect(
      deleteProductImage(productId, imageId, {
        db: db as never
      })
    ).rejects.toMatchObject({
      code: "IMAGE_NOT_FOUND",
      statusCode: 404
    });

    expect(db.runTransaction).not.toHaveBeenCalled();
  });

  it("returns PRODUCT_NOT_FOUND when the product does not exist", async () => {
    const productId = "HM-000005";
    const imageId = "img_existing_1";
    const productRef = {
      get: vi.fn().mockResolvedValue(
        createDocumentSnapshot(
          {
            productId
          },
          false
        )
      ),
      path: `products/${productId}`
    };
    const db = {
      collection: vi.fn((collectionName: string) => {
        if (collectionName === "products") {
          return {
            doc: vi.fn(() => productRef)
          };
        }

        throw new Error(`Unexpected collection ${collectionName}`);
      }),
      runTransaction: vi.fn()
    };

    await expect(
      deleteProductImage(productId, imageId, {
        db: db as never
      })
    ).rejects.toMatchObject({
      code: "PRODUCT_NOT_FOUND",
      statusCode: 404
    });

    expect(db.runTransaction).not.toHaveBeenCalled();
  });

  it("returns PRODUCT_RELATED_RESOURCE_UNAVAILABLE when the product is logically deleted", async () => {
    const productId = "HM-000006";
    const imageId = "img_existing_1";
    const productRef = {
      get: vi.fn().mockResolvedValue(
        createDocumentSnapshot(
          createProductDocument(
            productId,
            [
              createProductImageDocument(productId, "img_existing_1", 1, {
                isPrimary: true
              })
            ],
            {
              isDeleted: true
            }
          )
        )
      ),
      path: `products/${productId}`
    };
    const db = {
      collection: vi.fn((collectionName: string) => {
        if (collectionName === "products") {
          return {
            doc: vi.fn(() => productRef)
          };
        }

        throw new Error(`Unexpected collection ${collectionName}`);
      }),
      runTransaction: vi.fn()
    };

    await expect(
      deleteProductImage(productId, imageId, {
        db: db as never
      })
    ).rejects.toMatchObject({
      code: "PRODUCT_RELATED_RESOURCE_UNAVAILABLE",
      statusCode: 404
    });

    expect(db.runTransaction).not.toHaveBeenCalled();
  });
});
