import { vi } from "vitest";
import {
  createDocumentSnapshot,
  createTimestamp,
  expectTimestampLike
} from "../test/firestore-test-helpers";
import { updateProduct } from "./update-product";

describe("updateProduct", () => {
  it("updates a product and normalizes the primary image", async () => {
    const now = createTimestamp("2026-04-18T10:00:00.000Z");
    const productId = "HM-000001";
    const productRef = { path: `products/${productId}` };
    const categoryRef = { path: "categories/cat-b" };
    const tagRefA = { path: "tags/tag-a" };
    const tagRefB = { path: "tags/tag-b" };
    const setMock = vi.fn();
    const getMock = vi.fn(async (reference: unknown) => {
      if (reference === productRef) {
        return createDocumentSnapshot({
          categoryId: "cat-a",
          createdAt: createTimestamp("2026-04-18T08:00:00.000Z"),
          deletedAt: null,
          description: "Old description",
          images: [
            {
              displayPath: "products/HM-000001/display/img-001.webp",
              imageId: "img-001",
              isPrimary: false,
              sortOrder: 1,
              thumbnailPath: "products/HM-000001/thumb/img-001.webp"
            },
            {
              displayPath: "products/HM-000001/display/img-002.webp",
              imageId: "img-002",
              isPrimary: true,
              sortOrder: 2,
              thumbnailPath: "products/HM-000001/thumb/img-002.webp"
            }
          ],
          isDeleted: false,
          name: "Old Pin",
          price: 2800,
          productId,
          qrCodeValue: productId,
          soldAt: null,
          status: "onDisplay",
          tagIds: ["tag-b"],
          updatedAt: createTimestamp("2026-04-18T09:00:00.000Z")
        });
      }

      if (reference === categoryRef) {
        return createDocumentSnapshot({ categoryId: "cat-b" });
      }

      if (reference === tagRefA) {
        return createDocumentSnapshot({ tagId: "tag-a" });
      }

      if (reference === tagRefB) {
        return createDocumentSnapshot({ tagId: "tag-b" });
      }

      throw new Error("Unexpected transaction reference");
    });
    const transaction = {
      get: getMock,
      set: setMock
    };
    const db = {
      collection: vi.fn((collectionName: string) => {
        if (collectionName === "products") {
          return {
            doc: vi.fn((inputProductId: string) => {
              if (inputProductId === productId) {
                return productRef;
              }

              throw new Error(`Unexpected product ${inputProductId}`);
            })
          };
        }

        if (collectionName === "categories") {
          return {
            doc: vi.fn((categoryId: string) => {
              if (categoryId === "cat-b") {
                return categoryRef;
              }

              throw new Error(`Unexpected category ${categoryId}`);
            })
          };
        }

        if (collectionName === "tags") {
          return {
            doc: vi.fn((tagId: string) => {
              if (tagId === "tag-a") {
                return tagRefA;
              }

              if (tagId === "tag-b") {
                return tagRefB;
              }

              throw new Error(`Unexpected tag ${tagId}`);
            })
          };
        }

        throw new Error(`Unexpected collection ${collectionName}`);
      }),
      runTransaction: vi.fn(async (callback) => callback(transaction as never))
    };

    await expect(
      updateProduct(
        productId,
        {
          categoryId: "cat-b",
          description: "Updated description",
          name: "Fancy Pin",
          price: 3000,
          primaryImageId: "img-002",
          soldCustomerId: null,
          status: "sold",
          tagIds: ["tag-b", "tag-a"]
        },
        {
          db: db as never,
          now: () => now as never
        }
      )
    ).resolves.toEqual({
      changedFields: [
        "name",
        "price",
        "categoryId",
        "status",
        "description",
        "tagIds"
      ],
      productId,
      updatedAt: "2026-04-18T10:00:00.000Z"
    });

    expect(setMock).toHaveBeenCalledTimes(1);

    const [calledRef, payload] = setMock.mock.calls[0];

    expect(calledRef).toBe(productRef);
    expect(payload).toMatchObject({
      categoryId: "cat-b",
      description: "Updated description",
      images: [
        {
          displayPath: "products/HM-000001/display/img-001.webp",
          imageId: "img-001",
          isPrimary: false,
          sortOrder: 1,
          thumbnailPath: "products/HM-000001/thumb/img-001.webp"
        },
        {
          displayPath: "products/HM-000001/display/img-002.webp",
          imageId: "img-002",
          isPrimary: true,
          sortOrder: 2,
          thumbnailPath: "products/HM-000001/thumb/img-002.webp"
        }
      ],
      isDeleted: false,
      name: "Fancy Pin",
      price: 3000,
      productId,
      qrCodeValue: productId,
      soldCustomerId: null,
      soldCustomerNameSnapshot: null,
      status: "sold",
      tagIds: ["tag-b", "tag-a"]
    });
    expectTimestampLike(payload.createdAt, "2026-04-18T08:00:00.000Z");
    expect(payload.deletedAt).toBeNull();
    expect(payload.soldAt).toBe(now);
    expect(payload.updatedAt).toBe(now);
  });

  it("sets sold customer fields when saving a sold product with a customer", async () => {
    const now = createTimestamp("2026-04-18T10:30:00.000Z");
    const productId = "HM-000002";
    const productRef = { path: `products/${productId}` };
    const categoryRef = { path: "categories/cat-a" };
    const customerRef = { path: "customers/cus_000001" };
    const transaction = {
      get: vi.fn(async (reference: unknown) => {
        if (reference === productRef) {
          return createDocumentSnapshot({
            categoryId: "cat-a",
            createdAt: createTimestamp("2026-04-18T08:00:00.000Z"),
            deletedAt: null,
            description: "Display pin",
            images: [],
            isDeleted: false,
            name: "Display Pin",
            price: 2600,
            productId,
            qrCodeValue: productId,
            soldAt: null,
            soldCustomerId: null,
            soldCustomerNameSnapshot: null,
            status: "onDisplay",
            tagIds: [],
            updatedAt: createTimestamp("2026-04-18T09:00:00.000Z")
          });
        }

        if (reference === categoryRef) {
          return createDocumentSnapshot({ categoryId: "cat-a" });
        }

        if (reference === customerRef) {
          return createDocumentSnapshot({
            customerId: "cus_000001",
            isArchived: false,
            name: "山田 花子"
          });
        }

        throw new Error("Unexpected transaction reference");
      }),
      set: vi.fn()
    };
    const db = {
      collection: vi.fn((collectionName: string) => {
        if (collectionName === "products") {
          return {
            doc: vi.fn(() => productRef)
          };
        }

        if (collectionName === "categories") {
          return {
            doc: vi.fn(() => categoryRef)
          };
        }

        if (collectionName === "customers") {
          return {
            doc: vi.fn((customerId: string) => {
              if (customerId === "cus_000001") {
                return customerRef;
              }

              throw new Error(`Unexpected customer ${customerId}`);
            })
          };
        }

        if (collectionName === "tags") {
          return {
            doc: vi.fn()
          };
        }

        throw new Error(`Unexpected collection ${collectionName}`);
      }),
      runTransaction: vi.fn(async (callback) => callback(transaction as never))
    };

    await expect(
      updateProduct(
        productId,
        {
          categoryId: "cat-a",
          description: "Sold pin",
          name: "Display Pin",
          price: 2600,
          primaryImageId: null,
          soldCustomerId: "cus_000001",
          status: "sold",
          tagIds: []
        },
        {
          db: db as never,
          now: () => now as never
        }
      )
    ).resolves.toEqual({
      changedFields: ["status", "description", "soldCustomerId"],
      productId,
      updatedAt: "2026-04-18T10:30:00.000Z"
    });

    const [, payload] = transaction.set.mock.calls[0];

    expect(payload).toMatchObject({
      soldCustomerId: "cus_000001",
      soldCustomerNameSnapshot: "山田 花子",
      status: "sold"
    });
    expect(payload.soldAt).toBe(now);
  });

  it("rejects an archived customer when setting soldCustomerId", async () => {
    const productId = "HM-000003";
    const productRef = { path: `products/${productId}` };
    const categoryRef = { path: "categories/cat-a" };
    const customerRef = { path: "customers/cus_archived" };
    const transaction = {
      get: vi.fn(async (reference: unknown) => {
        if (reference === productRef) {
          return createDocumentSnapshot({
            categoryId: "cat-a",
            createdAt: createTimestamp("2026-04-18T08:00:00.000Z"),
            deletedAt: null,
            description: "Display pin",
            images: [],
            isDeleted: false,
            name: "Display Pin",
            price: 2600,
            productId,
            qrCodeValue: productId,
            soldAt: null,
            status: "onDisplay",
            tagIds: [],
            updatedAt: createTimestamp("2026-04-18T09:00:00.000Z")
          });
        }

        if (reference === categoryRef) {
          return createDocumentSnapshot({ categoryId: "cat-a" });
        }

        if (reference === customerRef) {
          return createDocumentSnapshot({
            customerId: "cus_archived",
            isArchived: true,
            name: "Archived Customer"
          });
        }

        throw new Error("Unexpected transaction reference");
      }),
      set: vi.fn()
    };
    const db = {
      collection: vi.fn((collectionName: string) => {
        if (collectionName === "products") {
          return {
            doc: vi.fn(() => productRef)
          };
        }

        if (collectionName === "categories") {
          return {
            doc: vi.fn(() => categoryRef)
          };
        }

        if (collectionName === "customers") {
          return {
            doc: vi.fn(() => customerRef)
          };
        }

        if (collectionName === "tags") {
          return {
            doc: vi.fn()
          };
        }

        throw new Error(`Unexpected collection ${collectionName}`);
      }),
      runTransaction: vi.fn(async (callback) => callback(transaction as never))
    };

    await expect(
      updateProduct(
        productId,
        {
          categoryId: "cat-a",
          description: "Sold pin",
          name: "Display Pin",
          price: 2600,
          primaryImageId: null,
          soldCustomerId: "cus_archived",
          status: "sold",
          tagIds: []
        },
        {
          db: db as never
        }
      )
    ).rejects.toMatchObject({
      code: "CUSTOMER_ARCHIVED",
      details: [
        {
          field: "soldCustomerId"
        }
      ],
      statusCode: 400
    });

    expect(transaction.set).not.toHaveBeenCalled();
  });

  it("keeps soldAt when re-saving a sold product", async () => {
    const now = createTimestamp("2026-04-18T11:00:00.000Z");
    const soldAt = createTimestamp("2026-04-18T09:45:00.000Z");
    const productId = "HM-000010";
    const productRef = { path: `products/${productId}` };
    const categoryRef = { path: "categories/cat-a" };
    const transaction = {
      get: vi.fn(async (reference: unknown) => {
        if (reference === productRef) {
          return createDocumentSnapshot({
            categoryId: "cat-a",
            createdAt: createTimestamp("2026-04-18T08:00:00.000Z"),
            deletedAt: null,
            description: "Sold pin",
            images: [],
            isDeleted: false,
            name: "Sold Pin",
            price: 3200,
            productId,
            qrCodeValue: productId,
            soldAt,
            status: "sold",
            tagIds: [],
            updatedAt: createTimestamp("2026-04-18T10:00:00.000Z")
          });
        }

        if (reference === categoryRef) {
          return createDocumentSnapshot({ categoryId: "cat-a" });
        }

        throw new Error("Unexpected transaction reference");
      }),
      set: vi.fn()
    };
    const db = {
      collection: vi.fn((collectionName: string) => {
        if (collectionName === "products") {
          return {
            doc: vi.fn(() => productRef)
          };
        }

        if (collectionName === "categories") {
          return {
            doc: vi.fn(() => categoryRef)
          };
        }

        if (collectionName === "tags") {
          return {
            doc: vi.fn()
          };
        }

        throw new Error(`Unexpected collection ${collectionName}`);
      }),
      runTransaction: vi.fn(async (callback) => callback(transaction as never))
    };

    await expect(
      updateProduct(
        productId,
        {
          categoryId: "cat-a",
          description: "Sold pin",
          name: "Sold Pin",
          price: 3200,
          primaryImageId: null,
          soldCustomerId: null,
          status: "sold",
          tagIds: []
        },
        {
          db: db as never,
          now: () => now as never
        }
      )
    ).resolves.toMatchObject({
      productId,
      updatedAt: "2026-04-18T11:00:00.000Z"
    });

    expect(transaction.set).toHaveBeenCalledTimes(1);

    const [calledRef, payload] = transaction.set.mock.calls[0];

    expect(calledRef).toBe(productRef);
    expect(payload).toMatchObject({
      categoryId: "cat-a",
      description: "Sold pin",
      images: [],
      isDeleted: false,
      name: "Sold Pin",
      price: 3200,
      productId,
      qrCodeValue: productId,
      soldCustomerId: null,
      soldCustomerNameSnapshot: null,
      status: "sold",
      tagIds: []
    });
    expectTimestampLike(payload.createdAt, "2026-04-18T08:00:00.000Z");
    expect(payload.deletedAt).toBeNull();
    expect(payload.soldAt).toBe(soldAt);
    expect(payload.updatedAt).toBe(now);
  });

  it("clears soldAt when returning a sold product to another status", async () => {
    const now = createTimestamp("2026-04-18T12:00:00.000Z");
    const soldAt = createTimestamp("2026-04-18T09:00:00.000Z");
    const productId = "HM-000011";
    const productRef = { path: `products/${productId}` };
    const categoryRef = { path: "categories/cat-a" };
    const transaction = {
      get: vi.fn(async (reference: unknown) => {
        if (reference === productRef) {
          return createDocumentSnapshot({
            categoryId: "cat-a",
            createdAt: createTimestamp("2026-04-18T08:00:00.000Z"),
            deletedAt: null,
            description: "Sold pin",
            images: [],
            isDeleted: false,
            name: "Sold Pin",
            price: 3200,
            productId,
            qrCodeValue: productId,
            soldAt,
            soldCustomerId: "cus_000001",
            soldCustomerNameSnapshot: "山田 花子",
            status: "sold",
            tagIds: [],
            updatedAt: createTimestamp("2026-04-18T10:00:00.000Z")
          });
        }

        if (reference === categoryRef) {
          return createDocumentSnapshot({ categoryId: "cat-a" });
        }

        throw new Error("Unexpected transaction reference");
      }),
      set: vi.fn()
    };
    const db = {
      collection: vi.fn((collectionName: string) => {
        if (collectionName === "products") {
          return {
            doc: vi.fn(() => productRef)
          };
        }

        if (collectionName === "categories") {
          return {
            doc: vi.fn(() => categoryRef)
          };
        }

        if (collectionName === "tags") {
          return {
            doc: vi.fn()
          };
        }

        throw new Error(`Unexpected collection ${collectionName}`);
      }),
      runTransaction: vi.fn(async (callback) => callback(transaction as never))
    };

    await expect(
      updateProduct(
        productId,
        {
          categoryId: "cat-a",
          description: "Back on display",
          name: "Fancy Pin",
          price: 3200,
          primaryImageId: null,
          soldCustomerId: null,
          status: "onDisplay",
          tagIds: []
        },
        {
          db: db as never,
          now: () => now as never
        }
      )
    ).resolves.toMatchObject({
      productId,
      updatedAt: "2026-04-18T12:00:00.000Z"
    });

    expect(transaction.set).toHaveBeenCalledTimes(1);

    const [calledRef, payload] = transaction.set.mock.calls[0];

    expect(calledRef).toBe(productRef);
    expect(payload).toMatchObject({
      categoryId: "cat-a",
      description: "Back on display",
      images: [],
      isDeleted: false,
      name: "Fancy Pin",
      price: 3200,
      productId,
      qrCodeValue: productId,
      soldCustomerId: null,
      soldCustomerNameSnapshot: null,
      status: "onDisplay",
      tagIds: []
    });
    expectTimestampLike(payload.createdAt, "2026-04-18T08:00:00.000Z");
    expect(payload.deletedAt).toBeNull();
    expect(payload.soldAt).toBeNull();
    expect(payload.updatedAt).toBe(now);
  });

  it("returns a validation error when primaryImageId does not exist", async () => {
    const productId = "HM-000012";
    const productRef = { path: `products/${productId}` };
    const categoryRef = { path: "categories/cat-a" };
    const transaction = {
      get: vi.fn(async (reference: unknown) => {
        if (reference === productRef) {
          return createDocumentSnapshot({
            categoryId: "cat-a",
            createdAt: createTimestamp("2026-04-18T08:00:00.000Z"),
            deletedAt: null,
            description: "Fancy pin",
            images: [
              {
                displayPath: "products/HM-000012/display/img-001.webp",
                imageId: "img-001",
                isPrimary: false,
                sortOrder: 1,
                thumbnailPath: "products/HM-000012/thumb/img-001.webp"
              }
            ],
            isDeleted: false,
            name: "Fancy Pin",
            price: 3200,
            productId,
            qrCodeValue: productId,
            soldAt: null,
            status: "onDisplay",
            tagIds: [],
            updatedAt: createTimestamp("2026-04-18T10:00:00.000Z")
          });
        }

        if (reference === categoryRef) {
          return createDocumentSnapshot({ categoryId: "cat-a" });
        }

        throw new Error("Unexpected transaction reference");
      }),
      set: vi.fn()
    };
    const db = {
      collection: vi.fn((collectionName: string) => {
        if (collectionName === "products") {
          return {
            doc: vi.fn(() => productRef)
          };
        }

        if (collectionName === "categories") {
          return {
            doc: vi.fn(() => categoryRef)
          };
        }

        if (collectionName === "tags") {
          return {
            doc: vi.fn()
          };
        }

        throw new Error(`Unexpected collection ${collectionName}`);
      }),
      runTransaction: vi.fn(async (callback) => callback(transaction as never))
    };

    await expect(
      updateProduct(
        productId,
        {
          categoryId: "cat-a",
          description: "Fancy pin",
          name: "Fancy Pin",
          price: 3200,
          primaryImageId: "missing",
          soldCustomerId: null,
          status: "onDisplay",
          tagIds: []
        },
        {
          db: db as never
        }
      )
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      details: [
        {
          field: "primaryImageId"
        }
      ],
      statusCode: 400
    });

    expect(transaction.set).not.toHaveBeenCalled();
  });

  it("returns PRODUCT_NOT_FOUND when the product does not exist", async () => {
    const productId = "HM-000013";
    const productRef = { path: `products/${productId}` };
    const db = {
      collection: vi.fn((collectionName: string) => {
        if (collectionName === "products") {
          return {
            doc: vi.fn(() =>
              productRef
            )
          };
        }

        throw new Error(`Unexpected collection ${collectionName}`);
      }),
      runTransaction: vi.fn(async (callback) =>
        callback({
          get: vi.fn(async () =>
            createDocumentSnapshot(
              {
                productId
              },
              false
            )
          ),
          set: vi.fn()
        } as never)
      )
    };

    await expect(
      updateProduct(
        productId,
        {
          categoryId: "cat-a",
          description: "Fancy pin",
          name: "Fancy Pin",
          price: 3200,
          primaryImageId: null,
          soldCustomerId: null,
          status: "onDisplay",
          tagIds: []
        },
        {
          db: db as never
        }
      )
    ).rejects.toMatchObject({
      code: "PRODUCT_NOT_FOUND",
      message: "対象の商品が見つかりません。",
      statusCode: 404
    });
  });

  it("returns PRODUCT_DELETED when the product is logically deleted", async () => {
    const productId = "HM-000014";
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
                deletedAt: null,
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
                updatedAt: createTimestamp("2026-04-18T10:00:00.000Z")
              });
            }

            throw new Error("Unexpected transaction reference");
          }),
          set: vi.fn()
        } as never)
      )
    };

    await expect(
      updateProduct(
        productId,
        {
          categoryId: "cat-a",
          description: "Fancy pin",
          name: "Fancy Pin",
          price: 3200,
          primaryImageId: null,
          soldCustomerId: null,
          status: "onDisplay",
          tagIds: []
        },
        {
          db: db as never
        }
      )
    ).rejects.toMatchObject({
      code: "PRODUCT_DELETED",
      message: "対象の商品はすでに利用できません。",
      statusCode: 404
    });
  });
});
