import type {
  ProductStatus,
  QrLookupData,
  QrLookupInput,
  QrLookupReasonCode
} from "@handmade/shared";
import { qrLookupInputSchema } from "@handmade/shared";
import type { Firestore } from "firebase-admin/firestore";
import type { ZodError } from "zod";
import { createValidationError } from "../errors/api-errors";
import { getFirestoreDb } from "../firebase/firebase-admin";

interface ProductDocument {
  isDeleted: boolean;
  name: string;
  productId: string;
  qrCodeValue: string;
  status: ProductStatus;
}

interface SnapshotLike<T> {
  data: () => T;
  exists: boolean;
}

interface LookupQrCodeOptions {
  db?: Firestore;
}

const QR_LOOKUP_MESSAGES: Record<QrLookupReasonCode, string> = {
  CAN_SELL: "販売済更新が可能です。",
  ALREADY_SOLD: "この商品はすでに販売済みです。",
  INVALID_STATUS: "この商品は現在のステータスでは販売済に更新できません。",
  PRODUCT_DELETED: "このQRコードの商品は利用できません。",
  PRODUCT_NOT_FOUND: "該当する商品が見つかりません。"
};

function toValidationErrorDetails(error: ZodError<QrLookupInput>) {
  return error.issues.map((issue) => ({
    field: typeof issue.path[0] === "string" ? issue.path[0] : "requestBody",
    message: issue.message
  }));
}

function getLookupReason(product: ProductDocument): Exclude<
  QrLookupReasonCode,
  "PRODUCT_NOT_FOUND"
> {
  if (product.isDeleted) {
    return "PRODUCT_DELETED";
  }

  if (product.status === "onDisplay" || product.status === "inStock") {
    return "CAN_SELL";
  }

  if (product.status === "sold") {
    return "ALREADY_SOLD";
  }

  return "INVALID_STATUS";
}

export async function lookupQrCode(
  input: unknown,
  options: LookupQrCodeOptions = {}
): Promise<QrLookupData> {
  const parsedInput = qrLookupInputSchema.safeParse(input);

  if (!parsedInput.success) {
    throw createValidationError(toValidationErrorDetails(parsedInput.error));
  }

  const db = options.db ?? getFirestoreDb();
  const productSnapshot = (await db
    .collection("products")
    .doc(parsedInput.data.qrCodeValue)
    .get()) as unknown as SnapshotLike<ProductDocument>;

  if (!productSnapshot.exists) {
    return {
      productId: null,
      name: null,
      status: null,
      canSell: false,
      reasonCode: "PRODUCT_NOT_FOUND",
      message: QR_LOOKUP_MESSAGES.PRODUCT_NOT_FOUND
    };
  }

  const product = productSnapshot.data();
  const reasonCode = getLookupReason(product);

  return {
    productId: product.productId,
    name: product.name,
    status: product.status,
    canSell: reasonCode === "CAN_SELL",
    reasonCode,
    message: QR_LOOKUP_MESSAGES[reasonCode]
  };
}
