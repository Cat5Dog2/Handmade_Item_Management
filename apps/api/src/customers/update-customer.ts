import type {
  CustomerUpdateData,
  CustomerUpdateInput
} from "@handmade/shared";
import {
  customerUpdateInputSchema,
  normalizeSearchKeyword
} from "@handmade/shared";
import type { Firestore, Timestamp } from "firebase-admin/firestore";
import { Timestamp as FirestoreTimestamp } from "firebase-admin/firestore";
import type { ZodError } from "zod";
import { createApiError, createValidationError } from "../errors/api-errors";
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

interface UpdateCustomerOptions {
  db?: Firestore;
  now?: () => Timestamp;
}

export interface CustomerUpdateResult extends CustomerUpdateData {
  changedFields: string[];
}

function toValidationErrorDetails(error: ZodError<CustomerUpdateInput>) {
  return error.issues.map((issue) => ({
    field: typeof issue.path[0] === "string" ? issue.path[0] : "requestBody",
    message: issue.message
  }));
}

function normalizeSnsAccounts(
  snsAccounts: CustomerUpdateInput["snsAccounts"]
): CustomerSnsAccountDocument[] {
  return (snsAccounts ?? []).map((account) => ({
    platform: account.platform ?? null,
    accountName: account.accountName ?? null,
    url: account.url ?? null,
    note: account.note ?? null
  }));
}

function areSnsAccountsEqual(
  left: CustomerSnsAccountDocument[],
  right: CustomerSnsAccountDocument[]
) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function collectChangedFields(
  current: CustomerDocument,
  next: CustomerDocument
) {
  const changedFields: string[] = [];

  if (current.name !== next.name) {
    changedFields.push("name");
  }

  if (current.gender !== next.gender) {
    changedFields.push("gender");
  }

  if (current.ageGroup !== next.ageGroup) {
    changedFields.push("ageGroup");
  }

  if (current.customerStyle !== next.customerStyle) {
    changedFields.push("customerStyle");
  }

  if (!areSnsAccountsEqual(current.snsAccounts, next.snsAccounts)) {
    changedFields.push("snsAccounts");
  }

  if (current.memo !== next.memo) {
    changedFields.push("memo");
  }

  return changedFields;
}

function createUpdatedCustomerDocument(
  current: CustomerDocument,
  input: CustomerUpdateInput,
  updatedAt: Timestamp
): CustomerDocument {
  return {
    ...current,
    name: input.name,
    normalizedName: normalizeSearchKeyword(input.name),
    gender: input.gender ?? null,
    ageGroup: input.ageGroup ?? null,
    customerStyle: input.customerStyle ?? null,
    snsAccounts: normalizeSnsAccounts(input.snsAccounts),
    memo: input.memo ?? null,
    updatedAt
  };
}

export async function updateCustomer(
  customerId: string,
  input: unknown,
  options: UpdateCustomerOptions = {}
): Promise<CustomerUpdateResult> {
  const parsedInput = customerUpdateInputSchema.safeParse(input);

  if (!parsedInput.success) {
    throw createValidationError(toValidationErrorDetails(parsedInput.error));
  }

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
        message: "指定した顧客が見つかりません。"
      });
    }

    const currentCustomer = snapshot.data() as CustomerDocument;

    if (currentCustomer.isArchived) {
      throw createApiError({
        statusCode: 400,
        code: "CUSTOMER_ARCHIVED",
        message: "アーカイブ済み顧客は更新できません。"
      });
    }

    const updatedAt = now();
    const nextCustomer = createUpdatedCustomerDocument(
      currentCustomer,
      parsedInput.data,
      updatedAt
    );
    const changedFields = collectChangedFields(currentCustomer, nextCustomer);

    typedTransaction.set(customerReference, nextCustomer);

    return {
      customerId: nextCustomer.customerId,
      updatedAt: updatedAt.toDate().toISOString(),
      changedFields
    };
  });
}
