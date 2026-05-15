import "../env";

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Auth } from "firebase-admin/auth";
import type {
  DocumentData,
  Firestore,
  WriteBatch
} from "firebase-admin/firestore";
import dotenv from "dotenv";
import {
  DEFAULT_DEMO_OWNER_PASSWORD,
  buildDemoSeedData,
  resolveDemoSeedCount
} from "./demo-data";
import {
  assertDemoSeedTargetSafety,
  resolveDemoSeedTarget,
  type DemoSeedTarget
} from "./seed-target";
import {
  getFirebaseAuthClient,
  getFirestoreDb
} from "../firebase/firebase-admin";

interface SeedDocument {
  collectionPath: string;
  data: DocumentData;
  documentId: string;
}

interface CollectionSeedResult {
  created: number;
  skipped: number;
}

const FIRESTORE_RETRY_ATTEMPTS = 30;
const FIRESTORE_RETRY_DELAY_MS = 1_000;
const AUTH_RETRY_ATTEMPTS = 30;
const AUTH_RETRY_DELAY_MS = 1_000;
const BATCH_WRITE_LIMIT = 400;
const repoRoot = path.resolve(__dirname, "..", "..", "..", "..");

function loadEnvFile(fileName: string) {
  const envPath = path.join(repoRoot, fileName);

  if (!existsSync(envPath)) {
    return;
  }

  const parsed = dotenv.parse(readFileSync(envPath));

  for (const [key, value] of Object.entries(parsed)) {
    process.env[key] = value;
  }
}

function loadTargetEnv(target: DemoSeedTarget) {
  loadEnvFile(".env");

  if (target === "stg" || target === "demo") {
    loadEnvFile(`.env.${target}`);
  }
}

function sleep(milliseconds: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function isDemoSeedEnabled() {
  return process.env.DEMO_SEED_ENABLED?.trim().toLowerCase() !== "false";
}

function seedTargetLabel(target: DemoSeedTarget) {
  return target === "emulator" ? "Firebase Emulator" : `${target} Firebase`;
}

async function waitForFirestore(db: Firestore, target: DemoSeedTarget) {
  for (let attempt = 1; attempt <= FIRESTORE_RETRY_ATTEMPTS; attempt += 1) {
    try {
      await db.collection("demoSeeds").limit(1).get();
      return;
    } catch (error) {
      if (attempt === FIRESTORE_RETRY_ATTEMPTS) {
        throw error;
      }

      console.log(
        `[demo-seed] Waiting for ${seedTargetLabel(target)} Firestore (${attempt}/${FIRESTORE_RETRY_ATTEMPTS})`
      );
      await sleep(FIRESTORE_RETRY_DELAY_MS);
    }
  }
}

async function waitForAuth(auth: Auth, target: DemoSeedTarget) {
  for (let attempt = 1; attempt <= AUTH_RETRY_ATTEMPTS; attempt += 1) {
    try {
      await auth.listUsers(1);
      return;
    } catch (error) {
      if (attempt === AUTH_RETRY_ATTEMPTS) {
        throw error;
      }

      console.log(
        `[demo-seed] Waiting for ${seedTargetLabel(target)} Auth (${attempt}/${AUTH_RETRY_ATTEMPTS})`
      );
      await sleep(AUTH_RETRY_DELAY_MS);
    }
  }
}

function hasErrorCode(error: unknown, code: string) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === code
  );
}

async function ensureDemoOwnerUser(auth: Auth, target: DemoSeedTarget) {
  const email = process.env.APP_OWNER_EMAIL?.trim();

  if (!email) {
    console.log("[demo-seed] APP_OWNER_EMAIL is empty; auth user seed skipped");
    return;
  }

  try {
    await auth.getUserByEmail(email);
    console.log(`[demo-seed] Auth user already exists: ${email}`);
  } catch (error) {
    if (!hasErrorCode(error, "auth/user-not-found")) {
      throw error;
    }

    const password =
      process.env.DEMO_OWNER_PASSWORD?.trim() ||
      (target === "emulator" ? DEFAULT_DEMO_OWNER_PASSWORD : undefined);

    if (!password) {
      throw new Error(
        `DEMO_OWNER_PASSWORD is required to create ${target} auth user.`
      );
    }

    await auth.createUser({
      email,
      emailVerified: true,
      password
    });
    console.log(`[demo-seed] Auth user created: ${email}`);
  }
}

