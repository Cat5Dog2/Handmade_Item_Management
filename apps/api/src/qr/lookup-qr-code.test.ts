import { describe, expect, it, vi } from "vitest";
import { lookupQrCode } from "./lookup-qr-code";

function createDocumentSnapshot<T>(data: T, exists = true) {
  return {
    data: () => data,
    exists
  };
}

function createDb(productSnapshot: unknown) {
  const productGet = vi.fn().mockResolvedValue(productSnapshot);
  const productDoc = vi.fn(() => ({
    get: productGet
  }));
  const db = {
    collection: vi.fn((collectionName: string) => {
      if (collectionName === "products") {
        return {
          doc: productDoc
        };
      }

      throw new Error(`Unexpected collection ${collectionName}`);
    })
  };

  return {
    db,
    productDoc,
    productGet
  };
}

describe("lookupQrCode", () => {
  it.each([
    ["onDisplay", "CAN_SELL", true],
    ["inStock", "CAN_SELL", true],
    ["sold", "ALREADY_SOLD", false],
    ["beforeProduction", "INVALID_STATUS", false],
    ["inProduction", "INVALID_STATUS", false],
    ["completed", "INVALID_STATUS", false]
  ] as const)(
    "returns %s lookup result",
    async (status, reasonCode, canSell) => {
      const { db, productDoc } = createDb(
        createDocumentSnapshot({
          isDeleted: false,
          name: "春色ピアス",
          productId: "HM-000001",
          qrCodeValue: "HM-000001",
          status
        })
      );

      await expect(
        lookupQrCode(
          {
            qrCodeValue: " HM-000001 "
          },
          {
            db: db as never
          }
        )
      ).resolves.toMatchObject({
        productId: "HM-000001",
        name: "春色ピアス",
        status,
        canSell,
        reasonCode
      });
      expect(productDoc).toHaveBeenCalledWith("HM-000001");
    }
  );

  it("returns PRODUCT_DELETED as a lookup result for logically deleted products", async () => {
    const { db } = createDb(
      createDocumentSnapshot({
        isDeleted: true,
        name: "削除済みピアス",
        productId: "HM-000002",
        qrCodeValue: "HM-000002",
        status: "onDisplay"
      })
    );

    await expect(
      lookupQrCode(
        {
          qrCodeValue: "HM-000002"
        },
        {
          db: db as never
        }
      )
    ).resolves.toEqual({
      productId: "HM-000002",
      name: "削除済みピアス",
      status: "onDisplay",
      canSell: false,
      reasonCode: "PRODUCT_DELETED",
      message: "このQRコードの商品は利用できません。"
    });
  });

  it("returns PRODUCT_NOT_FOUND as a lookup result for unknown QR values", async () => {
    const { db } = createDb(
      createDocumentSnapshot(
        {
          productId: "HM-999999"
        },
        false
      )
    );

    await expect(
      lookupQrCode(
        {
          qrCodeValue: "HM-999999"
        },
        {
          db: db as never
        }
      )
    ).resolves.toEqual({
      productId: null,
      name: null,
      status: null,
      canSell: false,
      reasonCode: "PRODUCT_NOT_FOUND",
      message: "該当する商品が見つかりません。"
    });
  });

  it("returns VALIDATION_ERROR when qrCodeValue is missing", async () => {
    await expect(lookupQrCode({})).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      statusCode: 400,
      details: [
        {
          field: "qrCodeValue"
        }
      ]
    });
  });
});
