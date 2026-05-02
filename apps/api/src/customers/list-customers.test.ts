import { vi } from "vitest";
import {
  createDocumentSnapshot,
  createTimestamp
} from "../test/firestore-test-helpers";
import { listCustomers } from "./list-customers";

describe("listCustomers", () => {
  it("returns filtered customers with purchase summaries and pagination meta", async () => {
    const customersGet = vi.fn().mockResolvedValue({
      docs: [
        createDocumentSnapshot({
          ageGroup: "30代",
          customerId: "cus_000001",
          customerStyle: "ナチュラル系",
          gender: "女性",
          isArchived: false,
          memo: "リピーター",
          name: "山田 花子",
          normalizedName: "山田 花子",
          snsAccounts: [
            {
              platform: "Instagram",
              accountName: "hanako_handmade",
              url: "https://instagram.com/hanako_handmade",
              note: "DM購入あり"
            }
          ],
          updatedAt: createTimestamp("2026-04-18T12:00:00.000Z")
        }),
        createDocumentSnapshot({
          ageGroup: null,
          customerId: "cus_000002",
          customerStyle: null,
          gender: null,
          isArchived: false,
          memo: "委託販売",
          name: "佐藤 美咲",
          normalizedName: "佐藤 美咲",
          snsAccounts: [],
          updatedAt: createTimestamp("2026-04-17T12:00:00.000Z")
        })
      ]
    });
    const customersWhere = vi.fn().mockReturnValue({
      get: customersGet
    });
    const productsGet = vi.fn().mockResolvedValue({
      docs: [
        createDocumentSnapshot({
          isDeleted: false,
          name: "青のブローチ",
          productId: "HM-000010",
          soldAt: createTimestamp("2026-04-20T08:30:00.000Z"),
          soldCustomerId: "cus_000001",
          status: "sold"
        }),
        createDocumentSnapshot({
          isDeleted: false,
          name: "赤のブローチ",
          productId: "HM-000005",
          soldAt: createTimestamp("2026-03-20T08:30:00.000Z"),
          soldCustomerId: "cus_000001",
          status: "sold"
        }),
        createDocumentSnapshot({
          isDeleted: false,
          name: "黄のピアス",
          productId: "HM-000011",
          soldAt: createTimestamp("2026-04-18T08:30:00.000Z"),
          soldCustomerId: null,
          status: "sold"
        })
      ]
    });
    const productsWhereStatus = vi.fn().mockReturnValue({
      get: productsGet
    });
    const productsWhereDeleted = vi.fn().mockReturnValue({
      where: productsWhereStatus
    });
    const db = {
      collection: vi.fn((collectionName: string) => {
        if (collectionName === "customers") {
          return {
            where: customersWhere
          };
        }

        if (collectionName === "products") {
          return {
            where: productsWhereDeleted
          };
        }

        throw new Error(`Unexpected collection ${collectionName}`);
      })
    };

    await expect(
      listCustomers(
        {
          keyword: " instagram ",
          page: "1",
          pageSize: "1",
          sortBy: "lastPurchaseAt",
          sortOrder: "desc"
        },
        {
          db: db as never
        }
      )
    ).resolves.toEqual({
      data: {
        items: [
          {
            customerId: "cus_000001",
            name: "山田 花子",
            gender: "女性",
            ageGroup: "30代",
            customerStyle: "ナチュラル系",
            lastPurchaseAt: "2026-04-20T08:30:00.000Z",
            lastPurchaseProductId: "HM-000010",
            lastPurchaseProductName: "青のブローチ",
            purchaseCount: 2,
            updatedAt: "2026-04-18T12:00:00.000Z"
          }
        ]
      },
      meta: {
        page: 1,
        pageSize: 1,
        totalCount: 1,
        hasNext: false
      }
    });

    expect(customersWhere).toHaveBeenCalledWith("isArchived", "==", false);
    expect(productsWhereDeleted).toHaveBeenCalledWith("isDeleted", "==", false);
    expect(productsWhereStatus).toHaveBeenCalledWith("status", "==", "sold");
  });

  it("keeps customers without purchases at the end when sorting by lastPurchaseAt", async () => {
    const db = {
      collection: vi.fn((collectionName: string) => {
        if (collectionName === "customers") {
          return {
            where: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                docs: [
                  createDocumentSnapshot({
                    customerId: "cus_000001",
                    isArchived: false,
                    name: "山田 花子",
                    normalizedName: "山田 花子",
                    updatedAt: createTimestamp("2026-04-18T12:00:00.000Z")
                  }),
                  createDocumentSnapshot({
                    customerId: "cus_000002",
                    isArchived: false,
                    name: "佐藤 美咲",
                    normalizedName: "佐藤 美咲",
                    updatedAt: createTimestamp("2026-04-19T12:00:00.000Z")
                  })
                ]
              })
            })
          };
        }

        if (collectionName === "products") {
          return {
            where: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                get: vi.fn().mockResolvedValue({
                  docs: [
                    createDocumentSnapshot({
                      isDeleted: false,
                      name: "青のブローチ",
                      productId: "HM-000010",
                      soldAt: createTimestamp("2026-04-20T08:30:00.000Z"),
                      soldCustomerId: "cus_000001",
                      status: "sold"
                    })
                  ]
                })
              })
            })
          };
        }

        throw new Error(`Unexpected collection ${collectionName}`);
      })
    };

    await expect(
      listCustomers(
        {
          sortBy: "lastPurchaseAt",
          sortOrder: "desc"
        },
        {
          db: db as never
        }
      )
    ).resolves.toMatchObject({
      data: {
        items: [
          {
            customerId: "cus_000001",
            lastPurchaseAt: "2026-04-20T08:30:00.000Z"
          },
          {
            customerId: "cus_000002",
            lastPurchaseAt: null
          }
        ]
      }
    });
  });

  it("rejects invalid list queries", async () => {
    await expect(
      listCustomers({
        keyword: "a".repeat(101)
      })
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR"
    });
  });
});
