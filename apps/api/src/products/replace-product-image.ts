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
  FirestoreTransactionLike,
  ProductDocument,
  ProductImageBucket
} from "./product-image-service-types";
import { saveProductImageStorageFiles } from "./product-image-storage";

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
  const bucket = options.bucket ?? getStorageBucket();
  const latestSnapshotBeforeStorage =
    (await productReference.get()) as unknown as SnapshotLike<ProductDocument>;

  assertRelatedProductAvailable(latestSnapshotBeforeStorage);
  findProductImageOrThrow(latestSnapshotBeforeStorage.data().images, imageId);

  await saveProductImageStorageFiles(
    bucket,
    storagePaths,
    processedImage.display.buffer,
    processedImage.thumbnail.buffer
  );

  const result = await db.runTransaction(async (transaction) => {
    const typedTransaction = transaction as unknown as FirestoreTransactionLike;
    const latestSnapshot = await typedTransaction.get(productReference);

    assertRelatedProductAvailable(latestSnapshot);

    const latestProduct = latestSnapshot.data() as ProductDocument;

    findProductImageOrThrow(latestProduct.images, imageId);

    const updatedAt = now();

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