function createSeedDocuments(): SeedDocument[] {
  const count = resolveDemoSeedCount(process.env.DEMO_SEED_COUNT);
  const data = buildDemoSeedData(count);

  return [
    ...data.categories.map((category) => ({
      collectionPath: "categories",
      data: category,
      documentId: category.categoryId
    })),
    ...data.tags.map((tag) => ({
      collectionPath: "tags",
      data: tag,
      documentId: tag.tagId
    })),
    ...data.customers.map((customer) => ({
      collectionPath: "customers",
      data: customer,
      documentId: customer.customerId
    })),
    ...data.products.map((product) => ({
      collectionPath: "products",
      data: product,
      documentId: product.productId
    })),
    ...data.tasks.map((task) => ({
      collectionPath: "tasks",
      data: task,
      documentId: task.taskId
    })),
    {
      collectionPath: "demoSeeds",
      data: data.metadata,
      documentId: data.metadata.seedKey
    }
  ];
}

async function commitBatchIfNeeded(
  db: Firestore,
  batch: WriteBatch,
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

async function writeMissingDocuments(
  db: Firestore,
  documents: SeedDocument[]
): Promise<CollectionSeedResult> {
  let batch = db.batch();
  let operationCount = 0;
  let created = 0;
  let skipped = 0;

  for (const document of documents) {
    const reference = db
      .collection(document.collectionPath)
      .doc(document.documentId);
    const snapshot = await reference.get();

    if (snapshot.exists) {
      skipped += 1;
      continue;
    }

    batch.set(reference, document.data);
    operationCount += 1;
    created += 1;

    const committed = await commitBatchIfNeeded(db, batch, operationCount);
    batch = committed.batch;
    operationCount = committed.operationCount;
  }

  await commitBatchIfNeeded(db, batch, operationCount, true);

  return {
    created,
    skipped
  };
}

async function ensureCounters(db: Firestore) {
  const count = resolveDemoSeedCount(process.env.DEMO_SEED_COUNT);
  const now = new Date();

  await db.runTransaction(async (transaction) => {
    const productCounterRef = db.collection("counters").doc("product");
    const customerCounterRef = db.collection("counters").doc("customer");
    const [productCounter, customerCounter] = await Promise.all([
      transaction.get(productCounterRef),
      transaction.get(customerCounterRef)
    ]);
    const productCurrentValue = productCounter.exists
      ? Number(productCounter.data()?.currentValue ?? 0)
      : 0;
    const customerCurrentValue = customerCounter.exists
      ? Number(customerCounter.data()?.currentValue ?? 0)
      : 0;

    if (productCurrentValue < count) {
      transaction.set(productCounterRef, {
        counterKey: "product",
        currentValue: count,
        updatedAt: now
      });
    }

    if (customerCurrentValue < count) {
      transaction.set(customerCounterRef, {
        counterKey: "customer",
        currentValue: count,
        updatedAt: now
      });
    }
  });
}

async function seedDemoData() {
  if (!isDemoSeedEnabled()) {
    console.log("[demo-seed] DEMO_SEED_ENABLED=false; seed skipped");
    return;
  }

  const target = resolveDemoSeedTarget();
  loadTargetEnv(target);

  const runtime = assertDemoSeedTargetSafety(target);

  const db = getFirestoreDb();

  console.log(
    `[demo-seed] Target=${target}${runtime.projectId ? ` project=${runtime.projectId}` : ""}`
  );

  await waitForFirestore(db, target);

  if (runtime.shouldSeedAuth) {
    const auth = getFirebaseAuthClient();

    await waitForAuth(auth, target);
    await ensureDemoOwnerUser(auth, target);
  } else {
    console.log(
      "[demo-seed] FIREBASE_AUTH_EMULATOR_HOST is empty; auth user seed skipped"
    );
  }

  const result = await writeMissingDocuments(db, createSeedDocuments());
  await ensureCounters(db);

  console.log(
    `[demo-seed] Firestore seed finished. created=${result.created}, skipped=${result.skipped}`
  );
}

seedDemoData().catch((error: unknown) => {
  console.error("[demo-seed] Seed failed", error);
  process.exitCode = 1;
});
