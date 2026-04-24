import type { CustomerCreateData, CustomerCreateInput } from "@handmade/shared";
import {
  customerCreateInputSchema,
  normalizeSearchKeyword
} from "@handmade/shared";
import type { Firestore, Timestamp } from "firebase-admin/firestore";
import { Timestamp as FirestoreTimestamp } from "firebase-admin/firestore";
import type { ZodError } from "zod";
import { createValidationError } from "../errors/api-errors";
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

interface CustomerCounterDocument {
  counterKey: "customer";
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

interface CreateCustomerOptions {
  db?: Firestore;
  now?: () => Timestamp;
}

const DEFAULT_CUSTOMER_ID_PREFIX = "cus_";
const DEFAULT_CUSTOMER_ID_DIGITS = 6;
const DEFAULT_CUSTOMER_COUNTER_DOCUMENT_PATH = "counters/customer";

function toValidationErrorDetails(error: ZodError<CustomerCreateInput>) {
  return error.issues.map((issue) => ({
    field: typeof issue.path[0] === "string" ? issue.path[0] : "requestBody",
    message: issue.message
  }));
}

function createCustomerId(customerNumber: number) {
  return `${DEFAULT_CUSTOMER_ID_PREFIX}${String(customerNumber).padStart(
    DEFAULT_CUSTOMER_ID_DIGITS,
    "0"
  )}`;
}

function normalizeSnsAccounts(
  snsAccounts: CustomerCreateInput["snsAccounts"]
): CustomerSnsAccountDocument[] {
  return (snsAccounts ?? []).map((account) => ({
    platform: account.platform ?? null,
    accountName: account.accountName ?? null,
    url: account.url ?? null,
    note: account.note ?? null
  }));
}

async function getNextCustomerId(
  transaction: FirestoreTransactionLike,
  counterReference: unknown,
  now: () => Timestamp
) {
  const snapshot = await transaction.get(counterReference);
  const counterData = snapshot.exists
    ? (snapshot.data() as CustomerCounterDocument)
    : undefined;
  const nextValue = (counterData?.currentValue ?? 0) + 1;
  const createdAt = now();

  transaction.set(counterReference, {
    counterKey: "customer",
    currentValue: nextValue,
    updatedAt: createdAt
  });

  return {
    createdAt,
    customerId: createCustomerId(nextValue)
  };
}

export async function createCustomer(
  input: unknown,
  options: CreateCustomerOptions = {}
): Promise<CustomerCreateData> {
  const parsedInput = customerCreateInputSchema.safeParse(input);

  if (!parsedInput.success) {
    throw createValidationError(toValidationErrorDetails(parsedInput.error));
  }

  const db = options.db ?? getFirestoreDb();
  const now = options.now ?? FirestoreTimestamp.now;
  const counterReference = db.doc(DEFAULT_CUSTOMER_COUNTER_DOCUMENT_PATH);

  const result = await db.runTransaction(async (transaction) => {
    const { createdAt, customerId } = await getNextCustomerId(
      transaction as unknown as FirestoreTransactionLike,
      counterReference,
      now
    );
    const customerReference = db.collection("customers").doc(customerId);
    const customerDocument: CustomerDocument = {
      customerId,
      name: parsedInput.data.name,
      normalizedName: normalizeSearchKeyword(parsedInput.data.name),
      gender: parsedInput.data.gender ?? null,
      ageGroup: parsedInput.data.ageGroup ?? null,
      customerStyle: parsedInput.data.customerStyle ?? null,
      snsAccounts: normalizeSnsAccounts(parsedInput.data.snsAccounts),
      memo: parsedInput.data.memo ?? null,
      isArchived: false,
      archivedAt: null,
      createdAt,
      updatedAt: createdAt
    };

    transaction.set(customerReference, customerDocument);

    return {
      customerId,
      createdAt,
      updatedAt: createdAt
    };
  });

  return {
    customerId: result.customerId,
    createdAt: result.createdAt.toDate().toISOString(),
    updatedAt: result.updatedAt.toDate().toISOString()
  };
}
