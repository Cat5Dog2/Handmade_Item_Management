import type { ProductImageMutationData } from "@handmade/shared";
import type { Firestore, Timestamp } from "firebase-admin/firestore";
import { Timestamp as FirestoreTimestamp } from "firebase-admin/firestore";
import { createApiError } from "../errors/api-errors";
import { getFirestoreDb, getStorageBucket } from "../firebase/firebase-admin";
import {
  assertRelatedProductAvailable,
  type SnapshotLike
} from "../guards/firestore-business-guards";
import {
  assertProductImageUploadFile,
  getProductImageStoragePaths,
  processProductImageBuffer,
  type ProductImageUploadFile
} from "../images/product-image-processing";

interface ProductImageDocument {
  displayPath: string;
  imageId: string;
  isPrimary: boolean;
  sortOrder: number;
  thumbnailPath: string;
}

interface ProductDocument {
  categoryId: string;
  createdAt: Timestamp;
  deletedAt: Timestamp | null;
  description: string;
  images?: ProductImageDocument[] | null;
  isDeleted: boolean;
  name: string;
  price: number;
  productId: string;
  qrCodeValue: string;
  soldAt: Timestamp | null;
  soldCustomerId?: string | null;
  soldCustomerNameSnapshot?: string | null;
  status: string;
  tagIds: string[];
  updatedAt: Timestamp;
}

interface ProductImageBucketFile {
  save(
    data: Buffer,
    options: {
      contentType: string;
      resumable: boolean;
    }
  ): Promise<unknown>;
}

interface ProductImageBucket {
  file(path: string): ProductImageBucketFile;
}

interface FirestoreTransactionLike {
  get(reference: unknown): Promise<SnapshotLike<unknown>>;
  set(reference: unknown, data: unknown): void;
}

interface ReplaceProductImageOptions {
  bucket?: ProductImageBucket;
  db?: Firestore;
  now?: () => Timestamp;
}

function toIsoString(value: Timestamp) {
  return value.toDate().toISOString();
}

function createImageNotFoundError() {
  return createApiError({
    statusCode: 404,
    code: "IMAGE_NOT_FOUND",
    message: "対象の画像が見つかりません。最新の情報を読み込み直してください。"
  });
}

function hasProductImage(
  images: ProductImageDocument[] | null | undefined,
  imageId: string
) {
  return (images ?? []).some((image) => image.imageId === imageId);
}

async function saveProcessedImage(
  bucket: ProductImageBucket,
  paths: ReturnType<typeof getProductImageStoragePaths>,
  displayBuffer: Buffer,
  thumbnailBuffer: Buffer
) {
  await Promise.all([
    bucket.file(paths.displayPath).save(displayBuffer, {
      contentType: "image/webp",
      resumable: false
    }),
    bucket.file(paths.thumbnailPath).save(thumbnailBuffer, {
      contentType: "image/webp",
      resumable: false
    })
  ]);
}

export async function replaceProductImage(
  productId: string,
  imageId: string,
  file: ProductImageUploadFile | undefined,
  options: ReplaceProductImageOptions = {}
): Promise<ProductImageMutationData> {
  assertProductImageUploadFile(file);

  const db = options.db ?? getFirestoreDb();
  const now = options.now ?? FirestoreTimestamp.now;
  const productReference = db.collection("products").doc(productId);
  const productSnapshot =
    (await productReference.get()) as unknown as SnapshotLike<ProductDocument>;

  assertRelatedProductAvailable(productSnapshot);

  const product = productSnapshot.data();

  if (!hasProductImage(product.images, imageId)) {
    throw createImageNotFoundError();
  }

  const processedImage = await processProductImageBuffer(file.buffer);
  const storagePaths = getProductImageStoragePaths(productId, imageId);
  const bucket = options.bucket ?? getStorageBucket();

  const result = await db.runTransaction(async (transaction) => {
    const typedTransaction = transaction as unknown as FirestoreTransactionLike;
    const latestSnapshot = await typedTransaction.get(productReference);

    assertRelatedProductAvailable(latestSnapshot);

    const latestProduct = latestSnapshot.data() as ProductDocument;

    if (!hasProductImage(latestProduct.images, imageId)) {
      throw createImageNotFoundError();
    }

    const updatedAt = now();

    await saveProcessedImage(
      bucket,
      storagePaths,
      processedImage.display.buffer,
      processedImage.thumbnail.buffer
    );

    typedTransaction.set(productReference, {
      ...latestProduct,
      updatedAt
    });

    return {
      updatedAt
    };
  });

  return {
    imageId,
    updatedAt: toIsoString(result.updatedAt)
  };
}
