import type {
  CustomerListData,
  CustomerListItem,
  CustomerListMeta,
  CustomerListQuery,
  CustomerSortBy,
  SortOrder
} from "@handmade/shared";
import {
  customerListQuerySchema,
  normalizeSearchKeyword
} from "@handmade/shared";
import type {
  Firestore,
  QueryDocumentSnapshot,
  Timestamp
} from "firebase-admin/firestore";
import type { ZodError } from "zod";
import { createValidationError } from "../errors/api-errors";
import { getFirestoreDb } from "../firebase/firebase-admin";

interface CustomerSnsAccountDocument {
  accountName?: string | null;
  note?: string | null;
  platform?: string | null;
  url?: string | null;
}

interface CustomerDocument {
  ageGroup?: string | null;
  customerId: string;
  customerStyle?: string | null;
  gender?: string | null;
  isArchived: boolean;
  memo?: string | null;
  name: string;
  normalizedName?: string;
  snsAccounts?: CustomerSnsAccountDocument[] | null;
  updatedAt: Timestamp;
}

interface ProductDocument {
  isDeleted: boolean;
  name: string;
  productId: string;
  soldAt: Timestamp | null;
  soldCustomerId?: string | null;
  status: "sold";
}

interface CustomerPurchaseSummaryRecord {
  lastPurchaseAt: Date | null;
  lastPurchaseProductId: string | null;
  lastPurchaseProductName: string | null;
  purchaseCount: number;
}

interface CustomerRecord {
  item: CustomerListItem;
  searchableText: string;
  sortableName: string;
  updatedAt: Date;
  lastPurchaseAt: Date | null;
}

interface ListCustomersOptions {
  db?: Firestore;
}

interface ListCustomersResult {
  data: CustomerListData;
  meta: CustomerListMeta;
}

function toValidationErrorDetails(error: ZodError<CustomerListQuery>) {
  return error.issues.map((issue) => ({
    field: typeof issue.path[0] === "string" ? issue.path[0] : "requestQuery",
    message: issue.message
  }));
}

function toDate(value: Timestamp) {
  return value.toDate();
}

function createSearchableText(parts: Array<string | null | undefined>) {
  return normalizeSearchKeyword(parts.filter(Boolean).join(" "));
}

function createEmptyPurchaseSummary(): CustomerPurchaseSummaryRecord {
  return {
    lastPurchaseAt: null,
    lastPurchaseProductId: null,
    lastPurchaseProductName: null,
    purchaseCount: 0
  };
}

function shouldReplaceLastPurchase(
  current: CustomerPurchaseSummaryRecord,
  nextSoldAt: Date | null,
  nextProductId: string
) {
  if (!nextSoldAt) {
    return false;
  }

  if (!current.lastPurchaseAt) {
    return true;
  }

  if (nextSoldAt.getTime() !== current.lastPurchaseAt.getTime()) {
    return nextSoldAt.getTime() > current.lastPurchaseAt.getTime();
  }

  return nextProductId.localeCompare(current.lastPurchaseProductId ?? "") < 0;
}

function createPurchaseSummaryMap(
  productSnapshots: Array<QueryDocumentSnapshot<ProductDocument>>
) {
  const purchaseSummaryMap = new Map<string, CustomerPurchaseSummaryRecord>();

  productSnapshots.forEach((snapshot) => {
    const data = snapshot.data();
    const customerId = data.soldCustomerId;

    if (!customerId) {
      return;
    }

    const currentSummary =
      purchaseSummaryMap.get(customerId) ?? createEmptyPurchaseSummary();
    const soldAt = data.soldAt ? toDate(data.soldAt) : null;
    const nextSummary: CustomerPurchaseSummaryRecord = {
      ...currentSummary,
      purchaseCount: currentSummary.purchaseCount + 1
    };

    if (shouldReplaceLastPurchase(currentSummary, soldAt, data.productId)) {
      nextSummary.lastPurchaseAt = soldAt;
      nextSummary.lastPurchaseProductId = data.productId;
      nextSummary.lastPurchaseProductName = data.name;
    }

    purchaseSummaryMap.set(customerId, nextSummary);
  });

  return purchaseSummaryMap;
}

function flattenSnsSearchParts(accounts?: CustomerSnsAccountDocument[] | null) {
  return (accounts ?? []).flatMap((account) => [
    account.platform,
    account.accountName,
    account.url,
    account.note
  ]);
}

