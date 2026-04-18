import request from "supertest";
import { vi } from "vitest";
import { createApp } from "../app";
import { createRequireAuth } from "../middlewares/auth";

const listProductsMock = vi.hoisted(() => vi.fn());

vi.mock("../products/list-products", () => ({
  listProducts: listProductsMock
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

describe("products routes", () => {
  beforeEach(() => {
    listProductsMock.mockReset();
  });

  it("returns AUTH_REQUIRED for unauthenticated product list requests", async () => {
    const response = await request(createTestApp()).get("/api/products");

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      code: "AUTH_REQUIRED"
    });
    expect(listProductsMock).not.toHaveBeenCalled();
  });

  it("returns the product list envelope for authenticated requests", async () => {
    listProductsMock.mockResolvedValue({
      data: {
        items: [
          {
            categoryName: "Accessories",
            name: "Plain Pin",
            productId: "HM-000001",
            status: "onDisplay",
            thumbnailUrl: "https://example.com/thumb.webp",
            updatedAt: "2026-04-17T12:00:00.000Z"
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
      .get("/api/products?page=2&pageSize=1")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: {
        items: [
          {
            categoryName: "Accessories",
            name: "Plain Pin",
            productId: "HM-000001",
            status: "onDisplay",
            thumbnailUrl: "https://example.com/thumb.webp",
            updatedAt: "2026-04-17T12:00:00.000Z"
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
    expect(listProductsMock).toHaveBeenCalledWith({
      page: "2",
      pageSize: "1"
    });
  });
});
