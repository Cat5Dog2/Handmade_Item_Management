import type {
  ProductStatus,
  ProductUpdateData,
  ProductUpdateInput
} from "@handmade/shared";
import { productUpdateInputSchema } from "@handmade/shared";
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
  images?: ProductImageDocument[] | null;
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

interface SnapshotLike<T> {
  data: () => T;
  exists: boolean;
}

interface FirestoreTransactionLike {
  get(reference: unknown): Promise<SnapshotLike<unknown>>;
  set(reference: unknown, data: unknown): void;
}

interface UpdateProductOptions {
  db?: Firestore;
  now?: () => Timestamp;
}

function toValidationErrorDetails(error: ZodError<ProductUpdateInput>) {
  return error.issues.map((issue) => ({
    field: typeof issue.path[0] === "string" ? issue.path[0] : "requestBody",
    message: issue.message
  }));
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

function createPrimaryImageError() {
  return createValidationError([
    {
      field: "primaryImageId",
      message: "対象の画像が見つかりません。"
    }
  ]);
}

function normalizeImages(
  images: ProductImageDocument[],
  primaryImageId: string | null
) {
  if (primaryImageId === null) {
    return images.map((image) => ({
      ...image,
      isPrimary: false
    }));
  }

  const hasPrimaryImage = images.some(
    (image) => image.imageId === primaryImageId
  );

  if (!hasPrimaryImage) {
    throw createPrimaryImageError();
  }

  return images.map((image) => ({
    ...image,
    isPrimary: image.imageId === primaryImageId
  }));
}

export async function updateProduct(
  productId: string,
  input: unknown,
  options: UpdateProductOptions = {}
): Promise<ProductUpdateData> {
  const parsedInput = productUpdateInputSchema.safeParse(input);

  if (!parsedInput.success) {
    throw createValidationError(toValidationErrorDetails(parsedInput.error));
  }

  const db = options.db ?? getFirestoreDb();
  const now = options.now ?? FirestoreTimestamp.now;
  const productReference = db.collection("products").doc(productId);
  const tagIds = parsedInput.data.tagIds;

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

    if (product.isDeleted) {
      throw createApiError({
        statusCode: 404,
        code: "PRODUCT_DELETED",
        message: "対象の商品はすでに利用できません。"
      });
    }

    const categoryReference = db
      .collection("categories")
      .doc(parsedInput.data.categoryId);
    const uniqueTagReferences = [...new Set(tagIds)].map((tagId) =>
      db.collection("tags").doc(tagId)
    );

    await assertDocumentExists(
      typedTransaction,
      categoryReference,
      "CATEGORY_NOT_FOUND",
      "categoryId",
      "指定したカテゴリが見つかりません。"
    );

    for (const tagReference of uniqueTagReferences) {
      await assertDocumentExists(
        typedTransaction,
        tagReference,
        "TAG_NOT_FOUND",
        "tagIds",
        "指定したタグが見つかりません。"
      );
    }

    const currentImages = product.images ?? [];
    const updatedImages = normalizeImages(
      currentImages,
      parsedInput.data.primaryImageId
    );
    const updatedAt = now();
    const soldAt =
      parsedInput.data.status === "sold" ? product.soldAt ?? updatedAt : null;

    typedTransaction.set(productReference, {
      ...product,
      categoryId: parsedInput.data.categoryId,
      description: parsedInput.data.description,
      images: updatedImages,
      name: parsedInput.data.name,
      price: parsedInput.data.price,
      soldAt,
      status: parsedInput.data.status,
      tagIds,
      updatedAt
    });

    return {
      productId: product.productId,
      updatedAt: updatedAt.toDate().toISOString()
    };
  });
}
