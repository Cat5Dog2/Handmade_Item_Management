import sharp from "sharp";
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
  createProductImageDocument,
  createProductImageUploadFile
} from "../test/product-image-test-helpers";
import { replaceProductImage } from "./replace-product-image";

function createReplaceProductDocument(
  overrides: Partial<Record<string, unknown>> = {}
) {
  return createProductDocument({
    images: [
      createProductImageDocument({ imageId: "img_existing_1", sortOrder: 1 }),
      createProductImageDocument({
        imageId: "img_existing_2",
        isPrimary: true,
        sortOrder: 2
      })
    ],
    overrides
  });
}

describe("replaceProductImage", () => {
  it("replaces image binaries while keeping image metadata intact", async () => {
    const now = createTimestamp("2026-04-18T10:00:00.000Z");
    const productId = "HM-000001";
    const imageId = "img_existing_2";
    const preflightProduct = createReplaceProductDocument({
      description: "Preflight description",
      updatedAt: createTimestamp("2026-04-18T08:30:00.000Z")
    });
    const latestProduct = createReplaceProductDocument({
      description: "Latest description",
      updatedAt: createTimestamp("2026-04-18T09:30:00.000Z")
    });
    const productRef = {
      get: vi
        .fn()
        .mockResolvedValueOnce(createDocumentSnapshot(preflightProduct))
        .mockResolvedValue(createDocumentSnapshot(latestProduct)),
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
          return createDocumentSnapshot(latestProduct);
        }

        throw new Error("Unexpected transaction reference");
      }),
      set: vi.fn()
    };
    const runTransaction = vi.fn(async (callback) =>
      callback(transaction as never)
    );
    const db = {
      collection: vi.fn((collectionName: string) => {
        if (collectionName === "products") {
          return {
            doc: vi.fn(() => productRef)
          };
        }

        throw new Error(`Unexpected collection ${collectionName}`);
      }),
      runTransaction
    };
    const sourceBuffer = await sharp({
      create: {
        width: 640,
        height: 480,
        channels: 3,
        background: "#89c2d9"
      }
    })
      .jpeg()
      .toBuffer();
    const result = await replaceProductImage(
      productId,
      imageId,
      createProductImageUploadFile(sourceBuffer),
      {
        bucket: {
          file: fileMock
        } as never,
        db: db as never,
        now: () => now as never
      }
    );

    expect(result).toEqual({
      imageId,
      updatedAt: "2026-04-18T10:00:00.000Z"
    });
    expect(runTransaction).toHaveBeenCalledTimes(1);
    expect(transaction.set).toHaveBeenCalledTimes(1);

    const [calledRef, payload] = transaction.set.mock.calls[0];

    expect(calledRef).toBe(productRef);
    expect(payload).toMatchObject({
      categoryId: latestProduct.categoryId,
      deletedAt: latestProduct.deletedAt,
      description: latestProduct.description,
      images: latestProduct.images,
      isDeleted: latestProduct.isDeleted,
      name: latestProduct.name,
      price: latestProduct.price,
      productId: latestProduct.productId,
      qrCodeValue: latestProduct.qrCodeValue,
      soldAt: latestProduct.soldAt,
      soldCustomerId: latestProduct.soldCustomerId,
      soldCustomerNameSnapshot: latestProduct.soldCustomerNameSnapshot,
      status: latestProduct.status,
      tagIds: latestProduct.tagIds
    });
    expectTimestampLike(payload.createdAt, "2026-04-18T08:00:00.000Z");
    expectTimestampLike(payload.updatedAt, "2026-04-18T10:00:00.000Z");

    expect(fileMock).toHaveBeenCalledTimes(2);
    expect(fileMock).toHaveBeenCalledWith(
      "products/HM-000001/display/img_existing_2.webp"
    );
    expect(fileMock).toHaveBeenCalledWith(
      "products/HM-000001/thumb/img_existing_2.webp"
    );
    expect(displayFile.save).toHaveBeenCalledTimes(1);
    expect(thumbnailFile.save).toHaveBeenCalledTimes(1);

    const [displayBuffer] = displayFile.save.mock.calls[0];
    const [thumbnailBuffer] = thumbnailFile.save.mock.calls[0];
    const displayMetadata = await sharp(displayBuffer as Buffer).metadata();
    const thumbnailMetadata = await sharp(thumbnailBuffer as Buffer).metadata();

    expect(displayMetadata.format).toBe("webp");
    expect(thumbnailMetadata.format).toBe("webp");
  });

  it("returns IMAGE_NOT_FOUND when the latest product snapshot no longer has the target image", async () => {
    const productId = "HM-000001";
    const imageId = "img_existing_2";
    const preflightProduct = createReplaceProductDocument();
    const latestProduct = createReplaceProductDocument({
      images: [createProductImageDocument({ imageId: "img_existing_1" })]
    });
    const productRef = {
      get: vi
        .fn()
        .mockResolvedValueOnce(createDocumentSnapshot(preflightProduct))
        .mockResolvedValue(createDocumentSnapshot(latestProduct)),
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
    const sourceBuffer = await sharp({
      create: {
        width: 320,
        height: 320,
        channels: 3,
        background: "#f4b5ca"
      }
    })
      .png()
      .toBuffer();

    await expect(
      replaceProductImage(
        productId,
        imageId,
        createProductImageUploadFile(sourceBuffer),
        {
          bucket: {
            file: fileMock
          } as never,
          db: db as never
        }
      )
    ).rejects.toMatchObject({
      code: "IMAGE_NOT_FOUND",
      statusCode: 404
    });

    expect(db.runTransaction).not.toHaveBeenCalled();
    expect(displayFile.save).not.toHaveBeenCalled();
    expect(thumbnailFile.save).not.toHaveBeenCalled();
  });

  it("does not update product metadata when storage replacement fails", async () => {
    const productId = "HM-000001";
    const imageId = "img_existing_2";
    const product = createReplaceProductDocument();
    const productRef = {
      get: vi.fn().mockResolvedValue(createDocumentSnapshot(product)),
      path: `products/${productId}`
    };
    const storageError = new Error("Storage save failed");
    const displayFile = createProductImageBucketFileMock({
      saveMock: vi.fn().mockRejectedValue(storageError)
    });
    const thumbnailFile = createProductImageBucketFileMock();
    const fileMock = createProductImageBucketPathMock({
      displayFile,
      imageId,
      productId,
      thumbnailFile
    });
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
    const sourceBuffer = await sharp({
      create: {
        width: 320,
        height: 320,
        channels: 3,
        background: "#f4b5ca"
      }
    })
      .png()
      .toBuffer();

    await expect(
      replaceProductImage(
        productId,
        imageId,
        createProductImageUploadFile(sourceBuffer),
        {
          bucket: {
            file: fileMock
          } as never,
          db: db as never
        }
      )
    ).rejects.toBe(storageError);

    expect(db.runTransaction).not.toHaveBeenCalled();
    expect(displayFile.save).toHaveBeenCalledTimes(1);
    expect(thumbnailFile.save).toHaveBeenCalledTimes(1);
  });

  it("returns PRODUCT_NOT_FOUND when the product does not exist", async () => {
    const productId = "HM-000002";
    const imageId = "img_existing_2";
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
    const sourceBuffer = await sharp({
      create: {
        width: 320,
        height: 320,
        channels: 3,
        background: "#ffffff"
      }
    })
      .png()
      .toBuffer();

    await expect(
      replaceProductImage(
        productId,
        imageId,
        createProductImageUploadFile(sourceBuffer),
        {
          db: db as never
        }
      )
    ).rejects.toMatchObject({
      code: "PRODUCT_NOT_FOUND",
      statusCode: 404
    });

    expect(db.runTransaction).not.toHaveBeenCalled();
  });

  it("returns PRODUCT_RELATED_RESOURCE_UNAVAILABLE when the product is logically deleted", async () => {
    const productId = "HM-000003";
    const imageId = "img_existing_2";
    const productRef = {
      get: vi.fn().mockResolvedValue(
        createDocumentSnapshot({
          ...createReplaceProductDocument(),
          isDeleted: true
        })
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
    const sourceBuffer = await sharp({
      create: {
        width: 320,
        height: 320,
        channels: 3,
        background: "#ffffff"
      }
    })
      .png()
      .toBuffer();

    await expect(
      replaceProductImage(
        productId,
        imageId,
        createProductImageUploadFile(sourceBuffer),
        {
          db: db as never
        }
      )
    ).rejects.toMatchObject({
      code: "PRODUCT_RELATED_RESOURCE_UNAVAILABLE",
      statusCode: 404
    });

    expect(db.runTransaction).not.toHaveBeenCalled();
  });

  it("rejects unsupported MIME types before any Firestore work", async () => {
    const productId = "HM-000004";
    const imageId = "img_existing_2";
    const db = {
      collection: vi.fn(),
      runTransaction: vi.fn()
    };
    const sourceBuffer = Buffer.from("not-an-image");

    await expect(
      replaceProductImage(
        productId,
        imageId,
        {
          buffer: sourceBuffer,
          fieldname: "file",
          mimetype: "image/gif",
          size: sourceBuffer.length
        },
        {
          db: db as never
        }
      )
    ).rejects.toMatchObject({
      code: "UNSUPPORTED_IMAGE_TYPE",
      statusCode: 400
    });

    expect(db.collection).not.toHaveBeenCalled();
    expect(db.runTransaction).not.toHaveBeenCalled();
  });
});
