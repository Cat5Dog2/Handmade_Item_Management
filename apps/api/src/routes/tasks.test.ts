import request from "supertest";
import { vi } from "vitest";
import { createApp } from "../app";
import { createRequireAuth } from "../middlewares/auth";

const updateTaskCompletionMock = vi.hoisted(() => vi.fn());

vi.mock("../tasks/update-task-completion", () => ({
  updateTaskCompletion: updateTaskCompletionMock
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

describe("tasks routes", () => {
  beforeEach(() => {
    updateTaskCompletionMock.mockReset();
  });

  it("returns AUTH_REQUIRED for unauthenticated task completion requests", async () => {
    const response = await request(createTestApp())
      .patch("/api/tasks/task_000001/completion")
      .send({
        isCompleted: true
      });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      code: "AUTH_REQUIRED"
    });
    expect(updateTaskCompletionMock).not.toHaveBeenCalled();
  });

  it("returns the task completion envelope for authenticated requests", async () => {
    updateTaskCompletionMock.mockResolvedValue({
      completedAt: "2026-04-25T09:00:00.000Z",
      isCompleted: true,
      taskId: "task_000001",
      updatedAt: "2026-04-25T09:00:00.000Z"
    });

    const requestBody = {
      isCompleted: true
    };
    const response = await request(
      createTestApp({
        verifyIdToken: async () => ({
          uid: "uid-1",
          email: "owner@example.com"
        })
      })
    )
      .patch("/api/tasks/task_000001/completion")
      .set("Authorization", "Bearer valid-token")
      .send(requestBody);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: {
        completedAt: "2026-04-25T09:00:00.000Z",
        isCompleted: true,
        taskId: "task_000001",
        updatedAt: "2026-04-25T09:00:00.000Z"
      }
    });
    expect(updateTaskCompletionMock).toHaveBeenCalledWith(
      "task_000001",
      requestBody
    );
  });
});
