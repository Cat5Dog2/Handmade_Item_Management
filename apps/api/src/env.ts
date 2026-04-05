import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

const workspaceRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(workspaceRoot, "..", "..");

const envFiles = [
  path.join(repoRoot, ".env"),
  path.join(workspaceRoot, ".env")
];

const initialEnvKeys = new Set(Object.keys(process.env));
const mergedEnv: Record<string, string> = {};

for (const envFile of envFiles) {
  if (!existsSync(envFile)) {
    continue;
  }

  const parsed = dotenv.parse(readFileSync(envFile));

  for (const [key, value] of Object.entries(parsed)) {
    mergedEnv[key] = value;
  }
}

for (const [key, value] of Object.entries(mergedEnv)) {
  if (initialEnvKeys.has(key) || process.env[key] !== undefined) {
    continue;
  }

  process.env[key] = value;
}
