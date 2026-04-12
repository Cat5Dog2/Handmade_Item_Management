export const queryKeys = {
  auth: {
    me: ["auth", "me"] as const
  },
  dashboard: {
    root: ["dashboard"] as const
  },
  products: {
    detail: (productId: string) => ["products", "detail", productId] as const,
    list: (filters: unknown) => ["products", "list", filters] as const
  }
} as const;
