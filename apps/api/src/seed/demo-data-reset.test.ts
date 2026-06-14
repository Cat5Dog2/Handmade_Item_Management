import { describe, expect, it, vi } from "vitest";
import {
  assertDemoSeedResetTargetSafety,
  resetDemoSeedData,
  resolveDemoSeedResetMode
} from "./demo-data-reset";
import { buildDemoSeedData } from "./demo-data";

interface TestDocument {
  data?: Record<string, unknown>;
  exists: boolean;
}

function createDb(documents: Record<string, TestDocument>) {
  const batch = {
    commit: vi.fn(async () => undefined),
    delete: vi.fn()
  };
  const db = {
    batch: vi.fn(() => batch),
    collection: vi.fn((collectionPath: string) => ({
      doc: vi.fn((documentId: string) => ({
        get: vi.fn(async () => {
          const key = `${collectionPath}/${documentId}`;
          const document = documents[key] ?? {
            exists: false
          };

          return {
            data: () => document.data,
            exists: document.exists,
            ref: {
              path: key
            }
          };
        })
      }))
    }))
  };

  return {
    batch,
    db
  };
}

describe("demo seed reset target", () => {
  it("defaults to dry-run and requires Firestore Emulator for emulator target", () => {
    expect(resolveDemoSeedResetMode([])).toBe("dry-run");

    expect(() => {
      assertDemoSeedResetTargetSafety("emulator", "dry-run", {});
    }).toThrow("FIRESTORE_EMULATOR_HOST");

    expect(
      assertDemoSeedResetTargetSafety("emulator", "dry-run", {
        FIRESTORE_EMULATOR_HOST: "localhost:8081"
      })
    ).toEqual({
      projectId: undefined
    });
  });

  it("requires confirmation only when executing against stg or demo", () => {
    expect(resolveDemoSeedResetMode(["--execute"])).toBe("execute");

    expect(
      assertDemoSeedResetTargetSafety("stg", "dry-run", {
        FIREBASE_PROJECT_ID: "example-stage-project"
      })
    ).toEqual({
      projectId: "example-stage-project"
    });

    expect(() => {
      assertDemoSeedResetTargetSafety("stg", "execute", {
        FIREBASE_PROJECT_ID: "example-stage-project"
      });
    }).toThrow("DEMO_SEED_RESET_STG_CONFIRM");

    expect(
      assertDemoSeedResetTargetSafety("demo", "execute", {
        DEMO_SEED_RESET_DEMO_CONFIRM: "example-demo-project",
        FIREBASE_PROJECT_ID: "example-demo-project"
      })
    ).toEqual({
      projectId: "example-demo-project"
    });
  });

  it("blocks real Firebase targets when emulator variables are configured", () => {
    expect(() => {
      assertDemoSeedResetTargetSafety("demo", "dry-run", {
        FIREBASE_PROJECT_ID: "example-demo-project",
        FIRESTORE_EMULATOR_HOST: "localhost:8081"
      });
    }).toThrow("must not use Firebase emulator");
  });
});

