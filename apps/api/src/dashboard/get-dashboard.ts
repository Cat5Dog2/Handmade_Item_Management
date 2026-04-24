import type {
  DashboardDueSoonTask,
  DashboardRecentProduct,
  DashboardResponseData,
  DashboardStatusCounts,
  ProductStatus
} from "@handmade/shared";
import { PRODUCT_STATUSES } from "@handmade/shared";
import type {
  Firestore,
  QueryDocumentSnapshot,
  Timestamp
} from "firebase-admin/firestore";
import { getFirestoreDb, getStorageBucket } from "../firebase/firebase-admin";

interface ProductImageDocument {
  displayPath: string;
  imageId: string;
  isPrimary: boolean;
  sortOrder: number;
  thumbnailPath: string;
}

interface ProductDocument {
  images?: ProductImageDocument[] | null;
  isDeleted: boolean;
  name: string;
  productId: string;
  status: ProductStatus;
  updatedAt: Timestamp;
}

interface TaskDocument {
  dueDate?: string | null;
  isCompleted: boolean;
  name: string;
  productId: string;
  taskId: string;
}

interface SignedUrlBucket {
  file(path: string): {
    getSignedUrl(options: { action: "read"; expires: Date }): Promise<[string]>;
  };
}

interface GetDashboardOptions {
  bucket?: SignedUrlBucket;
  db?: Firestore;
  now?: () => Date;
  signedUrlExpiresMinutes?: number;
}

interface ProductRecord {
  name: string;
  productId: string;
  status: ProductStatus;
  thumbnailPath: string | null;
  updatedAt: Date;
}

interface TaskRecord {
  dueDate: string | null;
  productId: string;
  taskId: string;
  taskName: string;
}

const DEFAULT_SIGNED_URL_EXPIRES_MINUTES = 60;
const DASHBOARD_RECENT_PRODUCT_LIMIT = 5;
const DASHBOARD_DUE_SOON_DAYS = 7;
const JST_TIME_ZONE = "Asia/Tokyo";

const jstDateFormatter = new Intl.DateTimeFormat("en-CA", {
  day: "2-digit",
  month: "2-digit",
  timeZone: JST_TIME_ZONE,
  year: "numeric"
});

