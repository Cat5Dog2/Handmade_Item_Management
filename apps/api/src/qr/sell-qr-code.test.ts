import { describe, expect, it, vi } from "vitest";
import {
  createDocumentSnapshot,
  createTimestamp,
  type TimestampLike
} from "../test/firestore-test-helpers";
import { sellQrCode } from "./sell-qr-code";

function createProduct(overrides: {
  isDeleted?: boolean;
  productId?: string;
  soldAt?: TimestampLike | null;
  soldCustomerId?: string | null;
  soldCustomerNameSnapshot?: string | null;
  status?: string;
  updatedAt?: TimestampLike;
}) {
  return {
    isDeleted: overrides.isDeleted ?? false,
    productId: overrides.productId ?? "HM-000001",
    soldAt: overrides.soldAt ?? null,
    soldCustomerId: overrides.soldCustomerId ?? null,
    soldCustomerNameSnapshot: overrides.soldCustomerNameSnapshot ?? null,
    status: overrides.status ?? "onDisplay",
    updatedAt:
      overrides.updatedAt ?? createTimestamp("2026-04-18T09:00:00.000Z")
  };
}

function createDb(options: {
  customerSnapshots?: Record<string, ReturnType<typeof createDocumentSnapshot>>;
  productIdentifier?: string;
  productSnapshot: ReturnType<typeof createDocumentSnapshot>;
}) {
  const productReference = {
    path: `products/${options.productIdentifier ?? "HM-000001"}`
  };
  const customerReferences = new Map<string, { path: string }>();
  const productDoc = vi.fn((productId: string) => {
    if (productId !== (options.productIdentifier ?? "HM-000001")) {
      throw new Error(`Unexpected product ${productId}`);
    }

    return productReference;
  });
  const customerDoc = vi.fn((customerId: string) => {
    const reference = customerReferences.get(customerId) ?? {
      path: `customers/${customerId}`
    };

    customerReferences.set(customerId, reference);

    return reference;
  });
  const transaction = {
    get: vi.fn(async (reference: unknown) => {
      if (reference === productReference) {
        return options.productSnapshot;
      }

      for (const [customerId, customerReference] of customerReferences) {
        if (reference === customerReference) {
          const customerSnapshot = options.customerSnapshots?.[customerId];

          if (!customerSnapshot) {
            throw new Error(`Unexpected customer ${customerId}`);
          }

          return customerSnapshot;
        }
      }

      throw new Error("Unexpected transaction reference");
    }),
    set: vi.fn()
  };
  const db = {
    collection: vi.fn((collectionName: string) => {
      if (collectionName === "products") {
        return {
          doc: productDoc
        };
      }

      if (collectionName === "customers") {
        return {
          doc: customerDoc
        };
      }

      throw new Error(`Unexpected collection ${collectionName}`);
    }),
    runTransaction: vi.fn(async (callback) => callback(transaction as never))
  };

  return {
    db,
    productDoc,
    transaction
  };
}

