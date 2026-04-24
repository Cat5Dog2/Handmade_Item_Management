import { vi } from "vitest";
import { getCustomerPurchases } from "./get-customer-purchases";

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

describe("getCustomerPurchases", () => {
  it("returns sold products for the customer sorted by soldAt descending", async () => {
    const customerId = "cus_000001";
    const customerRef = {
      get: vi.fn().mockResolvedValue(
        createDocumentSnapshot({
          customerId,
          isArchived: false
        })
      )
    };
    const getProducts = vi.fn().mockResolvedValue({
      docs: [
        createDocumentSnapshot({
          isDeleted: false,
          name: "Sample Pin",
          price: 1800,
          productId: "HM-000005",
          soldAt: createTimestamp("2026-04-18T08:30:00.000Z"),
          soldCustomerId: customerId,
          status: "sold",
          updatedAt: createTimestamp("2026-04-18T08:30:00.000Z")
        }),
        createDocumentSnapshot({
          isDeleted: false,
          name: "Flower Brooch",
          price: 2800,
          productId: "HM-000010",
          soldAt: createTimestamp("2026-04-20T08:30:00.000Z"),
          soldCustomerId: customerId,
          status: "sold",
          updatedAt: createTimestamp("2026-04-20T08:30:00.000Z")
        }),
        createDocumentSnapshot({
          isDeleted: false,
          name: "Collection Item",
          price: 3200,
          productId: "HM-000021",
          soldAt: null,
          soldCustomerId: customerId,
          status: "sold",
          updatedAt: createTimestamp("2026-04-17T12:00:00.000Z")
        })
      ]
    });
    const soldCustomerWhere = vi.fn(
      (field: string, operator: string, value: string) => {
        expect(field).toBe("soldCustomerId");
        expect(operator).toBe("==");
        expect(value).toBe(customerId);

        return {
          get: getProducts
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
      getCustomerPurchases(customerId, {
        db: db as never
      })
    ).resolves.toEqual({
      items: [
        {
          productId: "HM-000010",
          name: "Flower Brooch",
          price: 2800,
          soldAt: "2026-04-20T08:30:00.000Z"
        },
        {
          productId: "HM-000005",
          name: "Sample Pin",
          price: 1800,
          soldAt: "2026-04-18T08:30:00.000Z"
        },
        {
          productId: "HM-000021",
          name: "Collection Item",
          price: 3200,
          soldAt: "2026-04-17T12:00:00.000Z"
        }
      ]
    });

    expect(getProducts).toHaveBeenCalledTimes(1);
  });

  it("allows purchase lookup for archived customers", async () => {
    const customerId = "cus_000010";
    const customerRef = {
      get: vi.fn().mockResolvedValue(
        createDocumentSnapshot({
          customerId,
          isArchived: true
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
      getCustomerPurchases(customerId, {
        db: db as never
      })
    ).resolves.toEqual({
      items: []
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
      getCustomerPurchases("cus_999999", {
        db: db as never
      })
    ).rejects.toMatchObject({
      code: "CUSTOMER_NOT_FOUND",
      message: "指定した顧客が見つかりません。",
      statusCode: 404
    });
  });
});
