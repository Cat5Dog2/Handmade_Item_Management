export const queryKeys = {
  auth: {
    me: ["auth", "me"] as const
  },
  categories: {
    list: ["categories", "list"] as const
  },
  dashboard: {
    root: ["dashboard"] as const
  },
  products: {
    detail: (productId: string) => ["products", "detail", productId] as const,
    list: (filters: unknown) => ["products", "list", filters] as const
  },
  tags: {
    list: ["tags", "list"] as const
  }
} as const;
