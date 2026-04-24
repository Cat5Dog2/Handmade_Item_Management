import request from "supertest";
import { vi } from "vitest";
import { createApp } from "../app";
import { createRequireAuth } from "../middlewares/auth";

const lookupQrCodeMock = vi.hoisted(() => vi.fn());

vi.mock("../qr/lookup-qr-code", () => ({
  lookupQrCode: lookupQrCodeMock
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

describe("qr routes", () => {
  beforeEach(() => {
    lookupQrCodeMock.mockReset();
  });

  it("returns AUTH_REQUIRED for unauthenticated QR lookup requests", async () => {
    const response = await request(createTestApp()).post("/api/qr/lookup").send({
      qrCodeValue: "HM-000001"
    });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      code: "AUTH_REQUIRED"
    });
    expect(lookupQrCodeMock).not.toHaveBeenCalled();
  });

  it("returns the QR lookup envelope for authenticated requests", async () => {
    lookupQrCodeMock.mockResolvedValue({
      productId: "HM-000001",
      name: "春色ピアス",
      status: "onDisplay",
      canSell: true,
      reasonCode: "CAN_SELL",
      message: "販売済更新が可能です。"
    });

    const requestBody = {
      qrCodeValue: "HM-000001"
    };
    const response = await request(
      createTestApp({
        verifyIdToken: async () => ({
          uid: "uid-1",
          email: "owner@example.com"
        })
      })
    )
      .post("/api/qr/lookup")
      .set("Authorization", "Bearer valid-token")
      .send(requestBody);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: {
        productId: "HM-000001",
        name: "春色ピアス",
        status: "onDisplay",
        canSell: true,
        reasonCode: "CAN_SELL",
        message: "販売済更新が可能です。"
      }
    });
    expect(lookupQrCodeMock).toHaveBeenCalledWith(requestBody);
  });
});
