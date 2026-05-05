import { randomUUID } from "node:crypto";
import type { ProductImageCreateData } from "@handmade/shared";
import type { Firestore, Timestamp } from "firebase-admin/firestore";
import { Timestamp as FirestoreTimestamp } from "firebase-admin/firestore";
import { getFirestoreDb, getStorageBucket } from "../firebase/firebase-admin";
import {
  assertRelatedProductAvailable,
  type SnapshotLike
} from "../guards/firestore-business-guards";
import {
  assertProductImageCountAvailable,
  assertProductImageUploadFile,
  getProductImageStoragePaths,
  processProductImageBuffer,
  type ProductImageUploadFile
} from "../images/product-image-processing";
import {
  cleanupProductImageStorageFiles,
  saveProductImageStorageFiles
} from "./product-image-storage";
import type {
  FirestoreTransactionLike,
  ProductDocument,
  ProductImageBucket,
  ProductImageDocument
} from "./product-image-service-types";

interface CreateProductImageOptions {
  bucket?: ProductImageBucket;
  db?: Firestore;
  imageIdFactory?: () => string;
  now?: () => Timestamp;
}

const DEFAULT_IMAGE_ID_PREFIX = "img_";
const DEFAULT_IMAGE_ID_LENGTH = 12;

function createProductImageId() {
  return `${DEFAULT_IMAGE_ID_PREFIX}${randomUUID()
    .replace(/-/g, "")
    .slice(0, DEFAULT_IMAGE_ID_LENGTH)}`;
}

function getNextImageSortOrder(images: ProductImageDocument[]) {
  return (
    images.reduce(
      (currentMax, image) => Math.max(currentMax, image.sortOrder),
      0
    ) + 1
  );
}

function toIsoString(value: Timestamp) {
  return value.toDate().toISOString();
}

export async function createProductImage(
  productId: string,
  file: ProductImageUploadFile | undefined,
  options: CreateProductImageOptions = {}
): Promise<ProductImageCreateData> {
  assertProductImageUploadFile(file);

  const db = options.db ?? getFirestoreDb();
  const bucket = options.bucket ?? getStorageBucket();
  const now = options.now ?? FirestoreTimestamp.now;
  const imageId = options.imageIdFactory?.() ?? createProductImageId();
  const productReference = db.collection("products").doc(productId);
  const productSnapshot =
    (await productReference.get()) as unknown as SnapshotLike<ProductDocument>;

  assertRelatedProductAvailable(productSnapshot);

  const product = productSnapshot.data();
  const currentImages = product.images ?? [];

  assertProductImageCountAvailable(currentImages.length);

  const processedImage = await processProductImageBuffer(file.buffer);
  const storagePaths = getProductImageStoragePaths(productId, imageId);
  let shouldCleanup = false;

  // Store bytes first, then remove them if Firestore rejects the latest product state.
  try {
    shouldCleanup = true;
    await saveProductImageStorageFiles(
      bucket,
      storagePaths,
      processedImage.display.buffer,
      processedImage.thumbnail.buffer
    );

    const result = await db.runTransaction(async (transaction) => {
      const typedTransaction =
        transaction as unknown as FirestoreTransactionLike;
      const latestSnapshot = await typedTransaction.get(productReference);

      assertRelatedProductAvailable(latestSnapshot);

      const latestProduct = latestSnapshot.data() as ProductDocument;
      const latestImages = latestProduct.images ?? [];

      assertProductImageCountAvailable(latestImages.length);

      const updatedAt = now();
      const newImage: ProductImageDocument = {
        displayPath: storagePaths.displayPath,
        imageId,
        isPrimary: false,
        sortOrder: getNextImageSortOrder(latestImages),
        thumbnailPath: storagePaths.thumbnailPath
      };

      typedTransaction.set(productReference, {
        ...latestProduct,
        images: [...latestImages, newImage],
        updatedAt
      });

      return {
        imageId,
        isPrimary: newImage.isPrimary,
        updatedAt
      };
    });

    return {
      imageId: result.imageId,
      isPrimary: result.isPrimary,
      updatedAt: toIsoString(result.updatedAt)
    };
  } catch (error) {
    if (shouldCleanup) {
      await cleanupProductImageStorageFiles(bucket, storagePaths);
    }

    throw error;
  }
}
