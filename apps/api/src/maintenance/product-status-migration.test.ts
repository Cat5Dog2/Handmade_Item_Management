import { describe, expect, it, vi } from "vitest";
import {
  assertProductStatusMigrationTargetSafety,
  migrateProductStatuses,
  resolveProductStatusMigrationMode,
  resolveProductStatusMigrationTarget
} from "./product-status-migration";

function createSnapshot(id: string, status: string) {
  return {
    data: () => ({
      productId: id,
      status
    }),
    id,
    ref: {
      path: `products/${id}`
    }
  };
}

function createDb(docsByStatus: Record<string, ReturnType<typeof createSnapshot>[]>) {
  const batch = {
    commit: vi.fn(async () => undefined),
    update: vi.fn()
  };
  const where = vi.fn((fieldPath: string, opStr: string, value: string) => {
    if (fieldPath !== "status" || opStr !== "==") {
      throw new Error(`Unexpected query: ${fieldPath} ${opStr}`);
    }

    return {
      get: vi.fn(async () => ({
        docs: docsByStatus[value] ?? []
      }))
    };
  });
  const db = {
    batch: vi.fn(() => batch),
    collection: vi.fn((collectionPath: string) => {
      if (collectionPath !== "products") {
        throw new Error(`Unexpected collection: ${collectionPath}`);
      }

      return {
        where
      };
    })
  };

  return {
    batch,
    db,
    where
  };
}

describe("product status migration target", () => {
  it("defaults to emulator dry-run and requires Firestore Emulator", () => {
    expect(resolveProductStatusMigrationTarget([], {})).toBe("emulator");
    expect(resolveProductStatusMigrationMode([])).toBe("dry-run");

    expect(() => {
      assertProductStatusMigrationTargetSafety("emulator", "dry-run", {});
    }).toThrow("FIRESTORE_EMULATOR_HOST");

    expect(
      assertProductStatusMigrationTargetSafety("emulator", "dry-run", {
        FIRESTORE_EMULATOR_HOST: "localhost:8081"
      })
    ).toEqual({
      projectId: undefined
    });
  });

  it("requires confirmation only when executing against stg or demo", () => {
    expect(resolveProductStatusMigrationTarget(["--target=stg"], {})).toBe(
      "stg"
    );
    expect(resolveProductStatusMigrationMode(["--execute"])).toBe("execute");

    expect(
      assertProductStatusMigrationTargetSafety("stg", "dry-run", {
        FIREBASE_PROJECT_ID: "example-stg-project"
      })
    ).toEqual({
      projectId: "example-stg-project"
    });

    expect(() => {
      assertProductStatusMigrationTargetSafety("stg", "execute", {
        FIREBASE_PROJECT_ID: "example-stg-project"
      });
    }).toThrow("PRODUCT_STATUS_MIGRATION_STG_CONFIRM");

    expect(
      assertProductStatusMigrationTargetSafety("demo", "execute", {
        FIREBASE_PROJECT_ID: "example-demo-project",
        PRODUCT_STATUS_MIGRATION_DEMO_CONFIRM: "example-demo-project"
      })
    ).toEqual({
      projectId: "example-demo-project"
    });
  });

  it("blocks real Firebase targets when emulator variables are configured", () => {
    expect(() => {
      assertProductStatusMigrationTargetSafety("demo", "dry-run", {
        FIREBASE_PROJECT_ID: "example-demo-project",
        FIRESTORE_EMULATOR_HOST: "localhost:8081"
      });
    }).toThrow("must not use Firebase emulator");
  });
});

describe("migrateProductStatuses", () => {
  it("reports matching products in dry-run without writing", async () => {
    const { batch, db } = createDb({
      beforeProduction: [createSnapshot("HM-000001", "beforeProduction")],
      onDisplay: [createSnapshot("HM-000002", "onDisplay")]
    });

    await expect(
      migrateProductStatuses(db, {
        mode: "dry-run"
      })
    ).resolves.toMatchObject({
      mode: "dry-run",
      totalMatched: 2,
      totalUpdated: 0,
      rules: [
        {
          from: "beforeProduction",
          matched: 1,
          productIds: ["HM-000001"],
          to: "inProduction",
          updated: 0
        },
        {
          from: "onDisplay",
          matched: 1,
          productIds: ["HM-000002"],
          to: "consignmentSale",
          updated: 0
        }
      ]
    });
    expect(batch.update).not.toHaveBeenCalled();
    expect(batch.commit).not.toHaveBeenCalled();
  });

  it("updates only legacy status fields in execute mode", async () => {
    const beforeProduction = createSnapshot("HM-000001", "beforeProduction");
    const onDisplay = createSnapshot("HM-000002", "onDisplay");
    const { batch, db } = createDb({
      beforeProduction: [beforeProduction],
      onDisplay: [onDisplay]
    });

    await expect(
      migrateProductStatuses(db, {
        mode: "execute"
      })
    ).resolves.toMatchObject({
      totalMatched: 2,
      totalUpdated: 2
    });

    expect(batch.update).toHaveBeenCalledWith(beforeProduction.ref, {
      status: "inProduction"
    });
    expect(batch.update).toHaveBeenCalledWith(onDisplay.ref, {
      status: "consignmentSale"
    });
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });
});
