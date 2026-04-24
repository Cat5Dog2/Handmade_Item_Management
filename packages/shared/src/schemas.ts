import { z } from "zod";
import { API_ERROR_CODES } from "./error-codes";
import {
  normalizeMultilineText,
  normalizeOptionalSearchKeyword,
  normalizeSearchKeyword,
  normalizeSingleLineText
} from "./normalization";
import { PRODUCT_STATUSES } from "./statuses";

const PRODUCT_SORT_FIELDS = ["updatedAt", "name"] as const;
const CUSTOMER_SORT_FIELDS = ["updatedAt", "lastPurchaseAt", "name"] as const;
const SORT_ORDERS = ["asc", "desc"] as const;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const productStatusSchema = z.enum(PRODUCT_STATUSES);
export const productSortBySchema = z.enum(PRODUCT_SORT_FIELDS);
export const customerSortBySchema = z.enum(CUSTOMER_SORT_FIELDS);
export const sortOrderSchema = z.enum(SORT_ORDERS);

export const apiErrorCodeSchema = z.enum(API_ERROR_CODES);

export const apiErrorDetailSchema = z.object({
  field: z.string().min(1),
  message: z.string().min(1)
});

export const apiErrorResponseSchema = z.object({
  code: apiErrorCodeSchema,
  message: z.string().min(1),
  details: z.array(apiErrorDetailSchema).optional()
});

export const healthResponseSchema = z.object({
  data: z.object({
    status: z.literal("ok"),
    service: z.string().min(1)
  })
});

function normalizeStringInput(
  value: unknown,
  normalizer: (value: string) => string
) {
  if (typeof value !== "string") {
    return value;
  }

  return normalizer(value);
}

function emptyStringToUndefined(value: unknown) {
  if (value === "") {
    return undefined;
  }

  return value;
}

function normalizeOptionalIdentifier(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value !== "string") {
    return value;
  }

  const normalized = normalizeSingleLineText(value);

  return normalized === "" ? undefined : normalized;
}

function isIsoDateString(value: string) {
  if (!ISO_DATE_PATTERN.test(value)) {
    return false;
  }

  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

const identifierSchema = z.preprocess(
  (value) => normalizeStringInput(value, normalizeSingleLineText),
  z.string().min(1)
);

const optionalIdentifierSchema = z.preprocess(
  normalizeOptionalIdentifier,
  z.string().min(1).optional()
);

const nullableIdentifierSchema = z.preprocess((value) => {
  if (value === "") {
    return null;
  }

  return normalizeStringInput(value, normalizeSingleLineText);
}, z.string().min(1).nullable());

const requiredSingleLineTextSchema = (maxLength: number) =>
  z.preprocess(
    (value) => normalizeStringInput(value, normalizeSingleLineText),
    z.string().min(1).max(maxLength)
  );

const optionalNullableSingleLineTextSchema = (maxLength?: number) =>
  z.preprocess(
    (value) => {
      if (value === undefined) {
        return undefined;
      }

      if (value === null || value === "") {
        return null;
      }

      const normalized = normalizeStringInput(value, normalizeSingleLineText);

      return normalized === "" ? null : normalized;
    },
    (maxLength === undefined
      ? z.union([z.string(), z.null()])
      : z.union([z.string().max(maxLength), z.null()])
    ).optional()
  );

const optionalMultilineTextSchema = (maxLength: number) =>
  z.preprocess(
    (value) => normalizeStringInput(value, normalizeMultilineText),
    z.string().max(maxLength).optional()
  );

const requiredMultilineTextSchema = (maxLength: number) =>
  z.preprocess(
    (value) => normalizeStringInput(value, normalizeMultilineText),
    z.string().max(maxLength)
  );

const optionalNullableMultilineTextSchema = (maxLength?: number) =>
  z.preprocess(
    (value) => {
      if (value === undefined) {
        return undefined;
      }

      if (value === null || value === "") {
        return null;
      }

      const normalized = normalizeStringInput(value, normalizeMultilineText);

      return normalized === "" ? null : normalized;
    },
    (maxLength === undefined
      ? z.union([z.string(), z.null()])
      : z.union([z.string().max(maxLength), z.null()])
    ).optional()
  );

const nonNegativeIntegerSchema = z.preprocess(
  emptyStringToUndefined,
  z.coerce.number().int().min(0)
);

const optionalPositiveIntegerSchema = z.preprocess(
  emptyStringToUndefined,
  z.coerce.number().int().min(1).optional()
);

const optionalNonNegativeIntegerOrNullSchema = z.preprocess(
  (value) => {
    if (value === "") {
      return undefined;
    }

    if (value === undefined || value === null) {
      return value;
    }

    if (typeof value === "string") {
      const normalized = normalizeSingleLineText(value);

      if (normalized === "") {
        return undefined;
      }

      return Number(normalized);
    }

    return value;
  },
  z.union([z.number().int().min(0), z.null()]).optional()
);

const optionalBooleanSchema = z.preprocess((value) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return value;
}, z.boolean().optional());

