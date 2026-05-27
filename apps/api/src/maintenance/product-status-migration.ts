export type ProductStatusMigrationTarget = "emulator" | "stg" | "demo" | "prod";
export type ProductStatusMigrationMode = "dry-run" | "execute";

type MigrationEnv = Record<string, string | undefined>;

interface ProductStatusMigrationRuntime {
  projectId: string | undefined;
}

interface ProductStatusMigrationOptions {
  mode: ProductStatusMigrationMode;
}

interface ProductSnapshotLike {
  data(): {
    productId?: string;
    status?: string;
  };
  id: string;
  ref: unknown;
}

interface QuerySnapshotLike {
  docs: ProductSnapshotLike[];
}

interface ProductQueryLike {
  get(): Promise<QuerySnapshotLike>;
}

interface ProductCollectionLike {
  where(fieldPath: string, opStr: string, value: unknown): ProductQueryLike;
}

interface WriteBatchLike {
  commit(): Promise<unknown>;
  update(documentRef: unknown, data: unknown): void;
}

export interface ProductStatusMigrationFirestore {
  batch(): WriteBatchLike;
  collection(collectionPath: "products"): ProductCollectionLike;
}

interface ProductStatusMigrationRule {
  from: string;
  to: string;
}

export interface ProductStatusMigrationRuleResult extends ProductStatusMigrationRule {
  productIds: string[];
  matched: number;
  updated: number;
}

export interface ProductStatusMigrationResult {
  mode: ProductStatusMigrationMode;
  rules: ProductStatusMigrationRuleResult[];
  totalMatched: number;
  totalUpdated: number;
}

const PRODUCT_STATUS_MIGRATION_RULES: ProductStatusMigrationRule[] = [
  {
    from: "beforeProduction",
    to: "inProduction"
  },
  {
    from: "onDisplay",
    to: "consignmentSale"
  }
];
const BATCH_WRITE_LIMIT = 400;
const PRODUCT_STATUS_MIGRATION_TARGETS = [
  "emulator",
  "stg",
  "demo",
  "prod"
] as const satisfies ProductStatusMigrationTarget[];
const PRODUCT_STATUS_MIGRATION_CONFIRM_ENV_NAMES = {
  demo: "PRODUCT_STATUS_MIGRATION_DEMO_CONFIRM",
  prod: "PRODUCT_STATUS_MIGRATION_PROD_CONFIRM",
  stg: "PRODUCT_STATUS_MIGRATION_STG_CONFIRM"
} as const satisfies Record<
  Exclude<ProductStatusMigrationTarget, "emulator">,
  string
>;

function isProductStatusMigrationTarget(
  target: string
): target is ProductStatusMigrationTarget {
  return PRODUCT_STATUS_MIGRATION_TARGETS.includes(
    target as ProductStatusMigrationTarget
  );
}

function optionalEnvValue(value: string | undefined) {
  const trimmedValue = value?.trim();

  return trimmedValue ? trimmedValue : undefined;
}

function parseArgValue(args: string[], name: string) {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const prefix = `--${name}=`;

    if (arg === `--${name}`) {
      return args[index + 1];
    }

    if (arg.startsWith(prefix)) {
      return arg.slice(prefix.length);
    }
  }

  return undefined;
}

export function resolveProductStatusMigrationTarget(
  args = process.argv.slice(2),
  env: MigrationEnv = process.env
): ProductStatusMigrationTarget {
  const rawTarget =
    optionalEnvValue(parseArgValue(args, "target")) ??
    optionalEnvValue(env.PRODUCT_STATUS_MIGRATION_TARGET);
  const target = rawTarget?.toLowerCase() ?? "emulator";

  if (isProductStatusMigrationTarget(target)) {
    return target;
  }

  throw new Error(
    "PRODUCT_STATUS_MIGRATION_TARGET must be either 'emulator', 'stg', 'demo', or 'prod'."
  );
}

