import request from "supertest";
import { createApp } from "./app";
import { errorHandler } from "./errors/error-handler";
import { createRequireAuth } from "./middlewares/auth";

function createProtectedTestApp({
  ownerEmail = "owner@example.com",
  verifyIdToken
}: {
  ownerEmail?: string;
  verifyIdToken?: (idToken: string) => Promise<{ uid: string; email?: string }>;
} = {}) {
  const app = createApp();

  app.get(
    "/api/protected",
    createRequireAuth({
      ownerEmail,
      verifyIdToken
    }),
    (request, response) => {
      response.status(200).json({
        data: {
          actorUid: request.authContext?.actorUid ?? null,
          email: request.authContext?.email ?? null
        }
      });
    }
  );

  app.use(errorHandler);

  return app;
}

describe("createApp", () => {
  it("returns the health payload", async () => {
    const response = await request(createApp()).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: {
        status: "ok",
        service: "handmade-sales-api"
      }
    });
  });

  it("returns AUTH_REQUIRED when the authorization header is missing", async () => {
    const response = await request(createProtectedTestApp()).get(
      "/api/protected"
    );

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      code: "AUTH_REQUIRED",
      message: "認証が必要です。"
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
      message: "認証が必要です。"
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