describe("sellQrCode", () => {
  it("marks an on-display product as sold without a customer", async () => {
    const now = createTimestamp("2026-04-18T10:00:00.000Z");
    const product = createProduct({
      productId: "HM-000001",
      status: "onDisplay"
    });
    const { db, transaction } = createDb({
      productSnapshot: createDocumentSnapshot(product)
    });

    await expect(
      sellQrCode(
        {
          productId: "HM-000001"
        },
        {
          db: db as never,
          now: () => now as never
        }
      )
    ).resolves.toEqual({
      previousStatus: "onDisplay",
      productId: "HM-000001",
      status: "sold",
      soldAt: "2026-04-18T10:00:00.000Z",
      soldCustomerId: null,
      soldCustomerNameSnapshot: null,
      updatedAt: "2026-04-18T10:00:00.000Z"
    });

    expect(transaction.set).toHaveBeenCalledTimes(1);
    expect(transaction.set.mock.calls[0][1]).toMatchObject({
      ...product,
      soldAt: now,
      soldCustomerId: null,
      soldCustomerNameSnapshot: null,
      status: "sold",
      updatedAt: now
    });
  });

  it("uses qrCodeValue as a fallback identifier", async () => {
    const now = createTimestamp("2026-04-18T10:05:00.000Z");
    const { db, productDoc } = createDb({
      productIdentifier: "HM-000002",
      productSnapshot: createDocumentSnapshot(
        createProduct({
          productId: "HM-000002",
          status: "inStock"
        })
      )
    });

    await expect(
      sellQrCode(
        {
          qrCodeValue: "HM-000002"
        },
        {
          db: db as never,
          now: () => now as never
        }
      )
    ).resolves.toMatchObject({
      previousStatus: "inStock",
      productId: "HM-000002",
      status: "sold"
    });
    expect(productDoc).toHaveBeenCalledWith("HM-000002");
  });

  it("marks an in-stock product as sold with a customer snapshot", async () => {
    const now = createTimestamp("2026-04-18T10:10:00.000Z");
    const { db, transaction } = createDb({
      customerSnapshots: {
        cus_000001: createDocumentSnapshot({
          isArchived: false,
          name: "山田 花子"
        })
      },
      productSnapshot: createDocumentSnapshot(
        createProduct({
          productId: "HM-000001",
          status: "inStock"
        })
      )
    });

    await expect(
      sellQrCode(
        {
          customerId: "cus_000001",
          productId: "HM-000001"
        },
        {
          db: db as never,
          now: () => now as never
        }
      )
    ).resolves.toEqual({
      previousStatus: "inStock",
      productId: "HM-000001",
      status: "sold",
      soldAt: "2026-04-18T10:10:00.000Z",
      soldCustomerId: "cus_000001",
      soldCustomerNameSnapshot: "山田 花子",
      updatedAt: "2026-04-18T10:10:00.000Z"
    });

    expect(transaction.set.mock.calls[0][1]).toMatchObject({
      soldCustomerId: "cus_000001",
      soldCustomerNameSnapshot: "山田 花子"
    });
  });

  it("keeps an existing soldAt when present", async () => {
    const now = createTimestamp("2026-04-18T10:20:00.000Z");
    const soldAt = createTimestamp("2026-04-18T09:50:00.000Z");
    const { db } = createDb({
      productSnapshot: createDocumentSnapshot(
        createProduct({
          soldAt,
          status: "onDisplay"
        })
      )
    });

    await expect(
      sellQrCode(
        {
          productId: "HM-000001"
        },
        {
          db: db as never,
          now: () => now as never
        }
      )
    ).resolves.toMatchObject({
      soldAt: "2026-04-18T09:50:00.000Z",
      updatedAt: "2026-04-18T10:20:00.000Z"
    });
  });

  it("rejects already sold products without updating", async () => {
    const { db, transaction } = createDb({
      productSnapshot: createDocumentSnapshot(
        createProduct({
          status: "sold"
        })
      )
    });

    await expect(
      sellQrCode(
        {
          productId: "HM-000001"
        },
        {
          db: db as never
        }
      )
    ).rejects.toMatchObject({
      code: "ALREADY_SOLD",
      statusCode: 400
    });
    expect(transaction.set).not.toHaveBeenCalled();
  });

  it.each(["beforeProduction", "inProduction", "completed"] as const)(
    "rejects %s products without updating",
    async (status) => {
      const { db, transaction } = createDb({
        productSnapshot: createDocumentSnapshot(
          createProduct({
            status
          })
        )
      });

      await expect(
        sellQrCode(
          {
            productId: "HM-000001"
          },
          {
            db: db as never
          }
        )
      ).rejects.toMatchObject({
        code: "INVALID_STATUS_FOR_QR_SELL",
        statusCode: 400
      });
      expect(transaction.set).not.toHaveBeenCalled();
    }
  );

  it("rejects logically deleted products without updating", async () => {
    const { db, transaction } = createDb({
      productSnapshot: createDocumentSnapshot(
        createProduct({
          isDeleted: true,
          status: "onDisplay"
        })
      )
    });

    await expect(
      sellQrCode(
        {
          productId: "HM-000001"
        },
        {
          db: db as never
        }
      )
    ).rejects.toMatchObject({
      code: "PRODUCT_DELETED",
      statusCode: 404
    });
    expect(transaction.set).not.toHaveBeenCalled();
  });

  it("rejects unknown products", async () => {
    const { db } = createDb({
      productIdentifier: "HM-999999",
      productSnapshot: createDocumentSnapshot(
        {
          productId: "HM-999999"
        },
        false
      )
    });

    await expect(
      sellQrCode(
        {
          productId: "HM-999999"
        },
        {
          db: db as never
        }
      )
    ).rejects.toMatchObject({
      code: "PRODUCT_NOT_FOUND",
      statusCode: 404
    });
  });

  it("rejects missing customer IDs", async () => {
    const { db, transaction } = createDb({
      customerSnapshots: {
        cus_missing: createDocumentSnapshot(
          {
            customerId: "cus_missing"
          },
          false
        )
      },
      productSnapshot: createDocumentSnapshot(
        createProduct({
          status: "onDisplay"
        })
      )
    });

    await expect(
      sellQrCode(
        {
          customerId: "cus_missing",
          productId: "HM-000001"
        },
        {
          db: db as never
        }
      )
    ).rejects.toMatchObject({
      code: "CUSTOMER_NOT_FOUND",
      statusCode: 400
    });
    expect(transaction.set).not.toHaveBeenCalled();
  });

  it("rejects archived customers", async () => {
    const { db, transaction } = createDb({
      customerSnapshots: {
        cus_000002: createDocumentSnapshot({
          isArchived: true,
          name: "佐藤 花子"
        })
      },
      productSnapshot: createDocumentSnapshot(
        createProduct({
          status: "onDisplay"
        })
      )
    });

    await expect(
      sellQrCode(
        {
          customerId: "cus_000002",
          productId: "HM-000001"
        },
        {
          db: db as never
        }
      )
    ).rejects.toMatchObject({
      code: "CUSTOMER_ARCHIVED",
      statusCode: 400
    });
    expect(transaction.set).not.toHaveBeenCalled();
  });

  it("returns VALIDATION_ERROR when productId and qrCodeValue are missing", async () => {
    await expect(sellQrCode({})).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      statusCode: 400,
      details: [
        {
          field: "requestBody"
        }
      ]
    });
  });
});
