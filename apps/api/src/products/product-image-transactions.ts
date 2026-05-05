import type { Timestamp } from "firebase-admin/firestore";
import { assertRelatedProductAvailable } from "../guards/firestore-business-guards";
import { findProductImageOrThrow } from "./product-image-documents";
import type {
  FirestoreTransactionLike,
  ProductDocument
} from "./product-image-service-types";

interface ProductImageMetadataUpdate<TResult extends object> {
  data: ProductDocument;
  result: TResult;
}

export async function updateProductImageMetadataInTransaction<
  TResult extends object
>(
  transaction: unknown,
  productReference: unknown,
  imageId: string,
  now: () => Timestamp,
  buildUpdate: (
    latestProduct: ProductDocument,
    updatedAt: Timestamp
  ) => ProductImageMetadataUpdate<TResult>
): Promise<TResult & { updatedAt: Timestamp }> {
  const typedTransaction = transaction as unknown as FirestoreTransactionLike;

  // Re-read inside the transaction so concurrent image changes cannot bypass availability checks.
  const latestSnapshot = await typedTransaction.get(productReference);

  assertRelatedProductAvailable(latestSnapshot);

  const latestProduct = latestSnapshot.data() as ProductDocument;

  findProductImageOrThrow(latestProduct.images, imageId);

  const updatedAt = now();
  const update = buildUpdate(latestProduct, updatedAt);

  typedTransaction.set(productReference, update.data);

  return {
    ...update.result,
    updatedAt
  };
}
