import { vi } from "vitest";
import {
  createDocumentSnapshot,
  createTimestamp
} from "../test/firestore-test-helpers";
import { createProduct } from "./create-product";

describe("createProduct", () => {
  it("creates a product with a generated productId and default soldAt", async () => {
    const now = createTimestamp("2026-04-18T09:00:00.000Z");
    const categoryRef = { path: "categories/cat-a" };
    const tagRefA = { path: "tags/tag-a" };
    const tagRefB = { path: "tags/tag-b" };
    const counterRef = { path: "counters/product" };
    const productRef = { path: "products/HM-000001" };
    const setMock = vi.fn();
    const getMock = vi.fn(async (reference: unknown) => {
      if (reference === categoryRef) {
        return createDocumentSnapshot({
          categoryId: "cat-a"
        });
      }

      if (reference === tagRefA) {
        return createDocumentSnapshot({
          tagId: "tag-a"
        });
      }

      if (reference === tagRefB) {
        return createDocumentSnapshot({
          tagId: "tag-b"
        });
      }

      if (reference === counterRef) {
        return createDocumentSnapshot(
          {
            counterKey: "product",
            currentValue: 0,
            updatedAt: createTimestamp("2026-04-17T00:00:00.000Z")
          },
          false
        );
      }

      throw new Error("Unexpected transaction reference");
    });
    const transaction = {
      get: getMock,
      set: setMock
    };
    const runTransactionMock = vi.fn(async (callback) =>
      callback(transaction as never)
    );
    const categoryDocMock = vi.fn().mockReturnValue(categoryRef);
    const tagDocMock = vi.fn((tagId: string) => {
      if (tagId === "tag-a") {
        return tagRefA;
      }

      if (tagId === "tag-b") {
        return tagRefB;
      }

      throw new Error(`Unexpected tag ${tagId}`);
    });
    const productDocMock = vi.fn((productId: string) => {
      if (productId === "HM-000001") {
        return productRef;
      }

      throw new Error(`Unexpected product ${productId}`);
    });
    const db = {
      collection: vi.fn((collectionName: string) => {
        if (collectionName === "categories") {
          return {
            doc: categoryDocMock
          };
        }

        if (collectionName === "tags") {
          return {
            doc: tagDocMock
          };
        }

        if (collectionName === "products") {
          return {
            doc: productDocMock
          };
        }

        throw new Error(`Unexpected collection ${collectionName}`);
      }),
      doc: vi.fn().mockReturnValue(counterRef),
      runTransaction: runTransactionMock
    };

    const result = await createProduct(
      {
        categoryId: " cat-a ",
        description: "First line\r\nSecond line",
        name: "  Fancy Pin  ",
        price: 2800,
        status: "completed",
        tagIds: ["tag-a", "tag-b"]
      },
      {
        db: db as never,
        now: () => now as never
      }
    );

    expect(result).toEqual({
      productId: "HM-000001",
      createdAt: "2026-04-18T09:00:00.000Z",
      updatedAt: "2026-04-18T09:00:00.000Z"
    });
    expect(db.doc).toHaveBeenCalledWith("counters/product");
    expect(categoryDocMock).toHaveBeenCalledWith("cat-a");
    expect(tagDocMock).toHaveBeenNthCalledWith(1, "tag-a");
    expect(tagDocMock).toHaveBeenNthCalledWith(2, "tag-b");
    expect(productDocMock).toHaveBeenCalledWith("HM-000001");
    expect(setMock).toHaveBeenNthCalledWith(1, counterRef, {
      counterKey: "product",
      currentValue: 1,
      updatedAt: now
    });
    expect(setMock).toHaveBeenNthCalledWith(2, productRef, {
      categoryId: "cat-a",
      createdAt: now,
      deletedAt: null,
      description: "First line\nSecond line",
      images: [],
      isDeleted: false,
      name: "Fancy Pin",
      price: 2800,
      productId: "HM-000001",
      qrCodeValue: "HM-000001",
      soldAt: null,
      soldCustomerId: null,
      soldCustomerNameSnapshot: null,
      status: "completed",
      tagIds: ["tag-a", "tag-b"],
      updatedAt: now
    });
  });

  it("sets soldAt when the product is created as sold", async () => {
    const now = createTimestamp("2026-04-18T10:00:00.000Z");
    const categoryRef = { path: "categories/cat-a" };
    const counterRef = { path: "counters/product" };
    const productRef = { path: "products/HM-000001" };
    const setMock = vi.fn();
    const getMock = vi.fn(async (reference: unknown) => {
      if (reference === categoryRef) {
        return createDocumentSnapshot({
          categoryId: "cat-a"
        });
      }

      if (reference === counterRef) {
        return createDocumentSnapshot(
          {
            counterKey: "product",
            currentValue: 0,
            updatedAt: createTimestamp("2026-04-17T00:00:00.000Z")
          },
          false
        );
      }

      throw new Error("Unexpected transaction reference");
    });
    const transaction = {
      get: getMock,
      set: setMock
    };
    const db = {
      collection: vi.fn((collectionName: string) => {
        if (collectionName === "categories") {
          return {
            doc: vi.fn().mockReturnValue(categoryRef)
          };
        }

        if (collectionName === "products") {
          return {
            doc: vi.fn().mockReturnValue(productRef)
          };
        }

        throw new Error(`Unexpected collection ${collectionName}`);
      }),
      doc: vi.fn().mockReturnValue(counterRef),
      runTransaction: vi.fn(async (callback) => callback(transaction as never))
    };

    await expect(
      createProduct(
        {
          categoryId: "cat-a",
          name: "Sold Pin",
          price: 1200,
          status: "sold"
        },
        {
          db: db as never,
          now: () => now as never
        }
      )
    ).resolves.toEqual({
      productId: "HM-000001",
      createdAt: "2026-04-18T10:00:00.000Z",
      updatedAt: "2026-04-18T10:00:00.000Z"
    });

    expect(setMock).toHaveBeenCalledWith(productRef, {
      categoryId: "cat-a",
      createdAt: now,
      deletedAt: null,
      description: "",
      images: [],
      isDeleted: false,
      name: "Sold Pin",
      price: 1200,
      productId: "HM-000001",
      qrCodeValue: "HM-000001",
      soldAt: now,
      soldCustomerId: null,
      soldCustomerNameSnapshot: null,
      status: "sold",
      tagIds: [],
      updatedAt: now
    });
  });

  it("returns validation details for invalid input", async () => {
    await expect(
      createProduct({
        categoryId: "cat-a",
        name: "   ",
        price: 1200,
        status: "completed"
      })
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      details: [
        {
          field: "name",
          message: "String must contain at least 1 character(s)"
        }
      ],
      statusCode: 400
    });
  });

  it("returns CATEGORY_NOT_FOUND when the category does not exist", async () => {
    const now = createTimestamp("2026-04-18T11:00:00.000Z");
    const categoryRef = { path: "categories/missing" };
    const counterRef = { path: "counters/product" };
    const transaction = {
      get: vi.fn(async (reference: unknown) => {
        if (reference === categoryRef) {
          return createDocumentSnapshot(
            {
              categoryId: "missing"
            },
            false
          );
        }

        if (reference === counterRef) {
          return createDocumentSnapshot(
            {
              counterKey: "product",
              currentValue: 0,
              updatedAt: createTimestamp("2026-04-17T00:00:00.000Z")
            },
            false
          );
        }

        throw new Error("Unexpected transaction reference");
      }),
      set: vi.fn()
    };
    const db = {
      collection: vi.fn((collectionName: string) => {
        if (collectionName === "categories") {
          return {
            doc: vi.fn().mockReturnValue(categoryRef)
          };
        }

        if (collectionName === "products") {
          return {
            doc: vi.fn()
          };
        }

        if (collectionName === "tags") {
          return {
            doc: vi.fn()
          };
        }

        throw new Error(`Unexpected collection ${collectionName}`);
      }),
      doc: vi.fn().mockReturnValue(counterRef),
      runTransaction: vi.fn(async (callback) => callback(transaction as never))
    };

    await expect(
      createProduct(
        {
          categoryId: "missing",
          name: "Fancy Pin",
          price: 1200,
          status: "completed"
        },
        {
          db: db as never,
          now: () => now as never
        }
      )
    ).rejects.toMatchObject({
      code: "CATEGORY_NOT_FOUND",
      details: [
        {
          field: "categoryId",
          message: "指定したカテゴリが見つかりません。カテゴリを選び直してください。"
        }
      ],
      statusCode: 400
    });

    expect(transaction.set).not.toHaveBeenCalled();
  });

  it("returns TAG_NOT_FOUND when a tag does not exist", async () => {
    const now = createTimestamp("2026-04-18T12:00:00.000Z");
    const categoryRef = { path: "categories/cat-a" };
    const tagRef = { path: "tags/missing" };
    const counterRef = { path: "counters/product" };
    const transaction = {
      get: vi.fn(async (reference: unknown) => {
        if (reference === categoryRef) {
          return createDocumentSnapshot({
            categoryId: "cat-a"
          });
        }

        if (reference === tagRef) {
          return createDocumentSnapshot(
            {
              tagId: "missing"
            },
            false
          );
        }

        if (reference === counterRef) {
          return createDocumentSnapshot(
            {
              counterKey: "product",
              currentValue: 0,
              updatedAt: createTimestamp("2026-04-17T00:00:00.000Z")
            },
            false
          );
        }

        throw new Error("Unexpected transaction reference");
      }),
      set: vi.fn()
    };
    const db = {
      collection: vi.fn((collectionName: string) => {
        if (collectionName === "categories") {
          return {
            doc: vi.fn().mockReturnValue(categoryRef)
          };
        }

        if (collectionName === "tags") {
          return {
            doc: vi.fn((tagId: string) => {
              if (tagId === "missing") {
                return tagRef;
              }

              throw new Error(`Unexpected tag ${tagId}`);
            })
          };
        }

        if (collectionName === "products") {
          return {
            doc: vi.fn()
          };
        }

        throw new Error(`Unexpected collection ${collectionName}`);
      }),
      doc: vi.fn().mockReturnValue(counterRef),
      runTransaction: vi.fn(async (callback) => callback(transaction as never))
    };

    await expect(
      createProduct(
        {
          categoryId: "cat-a",
          name: "Fancy Pin",
          price: 1200,
          status: "completed",
          tagIds: ["missing"]
        },
        {
          db: db as never,
          now: () => now as never
        }
      )
    ).rejects.toMatchObject({
      code: "TAG_NOT_FOUND",
      details: [
        {
          field: "tagIds",
          message: "指定したタグが見つかりません。タグを選び直してください。"
        }
      ],
      statusCode: 400
    });

    expect(transaction.set).not.toHaveBeenCalled();
  });
});
