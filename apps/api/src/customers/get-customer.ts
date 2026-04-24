import type { CustomerDetailData } from "@handmade/shared";
import type {
  Firestore,
  QueryDocumentSnapshot,
  Timestamp
} from "firebase-admin/firestore";
import { createApiError } from "../errors/api-errors";
import { getFirestoreDb } from "../firebase/firebase-admin";

interface CustomerSnsAccountDocument {
  accountName?: string | null;
  note?: string | null;
  platform?: string | null;
  url?: string | null;
}

interface CustomerDocument {
  ageGroup?: string | null;
  archivedAt?: Timestamp | null;
  createdAt: Timestamp;
  customerId: string;
  customerStyle?: string | null;
  gender?: string | null;
  isArchived: boolean;
  memo?: string | null;
  name: string;
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

interface SnapshotLike<T> {
  data: () => T;
  exists: boolean;
}

interface CustomerPurchaseSummaryRecord {
  lastPurchaseAt: Date | null;
  lastPurchaseProductId: string | null;
  lastPurchaseProductName: string | null;
  purchaseCount: number;
}

interface GetCustomerOptions {
  db?: Firestore;
}

function toIsoString(value?: Timestamp | null) {
  return value ? value.toDate().toISOString() : null;
}

function normalizeSnsAccounts(accounts?: CustomerSnsAccountDocument[] | null) {
  return (accounts ?? []).map((account) => ({
    platform: account.platform ?? null,
    accountName: account.accountName ?? null,
    url: account.url ?? null,
    note: account.note ?? null
  }));
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

function createPurchaseSummary(
  productSnapshots: Array<QueryDocumentSnapshot<ProductDocument>>
) {
  return productSnapshots.reduce<CustomerPurchaseSummaryRecord>(
    (summary, snapshot) => {
      const product = snapshot.data();
      const nextSummary: CustomerPurchaseSummaryRecord = {
        ...summary,
        purchaseCount: summary.purchaseCount + 1
      };
      const soldAt = product.soldAt ? product.soldAt.toDate() : null;

      if (shouldReplaceLastPurchase(summary, soldAt, product.productId)) {
        nextSummary.lastPurchaseAt = soldAt;
        nextSummary.lastPurchaseProductId = product.productId;
        nextSummary.lastPurchaseProductName = product.name;
      }

      return nextSummary;
    },
    createEmptyPurchaseSummary()
  );
}

export async function getCustomer(
  customerId: string,
  options: GetCustomerOptions = {}
): Promise<CustomerDetailData> {
  const db = options.db ?? getFirestoreDb();
  const customerReference = db.collection("customers").doc(customerId);
  const customerSnapshot = (await customerReference.get()) as unknown as SnapshotLike<CustomerDocument>;

  if (!customerSnapshot.exists) {
    throw createApiError({
      statusCode: 404,
      code: "CUSTOMER_NOT_FOUND",
      message: "指定した顧客が見つかりません。"
    });
  }

  const customer = customerSnapshot.data();
  const productSnapshot = (await db
    .collection("products")
    .where("isDeleted", "==", false)
    .where("status", "==", "sold")
    .where("soldCustomerId", "==", customerId)
    .get()) as unknown as {
    docs: Array<QueryDocumentSnapshot<ProductDocument>>;
  };
  const purchaseSummary = createPurchaseSummary(productSnapshot.docs);

  return {
    customer: {
      customerId: customer.customerId,
      name: customer.name,
      gender: customer.gender ?? null,
      ageGroup: customer.ageGroup ?? null,
      customerStyle: customer.customerStyle ?? null,
      snsAccounts: normalizeSnsAccounts(customer.snsAccounts),
      memo: customer.memo ?? null,
      isArchived: customer.isArchived,
      archivedAt: toIsoString(customer.archivedAt),
      createdAt: customer.createdAt.toDate().toISOString(),
      updatedAt: customer.updatedAt.toDate().toISOString()
    },
    summary: {
      lastPurchaseAt: purchaseSummary.lastPurchaseAt?.toISOString() ?? null,
      lastPurchaseProductId: purchaseSummary.lastPurchaseProductId,
      lastPurchaseProductName: purchaseSummary.lastPurchaseProductName,
      purchaseCount: purchaseSummary.purchaseCount
    }
  };
}
