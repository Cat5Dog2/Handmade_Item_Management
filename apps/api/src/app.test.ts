import request from "supertest";
import { vi } from "vitest";
import { createApp } from "./app";
import { createValidationError } from "./errors/api-errors";
import { createRequireAuth } from "./middlewares/auth";
import type { ApiLogger } from "./middlewares/request-logger";

const listCategoriesMock = vi.hoisted(() => vi.fn());
const listTagsMock = vi.hoisted(() => vi.fn());
const createCategoryMock = vi.hoisted(() => vi.fn());
const createTagMock = vi.hoisted(() => vi.fn());
const updateCategoryMock = vi.hoisted(() => vi.fn());
const updateTagMock = vi.hoisted(() => vi.fn());
const deleteCategoryMock = vi.hoisted(() => vi.fn());
const deleteTagMock = vi.hoisted(() => vi.fn());

vi.mock("./categories/list-categories", () => ({
  listCategories: listCategoriesMock
}));

vi.mock("./tags/list-tags", () => ({
  listTags: listTagsMock
}));

vi.mock("./categories/create-category", () => ({
  createCategory: createCategoryMock
}));

vi.mock("./tags/create-tag", () => ({
  createTag: createTagMock
}));

vi.mock("./categories/update-category", () => ({
  updateCategory: updateCategoryMock
}));

vi.mock("./tags/update-tag", () => ({
  updateTag: updateTagMock
}));

vi.mock("./categories/delete-category", () => ({
  deleteCategory: deleteCategoryMock
}));

vi.mock("./tags/delete-tag", () => ({
  deleteTag: deleteTagMock
}));

function createTestLogger(): ApiLogger {
  return {
    info: vi.fn(),
    error: vi.fn()
  };
}

function createProtectedTestApp({
  logger = createTestLogger(),
  ownerEmail = "owner@example.com",
  verifyIdToken
}: {
  logger?: ApiLogger;
  ownerEmail?: string;
  verifyIdToken?: (idToken: string) => Promise<{ uid: string; email?: string }>;
} = {}) {
  return createApp({
    logger,
    requireAuthMiddleware: createRequireAuth({
      ownerEmail,
      verifyIdToken
    }),
    registerProtectedRoutes: (router, { requireAuthMiddleware }) => {
      router.get("/protected", requireAuthMiddleware, (request, response) => {
        response.status(200).json({
          data: {
            actorUid: request.authContext?.actorUid ?? null,
            email: request.authContext?.email ?? null
          }
        });
      });
    }
  });
}

