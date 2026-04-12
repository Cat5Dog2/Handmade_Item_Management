import request from "supertest";
import { vi } from "vitest";
import { createApp } from "./app";
import { createValidationError } from "./errors/api-errors";
import { createRequireAuth } from "./middlewares/auth";
import type { ApiLogger } from "./middlewares/request-logger";

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
});
