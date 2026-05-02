import { vi } from "vitest";
import {
  createDocumentSnapshot,
  createTimestamp,
  expectTimestampLike
} from "../test/firestore-test-helpers";
import { deleteProduct } from "./delete-product";

describe("deleteProduct", () => {
  it("marks a product as deleted and updates timestamps", async () => {
    const now = createTimestamp("2026-04-18T13:00:00.000Z");
    const productId = "HM-000021";
    const productRef = { path: `products/${productId}` };
    const setMock = vi.fn();
    const transaction = {
      get: vi.fn(async (reference: unknown) => {
        if (reference === productRef) {
          return createDocumentSnapshot({
            categoryId: "cat-a",
            createdAt: createTimestamp("2026-04-18T08:00:00.000Z"),
            deletedAt: null,
            description: "Fancy pin",
            images: [],
            isDeleted: false,
            name: "Fancy Pin",
            price: 3200,
            productId,
            qrCodeValue: productId,
            soldAt: null,
            status: "onDisplay",
            tagIds: [],
            updatedAt: createTimestamp("2026-04-18T12:00:00.000Z")
          });
        }

        throw new Error("Unexpected transaction reference");
      }),
      set: setMock
    };
    const db = {
      collection: vi.fn((collectionName: string) => {
        if (collectionName === "products") {
          return {
            doc: vi.fn(() => productRef)
          };
        }

        throw new Error(`Unexpected collection ${collectionName}`);
      }),
      runTransaction: vi.fn(async (callback) => callback(transaction as never))
    };

    await expect(
      deleteProduct(productId, {
        db: db as never,
        now: () => now as never
      })
    ).resolves.toEqual({
      deletedAt: "2026-04-18T13:00:00.000Z",
      productId
    });

    expect(setMock).toHaveBeenCalledTimes(1);

    const [calledRef, payload] = setMock.mock.calls[0];

    expect(calledRef).toBe(productRef);
    expect(payload).toMatchObject({
      categoryId: "cat-a",
      description: "Fancy pin",
      images: [],
      isDeleted: true,
      name: "Fancy Pin",
      price: 3200,
      productId,
      qrCodeValue: productId,
      soldAt: null,
      status: "onDisplay",
      tagIds: []
    });
    expectTimestampLike(payload.createdAt, "2026-04-18T08:00:00.000Z");
    expectTimestampLike(payload.deletedAt, "2026-04-18T13:00:00.000Z");
    expectTimestampLike(payload.updatedAt, "2026-04-18T13:00:00.000Z");
  });

  it("returns PRODUCT_NOT_FOUND when the product does not exist", async () => {
    const productId = "HM-000022";
    const productRef = { path: `products/${productId}` };
    const db = {
      collection: vi.fn((collectionName: string) => {
        if (collectionName === "products") {
          return {
            doc: vi.fn(() => productRef)
          };
        }

        throw new Error(`Unexpected collection ${collectionName}`);
      }),
      runTransaction: vi.fn(async (callback) =>
        callback({
          get: vi.fn(async () => createDocumentSnapshot({ productId }, false)),
          set: vi.fn()
        } as never)
      )
    };

    await expect(
      deleteProduct(productId, {
        db: db as never
      })
    ).rejects.toMatchObject({
      code: "PRODUCT_NOT_FOUND",
      statusCode: 404
    });
  });

  it("returns PRODUCT_DELETED when the product is already deleted", async () => {
    const productId = "HM-000023";
    const productRef = { path: `products/${productId}` };
    const db = {
      collection: vi.fn((collectionName: string) => {
        if (collectionName === "products") {
          return {
            doc: vi.fn(() => productRef)
          };
        }

        throw new Error(`Unexpected collection ${collectionName}`);
      }),
      runTransaction: vi.fn(async (callback) =>
        callback({
          get: vi.fn(async (reference: unknown) => {
            if (reference === productRef) {
              return createDocumentSnapshot({
                categoryId: "cat-a",
                createdAt: createTimestamp("2026-04-18T08:00:00.000Z"),
                deletedAt: createTimestamp("2026-04-18T13:00:00.000Z"),
                description: "Deleted pin",
                images: [],
                isDeleted: true,
                name: "Deleted Pin",
                price: 3200,
                productId,
                qrCodeValue: productId,
                soldAt: null,
                status: "onDisplay",
                tagIds: [],
                updatedAt: createTimestamp("2026-04-18T13:00:00.000Z")
              });
            }

            throw new Error("Unexpected transaction reference");
          }),
          set: vi.fn()
        } as never)
      )
    };

    await expect(
      deleteProduct(productId, {
        db: db as never
      })
    ).rejects.toMatchObject({
      code: "PRODUCT_DELETED",
      statusCode: 404
    });
  });
});
