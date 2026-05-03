import type { ProductImageMutationData } from "@handmade/shared";
import type { Firestore, Timestamp } from "firebase-admin/firestore";
import { Timestamp as FirestoreTimestamp } from "firebase-admin/firestore";
import { createApiError } from "../errors/api-errors";
import { getFirestoreDb, getStorageBucket } from "../firebase/firebase-admin";
import {
  assertRelatedProductAvailable,
  type SnapshotLike
} from "../guards/firestore-business-guards";

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
  delete(): Promise<unknown>;
}

interface ProductImageBucket {
  file(path: string): ProductImageBucketFile;
}

interface FirestoreTransactionLike {
  get(reference: unknown): Promise<SnapshotLike<unknown>>;
  set(reference: unknown, data: unknown): void;
}

interface DeleteProductImageOptions {
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

function sortImages(images: ProductImageDocument[]) {
  return [...images].sort((left, right) => {
    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder;
    }

    return left.imageId.localeCompare(right.imageId);
  });
}

function normalizeImagesAfterDelete(
  images: ProductImageDocument[],
  deletedImageId: string
) {
  const sortedImages = sortImages(images);
  const deletedImage = sortedImages.find((image) => image.imageId === deletedImageId);

  if (!deletedImage) {
    throw createImageNotFoundError();
  }

  const remainingImages = sortedImages.filter(
    (image) => image.imageId !== deletedImageId
  );
  const primaryImageId = deletedImage.isPrimary
    ? remainingImages[0]?.imageId ?? null
    : remainingImages.find((image) => image.isPrimary)?.imageId ?? null;

  return remainingImages.map((image, index) => ({
    ...image,
    isPrimary: image.imageId === primaryImageId,
    sortOrder: index + 1
  }));
}

async function deleteStorageFiles(
  bucket: ProductImageBucket,
  paths: Pick<ProductImageDocument, "displayPath" | "thumbnailPath">
) {
  await Promise.all([
    bucket.file(paths.displayPath).delete(),
    bucket.file(paths.thumbnailPath).delete()
  ]);
}

export async function deleteProductImage(
  productId: string,
  imageId: string,
  options: DeleteProductImageOptions = {}
): Promise<ProductImageMutationData> {
  const db = options.db ?? getFirestoreDb();
  const now = options.now ?? FirestoreTimestamp.now;
  const productReference = db.collection("products").doc(productId);
  const productSnapshot =
    (await productReference.get()) as unknown as SnapshotLike<ProductDocument>;

  assertRelatedProductAvailable(productSnapshot);

  const product = productSnapshot.data();
  const currentImages = product.images ?? [];
  const targetImage = sortImages(currentImages).find(
    (image) => image.imageId === imageId
  );

  if (!targetImage) {
    throw createImageNotFoundError();
  }

  const result = await db.runTransaction(async (transaction) => {
    const typedTransaction = transaction as unknown as FirestoreTransactionLike;
    const latestSnapshot = await typedTransaction.get(productReference);

    assertRelatedProductAvailable(latestSnapshot);

    const latestProduct = latestSnapshot.data() as ProductDocument;
    const latestImages = latestProduct.images ?? [];
    const updatedImages = normalizeImagesAfterDelete(latestImages, imageId);
    const updatedAt = now();

    typedTransaction.set(productReference, {
      ...latestProduct,
      images: updatedImages,
      updatedAt
    });

    return {
      updatedAt
    };
  });

  const bucket = options.bucket ?? getStorageBucket();
  await deleteStorageFiles(bucket, targetImage);

  return {
    imageId,
    updatedAt: toIsoString(result.updatedAt)
  };
}
