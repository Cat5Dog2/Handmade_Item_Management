import type { CustomerArchiveData } from "@handmade/shared";
import type { Firestore, Timestamp } from "firebase-admin/firestore";
import { Timestamp as FirestoreTimestamp } from "firebase-admin/firestore";
import { createApiError } from "../errors/api-errors";
import { getFirestoreDb } from "../firebase/firebase-admin";

interface CustomerSnsAccountDocument {
  accountName: string | null;
  note: string | null;
  platform: string | null;
  url: string | null;
}

interface CustomerDocument {
  ageGroup: string | null;
  archivedAt: Timestamp | null;
  createdAt: Timestamp;
  customerId: string;
  customerStyle: string | null;
  gender: string | null;
  isArchived: boolean;
  memo: string | null;
  name: string;
  normalizedName: string;
  snsAccounts: CustomerSnsAccountDocument[];
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

interface ArchiveCustomerOptions {
  db?: Firestore;
  now?: () => Timestamp;
}

export interface CustomerArchiveResult extends CustomerArchiveData {
  didArchive: boolean;
}

function toIsoString(value: Timestamp) {
  return value.toDate().toISOString();
}

function resolveArchivedAt(customer: CustomerDocument) {
  return customer.archivedAt ?? customer.updatedAt;
}

export async function archiveCustomer(
  customerId: string,
  options: ArchiveCustomerOptions = {}
): Promise<CustomerArchiveResult> {
  const db = options.db ?? getFirestoreDb();
  const now = options.now ?? FirestoreTimestamp.now;
  const customerReference = db.collection("customers").doc(customerId);

  return db.runTransaction(async (transaction) => {
    const typedTransaction = transaction as unknown as FirestoreTransactionLike;
    const snapshot = await typedTransaction.get(customerReference);

    if (!snapshot.exists) {
      throw createApiError({
        statusCode: 404,
        code: "CUSTOMER_NOT_FOUND",
        message: "\u6307\u5b9a\u3057\u305f\u9867\u5ba2\u304c\u898b\u3064\u304b\u308a\u307e\u305b\u3093\u3002"
      });
    }

    const customer = snapshot.data() as CustomerDocument;

    if (customer.isArchived) {
      const archivedAt = resolveArchivedAt(customer);

      return {
        customerId: customer.customerId,
        archivedAt: toIsoString(archivedAt),
        updatedAt: toIsoString(customer.updatedAt),
        didArchive: false
      };
    }

    const archivedAt = now();

    typedTransaction.set(customerReference, {
      ...customer,
      isArchived: true,
      archivedAt,
      updatedAt: archivedAt
    });

    return {
      customerId: customer.customerId,
      archivedAt: toIsoString(archivedAt),
      updatedAt: toIsoString(archivedAt),
      didArchive: true
    };
  });
}
