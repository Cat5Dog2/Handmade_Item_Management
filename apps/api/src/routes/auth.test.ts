import request from "supertest";
import { vi } from "vitest";
import { createApp } from "../app";
import { createRequireAuth } from "../middlewares/auth";

const writeOperationLogMock = vi.hoisted(() => vi.fn());

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

describe("auth routes", () => {
  beforeEach(() => {
    writeOperationLogMock.mockReset();
  });

  it("records LOGIN after a successful login confirmation", async () => {
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
      .post("/api/auth/login-record")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      data: {
        recorded: true
      }
    });
    expect(writeOperationLogMock).toHaveBeenCalledWith({
      eventType: "LOGIN",
      targetId: null,
      summary: "ログインしました",
      actorUid: "uid-1",
      detail: {
        result: "success"
      }
    });
  });

  it("returns AUTH_REQUIRED when the login-record request is unauthenticated", async () => {
    const response = await request(createTestApp()).post(
      "/api/auth/login-record"
    );

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      code: "AUTH_REQUIRED"
    });
    expect(writeOperationLogMock).not.toHaveBeenCalled();
  });

  it("returns AUTH_FORBIDDEN when the user is outside the allowlist", async () => {
    const response = await request(
      createTestApp({
        verifyIdToken: async () => ({
          uid: "uid-1",
          email: "other@example.com"
        })
      })
    )
      .post("/api/auth/login-record")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({
      code: "AUTH_FORBIDDEN"
    });
    expect(writeOperationLogMock).not.toHaveBeenCalled();
  });
});
