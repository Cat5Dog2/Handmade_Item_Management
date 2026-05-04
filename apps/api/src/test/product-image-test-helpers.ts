import { vi } from "vitest";
import { getProductImageStoragePaths } from "../images/product-image-processing";
import { createTimestamp } from "./firestore-test-helpers";

interface ProductImageDocumentOptions {
  imageId?: string;
  isPrimary?: boolean;
  productId?: string;
  sortOrder?: number;
  overrides?: Partial<Record<string, unknown>>;
}

interface ProductDocumentOptions {
  images?: Array<ReturnType<typeof createProductImageDocument>>;
  overrides?: Partial<Record<string, unknown>>;
  productId?: string;
}

export function createProductImageDocument(
  options: ProductImageDocumentOptions = {}
) {
  const productId = options.productId ?? "HM-000001";
  const imageId = options.imageId ?? "img_existing_1";
  const sortOrder = options.sortOrder ?? 1;

  return {
    displayPath: `products/${productId}/display/${imageId}.webp`,
    imageId,
    isPrimary: options.isPrimary ?? sortOrder === 1,
    sortOrder,
    thumbnailPath: `products/${productId}/thumb/${imageId}.webp`,
    ...options.overrides
  };
}

export function createProductDocument(options: ProductDocumentOptions = {}) {
  const productId = options.productId ?? "HM-000001";

  return {
    categoryId: "cat-a",
    createdAt: createTimestamp("2026-04-18T08:00:00.000Z"),
    deletedAt: null,
    description: "Handmade pin",
    images: options.images ?? [
      createProductImageDocument({ productId, imageId: "img_existing_1" })
    ],
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
    ...options.overrides
  };
}

export function createProductImageUploadFile(
  buffer: Buffer,
  mimetype = "image/png"
) {
  return {
    buffer,
    fieldname: "file",
    mimetype,
    size: buffer.length
  };
}

export function createProductImageBucketFileMock(options: {
  deleteMock?: ReturnType<typeof vi.fn>;
  saveMock?: ReturnType<typeof vi.fn>;
} = {}) {
  return {
    delete: options.deleteMock ?? vi.fn().mockResolvedValue(undefined),
    save: options.saveMock ?? vi.fn().mockResolvedValue(undefined)
  };
}

export function createProductImageBucketPathMock(options: {
  displayFile: ReturnType<typeof createProductImageBucketFileMock>;
  imageId: string;
  productId: string;
  thumbnailFile: ReturnType<typeof createProductImageBucketFileMock>;
}) {
  return vi.fn((path: string) => {
    const paths = getProductImageStoragePaths(options.productId, options.imageId);

    if (path === paths.displayPath) {
      return options.displayFile;
    }

    if (path === paths.thumbnailPath) {
      return options.thumbnailFile;
    }

    throw new Error(`Unexpected path ${path}`);
  });
}
