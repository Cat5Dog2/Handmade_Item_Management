import "../env";

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { getFirestoreDb } from "../firebase/firebase-admin";
import {
  assertProductStatusMigrationTargetSafety,
  migrateProductStatuses,
  resolveProductStatusMigrationMode,
  resolveProductStatusMigrationTarget,
  type ProductStatusMigrationTarget
} from "./product-status-migration";

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

function loadTargetEnv(target: ProductStatusMigrationTarget) {
  loadEnvFile(".env");

  if (target === "stg" || target === "demo") {
    loadEnvFile(`.env.${target}`);
  }
}

function formatProductIds(productIds: string[]) {
  const visibleProductIds = productIds.slice(0, 20);
  const hiddenCount = productIds.length - visibleProductIds.length;

  if (visibleProductIds.length === 0) {
    return "-";
  }

  return hiddenCount > 0
    ? `${visibleProductIds.join(", ")} ... +${hiddenCount}`
    : visibleProductIds.join(", ");
}

async function runProductStatusMigration() {
  const target = resolveProductStatusMigrationTarget();
  loadTargetEnv(target);

  const mode = resolveProductStatusMigrationMode();
  const runtime = assertProductStatusMigrationTargetSafety(target, mode);
  const db = getFirestoreDb();
  const result = await migrateProductStatuses(db, {
    mode
  });

  console.log(
    [
      "[product-status-migration]",
      `target=${target}`,
      `mode=${mode}`,
      runtime.projectId ? `project=${runtime.projectId}` : undefined
    ]
      .filter(Boolean)
      .join(" ")
  );

  for (const rule of result.rules) {
    console.log(
      [
        `[product-status-migration] ${rule.from} -> ${rule.to}`,
        `matched=${rule.matched}`,
        `updated=${rule.updated}`,
        `products=${formatProductIds(rule.productIds)}`
      ].join(" ")
    );
  }

  console.log(
    `[product-status-migration] finished matched=${result.totalMatched} updated=${result.totalUpdated}`
  );

  if (mode === "dry-run") {
    console.log(
      "[product-status-migration] dry-run only. Re-run with --execute and confirmation env to write changes."
    );
  }
}

runProductStatusMigration().catch((error: unknown) => {
  console.error("[product-status-migration] failed", error);
  process.exitCode = 1;
});
