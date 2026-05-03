import sharp from "sharp";
import { vi } from "vitest";
import {
  createDocumentSnapshot,
  createTimestamp,
  expectTimestampLike
} from "../test/firestore-test-helpers";
import { getProductImageStoragePaths } from "../images/product-image-processing";
import { replaceProductImage } from "./replace-product-image";

function createProductImageDocument(
  imageId: string,
  sortOrder: number,
  overrides: Partial<Record<string, unknown>> = {}
) {
  return {
    displayPath: `products/HM-000001/display/${imageId}.webp`,
    imageId,
    isPrimary: sortOrder === 1,
    sortOrder,
    thumbnailPath: `products/HM-000001/thumb/${imageId}.webp`,
    ...overrides
  };
}

function createProductDocument(
  overrides: Partial<Record<string, unknown>> = {}
) {
  return {
    categoryId: "cat-a",
    createdAt: createTimestamp("2026-04-18T08:00:00.000Z"),
    deletedAt: null,
    description: "Handmade pin",
    images: [
      createProductImageDocument("img_existing_1", 1),
      createProductImageDocument("img_existing_2", 2, {
        isPrimary: true
      })
    ],
    isDeleted: false,
    name: "Fancy Pin",
    price: 2800,
    productId: "HM-000001",
    qrCodeValue: "HM-000001",
    soldAt: null,
    soldCustomerId: null,
    soldCustomerNameSnapshot: null,
    status: "onDisplay",
    tagIds: [],
    updatedAt: createTimestamp("2026-04-18T09:00:00.000Z"),
    ...overrides
  };
}

function createUploadFile(buffer: Buffer) {
  return {
    buffer,
    fieldname: "file",
    mimetype: "image/png",
    size: buffer.length
  };
}

function createBucketFileMock() {
  return {
    save: vi.fn().mockResolvedValue(undefined)
  };
}

describe("replaceProductImage", () => {
  it("replaces image binaries while keeping image metadata intact", async () => {
    const now = createTimestamp("2026-04-18T10:00:00.000Z");
    const productId = "HM-000001";
    const imageId = "img_existing_2";
    const preflightProduct = createProductDocument({
      description: "Preflight description",
      updatedAt: createTimestamp("2026-04-18T08:30:00.000Z")
    });
    const latestProduct = createProductDocument({
      description: "Latest description",
      updatedAt: createTimestamp("2026-04-18T09:30:00.000Z")
    });
    const productRef = {
      get: vi.fn().mockResolvedValue(createDocumentSnapshot(preflightProduct)),
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
      createUploadFile(sourceBuffer),
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
    const preflightProduct = createProductDocument();
    const latestProduct = createProductDocument({
      images: [createProductImageDocument("img_existing_1", 1)]
    });
    const productRef = {
      get: vi.fn().mockResolvedValue(createDocumentSnapshot(preflightProduct)),
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
          return createDocumentSnapshot(latestProduct);
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
        createUploadFile(sourceBuffer),
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

    expect(db.runTransaction).toHaveBeenCalledTimes(1);
    expect(transaction.set).not.toHaveBeenCalled();
    expect(displayFile.save).not.toHaveBeenCalled();
    expect(thumbnailFile.save).not.toHaveBeenCalled();
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
        createUploadFile(sourceBuffer),
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
          ...createProductDocument(),
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
        createUploadFile(sourceBuffer),
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
