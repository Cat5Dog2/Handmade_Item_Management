import type {
  ProductCreateData,
  ProductCreateInput,
  ProductStatus
} from "@handmade/shared";
import { productCreateInputSchema } from "@handmade/shared";
import type { Firestore, Timestamp } from "firebase-admin/firestore";
import { Timestamp as FirestoreTimestamp } from "firebase-admin/firestore";
import type { ZodError } from "zod";
import { createApiError, createValidationError } from "../errors/api-errors";
import { getFirestoreDb } from "../firebase/firebase-admin";

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
  images: ProductImageDocument[];
  isDeleted: boolean;
  name: string;
  price: number;
  productId: string;
  qrCodeValue: string;
  soldAt: Timestamp | null;
  status: ProductStatus;
  tagIds: string[];
  updatedAt: Timestamp;
}

interface ProductCounterDocument {
  counterKey: "product";
  currentValue: number;
  updatedAt: Timestamp;
}

interface FirestoreTransactionLike {
  get(reference: unknown): Promise<{
    exists: boolean;
    data: () => unknown;
  }>;
  set(reference: unknown, data: unknown): void;
}

interface CreateProductOptions {
  db?: Firestore;
  now?: () => Timestamp;
}

const DEFAULT_PRODUCT_ID_PREFIX = "HM-";
const DEFAULT_PRODUCT_ID_DIGITS = 6;
const DEFAULT_PRODUCT_COUNTER_DOCUMENT_PATH = "counters/product";

function toValidationErrorDetails(error: ZodError<ProductCreateInput>) {
  return error.issues.map((issue) => ({
    field: typeof issue.path[0] === "string" ? issue.path[0] : "requestBody",
    message: issue.message
  }));
}

function resolveProductIdPrefix() {
  return process.env.PRODUCT_ID_PREFIX ?? DEFAULT_PRODUCT_ID_PREFIX;
}

function resolveProductIdDigits() {
  const envValue = Number(process.env.PRODUCT_ID_DIGITS ?? DEFAULT_PRODUCT_ID_DIGITS);

  return Number.isFinite(envValue) && envValue > 0
    ? Math.floor(envValue)
    : DEFAULT_PRODUCT_ID_DIGITS;
}

function resolveProductCounterDocumentPath() {
  return (
    process.env.PRODUCT_COUNTER_DOCUMENT_PATH ??
    DEFAULT_PRODUCT_COUNTER_DOCUMENT_PATH
  );
}

function createProductId(productNumber: number) {
  const prefix = resolveProductIdPrefix();
  const digits = resolveProductIdDigits();

  return `${prefix}${String(productNumber).padStart(digits, "0")}`;
}

async function assertDocumentExists(
  transaction: FirestoreTransactionLike,
  reference: unknown,
  code: "CATEGORY_NOT_FOUND" | "TAG_NOT_FOUND",
  field: "categoryId" | "tagIds",
  message: string
) {
  const snapshot = await transaction.get(reference);

  if (!snapshot.exists) {
    throw createApiError({
      statusCode: 400,
      code,
      details: [
        {
          field,
          message
        }
      ],
      message
    });
  }
}

function toTagReferences(db: Firestore, tagIds: string[]) {
  return tagIds.map((tagId) => db.collection("tags").doc(tagId));
}

async function getNextProductId(
  transaction: FirestoreTransactionLike,
  counterReference: unknown,
  now: () => Timestamp
) {
  const snapshot = await transaction.get(counterReference);
  const counterData = snapshot.exists
    ? (snapshot.data() as ProductCounterDocument)
    : undefined;
  const nextValue = (counterData?.currentValue ?? 0) + 1;
  const createdAt = now();

  transaction.set(counterReference, {
    counterKey: "product",
    currentValue: nextValue,
    updatedAt: createdAt
  });

  return {
    createdAt,
    productId: createProductId(nextValue)
  };
}

export async function createProduct(
  input: unknown,
  options: CreateProductOptions = {}
): Promise<ProductCreateData> {
  const parsedInput = productCreateInputSchema.safeParse(input);

  if (!parsedInput.success) {
    throw createValidationError(toValidationErrorDetails(parsedInput.error));
  }

  const db = options.db ?? getFirestoreDb();
  const now = options.now ?? FirestoreTimestamp.now;
  const counterReference = db.doc(resolveProductCounterDocumentPath());
  const categoryReference = db
    .collection("categories")
    .doc(parsedInput.data.categoryId);
  const tagIds = parsedInput.data.tagIds ?? [];
  const tagReferences = toTagReferences(db, [...new Set(tagIds)]);
  const productIdResult = await db.runTransaction(async (transaction) => {
    await assertDocumentExists(
      transaction,
      categoryReference,
      "CATEGORY_NOT_FOUND",
      "categoryId",
      "指定したカテゴリが見つかりません。カテゴリを選び直してください。"
    );

    for (const tagReference of tagReferences) {
      await assertDocumentExists(
        transaction,
        tagReference,
        "TAG_NOT_FOUND",
        "tagIds",
        "指定したタグが見つかりません。タグを選び直してください。"
      );
    }

    const { createdAt, productId } = await getNextProductId(
      transaction,
      counterReference,
      now
    );
    const productReference = db.collection("products").doc(productId);
    const soldAt = parsedInput.data.status === "sold" ? createdAt : null;
    const productDocument: ProductDocument = {
      categoryId: parsedInput.data.categoryId,
      createdAt,
      deletedAt: null,
      description: parsedInput.data.description ?? "",
      images: [],
      isDeleted: false,
      name: parsedInput.data.name,
      price: parsedInput.data.price,
      productId,
      qrCodeValue: productId,
      soldAt,
      status: parsedInput.data.status,
      tagIds,
      updatedAt: createdAt
    };

    transaction.set(productReference, productDocument);

    return {
      createdAt,
      productId,
      updatedAt: createdAt
    };
  });

  return {
    productId: productIdResult.productId,
    createdAt: productIdResult.createdAt.toDate().toISOString(),
    updatedAt: productIdResult.updatedAt.toDate().toISOString()
  };
}
