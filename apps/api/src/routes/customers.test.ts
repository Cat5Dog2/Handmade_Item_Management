import request from "supertest";
import { vi } from "vitest";
import { createApp } from "../app";
import { createRequireAuth } from "../middlewares/auth";

const listCustomersMock = vi.hoisted(() => vi.fn());

vi.mock("../customers/list-customers", () => ({
  listCustomers: listCustomersMock
}));

function createTestApp({
  ownerEmail = "owner@example.com",
  verifyIdToken
}: {
  ownerEmail?: string;
  verifyIdToken?: (idToken: string) => Promise<{ uid: string; email?: string }>;
} = {}) {
  return createApp({
    logger: {
      info: vi.fn(),
      error: vi.fn()
    },
    requireAuthMiddleware: createRequireAuth({
      ownerEmail,
      verifyIdToken
    })
  });
}

describe("customers routes", () => {
  beforeEach(() => {
    listCustomersMock.mockReset();
  });

  it("returns AUTH_REQUIRED for unauthenticated customer list requests", async () => {
    const response = await request(createTestApp()).get("/api/customers");

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      code: "AUTH_REQUIRED"
    });
    expect(listCustomersMock).not.toHaveBeenCalled();
  });

  it("returns the customer list envelope for authenticated requests", async () => {
    listCustomersMock.mockResolvedValue({
      data: {
        items: [
          {
            ageGroup: "30代",
            customerId: "cus_000001",
            customerStyle: "ナチュラル系",
            gender: "女性",
            lastPurchaseAt: "2026-04-20T08:30:00.000Z",
            lastPurchaseProductId: "HM-000010",
            lastPurchaseProductName: "青のブローチ",
            name: "山田 花子",
            purchaseCount: 2,
            updatedAt: "2026-04-18T12:00:00.000Z"
          }
        ]
      },
      meta: {
        hasNext: false,
        page: 2,
        pageSize: 1,
        totalCount: 1
      }
    });

    const response = await request(
      createTestApp({
        verifyIdToken: async () => ({
          uid: "uid-1",
          email: "owner@example.com"
        })
      })
    )
      .get("/api/customers?page=2&pageSize=1&sortBy=name")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: {
        items: [
          {
            ageGroup: "30代",
            customerId: "cus_000001",
            customerStyle: "ナチュラル系",
            gender: "女性",
            lastPurchaseAt: "2026-04-20T08:30:00.000Z",
            lastPurchaseProductId: "HM-000010",
            lastPurchaseProductName: "青のブローチ",
            name: "山田 花子",
            purchaseCount: 2,
            updatedAt: "2026-04-18T12:00:00.000Z"
          }
        ]
      },
      meta: {
        hasNext: false,
        page: 2,
        pageSize: 1,
        totalCount: 1
      }
    });
    expect(listCustomersMock).toHaveBeenCalledWith({
      page: "2",
      pageSize: "1",
      sortBy: "name"
    });
  });
});
