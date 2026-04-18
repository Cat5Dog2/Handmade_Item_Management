import {
  OPERATION_LOG_EVENT_TYPES,
  writeOperationLog
} from "./write-operation-log";

function createTimestamp(isoString: string) {
  return {
    toDate: () => new Date(isoString)
  };
}

describe("writeOperationLog", () => {
  it("fixes the MVP event types in code", () => {
    expect(OPERATION_LOG_EVENT_TYPES).toEqual([
      "LOGIN",
      "PRODUCT_UPDATED",
      "PRODUCT_DELETED",
      "QR_SOLD",
      "ERROR"
    ]);
  });

  it("writes the minimum operation log fields with normalized nullables", async () => {
    const setMock = vi.fn().mockResolvedValue(undefined);
    const docMock = vi.fn().mockReturnValue({
      set: setMock
    });
    const db = {
      collection: vi.fn((collectionName: string) => {
        expect(collectionName).toBe("operationLogs");

        return {
          doc: docMock
        };
      })
    };

    const result = await writeOperationLog(
      {
        eventType: "LOGIN",
        summary: "  ログインしました  ",
        targetId: "   ",
        actorUid: undefined
      },
      {
        db: db as never,
        logIdFactory: () => "log_001",
        now: () => createTimestamp("2026-04-15T00:00:00.000Z") as never
      }
    );

    expect(docMock).toHaveBeenCalledWith("log_001");
    expect(setMock).toHaveBeenCalledWith({
      logId: "log_001",
      eventType: "LOGIN",
      targetId: null,
      summary: "ログインしました",
      actorUid: null,
      createdAt: expect.any(Object),
      detail: null
    });
    expect(result).toEqual({
      logId: "log_001",
      eventType: "LOGIN",
      targetId: null,
      summary: "ログインしました",
      actorUid: null,
      createdAt: expect.any(Object),
      detail: null
    });
  });

  it("keeps targetId, actorUid, and detail for business and error logs", async () => {
    const setMock = vi.fn().mockResolvedValue(undefined);
    const db = {
      collection: vi.fn(() => ({
        doc: vi.fn().mockReturnValue({
          set: setMock
        })
      }))
    };

    const result = await writeOperationLog(
      {
        eventType: "ERROR",
        targetId: "/api/products",
        summary: "商品一覧の取得に失敗しました",
        actorUid: "uid_123",
        detail: {
          requestPath: "/api/products",
          errorCode: "INTERNAL_ERROR"
        }
      },
      {
        db: db as never,
        logIdFactory: () => "log_error",
        now: () => createTimestamp("2026-04-15T00:00:00.000Z") as never
      }
    );

    expect(result).toEqual({
      logId: "log_error",
      eventType: "ERROR",
      targetId: "/api/products",
      summary: "商品一覧の取得に失敗しました",
      actorUid: "uid_123",
      createdAt: expect.any(Object),
      detail: {
        requestPath: "/api/products",
        errorCode: "INTERNAL_ERROR"
      }
    });
  });

  it("rejects blank summaries", async () => {
    await expect(
      writeOperationLog({
        eventType: "LOGIN",
        summary: "   "
      })
    ).rejects.toThrow("Operation log summary is required.");
  });
});
