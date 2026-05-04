import type { ProductImageMutationData } from "@handmade/shared";
import type { Firestore, Timestamp } from "firebase-admin/firestore";
import { Timestamp as FirestoreTimestamp } from "firebase-admin/firestore";
import { getFirestoreDb, getStorageBucket } from "../firebase/firebase-admin";
import {
  assertRelatedProductAvailable,
  type SnapshotLike
} from "../guards/firestore-business-guards";
import {
  findProductImageOrThrow,
  sortProductImages
} from "./product-image-documents";
import { createImageNotFoundError } from "./product-image-errors";
import type {
  FirestoreTransactionLike,
  ProductDocument,
  ProductImageBucket,
  ProductImageDocument
} from "./product-image-service-types";
import { deleteProductImageStorageFiles } from "./product-image-storage";

interface DeleteProductImageOptions {
  bucket?: ProductImageBucket;
  db?: Firestore;
  now?: () => Timestamp;
}

function toIsoString(value: Timestamp) {
  return value.toDate().toISOString();
}

function normalizeImagesAfterDelete(
  images: ProductImageDocument[],
  deletedImageId: string
) {
  const sortedImages = sortProductImages(images);
  const deletedImage = sortedImages.find(
    (image) => image.imageId === deletedImageId
  );

  if (!deletedImage) {
    throw createImageNotFoundError();
  }

  const remainingImages = sortedImages.filter(
    (image) => image.imageId !== deletedImageId
  );
  const primaryImageId = deletedImage.isPrimary
    ? remainingImages[0]?.imageId ?? null
    : remainingImages.find((image) => image.isPrimary)?.imageId ?? null;

  return {
    deletedImage,
    images: remainingImages.map((image, index) => ({
      ...image,
      isPrimary: image.imageId === primaryImageId,
      sortOrder: index + 1
    }))
  };
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
  findProductImageOrThrow(currentImages, imageId);

  const bucket = options.bucket ?? getStorageBucket();
  const latestSnapshotBeforeStorage =
    (await productReference.get()) as unknown as SnapshotLike<ProductDocument>;

  assertRelatedProductAvailable(latestSnapshotBeforeStorage);

  const latestProductBeforeStorage = latestSnapshotBeforeStorage.data();
  const { deletedImage } = normalizeImagesAfterDelete(
    latestProductBeforeStorage.images ?? [],
    imageId
  );

  await deleteProductImageStorageFiles(bucket, deletedImage);

  const result = await db.runTransaction(async (transaction) => {
    const typedTransaction = transaction as unknown as FirestoreTransactionLike;
    const latestSnapshot = await typedTransaction.get(productReference);

    assertRelatedProductAvailable(latestSnapshot);

    const latestProduct = latestSnapshot.data() as ProductDocument;
    const latestImages = latestProduct.images ?? [];
    const { images: updatedImages } = normalizeImagesAfterDelete(
      latestImages,
      imageId
    );
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

  return {
    imageId,
    updatedAt: toIsoString(result.updatedAt)
  };
}
