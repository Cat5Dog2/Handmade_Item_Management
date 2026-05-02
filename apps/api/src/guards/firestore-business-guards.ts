import type { ApiErrorCode } from "@handmade/shared";
import { createApiError } from "../errors/api-errors";

export interface SnapshotLike<T = unknown> {
  data: () => T;
  exists: boolean;
}

export interface FirestoreReaderLike {
  get(reference: unknown): Promise<SnapshotLike<unknown>>;
}

export interface CustomerAvailabilityDocument {
  isArchived: boolean;
  name: string;
}

export interface ProductAvailabilityDocument {
  isDeleted: boolean;
}

interface DocumentExistsOptions {
  code: ApiErrorCode;
  field: string;
  message: string;
  statusCode?: number;
}

interface AvailableCustomerOptions {
  archivedDetailMessage: string;
  archivedMessage: string;
  field: string;
  notFoundDetailMessage: string;
  notFoundMessage: string;
}

const PRODUCT_NOT_FOUND_MESSAGE = "対象の商品が見つかりません。";
const PRODUCT_RELATED_RESOURCE_UNAVAILABLE_MESSAGE =
  "この商品の関連情報は表示できません。";

export async function assertDocumentExists(
  reader: FirestoreReaderLike,
  reference: unknown,
  options: DocumentExistsOptions
) {
  const snapshot = await reader.get(reference);

  if (!snapshot.exists) {
    throw createApiError({
      statusCode: options.statusCode ?? 400,
      code: options.code,
      details: [
        {
          field: options.field,
          message: options.message
        }
      ],
      message: options.message
    });
  }

  return snapshot;
}

export async function getAvailableCustomer(
  reader: FirestoreReaderLike,
  reference: unknown,
  options: AvailableCustomerOptions
) {
  const snapshot = await reader.get(reference);

  if (!snapshot.exists) {
    throw createApiError({
      statusCode: 400,
      code: "CUSTOMER_NOT_FOUND",
      details: [
        {
          field: options.field,
          message: options.notFoundDetailMessage
        }
      ],
      message: options.notFoundMessage
    });
  }

  const customer = snapshot.data() as CustomerAvailabilityDocument;

  if (customer.isArchived) {
    throw createApiError({
      statusCode: 400,
      code: "CUSTOMER_ARCHIVED",
      details: [
        {
          field: options.field,
          message: options.archivedDetailMessage
        }
      ],
      message: options.archivedMessage
    });
  }

  return customer;
}

export function assertRelatedProductAvailable(
  snapshot: SnapshotLike<unknown>
) {
  if (!snapshot.exists) {
    throw createApiError({
      statusCode: 404,
      code: "PRODUCT_NOT_FOUND",
      message: PRODUCT_NOT_FOUND_MESSAGE
    });
  }

  const product = snapshot.data() as ProductAvailabilityDocument;

  if (product.isDeleted) {
    throw createApiError({
      statusCode: 404,
      code: "PRODUCT_RELATED_RESOURCE_UNAVAILABLE",
      message: PRODUCT_RELATED_RESOURCE_UNAVAILABLE_MESSAGE
    });
  }

  return product;
}