export function resolveProductStatusMigrationMode(
  args = process.argv.slice(2)
): ProductStatusMigrationMode {
  const hasExecute = args.includes("--execute");
  const hasDryRun = args.includes("--dry-run");

  if (hasExecute && hasDryRun) {
    throw new Error("Use either --dry-run or --execute, not both.");
  }

  return hasExecute ? "execute" : "dry-run";
}

export function assertProductStatusMigrationTargetSafety(
  target: ProductStatusMigrationTarget,
  mode: ProductStatusMigrationMode,
  env: MigrationEnv = process.env
): ProductStatusMigrationRuntime {
  const firestoreEmulatorHost = optionalEnvValue(env.FIRESTORE_EMULATOR_HOST);
  const authEmulatorHost = optionalEnvValue(env.FIREBASE_AUTH_EMULATOR_HOST);
  const firebaseProjectId = optionalEnvValue(env.FIREBASE_PROJECT_ID);
  const projectId =
    firebaseProjectId ?? optionalEnvValue(env.GOOGLE_CLOUD_PROJECT);

  if (target === "emulator") {
    if (!firestoreEmulatorHost) {
      throw new Error(
        "Product status migration target 'emulator' requires FIRESTORE_EMULATOR_HOST."
      );
    }

    return {
      projectId
    };
  }

  if (firestoreEmulatorHost || authEmulatorHost) {
    throw new Error(
      `Product status migration target '${target}' must not use Firebase emulator environment variables.`
    );
  }

  if (!projectId) {
    throw new Error(
      `Product status migration target '${target}' requires FIREBASE_PROJECT_ID.`
    );
  }

  if (mode === "execute") {
    const confirmEnvName = PRODUCT_STATUS_MIGRATION_CONFIRM_ENV_NAMES[target];

    if (optionalEnvValue(env[confirmEnvName]) !== projectId) {
      throw new Error(
        `${confirmEnvName} must exactly match FIREBASE_PROJECT_ID for ${target} product status migration.`
      );
    }
  }

  return {
    projectId
  };
}

async function commitBatchIfNeeded(
  db: ProductStatusMigrationFirestore,
  batch: WriteBatchLike,
  operationCount: number,
  force = false
) {
  if (operationCount === 0 || (!force && operationCount < BATCH_WRITE_LIMIT)) {
    return {
      batch,
      operationCount
    };
  }

  await batch.commit();

  return {
    batch: db.batch(),
    operationCount: 0
  };
}

export async function migrateProductStatuses(
  db: ProductStatusMigrationFirestore,
  options: ProductStatusMigrationOptions
): Promise<ProductStatusMigrationResult> {
  const rules: ProductStatusMigrationRuleResult[] = [];
  let totalMatched = 0;
  let totalUpdated = 0;
  let batch = db.batch();
  let operationCount = 0;

  for (const rule of PRODUCT_STATUS_MIGRATION_RULES) {
    const snapshot = await db
      .collection("products")
      .where("status", "==", rule.from)
      .get();
    const productIds = snapshot.docs.map((doc) => {
      const product = doc.data();

      return product.productId ?? doc.id;
    });
    const matched = snapshot.docs.length;
    let updated = 0;

    totalMatched += matched;

    if (options.mode === "execute") {
      for (const doc of snapshot.docs) {
        batch.update(doc.ref, {
          status: rule.to
        });
        operationCount += 1;
        updated += 1;

        const committed = await commitBatchIfNeeded(db, batch, operationCount);
        batch = committed.batch;
        operationCount = committed.operationCount;
      }
    }

    totalUpdated += updated;
    rules.push({
      ...rule,
      matched,
      productIds,
      updated
    });
  }

  if (options.mode === "execute") {
    await commitBatchIfNeeded(db, batch, operationCount, true);
  }

  return {
    mode: options.mode,
    rules,
    totalMatched,
    totalUpdated
  };
}