export const isoDateSchema = z.preprocess(
  (value) => normalizeStringInput(value, normalizeSingleLineText),
  z.string().regex(ISO_DATE_PATTERN).refine(isIsoDateString)
);

const optionalNullableIsoDateSchema = z.preprocess((value) => {
  if (value === "") {
    return undefined;
  }

  return normalizeStringInput(value, normalizeSingleLineText);
}, z.union([isoDateSchema, z.null()]).optional());

export const searchKeywordSchema = z.preprocess(
  (value) => normalizeStringInput(value, normalizeSearchKeyword),
  z.string().min(1).max(100)
);

const optionalSearchKeywordSchema = z.preprocess(
  (value) => {
    if (typeof value !== "string" && value != null) {
      return value;
    }

    return normalizeOptionalSearchKeyword(value);
  },
  z.string().max(100).optional()
);

export const productListQuerySchema = z.object({
  page: optionalPositiveIntegerSchema,
  pageSize: z.preprocess(
    emptyStringToUndefined,
    z.coerce.number().int().min(1).max(100).optional()
  ),
  sortBy: z.preprocess(emptyStringToUndefined, productSortBySchema.optional()),
  sortOrder: z.preprocess(emptyStringToUndefined, sortOrderSchema.optional()),
  keyword: optionalSearchKeywordSchema,
  categoryId: optionalIdentifierSchema,
  tagId: optionalIdentifierSchema,
  status: z.preprocess(emptyStringToUndefined, productStatusSchema.optional()),
  includeSold: optionalBooleanSchema
});

export const customerListQuerySchema = z.object({
  page: optionalPositiveIntegerSchema,
  pageSize: z.preprocess(
    emptyStringToUndefined,
    z.coerce.number().int().min(1).max(100).optional()
  ),
  keyword: optionalSearchKeywordSchema,
  sortBy: z.preprocess(emptyStringToUndefined, customerSortBySchema.optional()),
  sortOrder: z.preprocess(emptyStringToUndefined, sortOrderSchema.optional())
});

export const productCreateInputSchema = z.object({
  name: requiredSingleLineTextSchema(100),
  description: optionalMultilineTextSchema(2000),
  price: nonNegativeIntegerSchema,
  categoryId: identifierSchema,
  tagIds: z.array(identifierSchema).optional(),
  status: productStatusSchema
});

export const productUpdateInputSchema = z.object({
  name: requiredSingleLineTextSchema(100),
  description: requiredMultilineTextSchema(2000),
  price: nonNegativeIntegerSchema,
  categoryId: identifierSchema,
  tagIds: z.array(identifierSchema),
  status: productStatusSchema,
  primaryImageId: nullableIdentifierSchema,
  soldCustomerId: nullableIdentifierSchema
});

export const taskListQuerySchema = z.object({
  showCompleted: optionalBooleanSchema
});

export const taskCreateInputSchema = z.object({
  name: requiredSingleLineTextSchema(100),
  content: optionalMultilineTextSchema(2000),
  dueDate: optionalNullableIsoDateSchema,
  memo: optionalMultilineTextSchema(1000)
});

export const taskUpdateInputSchema = z.object({
  name: requiredSingleLineTextSchema(100),
  content: optionalMultilineTextSchema(2000),
  dueDate: optionalNullableIsoDateSchema,
  memo: optionalMultilineTextSchema(1000),
  isCompleted: z.boolean()
});

export const taskCompletionInputSchema = z.object({
  isCompleted: z.boolean()
});

export const categoryInputSchema = z.object({
  name: requiredSingleLineTextSchema(50),
  sortOrder: optionalNonNegativeIntegerOrNullSchema
});

export const tagInputSchema = z.object({
  name: requiredSingleLineTextSchema(50)
});

export const customerSnsAccountInputSchema = z.object({
  platform: optionalNullableSingleLineTextSchema(),
  accountName: optionalNullableSingleLineTextSchema(),
  url: optionalNullableSingleLineTextSchema(),
  note: optionalNullableMultilineTextSchema()
});

export const customerInputSchema = z.object({
  name: requiredSingleLineTextSchema(100),
  gender: optionalNullableSingleLineTextSchema(),
  ageGroup: optionalNullableSingleLineTextSchema(),
  customerStyle: optionalNullableSingleLineTextSchema(100),
  snsAccounts: z.array(customerSnsAccountInputSchema).optional(),
  memo: optionalNullableMultilineTextSchema(1000)
});

export const customerCreateInputSchema = customerInputSchema;

export const customerUpdateInputSchema = customerInputSchema;

export const qrLookupInputSchema = z.object({
  qrCodeValue: identifierSchema
});

export const qrSellInputSchema = z
  .object({
    customerId: nullableIdentifierSchema.optional(),
    productId: optionalIdentifierSchema,
    qrCodeValue: optionalIdentifierSchema
  })
  .superRefine((value, ctx) => {
    if (!value.productId && !value.qrCodeValue) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "productId or qrCodeValue is required"
      });
    }
  });
