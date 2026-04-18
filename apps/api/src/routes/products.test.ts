import request from "supertest";
import { vi } from "vitest";
import { createApp } from "../app";
import { createRequireAuth } from "../middlewares/auth";

const listProductsMock = vi.hoisted(() => vi.fn());
const createProductMock = vi.hoisted(() => vi.fn());
const getProductMock = vi.hoisted(() => vi.fn());
const updateProductMock = vi.hoisted(() => vi.fn());
const deleteProductMock = vi.hoisted(() => vi.fn());

vi.mock("../products/list-products", () => ({
  listProducts: listProductsMock
}));

vi.mock("../products/create-product", () => ({
  createProduct: createProductMock
}));

vi.mock("../products/get-product", () => ({
  getProduct: getProductMock
}));

vi.mock("../products/update-product", () => ({
  updateProduct: updateProductMock
}));

vi.mock("../products/delete-product", () => ({
  deleteProduct: deleteProductMock
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
    createProductMock.mockReset();
    getProductMock.mockReset();
    updateProductMock.mockReset();
    deleteProductMock.mockReset();
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

  it("returns AUTH_REQUIRED for unauthenticated product detail requests", async () => {
    const response = await request(createTestApp()).get("/api/products/HM-000001");

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      code: "AUTH_REQUIRED"
    });
    expect(getProductMock).not.toHaveBeenCalled();
  });

  it("returns the product detail envelope for authenticated requests", async () => {
    getProductMock.mockResolvedValue({
      images: [],
      product: {
        categoryId: "cat-a",
        categoryName: "Accessories",
        createdAt: "2026-04-18T09:00:00.000Z",
        description: "Handmade pin",
        name: "Fancy Pin",
        price: 2800,
        productId: "HM-000001",
        soldAt: null,
        status: "onDisplay",
        tagIds: ["tag-a"],
        tagNames: ["Spring"],
        updatedAt: "2026-04-18T09:00:00.000Z"
      },
      qrCodeValue: "HM-000001",
      tasksSummary: {
        completedCount: 1,
        openCount: 2
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
      .get("/api/products/HM-000001")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: {
        images: [],
        product: {
          categoryId: "cat-a",
          categoryName: "Accessories",
          createdAt: "2026-04-18T09:00:00.000Z",
          description: "Handmade pin",
          name: "Fancy Pin",
          price: 2800,
          productId: "HM-000001",
          soldAt: null,
          status: "onDisplay",
          tagIds: ["tag-a"],
          tagNames: ["Spring"],
          updatedAt: "2026-04-18T09:00:00.000Z"
        },
        qrCodeValue: "HM-000001",
        tasksSummary: {
          completedCount: 1,
          openCount: 2
        }
      }
    });
    expect(getProductMock).toHaveBeenCalledWith("HM-000001");
  });

  it("returns AUTH_REQUIRED for unauthenticated product update requests", async () => {
    const response = await request(createTestApp()).put("/api/products/HM-000001");

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      code: "AUTH_REQUIRED"
    });
    expect(updateProductMock).not.toHaveBeenCalled();
  });

  it("returns the product update envelope for authenticated requests", async () => {
    updateProductMock.mockResolvedValue({
      productId: "HM-000001",
      updatedAt: "2026-04-18T10:00:00.000Z"
    });

    const response = await request(
      createTestApp({
        verifyIdToken: async () => ({
          uid: "uid-1",
          email: "owner@example.com"
        })
      })
    )
      .put("/api/products/HM-000001")
      .set("Authorization", "Bearer valid-token")
      .send({
        categoryId: "cat-a",
        description: "Updated pin",
        name: "Fancy Pin",
        price: 3000,
        primaryImageId: null,
        status: "onDisplay",
        tagIds: ["tag-a"]
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: {
        productId: "HM-000001",
        updatedAt: "2026-04-18T10:00:00.000Z"
      }
    });
    expect(updateProductMock).toHaveBeenCalledWith("HM-000001", {
      categoryId: "cat-a",
      description: "Updated pin",
      name: "Fancy Pin",
      price: 3000,
      primaryImageId: null,
      status: "onDisplay",
      tagIds: ["tag-a"]
    });
  });

  it("returns AUTH_REQUIRED for unauthenticated product delete requests", async () => {
    const response = await request(createTestApp()).delete("/api/products/HM-000001");

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      code: "AUTH_REQUIRED"
    });
    expect(deleteProductMock).not.toHaveBeenCalled();
  });

  it("returns the product delete envelope for authenticated requests", async () => {
    deleteProductMock.mockResolvedValue({
      deletedAt: "2026-04-18T11:00:00.000Z",
      productId: "HM-000001"
    });

    const response = await request(
      createTestApp({
        verifyIdToken: async () => ({
          uid: "uid-1",
          email: "owner@example.com"
        })
      })
    )
      .delete("/api/products/HM-000001")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: {
        deletedAt: "2026-04-18T11:00:00.000Z",
        productId: "HM-000001"
      }
    });
    expect(deleteProductMock).toHaveBeenCalledWith("HM-000001");
  });

  it("returns AUTH_REQUIRED for unauthenticated product create requests", async () => {
    const response = await request(createTestApp()).post("/api/products");

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      code: "AUTH_REQUIRED"
    });
    expect(createProductMock).not.toHaveBeenCalled();
  });

  it("returns the product create envelope for authenticated requests", async () => {
    createProductMock.mockResolvedValue({
      createdAt: "2026-04-18T09:00:00.000Z",
      productId: "HM-000001",
      updatedAt: "2026-04-18T09:00:00.000Z"
    });

    const response = await request(
      createTestApp({
        verifyIdToken: async () => ({
          uid: "uid-1",
          email: "owner@example.com"
        })
      })
    )
      .post("/api/products")
      .set("Authorization", "Bearer valid-token")
      .send({
        categoryId: "cat-a",
        name: "Fancy Pin",
        price: 2800,
        status: "completed"
      });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      data: {
        createdAt: "2026-04-18T09:00:00.000Z",
        productId: "HM-000001",
        updatedAt: "2026-04-18T09:00:00.000Z"
      }
    });
    expect(createProductMock).toHaveBeenCalledWith({
      categoryId: "cat-a",
      name: "Fancy Pin",
      price: 2800,
      status: "completed"
    });
  });
});