function toCustomerRecord(
  snapshot: QueryDocumentSnapshot<CustomerDocument>,
  purchaseSummaryMap: Map<string, CustomerPurchaseSummaryRecord>
): CustomerRecord {
  const data = snapshot.data();
  const purchaseSummary =
    purchaseSummaryMap.get(data.customerId) ?? createEmptyPurchaseSummary();
  const updatedAt = toDate(data.updatedAt);

  return {
    item: {
      customerId: data.customerId,
      name: data.name,
      gender: data.gender ?? null,
      ageGroup: data.ageGroup ?? null,
      customerStyle: data.customerStyle ?? null,
      lastPurchaseAt: purchaseSummary.lastPurchaseAt?.toISOString() ?? null,
      lastPurchaseProductId: purchaseSummary.lastPurchaseProductId,
      lastPurchaseProductName: purchaseSummary.lastPurchaseProductName,
      purchaseCount: purchaseSummary.purchaseCount,
      updatedAt: updatedAt.toISOString()
    },
    searchableText: createSearchableText([
      data.normalizedName ?? data.name,
      ...flattenSnsSearchParts(data.snsAccounts),
      data.memo
    ]),
    sortableName: normalizeSearchKeyword(data.normalizedName ?? data.name),
    updatedAt,
    lastPurchaseAt: purchaseSummary.lastPurchaseAt
  };
}

function doesCustomerMatchQuery(
  record: CustomerRecord,
  normalizedKeyword?: string
) {
  if (!normalizedKeyword) {
    return true;
  }

  return record.searchableText.includes(normalizedKeyword);
}

function compareNullableDates(
  left: Date | null,
  right: Date | null,
  sortOrder: SortOrder
) {
  if (!left && !right) {
    return 0;
  }

  if (!left) {
    return 1;
  }

  if (!right) {
    return -1;
  }

  const comparison = left.getTime() - right.getTime();

  return sortOrder === "asc" ? comparison : -comparison;
}

function compareCustomers(
  left: CustomerRecord,
  right: CustomerRecord,
  sortBy: CustomerSortBy,
  sortOrder: SortOrder
) {
  let baseComparison = 0;

  if (sortBy === "name") {
    baseComparison = left.sortableName.localeCompare(right.sortableName);
    baseComparison = sortOrder === "asc" ? baseComparison : -baseComparison;
  } else if (sortBy === "lastPurchaseAt") {
    baseComparison = compareNullableDates(
      left.lastPurchaseAt,
      right.lastPurchaseAt,
      sortOrder
    );
  } else {
    const comparison = left.updatedAt.getTime() - right.updatedAt.getTime();
    baseComparison = sortOrder === "asc" ? comparison : -comparison;
  }

  if (baseComparison !== 0) {
    return baseComparison;
  }

  return left.item.customerId.localeCompare(right.item.customerId);
}

export async function listCustomers(
  input: unknown,
  options: ListCustomersOptions = {}
): Promise<ListCustomersResult> {
  const parsedInput = customerListQuerySchema.safeParse(input);

  if (!parsedInput.success) {
    throw createValidationError(toValidationErrorDetails(parsedInput.error));
  }

  const db = options.db ?? getFirestoreDb();
  const query = parsedInput.data;
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 50;
  const sortBy = query.sortBy ?? "updatedAt";
  const sortOrder = query.sortOrder ?? "desc";
  const normalizedKeyword = query.keyword
    ? normalizeSearchKeyword(query.keyword)
    : undefined;

  const [customerSnapshot, productSnapshot] = await Promise.all([
    db
      .collection("customers")
      .where("isArchived", "==", false)
      .get() as unknown as Promise<{
      docs: Array<QueryDocumentSnapshot<CustomerDocument>>;
    }>,
    db
      .collection("products")
      .where("isDeleted", "==", false)
      .where("status", "==", "sold")
      .get() as unknown as Promise<{
      docs: Array<QueryDocumentSnapshot<ProductDocument>>;
    }>
  ]);

  const purchaseSummaryMap = createPurchaseSummaryMap(productSnapshot.docs);
  const records = customerSnapshot.docs
    .map((snapshot) => toCustomerRecord(snapshot, purchaseSummaryMap))
    .filter((record) => doesCustomerMatchQuery(record, normalizedKeyword))
    .sort((left, right) =>
      compareCustomers(left, right, sortBy, sortOrder)
    );

  const totalCount = records.length;
  const startIndex = (page - 1) * pageSize;
  const items = records
    .slice(startIndex, startIndex + pageSize)
    .map((record) => record.item);

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