describe("resetDemoSeedData", () => {
  it("reports matching seed documents in dry-run without deleting", async () => {
    const seedData = buildDemoSeedData(1);
    const [category] = seedData.categories;
    const [tag] = seedData.tags;
    const [customer] = seedData.customers;
    const [product] = seedData.products;
    const [task] = seedData.tasks;
    const { batch, db } = createDb({
      "categories/cat_demo_001": {
        data: {
          categoryId: category.categoryId,
          name: category.name
        },
        exists: true
      },
      "customers/cus_000001": {
        data: {
          customerId: customer.customerId,
          name: customer.name
        },
        exists: true
      },
      "demoSeeds/docker-demo-v1": {
        data: {
          categories: 1,
          customers: 1,
          products: 1,
          seedKey: "docker-demo-v1",
          tags: 1,
          tasks: 1
        },
        exists: true
      },
      "products/HM-000001": {
        data: {
          name: product.name,
          productId: product.productId,
          qrCodeValue: product.qrCodeValue
        },
        exists: true
      },
      "tags/tag_demo_001": {
        data: {
          name: tag.name,
          tagId: tag.tagId
        },
        exists: true
      },
      "tasks/task_demo_001": {
        data: {
          name: task.name,
          taskId: task.taskId
        },
        exists: true
      }
    });

    await expect(
      resetDemoSeedData(db, {
        env: {
          DEMO_SEED_COUNT: "1"
        },
        mode: "dry-run"
      })
    ).resolves.toMatchObject({
      deleted: 0,
      matched: 6,
      mode: "dry-run",
      resetCount: 1
    });
    expect(batch.delete).not.toHaveBeenCalled();
    expect(batch.commit).not.toHaveBeenCalled();
  });

  it("deletes matching seed documents in execute mode", async () => {
    const { batch, db } = createDb({
      "categories/cat_demo_001": {
        data: {
          name: "Demo Category 01"
        },
        exists: true
      },
      "demoSeeds/docker-demo-v1": {
        data: {
          categories: 1,
          customers: 1,
          products: 1,
          seedKey: "docker-demo-v1",
          tags: 1,
          tasks: 1
        },
        exists: true
      },
      "products/HM-000001": {
        data: {
          name: "Demo Handmade Item 001"
        },
        exists: true
      }
    });

    await expect(
      resetDemoSeedData(db, {
        env: {
          DEMO_SEED_COUNT: "1"
        },
        mode: "execute"
      })
    ).resolves.toMatchObject({
      deleted: 3,
      matched: 3,
      mode: "execute",
      resetCount: 1
    });
    expect(batch.delete).toHaveBeenCalledTimes(3);
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });

  it("deletes legacy placeholder products generated by older seed data", async () => {
    const { batch, db } = createDb({
      "categories/cat_legacy": {
        data: {
          categoryId: "cat_legacy",
          name: "カテゴリ"
        },
        exists: true
      },
      "customers/cus_000001": {
        data: {
          customerId: "cus_000001",
          name: "わし"
        },
        exists: true
      },
      "demoSeeds/docker-demo-v1": {
        data: {
          categories: 1,
          customers: 1,
          products: 1,
          seedKey: "docker-demo-v1",
          tags: 1,
          tasks: 1
        },
        exists: true
      },
      "products/HM-000001": {
        data: {
          categoryId: "cat_legacy",
          name: "商品",
          productId: "HM-000001",
          qrCodeValue: "HM-000001",
          soldCustomerId: "cus_000001",
          tagIds: ["tag_legacy"]
        },
        exists: true
      },
      "tags/tag_legacy": {
        data: {
          name: "タグ",
          tagId: "tag_legacy"
        },
        exists: true
      }
    });

    await expect(
      resetDemoSeedData(db, {
        env: {
          DEMO_SEED_COUNT: "1"
        },
        mode: "execute"
      })
    ).resolves.toMatchObject({
      deleted: 5,
      matched: 5,
      mode: "execute",
      resetCount: 1
    });
    expect(batch.delete).toHaveBeenCalledTimes(5);
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });

  it("skips existing deterministic IDs when the document does not look like seed data", async () => {
    const { batch, db } = createDb({
      "categories/cat_demo_001": {
        data: {
          name: "Production Category"
        },
        exists: true
      },
      "demoSeeds/docker-demo-v1": {
        data: {
          categories: 1,
          customers: 1,
          products: 1,
          seedKey: "other-seed",
          tags: 1,
          tasks: 1
        },
        exists: true
      },
      "products/HM-000001": {
        data: {
          name: "Custom Product"
        },
        exists: true
      }
    });

    await expect(
      resetDemoSeedData(db, {
        env: {
          DEMO_SEED_COUNT: "1"
        },
        mode: "execute"
      })
    ).resolves.toMatchObject({
      deleted: 0,
      matched: 0,
      resetCount: 1,
      skippedUnsafe: 3
    });
    expect(batch.delete).not.toHaveBeenCalled();
    expect(batch.commit).not.toHaveBeenCalled();
  });
});
