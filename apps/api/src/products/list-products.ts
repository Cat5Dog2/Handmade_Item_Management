import type {
  ProductListData,
  ProductListItem,
  ProductListMeta,
  ProductListQuery,
  ProductStatus
} from "@handmade/shared";
import {
  normalizeSearchKeyword,
  productListQuerySchema
} from "@handmade/shared";
import type {
  Firestore,
  QueryDocumentSnapshot,
  Timestamp
} from "firebase-admin/firestore";
import type { ZodError } from "zod";
import { createValidationError } from "../errors/api-errors";
import { getFirestoreDb, getStorageBucket } from "../firebase/firebase-admin";
import { getStorageReadUrl } from "../firebase/storage-read-url";

interface ProductImageDocument {
  displayPath: string;
  imageId: string;
  isPrimary: boolean;
  sortOrder: number;
  thumbnailPath: string;
}

interface ProductDocument {
  categoryId: string;
  description: string;
  images?: ProductImageDocument[] | null;
  isDeleted: boolean;
  name: string;
  productId: string;
  soldAt: Timestamp | null;
  status: ProductStatus;
  tagIds: string[];
  updatedAt: Timestamp;
}

interface CategoryDocument {
  categoryId: string;
  name: string;
}

interface TagDocument {
  name: string;
  tagId: string;
}

interface SignedUrlBucket {
  file(path: string): {
    getSignedUrl(options: { action: "read"; expires: Date }): Promise<[string]>;
  };
}

interface ListProductsOptions {
  bucket?: SignedUrlBucket;
  db?: Firestore;
  now?: () => Date;
  signedUrlExpiresMinutes?: number;
}

interface ProductRecord {
  categoryId: string;
  categoryName: string | null;
  images: ProductImageDocument[];
  name: string;
  productId: string;
  searchableText: string;
  status: ProductStatus;
  tagIds: string[];
  updatedAt: Date;
  thumbnailPath: string | null;
}

interface ListProductsResult {
  data: ProductListData;
  meta: ProductListMeta;
}

function toValidationErrorDetails(error: ZodError<ProductListQuery>) {
  return error.issues.map((issue) => ({
    field: typeof issue.path[0] === "string" ? issue.path[0] : "requestQuery",
    message: issue.message
  }));
}

function toDate(value: Timestamp) {
  return value.toDate();
}

function getRepresentativeImage(images: ProductImageDocument[]) {
  if (images.length === 0) {
    return null;
  }

  const sortedImages = [...images].sort((left, right) => {
    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder;
    }

    return left.imageId.localeCompare(right.imageId);
  });

  return sortedImages.find((image) => image.isPrimary) ?? sortedImages[0] ?? null;
}

function createSearchableText(parts: Array<string | null | undefined>) {
  return normalizeSearchKeyword(parts.filter(Boolean).join(" "));
}

function toProductRecord(
  snapshot: QueryDocumentSnapshot<ProductDocument>,
  categoryNameMap: Map<string, string>,
  tagNameMap: Map<string, string>
): ProductRecord {
  const data = snapshot.data();
  const images = data.images ?? [];
  const representativeImage = getRepresentativeImage(images);
  const categoryName = categoryNameMap.get(data.categoryId) ?? null;
  const tagNames = data.tagIds
    .map((tagId) => tagNameMap.get(tagId))
    .filter((tagName): tagName is string => Boolean(tagName));

  return {
    categoryId: data.categoryId,
    categoryName,
    images,
    name: data.name,
    productId: data.productId,
    searchableText: createSearchableText([
      data.productId,
      data.name,
      data.description,
      categoryName,
      tagNames.join(" ")
    ]),
    status: data.status,
    tagIds: data.tagIds,
    updatedAt: toDate(data.updatedAt),
    thumbnailPath: representativeImage?.thumbnailPath ?? null
  };
}

function doesProductMatchQuery(
  record: ProductRecord,
  query: ProductListQuery,
  normalizedKeyword?: string
) {
  const includeSold = query.includeSold ?? true;
  const shouldExcludeSold = includeSold === false && query.status !== "sold";

  if (shouldExcludeSold && record.status === "sold") {
    return false;
  }

  if (query.categoryId && record.categoryId !== query.categoryId) {
    return false;
  }

  if (query.tagId && !record.tagIds.includes(query.tagId)) {
    return false;
  }

  if (query.status && record.status !== query.status) {
    return false;
  }

  if (normalizedKeyword && !record.searchableText.includes(normalizedKeyword)) {
    return false;
  }

  return true;
}

