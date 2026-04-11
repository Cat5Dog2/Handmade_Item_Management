export const PRODUCT_STATUSES = [
  "beforeProduction",
  "inProduction",
  "completed",
  "onDisplay",
  "inStock",
  "sold"
] as const;

export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  beforeProduction: "制作前",
  inProduction: "制作中",
  completed: "制作完了",
  onDisplay: "展示中",
  inStock: "在庫あり",
  sold: "販売済"
};
