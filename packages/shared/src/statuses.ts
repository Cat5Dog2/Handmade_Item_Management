export const PRODUCT_STATUSES = [
  "inProduction",
  "completed",
  "consignmentSale",
  "marche",
  "inStock",
  "sold"
] as const;

export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

const LEGACY_PRODUCT_STATUS_MIGRATIONS = {
  beforeProduction: "inProduction",
  onDisplay: "consignmentSale"
} as const;

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  inProduction: "制作中",
  completed: "制作済",
  consignmentSale: "委託販売",
  marche: "マルシェ",
  inStock: "在庫中",
  sold: "販売済"
};

export function normalizeProductStatus(value: unknown) {
  if (typeof value !== "string") {
    return value;
  }

  return (
    LEGACY_PRODUCT_STATUS_MIGRATIONS[
      value as keyof typeof LEGACY_PRODUCT_STATUS_MIGRATIONS
    ] ?? value
  );
}
