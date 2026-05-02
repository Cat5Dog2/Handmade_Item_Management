import { vi } from "vitest";
import {
  createDocumentSnapshot,
  createTimestamp
} from "../test/firestore-test-helpers";
import { updateCustomer } from "./update-customer";

describe("updateCustomer", () => {
  it("updates a customer and returns changedFields for logging", async () => {
    const now = createTimestamp("2026-04-24T09:00:00.000Z");
    const customerId = "cus_000001";
    const customerRef = { path: `customers/${customerId}` };
    const transaction = {
      get: vi.fn(async (reference: unknown) => {
        if (reference === customerRef) {
          return createDocumentSnapshot({
            ageGroup: "20s",
            archivedAt: null,
            createdAt: createTimestamp("2026-04-01T08:00:00.000Z"),
            customerId,
            customerStyle: "Classic",
            gender: "female",
            isArchived: false,
            memo: "Old memo",
            name: "Hanako",
            normalizedName: "hanako",
            snsAccounts: [],
            updatedAt: createTimestamp("2026-04-10T10:00:00.000Z")
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
      updateCustomer(
        customerId,
        {
          name: " Hanako Handmade ",
          gender: "",
          ageGroup: " 30s ",
          customerStyle: " Natural ",
          snsAccounts: [
            {
              platform: " Instagram ",
              accountName: " hanako_handmade ",
              url: " https://instagram.com/hanako_handmade ",
              note: " DM ok "
            }
          ],
          memo: " New memo "
        },
        {
          db: db as never,
          now: () => now as never
        }
      )
    ).resolves.toEqual({
      customerId,
      updatedAt: "2026-04-24T09:00:00.000Z",
      changedFields: [
        "name",
        "gender",
        "ageGroup",
        "customerStyle",
        "snsAccounts",
        "memo"
      ]
    });

    expect(transaction.set).toHaveBeenCalledTimes(1);

    const [calledReference, payload] = transaction.set.mock.calls[0];

    expect(calledReference).toBe(customerRef);
    expect(payload).toMatchObject({
      ageGroup: "30s",
      archivedAt: null,
      customerId,
      customerStyle: "Natural",
      gender: null,
      isArchived: false,
      memo: " New memo ",
      name: "Hanako Handmade",
      normalizedName: "hanako handmade",
      snsAccounts: [
        {
          platform: "Instagram",
          accountName: "hanako_handmade",
          url: "https://instagram.com/hanako_handmade",
          note: " DM ok "
        }
      ]
    });
    expect(payload.createdAt).toEqual(expect.any(Object));
    expect(payload.createdAt.toDate().toISOString()).toBe(
      "2026-04-01T08:00:00.000Z"
    );
    expect(payload.updatedAt).toBe(now);
  });

  it("returns CUSTOMER_ARCHIVED when the customer is archived", async () => {
    const customerId = "cus_000010";
    const customerRef = { path: `customers/${customerId}` };
    const transaction = {
      get: vi.fn(async (reference: unknown) => {
        if (reference === customerRef) {
          return createDocumentSnapshot({
            ageGroup: null,
            archivedAt: createTimestamp("2026-04-20T08:00:00.000Z"),
            createdAt: createTimestamp("2026-04-01T08:00:00.000Z"),
            customerId,
            customerStyle: null,
            gender: null,
            isArchived: true,
            memo: null,
            name: "Archived Customer",
            normalizedName: "archived customer",
            snsAccounts: [],
            updatedAt: createTimestamp("2026-04-20T08:00:00.000Z")
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
      updateCustomer(
        customerId,
        {
          name: "Archived Customer"
        },
        {
          db: db as never
        }
      )
    ).rejects.toMatchObject({
      code: "CUSTOMER_ARCHIVED",
      statusCode: 400
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
      updateCustomer(
        customerId,
        {
          name: "Missing Customer"
        },
        {
          db: db as never
        }
      )
    ).rejects.toMatchObject({
      code: "CUSTOMER_NOT_FOUND",
      statusCode: 404
    });

    expect(transaction.set).not.toHaveBeenCalled();
  });

  it("returns validation details for invalid input", async () => {
    await expect(
      updateCustomer("cus_000001", {
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
