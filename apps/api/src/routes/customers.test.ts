import request from "supertest";
import { vi } from "vitest";
import { createApp } from "../app";
import { createRequireAuth } from "../middlewares/auth";

const createCustomerMock = vi.hoisted(() => vi.fn());
const getCustomerMock = vi.hoisted(() => vi.fn());
const listCustomersMock = vi.hoisted(() => vi.fn());
const updateCustomerMock = vi.hoisted(() => vi.fn());
const writeOperationLogMock = vi.hoisted(() => vi.fn());

vi.mock("../customers/create-customer", () => ({
  createCustomer: createCustomerMock
}));

vi.mock("../customers/get-customer", () => ({
  getCustomer: getCustomerMock
}));

vi.mock("../customers/list-customers", () => ({
  listCustomers: listCustomersMock
}));

vi.mock("../customers/update-customer", () => ({
  updateCustomer: updateCustomerMock
}));

vi.mock("../operation-logs/write-operation-log", () => ({
  writeOperationLog: writeOperationLogMock
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
    createCustomerMock.mockReset();
    getCustomerMock.mockReset();
    listCustomersMock.mockReset();
    updateCustomerMock.mockReset();
    writeOperationLogMock.mockReset();
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
            ageGroup: "30s",
            customerId: "cus_000001",
            customerStyle: "Natural",
            gender: "female",
            lastPurchaseAt: "2026-04-20T08:30:00.000Z",
            lastPurchaseProductId: "HM-000010",
            lastPurchaseProductName: "Flower Brooch",
            name: "Hanako Handmade",
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
            ageGroup: "30s",
            customerId: "cus_000001",
            customerStyle: "Natural",
            gender: "female",
            lastPurchaseAt: "2026-04-20T08:30:00.000Z",
            lastPurchaseProductId: "HM-000010",
            lastPurchaseProductName: "Flower Brooch",
            name: "Hanako Handmade",
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

  it("returns AUTH_REQUIRED for unauthenticated customer detail requests", async () => {
    const response = await request(createTestApp()).get(
      "/api/customers/cus_000001"
    );

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      code: "AUTH_REQUIRED"
    });
    expect(getCustomerMock).not.toHaveBeenCalled();
  });

  it("returns the customer detail envelope for authenticated requests", async () => {
    getCustomerMock.mockResolvedValue({
      customer: {
        archivedAt: null,
        createdAt: "2026-04-18T09:00:00.000Z",
        customerId: "cus_000001",
        customerStyle: "Natural",
        gender: "female",
        ageGroup: "30s",
        isArchived: false,
        memo: "First visit memo",
        name: "Hanako Handmade",
        snsAccounts: [
          {
            accountName: "hanako_handmade",
            note: null,
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
        purchaseCount: 2
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
      .get("/api/customers/cus_000001")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: {
        customer: {
          archivedAt: null,
          createdAt: "2026-04-18T09:00:00.000Z",
          customerId: "cus_000001",
          customerStyle: "Natural",
          gender: "female",
          ageGroup: "30s",
          isArchived: false,
          memo: "First visit memo",
          name: "Hanako Handmade",
          snsAccounts: [
            {
              accountName: "hanako_handmade",
              note: null,
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
          purchaseCount: 2
        }
      }
    });
    expect(getCustomerMock).toHaveBeenCalledWith("cus_000001");
  });

  it("returns AUTH_REQUIRED for unauthenticated customer create requests", async () => {
    const response = await request(createTestApp()).post("/api/customers");

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      code: "AUTH_REQUIRED"
    });
    expect(createCustomerMock).not.toHaveBeenCalled();
  });

  it("returns the customer create envelope for authenticated requests", async () => {
    createCustomerMock.mockResolvedValue({
      customerId: "cus_000001",
      createdAt: "2026-04-20T09:00:00.000Z",
      updatedAt: "2026-04-20T09:00:00.000Z"
    });

    const response = await request(
      createTestApp({
        verifyIdToken: async () => ({
          uid: "uid-1",
          email: "owner@example.com"
        })
      })
    )
      .post("/api/customers")
      .set("Authorization", "Bearer valid-token")
      .send({
        name: "Hanako Handmade",
        customerStyle: "Natural"
      });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      data: {
        customerId: "cus_000001",
        createdAt: "2026-04-20T09:00:00.000Z",
        updatedAt: "2026-04-20T09:00:00.000Z"
      }
    });
    expect(createCustomerMock).toHaveBeenCalledWith({
      name: "Hanako Handmade",
      customerStyle: "Natural"
    });
  });

  it("returns AUTH_REQUIRED for unauthenticated customer update requests", async () => {
    const response = await request(createTestApp()).put(
      "/api/customers/cus_000001"
    );

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      code: "AUTH_REQUIRED"
    });
    expect(updateCustomerMock).not.toHaveBeenCalled();
    expect(writeOperationLogMock).not.toHaveBeenCalled();
  });

  it("returns the customer update envelope and records CUSTOMER_UPDATED", async () => {
    updateCustomerMock.mockResolvedValue({
      customerId: "cus_000001",
      updatedAt: "2026-04-24T09:00:00.000Z",
      changedFields: ["name", "memo"]
    });
    writeOperationLogMock.mockResolvedValue({
      logId: "log-001"
    });

    const response = await request(
      createTestApp({
        verifyIdToken: async () => ({
          uid: "uid-1",
          email: "owner@example.com"
        })
      })
    )
      .put("/api/customers/cus_000001")
      .set("Authorization", "Bearer valid-token")
      .send({
        name: "Hanako Handmade",
        memo: "Updated memo"
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: {
        customerId: "cus_000001",
        updatedAt: "2026-04-24T09:00:00.000Z"
      }
    });
    expect(updateCustomerMock).toHaveBeenCalledWith("cus_000001", {
      name: "Hanako Handmade",
      memo: "Updated memo"
    });
    expect(writeOperationLogMock).toHaveBeenCalledWith({
      eventType: "CUSTOMER_UPDATED",
      targetId: "cus_000001",
      summary: "顧客情報を更新しました",
      actorUid: "uid-1",
      detail: {
        result: "success",
        changedFields: ["name", "memo"]
      }
    });
  });
});
