import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  assertDemoSeedTargetSafety,
  resolveDemoSeedTarget
} from "./seed-target";

describe("demo seed target", () => {
  it("defaults to emulator target and requires Firestore Emulator", () => {
    expect(resolveDemoSeedTarget([], {})).toBe("emulator");

    expect(() => {
      assertDemoSeedTargetSafety("emulator", {});
    }).toThrow("FIRESTORE_EMULATOR_HOST");

    expect(
      assertDemoSeedTargetSafety("emulator", {
        FIRESTORE_EMULATOR_HOST: "localhost:8081"
      })
    ).toEqual({
      projectId: undefined,
      shouldSeedAuth: false
    });
  });

  it("allows stg only when explicit confirmation and required values are present", () => {
    expect(resolveDemoSeedTarget(["--target=stg"], {})).toBe("stg");

    expect(
      assertDemoSeedTargetSafety("stg", {
        APP_OWNER_EMAIL: "owner@example.com",
        DEMO_OWNER_PASSWORD: "example-password",
        DEMO_SEED_STG_CONFIRM: "stg-handmade-item-management",
        FIREBASE_PROJECT_ID: "stg-handmade-item-management"
      })
    ).toEqual({
      projectId: "stg-handmade-item-management",
      shouldSeedAuth: true
    });
  });

  it("blocks stg seed when confirmation does not match the target project", () => {
    expect(() => {
      assertDemoSeedTargetSafety("stg", {
        APP_OWNER_EMAIL: "owner@example.com",
        DEMO_OWNER_PASSWORD: "example-password",
        DEMO_SEED_STG_CONFIRM: "other-project",
        FIREBASE_PROJECT_ID: "stg-handmade-item-management"
      });
    }).toThrow("DEMO_SEED_STG_CONFIRM");
  });

  it("blocks stg seed when emulator variables are still configured", () => {
    expect(() => {
      assertDemoSeedTargetSafety("stg", {
        APP_OWNER_EMAIL: "owner@example.com",
        DEMO_OWNER_PASSWORD: "example-password",
        DEMO_SEED_STG_CONFIRM: "stg-handmade-item-management",
        FIREBASE_AUTH_EMULATOR_HOST: "localhost:9099",
        FIREBASE_PROJECT_ID: "stg-handmade-item-management"
      });
    }).toThrow("must not use Firebase emulator");
  });

  it("resolves relative service account paths from the initial npm cwd", () => {
    const previousInitialCwd = process.env.INIT_CWD;
    const tempDir = mkdtempSync(path.join(os.tmpdir(), "demo-seed-"));
    const credentialsFile = path.join(tempDir, "service-account.json");
    const env = {
      APP_OWNER_EMAIL: "owner@example.com",
      DEMO_OWNER_PASSWORD: "example-password",
      DEMO_SEED_STG_CONFIRM: "stg-handmade-item-management",
      FIREBASE_PROJECT_ID: "stg-handmade-item-management",
      GOOGLE_APPLICATION_CREDENTIALS: "service-account.json"
    };

    try {
      process.env.INIT_CWD = tempDir;
      writeFileSync(credentialsFile, "{}");

      assertDemoSeedTargetSafety("stg", env);

      expect(env.GOOGLE_APPLICATION_CREDENTIALS).toBe(credentialsFile);
    } finally {
      if (previousInitialCwd === undefined) {
        delete process.env.INIT_CWD;
      } else {
        process.env.INIT_CWD = previousInitialCwd;
      }

      rmSync(tempDir, {
        force: true,
        recursive: true
      });
    }
  });

  it("uses application default credentials when configured service account file does not exist", () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), "demo-seed-adc-"));
    const adcDir = path.join(tempDir, "gcloud");
    const adcFile = path.join(adcDir, "application_default_credentials.json");
    const env = {
      APP_OWNER_EMAIL: "owner@example.com",
      APPDATA: tempDir,
      DEMO_OWNER_PASSWORD: "example-password",
      DEMO_SEED_STG_CONFIRM: "stg-handmade-item-management",
      FIREBASE_PROJECT_ID: "stg-handmade-item-management",
      GOOGLE_APPLICATION_CREDENTIALS: "missing-service-account.json"
    };

    try {
      mkdirSync(adcDir, { recursive: true });
      writeFileSync(adcFile, "{}");

      assertDemoSeedTargetSafety("stg", env);

      expect(env.GOOGLE_APPLICATION_CREDENTIALS).toBe(adcFile);
    } finally {
      rmSync(tempDir, {
        force: true,
        recursive: true
      });
    }
  });

  it("fails fast when a configured service account file does not exist", () => {
    expect(() => {
      assertDemoSeedTargetSafety("stg", {
        APP_OWNER_EMAIL: "owner@example.com",
        DEMO_OWNER_PASSWORD: "example-password",
        DEMO_SEED_STG_CONFIRM: "stg-handmade-item-management",
        FIREBASE_PROJECT_ID: "stg-handmade-item-management",
        GOOGLE_APPLICATION_CREDENTIALS: "missing-service-account.json"
      });
    }).toThrow("GOOGLE_APPLICATION_CREDENTIALS");
  });
});