function compareProducts(
  left: ProductRecord,
  right: ProductRecord,
  sortBy: NonNullable<ProductListQuery["sortBy"]>,
  sortOrder: NonNullable<ProductListQuery["sortOrder"]>
) {
  const baseComparison =
    sortBy === "name"
      ? normalizeSearchKeyword(left.name).localeCompare(
          normalizeSearchKeyword(right.name)
        )
      : left.updatedAt.getTime() - right.updatedAt.getTime();

  if (baseComparison !== 0) {
    return sortOrder === "asc" ? baseComparison : -baseComparison;
  }

  return left.productId.localeCompare(right.productId);
}

async function getThumbnailUrl(
  bucket: SignedUrlBucket,
  thumbnailPath: string | null,
  now: () => Date,
  signedUrlExpiresMinutes: number
) {
  if (!thumbnailPath) {
    return null;
  }

  const expiresAt = new Date(
    now().getTime() + signedUrlExpiresMinutes * 60 * 1000
  );
  const thumbnailUrl = await getStorageReadUrl(
    bucket,
    thumbnailPath,
    expiresAt
  );

  return thumbnailUrl;
}

function resolveSignedUrlExpiresMinutes(options: ListProductsOptions) {
  if (options.signedUrlExpiresMinutes != null) {
    return options.signedUrlExpiresMinutes;
  }

  const envValue = Number(process.env.SIGNED_URL_EXPIRES_MINUTES ?? "60");

  return Number.isFinite(envValue) && envValue > 0 ? envValue : 60;
}

export async function listProducts(
  input: unknown,
  options: ListProductsOptions = {}
): Promise<ListProductsResult> {
  const parsedInput = productListQuerySchema.safeParse(input);

  if (!parsedInput.success) {
    throw createValidationError(toValidationErrorDetails(parsedInput.error));
  }

  const db = options.db ?? getFirestoreDb();
  const bucket = options.bucket ?? getStorageBucket();
  const now = options.now ?? (() => new Date());
  const signedUrlExpiresMinutes = resolveSignedUrlExpiresMinutes(options);
  const query = parsedInput.data;
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 50;
  const sortBy = query.sortBy ?? "updatedAt";
  const sortOrder = query.sortOrder ?? "desc";
  const normalizedKeyword = query.keyword
    ? normalizeSearchKeyword(query.keyword)
    : undefined;

  // Apply only index-friendly filters in Firestore; keyword matching is resolved below for MVP-scale data.
  let productQuery = db
    .collection("products")
    .where("isDeleted", "==", false);

  if (query.categoryId) {
    productQuery = productQuery.where("categoryId", "==", query.categoryId);
  }

  if (query.status) {
    productQuery = productQuery.where("status", "==", query.status);
  }

  if (query.tagId) {
    productQuery = productQuery.where("tagIds", "array-contains", query.tagId);
  }

  const [productSnapshot, categorySnapshot, tagSnapshot] = await Promise.all([
    productQuery.get() as unknown as Promise<{
      docs: Array<QueryDocumentSnapshot<ProductDocument>>;
    }>,
    db.collection("categories").get() as unknown as Promise<{
      docs: Array<QueryDocumentSnapshot<CategoryDocument>>;
    }>,
    db.collection("tags").get() as unknown as Promise<{
      docs: Array<QueryDocumentSnapshot<TagDocument>>;
    }>
  ]);

  const categoryNameMap = new Map(
    categorySnapshot.docs.map((snapshot) => {
      const data = snapshot.data();
      return [data.categoryId, data.name] as const;
    })
  );
  const tagNameMap = new Map(
    tagSnapshot.docs.map((snapshot) => {
      const data = snapshot.data();
      return [data.tagId, data.name] as const;
    })
  );

  const records = productSnapshot.docs
    .map((snapshot) => toProductRecord(snapshot, categoryNameMap, tagNameMap))
    .filter((record) =>
      doesProductMatchQuery(record, query, normalizedKeyword)
    )
    .sort((left, right) =>
      compareProducts(left, right, sortBy, sortOrder)
    );

  const totalCount = records.length;
  const startIndex = (page - 1) * pageSize;
  const pageRecords = records.slice(startIndex, startIndex + pageSize);

  const items: ProductListItem[] = await Promise.all(
    pageRecords.map(async (record) => ({
      productId: record.productId,
      name: record.name,
      status: record.status,
      categoryName: record.categoryName,
      updatedAt: record.updatedAt.toISOString(),
      thumbnailUrl: await getThumbnailUrl(
        bucket,
        record.thumbnailPath,
        now,
        signedUrlExpiresMinutes
      )
    }))
  );

  return {
    data: {
      items
    },
    meta: {
      page,
      pageSize,
      totalCount,
      hasNext: page * pageSize < totalCount
    }
  };
}