function createEmptyStatusCounts(): DashboardStatusCounts {
  return PRODUCT_STATUSES.reduce((counts, status) => {
    counts[status] = 0;
    return counts;
  }, {} as DashboardStatusCounts);
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

function toProductRecord(
  snapshot: QueryDocumentSnapshot<ProductDocument>
): ProductRecord {
  const product = snapshot.data();
  const images = product.images ?? [];
  const representativeImage = getRepresentativeImage(images);

  return {
    name: product.name,
    productId: product.productId,
    status: product.status,
    thumbnailPath: representativeImage?.thumbnailPath ?? null,
    updatedAt: product.updatedAt.toDate()
  };
}

function toTaskRecord(snapshot: QueryDocumentSnapshot<TaskDocument>): TaskRecord {
  const task = snapshot.data();

  return {
    dueDate: task.dueDate ?? null,
    productId: task.productId,
    taskId: task.taskId,
    taskName: task.name
  };
}

function formatJstDate(date: Date) {
  const parts = jstDateFormatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return `${year}-${month}-${day}`;
}

function addDaysToDateString(dateString: string, days: number) {
  const [yearText, monthText, dayText] = dateString.split("-");
  const date = new Date(
    Date.UTC(Number(yearText), Number(monthText) - 1, Number(dayText) + days)
  );

  return date.toISOString().slice(0, 10);
}

function isDueSoon(dueDate: string | null, today: string, dueSoonEnd: string) {
  return Boolean(dueDate && dueDate >= today && dueDate <= dueSoonEnd);
}

function compareDueSoonTasks(
  left: DashboardDueSoonTask,
  right: DashboardDueSoonTask
) {
  if (left.dueDate !== right.dueDate) {
    return left.dueDate.localeCompare(right.dueDate);
  }

  if (left.productId !== right.productId) {
    return left.productId.localeCompare(right.productId);
  }

  return left.taskId.localeCompare(right.taskId);
}

function compareProductsByUpdatedAtDescending(
  left: ProductRecord,
  right: ProductRecord
) {
  const updatedAtComparison = right.updatedAt.getTime() - left.updatedAt.getTime();

  if (updatedAtComparison !== 0) {
    return updatedAtComparison;
  }

  return left.productId.localeCompare(right.productId);
}

function resolveSignedUrlExpiresMinutes(options: GetDashboardOptions) {
  if (options.signedUrlExpiresMinutes != null) {
    return options.signedUrlExpiresMinutes;
  }

  const envValue = Number(process.env.SIGNED_URL_EXPIRES_MINUTES ?? "60");

  return Number.isFinite(envValue) && envValue > 0
    ? envValue
    : DEFAULT_SIGNED_URL_EXPIRES_MINUTES;
}

async function getThumbnailUrl(
  bucket: SignedUrlBucket,
  thumbnailPath: string | null,
  expiresAt: Date
) {
  if (!thumbnailPath) {
    return null;
  }

  const [thumbnailUrl] = await bucket.file(thumbnailPath).getSignedUrl({
    action: "read",
    expires: expiresAt
  });

  return thumbnailUrl;
}

async function toRecentProduct(
  bucket: SignedUrlBucket,
  product: ProductRecord,
  expiresAt: Date
): Promise<DashboardRecentProduct> {
  return {
    productId: product.productId,
    name: product.name,
    status: product.status,
    updatedAt: product.updatedAt.toISOString(),
    thumbnailUrl: await getThumbnailUrl(bucket, product.thumbnailPath, expiresAt)
  };
}

export async function getDashboard(
  options: GetDashboardOptions = {}
): Promise<DashboardResponseData> {
  const db = options.db ?? getFirestoreDb();
  const bucket = options.bucket ?? getStorageBucket();
  const now = options.now ?? (() => new Date());
  const signedUrlExpiresMinutes = resolveSignedUrlExpiresMinutes(options);
  const requestNow = now();
  const expiresAt = new Date(
    requestNow.getTime() + signedUrlExpiresMinutes * 60 * 1000
  );
  const today = formatJstDate(requestNow);
  const dueSoonEnd = addDaysToDateString(today, DASHBOARD_DUE_SOON_DAYS);

  const [productSnapshot, openTaskSnapshot] = await Promise.all([
    db
      .collection("products")
      .where("isDeleted", "==", false)
      .get() as unknown as Promise<{
      docs: Array<QueryDocumentSnapshot<ProductDocument>>;
    }>,
    db
      .collection("tasks")
      .where("isCompleted", "==", false)
      .get() as unknown as Promise<{
      docs: Array<QueryDocumentSnapshot<TaskDocument>>;
    }>
  ]);

  const products = productSnapshot.docs.map(toProductRecord);
  const productMap = new Map(
    products.map((product) => [product.productId, product] as const)
  );
  const statusCounts = createEmptyStatusCounts();

  products.forEach((product) => {
    statusCounts[product.status] += 1;
  });

  const openTasks = openTaskSnapshot.docs
    .map(toTaskRecord)
    .filter((task) => productMap.has(task.productId));
  const dueSoonTasks: DashboardDueSoonTask[] = openTasks
    .filter((task) => isDueSoon(task.dueDate, today, dueSoonEnd))
    .map((task) => {
      const product = productMap.get(task.productId);

      return {
        taskId: task.taskId,
        taskName: task.taskName,
        productId: task.productId,
        productName: product?.name ?? "",
        dueDate: task.dueDate as string
      };
    })
    .sort(compareDueSoonTasks);
  const recentProductRecords = products
    .slice()
    .sort(compareProductsByUpdatedAtDescending)
    .slice(0, DASHBOARD_RECENT_PRODUCT_LIMIT);
  const recentProducts = await Promise.all(
    recentProductRecords.map((product) =>
      toRecentProduct(bucket, product, expiresAt)
    )
  );

  return {
    statusCounts,
    soldCount: statusCounts.sold,
    openTaskCount: openTasks.length,
    dueSoonTasks,
    recentProducts
  };
}
