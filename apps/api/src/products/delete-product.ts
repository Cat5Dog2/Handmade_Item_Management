import type { ProductDeleteData } from "@handmade/shared";
import type { Firestore, Timestamp } from "firebase-admin/firestore";
import { Timestamp as FirestoreTimestamp } from "firebase-admin/firestore";
import { createApiError } from "../errors/api-errors";
import { getFirestoreDb } from "../firebase/firebase-admin";

interface ProductDocument {
  categoryId: string;
  createdAt: Timestamp;
  deletedAt: Timestamp | null;
  description: string;
  images: unknown[];
  isDeleted: boolean;
  name: string;
  price: number;
  productId: string;
  qrCodeValue: string;
  soldAt: Timestamp | null;
  status: string;
  tagIds: string[];
  updatedAt: Timestamp;
}

interface SnapshotLike<T> {
  data: () => T;
  exists: boolean;
}

interface FirestoreTransactionLike {
  get(reference: unknown): Promise<SnapshotLike<unknown>>;
  set(reference: unknown, data: unknown): void;
}

interface DeleteProductOptions {
  db?: Firestore;
  now?: () => Timestamp;
}

export async function deleteProduct(
  productId: string,
  options: DeleteProductOptions = {}
): Promise<ProductDeleteData> {
  const db = options.db ?? getFirestoreDb();
  const now = options.now ?? FirestoreTimestamp.now;
  const productReference = db.collection("products").doc(productId);

  return db.runTransaction(async (transaction) => {
    const typedTransaction = transaction as unknown as FirestoreTransactionLike;
    const snapshot = await typedTransaction.get(productReference);

    if (!snapshot.exists) {
      throw createApiError({
        statusCode: 404,
        code: "PRODUCT_NOT_FOUND",
        message: "対象の商品が見つかりません。"
      });
    }

    const product = snapshot.data() as ProductDocument;

    if (product.isDeleted) {
      throw createApiError({
        statusCode: 404,
        code: "PRODUCT_DELETED",
        message: "対象の商品はすでに利用できません。"
      });
    }

    const deletedAt = now();

    typedTransaction.set(productReference, {
      ...product,
      deletedAt,
      isDeleted: true,
      updatedAt: deletedAt
    });

    return {
      deletedAt: deletedAt.toDate().toISOString(),
      productId: product.productId
    };
  });
}
