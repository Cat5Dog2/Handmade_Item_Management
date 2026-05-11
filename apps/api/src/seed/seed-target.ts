import { existsSync, statSync } from "node:fs";
import path from "node:path";

export type DemoSeedTarget = "emulator" | "stg";

type DemoSeedEnv = Record<string, string | undefined>;

interface SeedTargetRuntime {
  projectId: string | undefined;
  shouldSeedAuth: boolean;
}

function optionalEnvValue(value: string | undefined) {
  const trimmedValue = value?.trim();

  return trimmedValue ? trimmedValue : undefined;
}

function parseTargetArg(args: string[]) {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--target") {
      return args[index + 1];
    }

    if (arg.startsWith("--target=")) {
      return arg.slice("--target=".length);
    }
  }

  return undefined;
}

function isFile(filePath: string) {
  try {
    return existsSync(filePath) && statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function resolveCredentialCandidates(credentialsPath: string) {
  if (path.isAbsolute(credentialsPath)) {
    return [credentialsPath];
  }

  const repoRoot = path.resolve(__dirname, "..", "..", "..", "..");
  const initialCwd = optionalEnvValue(process.env.INIT_CWD);
  const candidateRoots = [initialCwd, repoRoot, process.cwd()].filter(
    (root): root is string => Boolean(root)
  );

  return [
    ...new Set(
      candidateRoots.map((root) => path.resolve(root, credentialsPath))
    )
  ];
}

function resolveApplicationDefaultCredentials(env: DemoSeedEnv) {
  const candidates = [
    optionalEnvValue(env.APPDATA)
      ? path.join(
          optionalEnvValue(env.APPDATA) ?? "",
          "gcloud",
          "application_default_credentials.json"
        )
      : undefined,
    optionalEnvValue(env.HOME)
      ? path.join(
          optionalEnvValue(env.HOME) ?? "",
          ".config",
          "gcloud",
          "application_default_credentials.json"
        )
      : undefined,
    optionalEnvValue(env.USERPROFILE)
      ? path.join(
          optionalEnvValue(env.USERPROFILE) ?? "",
          "AppData",
          "Roaming",
          "gcloud",
          "application_default_credentials.json"
        )
      : undefined
  ].filter((candidate): candidate is string => Boolean(candidate));

  return candidates.find(isFile);
}

function resolveGoogleApplicationCredentials(env: DemoSeedEnv) {
  const credentialsPath = optionalEnvValue(env.GOOGLE_APPLICATION_CREDENTIALS);

  if (!credentialsPath) {
    return;
  }

  const candidates = resolveCredentialCandidates(credentialsPath);
  const resolvedPath = candidates.find(isFile);

  if (!resolvedPath) {
    const applicationDefaultCredentials =
      resolveApplicationDefaultCredentials(env);

    if (applicationDefaultCredentials) {
      env.GOOGLE_APPLICATION_CREDENTIALS = applicationDefaultCredentials;
      return;
    }

    throw new Error(
      [
        "GOOGLE_APPLICATION_CREDENTIALS points to a missing service account file.",
        `value=${credentialsPath}`,
        `checked=${candidates.join(", ")}`,
        "Put the service account JSON there or run 'gcloud auth application-default login'."
      ].join(" ")
    );
  }

  env.GOOGLE_APPLICATION_CREDENTIALS = resolvedPath;
}

export function resolveDemoSeedTarget(
  args = process.argv.slice(2),
  env: DemoSeedEnv = process.env
): DemoSeedTarget {
  const rawTarget =
    optionalEnvValue(parseTargetArg(args)) ?? env.DEMO_SEED_TARGET;
  const target = optionalEnvValue(rawTarget)?.toLowerCase() ?? "emulator";

  if (target === "emulator" || target === "stg") {
    return target;
  }

  throw new Error("DEMO_SEED_TARGET must be either 'emulator' or 'stg'.");
}

export function assertDemoSeedTargetSafety(
  target: DemoSeedTarget,
  env: DemoSeedEnv = process.env
): SeedTargetRuntime {
  const firestoreEmulatorHost = optionalEnvValue(env.FIRESTORE_EMULATOR_HOST);
  const authEmulatorHost = optionalEnvValue(env.FIREBASE_AUTH_EMULATOR_HOST);
  const firebaseProjectId = optionalEnvValue(env.FIREBASE_PROJECT_ID);
  const projectId =
    firebaseProjectId ?? optionalEnvValue(env.GOOGLE_CLOUD_PROJECT);

  if (target === "emulator") {
    if (!firestoreEmulatorHost) {
      throw new Error(
        "DEMO seed target 'emulator' requires FIRESTORE_EMULATOR_HOST."
      );
    }

    return {
      projectId,
      shouldSeedAuth: Boolean(authEmulatorHost)
    };
  }

  if (firestoreEmulatorHost || authEmulatorHost) {
    throw new Error(
      "DEMO seed target 'stg' must not use Firebase emulator environment variables."
    );
  }

  if (!projectId) {
    throw new Error("DEMO seed target 'stg' requires FIREBASE_PROJECT_ID.");
  }

  if (!projectId.toLowerCase().includes("stg")) {
    throw new Error(
      "DEMO seed target 'stg' requires a FIREBASE_PROJECT_ID containing 'stg'."
    );
  }

  if (optionalEnvValue(env.DEMO_SEED_STG_CONFIRM) !== projectId) {
    throw new Error(
      "DEMO_SEED_STG_CONFIRM must exactly match FIREBASE_PROJECT_ID for stg seed."
    );
  }

  if (!optionalEnvValue(env.APP_OWNER_EMAIL)) {
    throw new Error("DEMO seed target 'stg' requires APP_OWNER_EMAIL.");
  }

  if (!optionalEnvValue(env.DEMO_OWNER_PASSWORD)) {
    throw new Error("DEMO seed target 'stg' requires DEMO_OWNER_PASSWORD.");
  }

  resolveGoogleApplicationCredentials(env);

  return {
    projectId,
    shouldSeedAuth: true
  };
}