describe("createApp", () => {
  beforeEach(() => {
    createCategoryMock.mockReset();
    createTagMock.mockReset();
    deleteCategoryMock.mockReset();
    deleteTagMock.mockReset();
    listCategoriesMock.mockReset();
    listTagsMock.mockReset();
    updateCategoryMock.mockReset();
    updateTagMock.mockReset();
  });

  it("returns the health payload", async () => {
    const response = await request(
      createApp({
        logger: createTestLogger()
      })
    ).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: {
        status: "ok",
        service: "handmade-sales-api"
      }
    });
  });

  it("returns VALIDATION_ERROR in the shared error format", async () => {
    const response = await request(
      createApp({
        logger: createTestLogger(),
        registerPublicRoutes: (router) => {
          router.get("/validation-error", (_request, _response, next) => {
            next(
              createValidationError([
                {
                  field: "name",
                  message: "商品名を入力してください。"
                }
              ])
            );
          });
        }
      })
    ).get("/api/validation-error");

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      code: "VALIDATION_ERROR",
      message: "入力内容を確認してください。",
      details: [
        {
          field: "name",
          message: "商品名を入力してください。"
        }
      ]
    });
  });

  it("returns 404 for undefined routes", async () => {
    const response = await request(
      createApp({
        logger: createTestLogger()
      })
    ).get("/api/missing");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      message: "Not Found"
    });
  });

  it("returns INTERNAL_ERROR and logs unexpected failures", async () => {
    const logger = createTestLogger();

    const response = await request(
      createApp({
        logger,
        registerPublicRoutes: (router) => {
          router.get("/unexpected-error", (_request, _response, next) => {
            next(new Error("boom"));
          });
        }
      })
    ).get("/api/unexpected-error");

    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({
      code: "INTERNAL_ERROR"
    });
    expect(logger.error).toHaveBeenCalledWith(
      "Unhandled API error",
      expect.any(Error)
    );
  });

  it("keeps public routes outside auth middleware", async () => {
    const response = await request(
      createApp({
        logger: createTestLogger(),
        requireAuthMiddleware: createRequireAuth({
          ownerEmail: "owner@example.com",
          verifyIdToken: async () => ({
            uid: "uid-1",
            email: "owner@example.com"
          })
        }),
        registerPublicRoutes: (router) => {
          router.get("/public", (_request, response) => {
            response.status(200).json({
              data: {
                ok: true
              }
            });
          });
        },
        registerProtectedRoutes: (router, { requireAuthMiddleware }) => {
          router.get("/protected", requireAuthMiddleware, (_request, response) => {
            response.status(200).json({
              data: {
                ok: true
              }
            });
          });
        }
      })
    ).get("/api/public");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: {
        ok: true
      }
    });
  });

  it("logs completed requests", async () => {
    const logger = createTestLogger();

    const response = await request(
      createProtectedTestApp({
        logger,
        verifyIdToken: async () => ({
          uid: "uid-1",
          email: "owner@example.com"
        })
      })
    )
      .get("/api/protected")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(200);
    expect(logger.info).toHaveBeenCalledWith(
      "API request completed",
      expect.objectContaining({
        method: "GET",
        requestPath: "/api/protected",
        statusCode: 200,
        actorUid: "uid-1"
      })
    );
  });

  it("returns AUTH_REQUIRED when the authorization header is missing", async () => {
    const response = await request(createProtectedTestApp()).get(
      "/api/protected"
    );

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      code: "AUTH_REQUIRED",
      message: "セッションが切れました。再度ログインしてください。"
    });
  });

  it("returns AUTH_REQUIRED for malformed bearer headers", async () => {
    const response = await request(createProtectedTestApp())
      .get("/api/protected")
      .set("Authorization", "Token invalid-token");

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      code: "AUTH_REQUIRED"
    });
  });

  it("returns AUTH_REQUIRED when token verification fails", async () => {
    const response = await request(
      createProtectedTestApp({
        verifyIdToken: async () => {
          throw new Error("invalid token");
        }
      })
    )
      .get("/api/protected")
      .set("Authorization", "Bearer invalid-token");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      code: "AUTH_REQUIRED",
      message: "セッションが切れました。再度ログインしてください。"
    });
  });

  it("returns AUTH_FORBIDDEN when the user email does not match APP_OWNER_EMAIL", async () => {
    const response = await request(
      createProtectedTestApp({
        verifyIdToken: async () => ({
          uid: "uid-1",
          email: "other@example.com"
        })
      })
    )
      .get("/api/protected")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      code: "AUTH_FORBIDDEN",
      message: "この操作は実行できません。"
    });
  });

  it("returns INTERNAL_ERROR when the owner allowlist is not configured", async () => {
    const response = await request(
      createProtectedTestApp({
        ownerEmail: "   ",
        verifyIdToken: async () => ({
          uid: "uid-1",
          email: "owner@example.com"
        })
      })
    )
      .get("/api/protected")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({
      code: "INTERNAL_ERROR"
    });
  });

  it("stores authContext when the token and allowlist match", async () => {
    const response = await request(
      createProtectedTestApp({
        verifyIdToken: async () => ({
          uid: "uid-1",
          email: "owner@example.com"
        })
      })
    )
      .get("/api/protected")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: {
        actorUid: "uid-1",
        email: "owner@example.com"
      }
    });
  });

  it("returns category items from the default protected route", async () => {
    listCategoriesMock.mockResolvedValue({
      items: [
        {
          categoryId: "cat-001",
          name: "ピアス",
          sortOrder: 10,
          updatedAt: "2026-04-12T00:00:00.000Z",
          usedProductCount: 2,
          isInUse: true
        }
      ]
    });

    const response = await request(
      createApp({
        logger: createTestLogger(),
        requireAuthMiddleware: createRequireAuth({
          ownerEmail: "owner@example.com",
          verifyIdToken: async () => ({
            uid: "uid-1",
            email: "owner@example.com"
          })
        })
      })
    )
      .get("/api/categories")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: {
        items: [
          {
            categoryId: "cat-001",
            name: "ピアス",
            sortOrder: 10,
            updatedAt: "2026-04-12T00:00:00.000Z",
            usedProductCount: 2,
            isInUse: true
          }
        ]
      }
    });
    expect(listCategoriesMock).toHaveBeenCalledTimes(1);
  });

  it("returns tag items from the default protected route", async () => {
    listTagsMock.mockResolvedValue({
      items: [
        {
          tagId: "tag-001",
          name: "春",
          updatedAt: "2026-04-12T00:00:00.000Z",
          usedProductCount: 2,
          isInUse: true
        }
      ]
    });

    const response = await request(
      createApp({
        logger: createTestLogger(),
        requireAuthMiddleware: createRequireAuth({
          ownerEmail: "owner@example.com",
          verifyIdToken: async () => ({
            uid: "uid-1",
            email: "owner@example.com"
          })
        })
      })
    )
      .get("/api/tags")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: {
        items: [
          {
            tagId: "tag-001",
            name: "春",
            updatedAt: "2026-04-12T00:00:00.000Z",
            usedProductCount: 2,
            isInUse: true
          }
        ]
      }
    });
    expect(listTagsMock).toHaveBeenCalledTimes(1);
  });

  it("creates a tag through the default protected route", async () => {
    createTagMock.mockResolvedValue({
      tagId: "tag_010"
    });

    const response = await request(
      createApp({
        logger: createTestLogger(),
        requireAuthMiddleware: createRequireAuth({
          ownerEmail: "owner@example.com",
          verifyIdToken: async () => ({
            uid: "uid-1",
            email: "owner@example.com"
          })
        })
      })
    )
      .post("/api/tags")
      .set("Authorization", "Bearer valid-token")
      .send({
        name: "春"
      });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      data: {
        tagId: "tag_010"
      }
    });
    expect(createTagMock).toHaveBeenCalledWith({
      name: "春"
    });
  });

  it("updates a tag through the default protected route", async () => {
    updateTagMock.mockResolvedValue({
      tagId: "tag_001"
    });

    const response = await request(
      createApp({
        logger: createTestLogger(),
        requireAuthMiddleware: createRequireAuth({
          ownerEmail: "owner@example.com",
          verifyIdToken: async () => ({
            uid: "uid-1",
            email: "owner@example.com"
          })
        })
      })
    )
      .put("/api/tags/tag_001")
      .set("Authorization", "Bearer valid-token")
      .send({
        name: "初夏"
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: {
        tagId: "tag_001"
      }
    });
    expect(updateTagMock).toHaveBeenCalledWith("tag_001", {
      name: "初夏"
    });
  });

  it("deletes a tag through the default protected route", async () => {
    deleteTagMock.mockResolvedValue({
      tagId: "tag_001"
    });

    const response = await request(
      createApp({
        logger: createTestLogger(),
        requireAuthMiddleware: createRequireAuth({
          ownerEmail: "owner@example.com",
          verifyIdToken: async () => ({
            uid: "uid-1",
            email: "owner@example.com"
          })
        })
      })
    )
      .delete("/api/tags/tag_001")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: {
        tagId: "tag_001"
      }
    });
    expect(deleteTagMock).toHaveBeenCalledWith("tag_001");
  });

  it("creates a category through the default protected route", async () => {
    createCategoryMock.mockResolvedValue({
      categoryId: "cat_010"
    });

    const response = await request(
      createApp({
        logger: createTestLogger(),
        requireAuthMiddleware: createRequireAuth({
          ownerEmail: "owner@example.com",
          verifyIdToken: async () => ({
            uid: "uid-1",
            email: "owner@example.com"
          })
        })
      })
    )
      .post("/api/categories")
      .set("Authorization", "Bearer valid-token")
      .send({
        name: "ピアス",
        sortOrder: null
      });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      data: {
        categoryId: "cat_010"
      }
    });
    expect(createCategoryMock).toHaveBeenCalledWith({
      name: "ピアス",
      sortOrder: null
    });
  });

  it("updates a category through the default protected route", async () => {
    updateCategoryMock.mockResolvedValue({
      categoryId: "cat_001"
    });

    const response = await request(
      createApp({
        logger: createTestLogger(),
        requireAuthMiddleware: createRequireAuth({
          ownerEmail: "owner@example.com",
          verifyIdToken: async () => ({
            uid: "uid-1",
            email: "owner@example.com"
          })
        })
      })
    )
      .put("/api/categories/cat_001")
      .set("Authorization", "Bearer valid-token")
      .send({
        name: "イヤリング",
        sortOrder: null
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: {
        categoryId: "cat_001"
      }
    });
    expect(updateCategoryMock).toHaveBeenCalledWith("cat_001", {
      name: "イヤリング",
      sortOrder: null
    });
  });

  it("deletes a category through the default protected route", async () => {
    deleteCategoryMock.mockResolvedValue({
      categoryId: "cat_001"
    });

    const response = await request(
      createApp({
        logger: createTestLogger(),
        requireAuthMiddleware: createRequireAuth({
          ownerEmail: "owner@example.com",
          verifyIdToken: async () => ({
            uid: "uid-1",
            email: "owner@example.com"
          })
        })
      })
    )
      .delete("/api/categories/cat_001")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: {
        categoryId: "cat_001"
      }
    });
    expect(deleteCategoryMock).toHaveBeenCalledWith("cat_001");
  });
});
