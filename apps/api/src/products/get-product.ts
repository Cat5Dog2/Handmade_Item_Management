import type {
  ProductDetailData,
  ProductImageDetail,
  ProductStatus
} from "@handmade/shared";
import type { Firestore, Timestamp } from "firebase-admin/firestore";
import { createApiError } from "../errors/api-errors";
import { getFirestoreDb, getStorageBucket } from "../firebase/firebase-admin";

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
  description: string;
  images?: ProductImageDocument[] | null;
  isDeleted: boolean;
  name: string;
  price: number;
  productId: string;
  qrCodeValue: string;
  soldAt: Timestamp | null;
  soldCustomerId?: string | null;
  soldCustomerNameSnapshot?: string | null;
  status: ProductStatus;
  tagIds: string[];
  updatedAt: Timestamp;
}

interface CategoryDocument {
  name: string;
}

interface TagDocument {
  name: string;
}

interface TaskDocument {
  isCompleted: boolean;
}

interface SnapshotLike<T> {
  data: () => T;
  exists: boolean;
}

interface SignedUrlBucket {
  file(path: string): {
    getSignedUrl(options: { action: "read"; expires: Date }): Promise<[string]>;
  };
}

interface GetProductOptions {
  bucket?: SignedUrlBucket;
  db?: Firestore;
  now?: () => Date;
  signedUrlExpiresMinutes?: number;
}

const DEFAULT_SIGNED_URL_EXPIRES_MINUTES = 60;

function toIsoString(value: Timestamp | null) {
  return value ? value.toDate().toISOString() : null;
}

function resolveSignedUrlExpiresMinutes(options: GetProductOptions) {
  if (options.signedUrlExpiresMinutes != null) {
    return options.signedUrlExpiresMinutes;
  }

  const envValue = Number(process.env.SIGNED_URL_EXPIRES_MINUTES ?? "60");

  return Number.isFinite(envValue) && envValue > 0
    ? envValue
    : DEFAULT_SIGNED_URL_EXPIRES_MINUTES;
}

function sortImages(images: ProductImageDocument[]) {
  return [...images].sort((left, right) => {
    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder;
    }

    return left.imageId.localeCompare(right.imageId);
  });
}

function createRelatedResourceUnavailableError() {
  return createApiError({
    statusCode: 404,
    code: "PRODUCT_RELATED_RESOURCE_UNAVAILABLE",
    message: "この商品の関連情報は表示できません。"
  });
}

async function createImageDetail(
  bucket: SignedUrlBucket,
  image: ProductImageDocument,
  expiresAt: Date
): Promise<ProductImageDetail> {
  const [displayUrl] = await bucket.file(image.displayPath).getSignedUrl({
    action: "read",
    expires: expiresAt
  });
  const [thumbnailUrl] = await bucket.file(image.thumbnailPath).getSignedUrl({
    action: "read",
    expires: expiresAt
  });

  return {
    imageId: image.imageId,
    displayUrl,
    thumbnailUrl,
    urlExpiresAt: expiresAt.toISOString(),
    sortOrder: image.sortOrder,
    isPrimary: image.isPrimary
  };
}

async function getRelatedNames(
  db: Firestore,
  product: ProductDocument
) {
  const categoryReference = db.collection("categories").doc(product.categoryId);
  const tagReferences = product.tagIds.map((tagId) =>
    db.collection("tags").doc(tagId)
  );
  const [categorySnapshot, tagSnapshots] = await Promise.all([
    categoryReference.get() as unknown as Promise<SnapshotLike<CategoryDocument>>,
    Promise.all(
      tagReferences.map((reference) =>
        reference.get() as unknown as Promise<SnapshotLike<TagDocument>>
      )
    )
  ]);

  if (!categorySnapshot.exists) {
    throw createRelatedResourceUnavailableError();
  }

  if (tagSnapshots.some((snapshot) => !snapshot.exists)) {
    throw createRelatedResourceUnavailableError();
  }

  return {
    categoryName: categorySnapshot.data().name,
    tagNames: tagSnapshots.map((snapshot) => snapshot.data().name)
  };
}

export async function getProduct(
  productId: string,
  options: GetProductOptions = {}
): Promise<ProductDetailData> {
  const db = options.db ?? getFirestoreDb();
  const bucket = options.bucket ?? getStorageBucket();
  const now = options.now ?? (() => new Date());
  const signedUrlExpiresMinutes = resolveSignedUrlExpiresMinutes(options);
  const productReference = db.collection("products").doc(productId);
  const productSnapshot = (await productReference.get()) as unknown as SnapshotLike<ProductDocument>;

  if (!productSnapshot.exists) {
    throw createApiError({
      statusCode: 404,
      code: "PRODUCT_NOT_FOUND",
      message: "対象の商品が見つかりません。"
    });
  }

  const product = productSnapshot.data();

  if (product.isDeleted) {
    throw createApiError({
      statusCode: 404,
      code: "PRODUCT_DELETED",
      message: "対象の商品はすでに利用できません。"
    });
  }

  const tasksReference = db.collection("tasks").where("productId", "==", productId);
  const [relatedNames, tasksSnapshot] = await Promise.all([
    getRelatedNames(db, product),
    tasksReference.get() as unknown as Promise<{
      docs: Array<SnapshotLike<TaskDocument>>;
    }>
  ]);
  const sortedImages = sortImages(product.images ?? []);
  const expiresAt = new Date(
    now().getTime() + signedUrlExpiresMinutes * 60 * 1000
  );
  const images = await Promise.all(
    sortedImages.map((image) => createImageDetail(bucket, image, expiresAt))
  );
  const completedCount = tasksSnapshot.docs.filter((snapshot) => {
    return snapshot.data().isCompleted;
  }).length;

  return {
    product: {
      productId: product.productId,
      name: product.name,
      description: product.description,
      price: product.price,
      categoryId: product.categoryId,
      categoryName: relatedNames.categoryName,
      tagIds: product.tagIds,
      tagNames: relatedNames.tagNames,
      status: product.status,
      soldAt: toIsoString(product.soldAt),
      soldCustomerId: product.soldCustomerId ?? null,
      soldCustomerNameSnapshot: product.soldCustomerNameSnapshot ?? null,
      createdAt: product.createdAt.toDate().toISOString(),
      updatedAt: product.updatedAt.toDate().toISOString()
    },
    images,
    tasksSummary: {
      openCount: tasksSnapshot.docs.length - completedCount,
      completedCount
    },
    qrCodeValue: product.qrCodeValue
  };
}
