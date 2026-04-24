import { vi } from "vitest";
import { createCustomer } from "./create-customer";

function createTimestamp(isoString: string) {
  return {
    toDate: () => new Date(isoString)
  };
}

function createDocumentSnapshot<T>(data: T, exists = true) {
  return {
    data: () => data,
    exists
  };
}

describe("createCustomer", () => {
  it("creates a customer with a generated customerId", async () => {
    const now = createTimestamp("2026-04-20T09:00:00.000Z");
    const counterRef = { path: "counters/customer" };
    const customerRef = { path: "customers/cus_000001" };
    const setMock = vi.fn();
    const getMock = vi.fn(async (reference: unknown) => {
      if (reference === counterRef) {
        return createDocumentSnapshot(
          {
            counterKey: "customer",
            currentValue: 0,
            updatedAt: createTimestamp("2026-04-19T00:00:00.000Z")
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
    const customerDocMock = vi.fn((customerId: string) => {
      if (customerId === "cus_000001") {
        return customerRef;
      }

      throw new Error(`Unexpected customer ${customerId}`);
    });
    const db = {
      collection: vi.fn((collectionName: string) => {
        if (collectionName === "customers") {
          return {
            doc: customerDocMock
          };
        }

        throw new Error(`Unexpected collection ${collectionName}`);
      }),
      doc: vi.fn().mockReturnValue(counterRef),
      runTransaction: vi.fn(async (callback) => callback(transaction as never))
    };

    const result = await createCustomer(
      {
        name: " Hanako Handmade ",
        gender: "",
        ageGroup: " 30代 ",
        customerStyle: " ナチュラル系 ",
        snsAccounts: [
          {
            platform: " Instagram ",
            accountName: " hanako_handmade ",
            url: " https://instagram.com/hanako_handmade ",
            note: "DM購入あり\r\nメモ"
          }
        ],
        memo: " 初回来店\r\nメモ "
      },
      {
        db: db as never,
        now: () => now as never
      }
    );

    expect(result).toEqual({
      customerId: "cus_000001",
      createdAt: "2026-04-20T09:00:00.000Z",
      updatedAt: "2026-04-20T09:00:00.000Z"
    });
    expect(db.doc).toHaveBeenCalledWith("counters/customer");
    expect(customerDocMock).toHaveBeenCalledWith("cus_000001");
    expect(setMock).toHaveBeenNthCalledWith(1, counterRef, {
      counterKey: "customer",
      currentValue: 1,
      updatedAt: now
    });
    expect(setMock).toHaveBeenNthCalledWith(2, customerRef, {
      customerId: "cus_000001",
      name: "Hanako Handmade",
      normalizedName: "hanako handmade",
      gender: null,
      ageGroup: "30代",
      customerStyle: "ナチュラル系",
      snsAccounts: [
        {
          platform: "Instagram",
          accountName: "hanako_handmade",
          url: "https://instagram.com/hanako_handmade",
          note: "DM購入あり\nメモ"
        }
      ],
      memo: " 初回来店\nメモ ",
      isArchived: false,
      archivedAt: null,
      createdAt: now,
      updatedAt: now
    });
  });

  it("increments the existing customer counter without reusing ids", async () => {
    const now = createTimestamp("2026-04-20T10:00:00.000Z");
    const counterRef = { path: "counters/customer" };
    const customerRef = { path: "customers/cus_000042" };
    const transaction = {
      get: vi.fn(async (reference: unknown) => {
        if (reference === counterRef) {
          return createDocumentSnapshot({
            counterKey: "customer",
            currentValue: 41,
            updatedAt: createTimestamp("2026-04-19T00:00:00.000Z")
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
      doc: vi.fn().mockReturnValue(counterRef),
      runTransaction: vi.fn(async (callback) => callback(transaction as never))
    };

    await expect(
      createCustomer(
        {
          name: "山田 花子"
        },
        {
          db: db as never,
          now: () => now as never
        }
      )
    ).resolves.toEqual({
      customerId: "cus_000042",
      createdAt: "2026-04-20T10:00:00.000Z",
      updatedAt: "2026-04-20T10:00:00.000Z"
    });
  });

  it("returns validation details for invalid input", async () => {
    await expect(
      createCustomer({
        name: "   "
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
});
