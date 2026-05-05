import type { ProductImageMutationData } from "@handmade/shared";
import type { Firestore, Timestamp } from "firebase-admin/firestore";
import { Timestamp as FirestoreTimestamp } from "firebase-admin/firestore";
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
import { findProductImageOrThrow } from "./product-image-documents";
import type {
  ProductDocument,
  ProductImageBucket
} from "./product-image-service-types";
import { saveProductImageStorageFiles } from "./product-image-storage";
import { updateProductImageMetadataInTransaction } from "./product-image-transactions";

interface ReplaceProductImageOptions {
  bucket?: ProductImageBucket;
  db?: Firestore;
  now?: () => Timestamp;
}

function toIsoString(value: Timestamp) {
  return value.toDate().toISOString();
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

  findProductImageOrThrow(product.images, imageId);

  const processedImage = await processProductImageBuffer(file.buffer);
  const storagePaths = getProductImageStoragePaths(productId, imageId);
  const result = await db.runTransaction((transaction) =>
    updateProductImageMetadataInTransaction(
      transaction,
      productReference,
      imageId,
      now,
      (latestProduct, updatedAt) => ({
        data: {
          ...latestProduct,
          updatedAt
        },
        result: {}
      })
    )
  );
  const bucket = options.bucket ?? getStorageBucket();

  await saveProductImageStorageFiles(
    bucket,
    storagePaths,
    processedImage.display.buffer,
    processedImage.thumbnail.buffer
  );

  return {
    imageId,
    updatedAt: toIsoString(result.updatedAt)
  };
}
