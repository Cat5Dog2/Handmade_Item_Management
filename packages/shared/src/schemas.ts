import { z } from "zod";
import { API_ERROR_CODES } from "./error-codes";
import { PRODUCT_STATUSES } from "./statuses";

export const productStatusSchema = z.enum(PRODUCT_STATUSES);

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
