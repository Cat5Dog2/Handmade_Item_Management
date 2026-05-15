import "../env";

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { getFirestoreDb } from "../firebase/firebase-admin";
import {
  assertDemoSeedResetTargetSafety,
  resetDemoSeedData,
  resolveDemoSeedResetMode
} from "./demo-data-reset";
import {
  resolveDemoSeedTarget,
  type DemoSeedTarget
} from "./seed-target";

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

async function runDemoSeedReset() {
  const target = resolveDemoSeedTarget();
  loadTargetEnv(target);

  const mode = resolveDemoSeedResetMode();
  const runtime = assertDemoSeedResetTargetSafety(target, mode);
  const db = getFirestoreDb();
  const result = await resetDemoSeedData(db, {
    mode
  });

  console.log(
    [
      "[demo-seed-reset]",
      `target=${target}`,
      `mode=${mode}`,
      runtime.projectId ? `project=${runtime.projectId}` : undefined
    ]
      .filter(Boolean)
      .join(" ")
  );
  console.log(
    [
      "[demo-seed-reset] finished",
      `resetCount=${result.resetCount}`,
      `matched=${result.matched}`,
      `deleted=${result.deleted}`,
      `skippedMissing=${result.skippedMissing}`,
      `skippedUnsafe=${result.skippedUnsafe}`
    ].join(" ")
  );

  if (mode === "dry-run") {
    console.log(
      "[demo-seed-reset] dry-run only. Re-run with --execute and confirmation env to delete seed documents."
    );
  }
}

runDemoSeedReset().catch((error: unknown) => {
  console.error("[demo-seed-reset] failed", error);
  process.exitCode = 1;
});
