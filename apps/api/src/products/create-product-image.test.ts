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
import { createProductImage } from "./create-product-image";

function createProductDocumentWithImageCount(imageCount: number) {
  return createProductDocument({
    images: Array.from({ length: imageCount }, (_, index) =>
      createProductImageDocument({
        imageId: `img_existing_${index + 1}`,
        isPrimary: index === 0,
        sortOrder: index + 1
      })
    )
  });
}

describe("createProductImage", () => {
  it("uploads image variants and appends image metadata to the product", async () => {
    const now = createTimestamp("2026-04-18T10:00:00.000Z");
    const productId = "HM-000001";
    const imageId = "img_abcdef123456";
    const existingProduct = createProductDocumentWithImageCount(2);
    const productRef = {
      get: vi.fn().mockResolvedValue(createDocumentSnapshot(existingProduct))
    };
    const transaction = {
      get: vi.fn(async (reference: unknown) => {
        if (reference === productRef) {
          return createDocumentSnapshot(existingProduct);
        }

        throw new Error("Unexpected transaction reference");
      }),
      set: vi.fn()
    };
    const runTransaction = vi.fn(async (callback) =>
      callback(transaction as never)
    );
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
      .png()
      .toBuffer();

    const result = await createProductImage(
      productId,
      createProductImageUploadFile(sourceBuffer),
      {
        bucket: {
          file: fileMock
        } as never,
        db: db as never,
        imageIdFactory: () => imageId,
        now: () => now as never
      }
    );

    expect(result).toEqual({
      imageId,
      isPrimary: false,
      updatedAt: "2026-04-18T10:00:00.000Z"
    });
    expect(fileMock).toHaveBeenCalledTimes(2);
    expect(fileMock).toHaveBeenCalledWith(
      "products/HM-000001/display/img_abcdef123456.webp"
    );
    expect(fileMock).toHaveBeenCalledWith(
      "products/HM-000001/thumb/img_abcdef123456.webp"
    );
    expect(displayFile.save).toHaveBeenCalledTimes(1);
    expect(thumbnailFile.save).toHaveBeenCalledTimes(1);
    expect(displayFile.save).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.objectContaining({
        contentType: "image/webp",
        resumable: false
      })
    );
    expect(thumbnailFile.save).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.objectContaining({
        contentType: "image/webp",
        resumable: false
      })
    );

    const [displayBuffer] = displayFile.save.mock.calls[0];
    const [thumbnailBuffer] = thumbnailFile.save.mock.calls[0];
    const displayMetadata = await sharp(displayBuffer as Buffer).metadata();
    const thumbnailMetadata = await sharp(thumbnailBuffer as Buffer).metadata();

    expect(displayMetadata.format).toBe("webp");
    expect(thumbnailMetadata.format).toBe("webp");
    expect(runTransaction).toHaveBeenCalledTimes(1);
    expect(transaction.set).toHaveBeenCalledTimes(1);

    const [calledRef, payload] = transaction.set.mock.calls[0];
    const expectedImage = {
      displayPath: "products/HM-000001/display/img_abcdef123456.webp",
      imageId,
      isPrimary: false,
      sortOrder: 3,
      thumbnailPath: "products/HM-000001/thumb/img_abcdef123456.webp"
    };

    expect(calledRef).toBe(productRef);
    expect(payload).toMatchObject({
      categoryId: existingProduct.categoryId,
      deletedAt: existingProduct.deletedAt,
      description: existingProduct.description,
      images: [...existingProduct.images, expectedImage],
      isDeleted: existingProduct.isDeleted,
      name: existingProduct.name,
      price: existingProduct.price,
      productId: existingProduct.productId,
      qrCodeValue: existingProduct.qrCodeValue,
      soldAt: existingProduct.soldAt,
      soldCustomerId: existingProduct.soldCustomerId,
      soldCustomerNameSnapshot: existingProduct.soldCustomerNameSnapshot,
      status: existingProduct.status,
      tagIds: existingProduct.tagIds
    });
    expectTimestampLike(payload.createdAt, "2026-04-18T08:00:00.000Z");
    expectTimestampLike(payload.updatedAt, "2026-04-18T10:00:00.000Z");
  });

  it("rejects when the product already has 10 images without uploading", async () => {
    const productId = "HM-000001";
    const productRef = {
      get: vi
        .fn()
        .mockResolvedValue(
          createDocumentSnapshot(createProductDocumentWithImageCount(10))
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
      }),
      runTransaction: vi.fn()
    };
    const fileMock = vi.fn();
    const sourceBuffer = await sharp({
      create: {
        width: 64,
        height: 64,
        channels: 3,
        background: "#ffffff"
      }
    })
      .png()
      .toBuffer();

    await expect(
      createProductImage(productId, createProductImageUploadFile(sourceBuffer), {
        bucket: {
          file: fileMock
        } as never,
        db: db as never,
        imageIdFactory: () => "img_abcdef123456"
      })
    ).rejects.toMatchObject({
      code: "IMAGE_LIMIT_EXCEEDED",
      statusCode: 400
    });

    expect(fileMock).not.toHaveBeenCalled();
    expect(db.runTransaction).not.toHaveBeenCalled();
  });

  it("cleans up uploaded files when the transaction detects a concurrent limit change", async () => {
    const now = createTimestamp("2026-04-18T10:00:00.000Z");
    const productId = "HM-000001";
    const imageId = "img_abcdef123456";
    const preflightProduct = createProductDocumentWithImageCount(9);
    const transactionProduct = createProductDocumentWithImageCount(10);
    const productRef = {
      get: vi.fn().mockResolvedValue(createDocumentSnapshot(preflightProduct))
    };
    const transaction = {
      get: vi.fn(async (reference: unknown) => {
        if (reference === productRef) {
          return createDocumentSnapshot(transactionProduct);
        }

        throw new Error("Unexpected transaction reference");
      }),
      set: vi.fn()
    };
    const runTransaction = vi.fn(async (callback) =>
      callback(transaction as never)
    );
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
      runTransaction
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
      createProductImage(productId, createProductImageUploadFile(sourceBuffer), {
        bucket: {
          file: fileMock
        } as never,
        db: db as never,
        imageIdFactory: () => imageId,
        now: () => now as never
      })
    ).rejects.toMatchObject({
      code: "IMAGE_LIMIT_EXCEEDED",
      statusCode: 400
    });

    expect(fileMock).toHaveBeenCalledTimes(4);
    expect(displayFile.delete).toHaveBeenCalledTimes(1);
    expect(thumbnailFile.delete).toHaveBeenCalledTimes(1);
    expect(transaction.set).not.toHaveBeenCalled();
  });
});
