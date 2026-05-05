import { vi } from "vitest";
import {
  createDocumentSnapshot,
  createTimestamp,
  expectTimestampLike
} from "../test/firestore-test-helpers";
import {
  createProductDocument,
  createProductImageBucketFileMock,
  createProductImageBucketPathMock,
  createProductImageDocument
} from "../test/product-image-test-helpers";
import { deleteProductImage } from "./delete-product-image";

function createDeleteProductDocument(
  productId: string,
  images: Array<ReturnType<typeof createProductImageDocument>>,
  overrides: Partial<Record<string, unknown>> = {}
) {
  return createProductDocument({
    images,
    overrides,
    productId
  });
}

describe("deleteProductImage", () => {
  it("removes a non-primary image and reindexes the remaining images", async () => {
    const now = createTimestamp("2026-04-18T10:00:00.000Z");
    const productId = "HM-000001";
    const imageId = "img_existing_2";
    const productRef = {
      get: vi.fn().mockResolvedValue(
        createDocumentSnapshot(
          createDeleteProductDocument(productId, [
            createProductImageDocument({
              imageId: "img_existing_1",
              isPrimary: true,
              productId,
              sortOrder: 1
            }),
            createProductImageDocument({
              imageId: "img_existing_2",
              isPrimary: false,
              productId,
              sortOrder: 2
            }),
            createProductImageDocument({
              imageId: "img_existing_3",
              isPrimary: false,
              productId,
              sortOrder: 3
            })
          ])
        )
      ),
      path: `products/${productId}`
    };
    const displayFile = createProductImageBucketFileMock();
    const thumbnailFile = createProductImageBucketFileMock();
    const fileMock = createProductImageBucketPathMock({
      displayFile,
      imageId,
      productId,
      thumbnailFile
    });
    const transaction = {
      get: vi.fn(async (reference: unknown) => {
        if (reference === productRef) {
          return createDocumentSnapshot(
            createDeleteProductDocument(productId, [
              createProductImageDocument({
                imageId: "img_existing_1",
                isPrimary: true,
                productId,
                sortOrder: 1
              }),
              createProductImageDocument({
                imageId: "img_existing_2",
                isPrimary: false,
                productId,
                sortOrder: 2
              }),
              createProductImageDocument({
                imageId: "img_existing_3",
                isPrimary: false,
                productId,
                sortOrder: 3
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
          createDeleteProductDocument(productId, [
            createProductImageDocument({
              imageId: "img_existing_1",
              isPrimary: false,
              productId,
              sortOrder: 1
            }),
            createProductImageDocument({
              imageId: "img_existing_2",
              isPrimary: true,
              productId,
              sortOrder: 2
            }),
            createProductImageDocument({
              imageId: "img_existing_3",
              isPrimary: false,
              productId,
              sortOrder: 3
            })
          ])
        )
      ),
      path: `products/${productId}`
    };
    const displayFile = createProductImageBucketFileMock();
    const thumbnailFile = createProductImageBucketFileMock();
    const fileMock = createProductImageBucketPathMock({
      displayFile,
      imageId,
      productId,
      thumbnailFile
    });
    const transaction = {
      get: vi.fn(async (reference: unknown) => {
        if (reference === productRef) {
          return createDocumentSnapshot(
            createDeleteProductDocument(productId, [
              createProductImageDocument({
                imageId: "img_existing_1",
                isPrimary: false,
                productId,
                sortOrder: 1
              }),
              createProductImageDocument({
                imageId: "img_existing_2",
                isPrimary: true,
                productId,
                sortOrder: 2
              }),
              createProductImageDocument({
                imageId: "img_existing_3",
                isPrimary: false,
                productId,
                sortOrder: 3
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

  it("surfaces storage deletion failures after the metadata transaction", async () => {
    const productId = "HM-000003";
    const imageId = "img_existing_1";
    const product = createDeleteProductDocument(productId, [
      createProductImageDocument({
        imageId: "img_existing_1",
        isPrimary: true,
        productId,
        sortOrder: 1
      }),
      createProductImageDocument({
        imageId: "img_existing_2",
        isPrimary: false,
        productId,
        sortOrder: 2
      })
    ]);
    const productRef = {
      get: vi.fn().mockResolvedValue(createDocumentSnapshot(product)),
      path: `products/${productId}`
    };
    const storageError = new Error("Storage delete failed");
    const displayFile = createProductImageBucketFileMock({
      deleteMock: vi.fn().mockRejectedValue(storageError)
    });
    const thumbnailFile = createProductImageBucketFileMock();
    const fileMock = createProductImageBucketPathMock({
      displayFile,
      imageId,
      productId,
      thumbnailFile
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
    expect(transaction.set).toHaveBeenCalledTimes(1);
    expect(displayFile.delete).toHaveBeenCalledTimes(1);
    expect(thumbnailFile.delete).toHaveBeenCalledTimes(1);
  });

  it("returns IMAGE_NOT_FOUND when the target image does not exist", async () => {
    const productId = "HM-000004";
    const imageId = "img_missing";
    const productRef = {
      get: vi.fn().mockResolvedValue(
        createDocumentSnapshot(
          createDeleteProductDocument(productId, [
            createProductImageDocument({
              imageId: "img_existing_1",
              isPrimary: true,
              productId,
              sortOrder: 1
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
          createDeleteProductDocument(
            productId,
            [
              createProductImageDocument({
                imageId: "img_existing_1",
                isPrimary: true,
                productId,
                sortOrder: 1
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
