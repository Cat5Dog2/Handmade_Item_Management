import type {
  ProductStatus,
  QrSellData,
  QrSellInput
} from "@handmade/shared";
import { qrSellInputSchema } from "@handmade/shared";
import type { Firestore, Timestamp } from "firebase-admin/firestore";
import { Timestamp as FirestoreTimestamp } from "firebase-admin/firestore";
import type { ZodError } from "zod";
import { createApiError, createValidationError } from "../errors/api-errors";
import { getFirestoreDb } from "../firebase/firebase-admin";
import {
  getAvailableCustomer,
  type SnapshotLike
} from "../guards/firestore-business-guards";

interface ProductDocument {
  isDeleted: boolean;
  productId: string;
  soldAt: Timestamp | null;
  soldCustomerId?: string | null;
  soldCustomerNameSnapshot?: string | null;
  status: ProductStatus;
  updatedAt: Timestamp;
}

interface FirestoreTransactionLike {
  get(reference: unknown): Promise<SnapshotLike<unknown>>;
  set(reference: unknown, data: unknown): void;
}

interface SellQrCodeOptions {
  db?: Firestore;
  now?: () => Timestamp;
}

export interface QrSellResult extends QrSellData {
  previousStatus: ProductStatus;
}

function toValidationErrorDetails(error: ZodError<QrSellInput>) {
  return error.issues.map((issue) => ({
    field: typeof issue.path[0] === "string" ? issue.path[0] : "requestBody",
    message: issue.message
  }));
}

function getProductIdentifier(input: QrSellInput) {
  return input.productId ?? input.qrCodeValue;
}

function assertSellableProduct(product: ProductDocument) {
  if (product.isDeleted) {
    throw createApiError({
      statusCode: 404,
      code: "PRODUCT_DELETED",
      message: "対象の商品はすでに利用できません。"
    });
  }

  if (product.status === "sold") {
    throw createApiError({
      statusCode: 400,
      code: "ALREADY_SOLD",
      message: "この商品はすでに販売済みです。"
    });
  }

  if (product.status !== "onDisplay" && product.status !== "inStock") {
    throw createApiError({
      statusCode: 400,
      code: "INVALID_STATUS_FOR_QR_SELL",
      message: "このステータスの商品はQRで販売済に更新できません。"
    });
  }
}

export async function sellQrCode(
  input: unknown,
  options: SellQrCodeOptions = {}
): Promise<QrSellResult> {
  const parsedInput = qrSellInputSchema.safeParse(input);

  if (!parsedInput.success) {
    throw createValidationError(toValidationErrorDetails(parsedInput.error));
  }

  const db = options.db ?? getFirestoreDb();
  const now = options.now ?? FirestoreTimestamp.now;
  const productIdentifier = getProductIdentifier(parsedInput.data);

  if (!productIdentifier) {
    throw createValidationError([
      {
        field: "requestBody",
        message: "productId または qrCodeValue を指定してください。"
      }
    ]);
  }

  const productReference = db.collection("products").doc(productIdentifier);

  return db.runTransaction(async (transaction) => {
    const typedTransaction = transaction as unknown as FirestoreTransactionLike;
    const productSnapshot = await typedTransaction.get(productReference);

    if (!productSnapshot.exists) {
      throw createApiError({
        statusCode: 404,
        code: "PRODUCT_NOT_FOUND",
        message: "対象の商品が見つかりません。"
      });
    }

    const product = productSnapshot.data() as ProductDocument;
    const previousStatus = product.status;

    assertSellableProduct(product);

    const updatedAt = now();
    const soldAt = product.soldAt ?? updatedAt;
    const soldCustomerId = parsedInput.data.customerId ?? null;
    const soldCustomerNameSnapshot = soldCustomerId
      ? (
          await getAvailableCustomer(
            typedTransaction,
            db.collection("customers").doc(soldCustomerId),
            {
              archivedDetailMessage: "アーカイブ済み顧客は指定できません。",
              archivedMessage:
                "選択した顧客は現在利用できません。別の顧客を選択してください。",
              field: "customerId",
              notFoundDetailMessage: "指定した顧客が見つかりません。",
              notFoundMessage:
                "選択した顧客が見つかりません。顧客一覧を確認してください。"
            }
          )
        ).name
      : null;

    typedTransaction.set(productReference, {
      ...product,
      soldAt,
      soldCustomerId,
      soldCustomerNameSnapshot,
      status: "sold",
      updatedAt
    });

    return {
      previousStatus,
      productId: product.productId,
      status: "sold",
      soldAt: soldAt.toDate().toISOString(),
      soldCustomerId,
      soldCustomerNameSnapshot,
      updatedAt: updatedAt.toDate().toISOString()
    };
  });
}
