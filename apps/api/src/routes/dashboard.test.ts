import request from "supertest";
import { vi } from "vitest";
import { createApp } from "../app";
import { createRequireAuth } from "../middlewares/auth";

const getDashboardMock = vi.hoisted(() => vi.fn());

vi.mock("../dashboard/get-dashboard", () => ({
  getDashboard: getDashboardMock
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

describe("dashboard routes", () => {
  beforeEach(() => {
    getDashboardMock.mockReset();
  });

  it("returns AUTH_REQUIRED for unauthenticated dashboard requests", async () => {
    const response = await request(createTestApp()).get("/api/dashboard");

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      code: "AUTH_REQUIRED"
    });
    expect(getDashboardMock).not.toHaveBeenCalled();
  });

  it("returns the dashboard envelope for authenticated requests", async () => {
    getDashboardMock.mockResolvedValue({
      statusCounts: {
        beforeProduction: 1,
        inProduction: 2,
        completed: 3,
        onDisplay: 4,
        inStock: 5,
        sold: 6
      },
      soldCount: 6,
      openTaskCount: 8,
      dueSoonTasks: [
        {
          dueDate: "2026-04-24",
          productId: "HM-000001",
          productName: "Blue Brooch",
          taskId: "task_001",
          taskName: "Prepare backing card"
        }
      ],
      recentProducts: [
        {
          productId: "HM-000010",
          name: "Recent Pin",
          status: "onDisplay",
          thumbnailUrl: "https://example.com/thumb.webp",
          updatedAt: "2026-04-24T01:00:00.000Z"
        }
      ]
    });

    const response = await request(
      createTestApp({
        verifyIdToken: async () => ({
          uid: "uid-1",
          email: "owner@example.com"
        })
      })
    )
      .get("/api/dashboard")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: {
        statusCounts: {
          beforeProduction: 1,
          inProduction: 2,
          completed: 3,
          onDisplay: 4,
          inStock: 5,
          sold: 6
        },
        soldCount: 6,
        openTaskCount: 8,
        dueSoonTasks: [
          {
            dueDate: "2026-04-24",
            productId: "HM-000001",
            productName: "Blue Brooch",
            taskId: "task_001",
            taskName: "Prepare backing card"
          }
        ],
        recentProducts: [
          {
            productId: "HM-000010",
            name: "Recent Pin",
            status: "onDisplay",
            thumbnailUrl: "https://example.com/thumb.webp",
            updatedAt: "2026-04-24T01:00:00.000Z"
          }
        ]
      }
    });
    expect(getDashboardMock).toHaveBeenCalledTimes(1);
  });
});
