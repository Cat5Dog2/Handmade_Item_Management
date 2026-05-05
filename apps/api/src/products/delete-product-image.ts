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
  ProductDocument,
  ProductImageBucket,
  ProductImageDocument
} from "./product-image-service-types";
import { deleteProductImageStorageFiles } from "./product-image-storage";
import { updateProductImageMetadataInTransaction } from "./product-image-transactions";

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
  // Deletion keeps product images as a 1-based ordered list and reselects primary image when needed.
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
    ? (remainingImages[0]?.imageId ?? null)
    : (remainingImages.find((image) => image.isPrimary)?.imageId ?? null);

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

  const result = await db.runTransaction((transaction) =>
    updateProductImageMetadataInTransaction(
      transaction,
      productReference,
      imageId,
      now,
      (latestProduct, updatedAt) => {
        const latestImages = latestProduct.images ?? [];
        const { deletedImage, images: updatedImages } =
          normalizeImagesAfterDelete(latestImages, imageId);

        return {
          data: {
            ...latestProduct,
            images: updatedImages,
            updatedAt
          },
          result: {
            deletedImage
          }
        };
      }
    )
  );
  const bucket = options.bucket ?? getStorageBucket();

  await deleteProductImageStorageFiles(bucket, result.deletedImage);

  return {
    imageId,
    updatedAt: toIsoString(result.updatedAt)
  };
}
