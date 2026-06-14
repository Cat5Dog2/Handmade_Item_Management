import type { DemoSeedTarget } from "./seed-target";
import { buildDemoSeedData, resolveDemoSeedCount } from "./demo-data";

export type DemoSeedResetMode = "dry-run" | "execute";

type ResetEnv = Record<string, string | undefined>;

interface SnapshotLike {
  data(): Record<string, unknown> | undefined;
  exists: boolean;
  ref: unknown;
}

interface DocumentReferenceLike {
  get(): Promise<SnapshotLike>;
}

interface CollectionReferenceLike {
  doc(documentId: string): DocumentReferenceLike;
}

interface WriteBatchLike {
  commit(): Promise<unknown>;
  delete(documentRef: unknown): void;
}

export interface DemoSeedResetFirestore {
  batch(): WriteBatchLike;
  collection(collectionPath: string): CollectionReferenceLike;
}

interface ResetDocument {
  collectionPath: string;
  createRelatedDocuments?(
    data: Record<string, unknown> | undefined
  ): ResetDocument[];
  documentId: string;
  isSeedDocument(data: Record<string, unknown> | undefined): boolean;
}

export interface DemoSeedResetResult {
  deleted: number;
  matched: number;
  mode: DemoSeedResetMode;
  resetCount: number;
  skippedMissing: number;
  skippedUnsafe: number;
}

const BATCH_WRITE_LIMIT = 400;

function optionalEnvValue(value: string | undefined) {
  const trimmedValue = value?.trim();

  return trimmedValue ? trimmedValue : undefined;
}

export function resolveDemoSeedResetMode(
  args = process.argv.slice(2)
): DemoSeedResetMode {
  const hasExecute = args.includes("--execute");
  const hasDryRun = args.includes("--dry-run");

  if (hasExecute && hasDryRun) {
    throw new Error("Use either --dry-run or --execute, not both.");
  }

  return hasExecute ? "execute" : "dry-run";
}

export function assertDemoSeedResetTargetSafety(
  target: DemoSeedTarget,
  mode: DemoSeedResetMode,
  env: ResetEnv = process.env
) {
  const firestoreEmulatorHost = optionalEnvValue(env.FIRESTORE_EMULATOR_HOST);
  const authEmulatorHost = optionalEnvValue(env.FIREBASE_AUTH_EMULATOR_HOST);
  const firebaseProjectId = optionalEnvValue(env.FIREBASE_PROJECT_ID);
  const projectId =
    firebaseProjectId ?? optionalEnvValue(env.GOOGLE_CLOUD_PROJECT);

  if (target === "emulator") {
    if (!firestoreEmulatorHost) {
      throw new Error(
        "Demo seed reset target 'emulator' requires FIRESTORE_EMULATOR_HOST."
      );
    }

    return {
      projectId
    };
  }

  if (firestoreEmulatorHost || authEmulatorHost) {
    throw new Error(
      `Demo seed reset target '${target}' must not use Firebase emulator environment variables.`
    );
  }

  if (!projectId) {
    throw new Error(
      `Demo seed reset target '${target}' requires FIREBASE_PROJECT_ID.`
    );
  }

  if (mode === "execute") {
    const confirmEnvName =
      target === "demo"
        ? "DEMO_SEED_RESET_DEMO_CONFIRM"
        : "DEMO_SEED_RESET_STG_CONFIRM";

    if (optionalEnvValue(env[confirmEnvName]) !== projectId) {
      throw new Error(
        `${confirmEnvName} must exactly match FIREBASE_PROJECT_ID for ${target} demo seed reset.`
      );
    }
  }

  return {
    projectId
  };
}

function hasSeedName(prefix: string, currentName: string) {
  return (data: Record<string, unknown> | undefined) =>
    typeof data?.name === "string" &&
    (data.name === currentName || data.name.startsWith(prefix));
}

function createDocumentKey(document: Pick<ResetDocument, "collectionPath" | "documentId">) {
  return `${document.collectionPath}/${document.documentId}`;
}

function hasLegacyProductSeedFingerprint(
  productId: string,
  data: Record<string, unknown> | undefined
) {
  return (
    data?.name === "商品" &&
    data.productId === productId &&
    data.qrCodeValue === productId
  );
}

function hasProductSeedFingerprint(productId: string, currentName: string) {
  return (data: Record<string, unknown> | undefined) => {
    if (typeof data?.name !== "string") {
      return false;
    }

    if (data.productId === productId && data.name === currentName) {
      return true;
    }

    if (data.name.startsWith("Demo Handmade Item ")) {
      return true;
    }

    return hasLegacyProductSeedFingerprint(productId, data);
  };
}

function hasLegacyCategorySeedFingerprint(categoryId: string) {
  return (data: Record<string, unknown> | undefined) =>
    data?.categoryId === categoryId && data.name === "カテゴリ";
}

function hasLegacyTagSeedFingerprint(tagId: string) {
  return (data: Record<string, unknown> | undefined) =>
    data?.tagId === tagId && data.name === "タグ";
}

