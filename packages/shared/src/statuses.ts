export const PRODUCT_STATUSES = [
  "beforeProduction",
  "inProduction",
  "completed",
  "onDisplay",
  "inStock",
  "sold"
] as const;

export type ProductStatus = (typeof PRODUCT_STATUSES)[number];
