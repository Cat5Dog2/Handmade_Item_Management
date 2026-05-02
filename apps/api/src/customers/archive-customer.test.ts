import { vi } from "vitest";
import {
  createDocumentSnapshot,
  createTimestamp
} from "../test/firestore-test-helpers";
import { archiveCustomer } from "./archive-customer";

describe("archiveCustomer", () => {
  it("archives a customer without touching sold product linkage", async () => {
    const now = createTimestamp("2026-04-24T10:00:00.000Z");
    const customerId = "cus_000001";
    const customerRef = { path: `customers/${customerId}` };
    const transaction = {
      get: vi.fn(async (reference: unknown) => {
        if (reference === customerRef) {
          return createDocumentSnapshot({
            ageGroup: "30s",
            archivedAt: null,
            createdAt: createTimestamp("2026-04-01T08:00:00.000Z"),
            customerId,
            customerStyle: "Natural",
            gender: "female",
            isArchived: false,
            memo: "First visit memo",
            name: "Hanako Handmade",
            normalizedName: "hanako handmade",
            snsAccounts: [],
            updatedAt: createTimestamp("2026-04-20T09:00:00.000Z")
          });
        }

        throw new Error("Unexpected transaction reference");
      }),
      set: vi.fn()
    };
    const db = {
      collection: vi.fn((collectionName: string) => {
        if (collectionName === "customers") {
          return {
            doc: vi.fn((inputCustomerId: string) => {
              if (inputCustomerId === customerId) {
                return customerRef;
              }

              throw new Error(`Unexpected customer ${inputCustomerId}`);
            })
          };
        }

        throw new Error(`Unexpected collection ${collectionName}`);
      }),
      runTransaction: vi.fn(async (callback) => callback(transaction as never))
    };

    await expect(
      archiveCustomer(customerId, {
        db: db as never,
        now: () => now as never
      })
    ).resolves.toEqual({
      customerId,
      archivedAt: "2026-04-24T10:00:00.000Z",
      updatedAt: "2026-04-24T10:00:00.000Z",
      didArchive: true
    });

    expect(transaction.set).toHaveBeenCalledTimes(1);

    const [calledReference, payload] = transaction.set.mock.calls[0];

    expect(calledReference).toBe(customerRef);
    expect(payload).toMatchObject({
      ageGroup: "30s",
      archivedAt: now,
      customerId,
      customerStyle: "Natural",
      gender: "female",
      isArchived: true,
      memo: "First visit memo",
      name: "Hanako Handmade",
      normalizedName: "hanako handmade",
      snsAccounts: [],
      updatedAt: now
    });
    expect(payload.createdAt.toDate().toISOString()).toBe(
      "2026-04-01T08:00:00.000Z"
    );
  });

  it("returns the current archived timestamps when the customer is already archived", async () => {
    const customerId = "cus_000010";
    const customerRef = { path: `customers/${customerId}` };
    const archivedAt = createTimestamp("2026-04-20T08:00:00.000Z");
    const updatedAt = createTimestamp("2026-04-20T08:00:00.000Z");
    const transaction = {
      get: vi.fn(async (reference: unknown) => {
        if (reference === customerRef) {
          return createDocumentSnapshot({
            ageGroup: null,
            archivedAt,
            createdAt: createTimestamp("2026-04-01T08:00:00.000Z"),
            customerId,
            customerStyle: null,
            gender: null,
            isArchived: true,
            memo: null,
            name: "Archived Customer",
            normalizedName: "archived customer",
            snsAccounts: [],
            updatedAt
          });
        }

        throw new Error("Unexpected transaction reference");
      }),
      set: vi.fn()
    };
    const db = {
      collection: vi.fn((collectionName: string) => {
        if (collectionName === "customers") {
          return {
            doc: vi.fn().mockReturnValue(customerRef)
          };
        }

        throw new Error(`Unexpected collection ${collectionName}`);
      }),
      runTransaction: vi.fn(async (callback) => callback(transaction as never))
    };

    await expect(
      archiveCustomer(customerId, {
        db: db as never
      })
    ).resolves.toEqual({
      customerId,
      archivedAt: "2026-04-20T08:00:00.000Z",
      updatedAt: "2026-04-20T08:00:00.000Z",
      didArchive: false
    });

    expect(transaction.set).not.toHaveBeenCalled();
  });

  it("returns CUSTOMER_NOT_FOUND when the customer does not exist", async () => {
    const customerId = "cus_999999";
    const customerRef = { path: `customers/${customerId}` };
    const transaction = {
      get: vi.fn(async () =>
        createDocumentSnapshot(
          {
            customerId
          },
          false
        )
      ),
      set: vi.fn()
    };
    const db = {
      collection: vi.fn((collectionName: string) => {
        if (collectionName === "customers") {
          return {
            doc: vi.fn().mockReturnValue(customerRef)
          };
        }

        throw new Error(`Unexpected collection ${collectionName}`);
      }),
      runTransaction: vi.fn(async (callback) => callback(transaction as never))
    };

    await expect(
      archiveCustomer(customerId, {
        db: db as never
      })
    ).rejects.toMatchObject({
      code: "CUSTOMER_NOT_FOUND",
      message: "指定した顧客が見つかりません。",
      statusCode: 404
    });

    expect(transaction.set).not.toHaveBeenCalled();
  });
});
