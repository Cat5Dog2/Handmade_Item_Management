import { vi } from "vitest";
import { getCustomer } from "./get-customer";

function createTimestamp(isoString: string) {
  return {
    toDate: () => new Date(isoString)
  };
}

function createDocumentSnapshot<T>(data: T, exists = true) {
  return {
    data: () => data,
    exists
  };
}

describe("getCustomer", () => {
  it("returns customer details with a purchase summary derived from sold products", async () => {
    const customerId = "cus_000001";
    const customerRef = {
      get: vi.fn().mockResolvedValue(
        createDocumentSnapshot({
          archivedAt: null,
          createdAt: createTimestamp("2026-04-18T08:00:00.000Z"),
          customerId,
          customerStyle: "Natural",
          gender: "female",
          ageGroup: "30s",
          isArchived: false,
          memo: "First visit memo",
          name: "Hanako Handmade",
          snsAccounts: [
            {
              accountName: "hanako_handmade",
              note: "DM ok",
              platform: "Instagram",
              url: "https://instagram.com/hanako_handmade"
            }
          ],
          updatedAt: createTimestamp("2026-04-20T09:00:00.000Z")
        })
      )
    };
    const soldProductsGet = vi.fn().mockResolvedValue({
      docs: [
        createDocumentSnapshot({
          isDeleted: false,
          name: "Flower Brooch",
          productId: "HM-000010",
          soldAt: createTimestamp("2026-04-20T08:30:00.000Z"),
          soldCustomerId: customerId,
          status: "sold"
        }),
        createDocumentSnapshot({
          isDeleted: false,
          name: "Sample Pin",
          productId: "HM-000005",
          soldAt: createTimestamp("2026-04-18T08:30:00.000Z"),
          soldCustomerId: customerId,
          status: "sold"
        }),
        createDocumentSnapshot({
          isDeleted: false,
          name: "Collection Item",
          productId: "HM-000021",
          soldAt: null,
          soldCustomerId: customerId,
          status: "sold"
        })
      ]
    });
    const soldCustomerWhere = vi.fn(
      (field: string, operator: string, value: string) => {
        expect(field).toBe("soldCustomerId");
        expect(operator).toBe("==");
        expect(value).toBe(customerId);

        return {
          get: soldProductsGet
        };
      }
    );
    const soldStatusWhere = vi.fn(
      (field: string, operator: string, value: string) => {
        expect(field).toBe("status");
        expect(operator).toBe("==");
        expect(value).toBe("sold");

        return {
          where: soldCustomerWhere
        };
      }
    );
    const isDeletedWhere = vi.fn(
      (field: string, operator: string, value: boolean) => {
        expect(field).toBe("isDeleted");
        expect(operator).toBe("==");
        expect(value).toBe(false);

        return {
          where: soldStatusWhere
        };
      }
    );
    const db = {
      collection: vi.fn((collectionName: string) => {
        if (collectionName === "customers") {
          return {
            doc: vi.fn((inputCustomerId: string) => {
              if (inputCustomerId === customerId) {
                return customerRef;
              }

              throw new Error(`Unexpected customer ${inputCustomerId}`);
            })
          };
        }

        if (collectionName === "products") {
          return {
            where: isDeletedWhere
          };
        }

        throw new Error(`Unexpected collection ${collectionName}`);
      })
    };

    await expect(
      getCustomer(customerId, {
        db: db as never
      })
    ).resolves.toEqual({
      customer: {
        archivedAt: null,
        createdAt: "2026-04-18T08:00:00.000Z",
        customerId,
        customerStyle: "Natural",
        gender: "female",
        ageGroup: "30s",
        isArchived: false,
        memo: "First visit memo",
        name: "Hanako Handmade",
        snsAccounts: [
          {
            accountName: "hanako_handmade",
            note: "DM ok",
            platform: "Instagram",
            url: "https://instagram.com/hanako_handmade"
          }
        ],
        updatedAt: "2026-04-20T09:00:00.000Z"
      },
      summary: {
        lastPurchaseAt: "2026-04-20T08:30:00.000Z",
        lastPurchaseProductId: "HM-000010",
        lastPurchaseProductName: "Flower Brooch",
        purchaseCount: 3
      }
    });

    expect(soldProductsGet).toHaveBeenCalledTimes(1);
  });

  it("returns archived customer details instead of treating them as not found", async () => {
    const customerId = "cus_000010";
    const customerRef = {
      get: vi.fn().mockResolvedValue(
        createDocumentSnapshot({
          archivedAt: createTimestamp("2026-04-19T08:00:00.000Z"),
          createdAt: createTimestamp("2026-04-10T08:00:00.000Z"),
          customerId,
          isArchived: true,
          memo: null,
          name: "Hanako Handmade",
          snsAccounts: null,
          updatedAt: createTimestamp("2026-04-19T08:00:00.000Z")
        })
      )
    };
    const getProducts = vi.fn().mockResolvedValue({
      docs: []
    });
    const db = {
      collection: vi.fn((collectionName: string) => {
        if (collectionName === "customers") {
          return {
            doc: vi.fn().mockReturnValue(customerRef)
          };
        }

        if (collectionName === "products") {
          return {
            where: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  get: getProducts
                })
              })
            })
          };
        }

        throw new Error(`Unexpected collection ${collectionName}`);
      })
    };

    await expect(
      getCustomer(customerId, {
        db: db as never
      })
    ).resolves.toEqual({
      customer: {
        archivedAt: "2026-04-19T08:00:00.000Z",
        createdAt: "2026-04-10T08:00:00.000Z",
        customerId,
        customerStyle: null,
        gender: null,
        ageGroup: null,
        isArchived: true,
        memo: null,
        name: "Hanako Handmade",
        snsAccounts: [],
        updatedAt: "2026-04-19T08:00:00.000Z"
      },
      summary: {
        lastPurchaseAt: null,
        lastPurchaseProductId: null,
        lastPurchaseProductName: null,
        purchaseCount: 0
      }
    });

    expect(getProducts).toHaveBeenCalledTimes(1);
  });

  it("returns CUSTOMER_NOT_FOUND when the customer does not exist", async () => {
    const customerRef = {
      get: vi.fn().mockResolvedValue(
        createDocumentSnapshot(
          {
            customerId: "cus_999999"
          },
          false
        )
      )
    };
    const db = {
      collection: vi.fn((collectionName: string) => {
        if (collectionName === "customers") {
          return {
            doc: vi.fn().mockReturnValue(customerRef)
          };
        }

        if (collectionName === "products") {
          throw new Error("Products should not be queried for missing customers");
        }

        throw new Error(`Unexpected collection ${collectionName}`);
      })
    };

    await expect(
      getCustomer("cus_999999", {
        db: db as never
      })
    ).rejects.toMatchObject({
      code: "CUSTOMER_NOT_FOUND",
      message: "指定した顧客が見つかりません。",
      statusCode: 404
    });
  });
});