function hasCustomerSeedFingerprint(customerId: string, currentName: string) {
  return (data: Record<string, unknown> | undefined) => {
    if (data?.customerId !== customerId) {
      return false;
    }

    return (
      data.name === currentName ||
      (typeof data.name === "string" &&
        data.name.startsWith("Demo Customer ")) ||
      data.name === "わし"
    );
  };
}

function createLegacyProductRelatedDocuments(
  data: Record<string, unknown> | undefined
): ResetDocument[] {
  const categoryId =
    typeof data?.categoryId === "string" ? data.categoryId : undefined;
  const tagIds = Array.isArray(data?.tagIds)
    ? data.tagIds.filter((tagId): tagId is string => typeof tagId === "string")
    : [];

  return [
    categoryId
      ? {
          collectionPath: "categories",
          documentId: categoryId,
          isSeedDocument: hasLegacyCategorySeedFingerprint(categoryId)
        }
      : undefined,
    ...tagIds.map((tagId) => ({
      collectionPath: "tags",
      documentId: tagId,
      isSeedDocument: hasLegacyTagSeedFingerprint(tagId)
    }))
  ].filter((document): document is ResetDocument => Boolean(document));
}

function createResetDocuments(count: number): ResetDocument[] {
  const data = buildDemoSeedData(count);

  return [
    ...data.categories.map((category) => ({
      collectionPath: "categories",
      documentId: category.categoryId,
      isSeedDocument: hasSeedName("Demo Category ", category.name)
    })),
    ...data.tags.map((tag) => ({
      collectionPath: "tags",
      documentId: tag.tagId,
      isSeedDocument: hasSeedName("Demo Tag ", tag.name)
    })),
    ...data.customers.map((customer) => ({
      collectionPath: "customers",
      documentId: customer.customerId,
      isSeedDocument: hasCustomerSeedFingerprint(
        customer.customerId,
        customer.name
      )
    })),
    ...data.products.map((product) => ({
      collectionPath: "products",
      createRelatedDocuments: (
        documentData: Record<string, unknown> | undefined
      ) =>
        hasLegacyProductSeedFingerprint(product.productId, documentData)
          ? createLegacyProductRelatedDocuments(documentData)
          : [],
      documentId: product.productId,
      isSeedDocument: hasProductSeedFingerprint(product.productId, product.name)
    })),
    ...data.tasks.map((task) => ({
      collectionPath: "tasks",
      documentId: task.taskId,
      isSeedDocument: hasSeedName("Demo Task ", task.name)
    })),
    {
      collectionPath: "demoSeeds",
      documentId: data.metadata.seedKey,
      isSeedDocument: (documentData) =>
        documentData?.seedKey === data.metadata.seedKey
    }
  ];
}

async function commitBatchIfNeeded(
  db: DemoSeedResetFirestore,
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

async function resolveResetCount(db: DemoSeedResetFirestore, env: ResetEnv) {
  const envCount = resolveDemoSeedCount(env.DEMO_SEED_COUNT);
  const metadataSnapshot = await db
    .collection("demoSeeds")
    .doc("docker-demo-v1")
    .get();

  if (!metadataSnapshot.exists) {
    return envCount;
  }

  const metadata = metadataSnapshot.data();
  const metadataCounts = [
    metadata?.categories,
    metadata?.customers,
    metadata?.products,
    metadata?.tags,
    metadata?.tasks
  ]
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);

  return Math.max(envCount, ...metadataCounts);
}

export async function resetDemoSeedData(
  db: DemoSeedResetFirestore,
  options: {
    env?: ResetEnv;
    mode: DemoSeedResetMode;
  }
): Promise<DemoSeedResetResult> {
  const resetCount = await resolveResetCount(db, options.env ?? process.env);
  const documents = createResetDocuments(resetCount);
  const queuedDocumentKeys = new Set(documents.map(createDocumentKey));
  let batch = db.batch();
  let operationCount = 0;
  let deleted = 0;
  let matched = 0;
  let skippedMissing = 0;
  let skippedUnsafe = 0;

  for (let index = 0; index < documents.length; index += 1) {
    const document = documents[index];
    const reference = db
      .collection(document.collectionPath)
      .doc(document.documentId);
    const snapshot = await reference.get();

    if (!snapshot.exists) {
      skippedMissing += 1;
      continue;
    }

    const documentData = snapshot.data();

    if (!document.isSeedDocument(documentData)) {
      skippedUnsafe += 1;
      continue;
    }

    matched += 1;

    for (const relatedDocument of document.createRelatedDocuments?.(
      documentData
    ) ?? []) {
      const relatedDocumentKey = createDocumentKey(relatedDocument);

      if (queuedDocumentKeys.has(relatedDocumentKey)) {
        continue;
      }

      documents.push(relatedDocument);
      queuedDocumentKeys.add(relatedDocumentKey);
    }

    if (options.mode === "execute") {
      batch.delete(snapshot.ref);
      operationCount += 1;
      deleted += 1;

      const committed = await commitBatchIfNeeded(db, batch, operationCount);
      batch = committed.batch;
      operationCount = committed.operationCount;
    }
  }

  if (options.mode === "execute") {
    await commitBatchIfNeeded(db, batch, operationCount, true);
  }

  return {
    deleted,
    matched,
    mode: options.mode,
    resetCount,
    skippedMissing,
    skippedUnsafe
  };
}
