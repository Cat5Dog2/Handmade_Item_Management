import { Storage } from "@google-cloud/storage";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getStorageReadUrl } from "./storage-read-url";

const storageMock = vi.hoisted(() => {
  const file = vi.fn().mockReturnValue({
    getSignedUrl: vi.fn().mockResolvedValue([
      "https://example.com/emulator.webp"
    ])
  });
  const bucket = vi.fn().mockReturnValue({
    file
  });

  return {
    bucket,
    file
  };
});

vi.mock("@google-cloud/storage", () => ({
  Storage: vi.fn().mockImplementation(() => ({
    bucket: storageMock.bucket
  }))
}));

describe("getStorageReadUrl", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    delete process.env.FIREBASE_STORAGE_EMULATOR_HOST;
    delete process.env.VITE_FIREBASE_STORAGE_EMULATOR_HOST;
    delete process.env.FIREBASE_STORAGE_BUCKET;
    delete process.env.FIREBASE_PROJECT_ID;
    delete process.env.GOOGLE_CLOUD_PROJECT;
    vi.clearAllMocks();
  });

  it("uses the bucket signed URL when the storage emulator is disabled", async () => {
    const getSignedUrl = vi.fn().mockResolvedValue([
      "https://example.com/products/HM-000001/display/img-001.webp"
    ]);
    const bucket = {
      file: vi.fn().mockReturnValue({
        getSignedUrl
      })
    };
    const expiresAt = new Date("2026-04-18T10:00:00.000Z");

    await expect(
      getStorageReadUrl(bucket as never, "products/HM-000001/display/img-001.webp", expiresAt)
    ).resolves.toBe(
      "https://example.com/products/HM-000001/display/img-001.webp"
    );

    expect(bucket.file).toHaveBeenCalledWith(
      "products/HM-000001/display/img-001.webp"
    );
    expect(getSignedUrl).toHaveBeenCalledWith({
      action: "read",
      expires: expiresAt
    });
  });

  it("signs browser-accessible URLs for the storage emulator", async () => {
    process.env.FIREBASE_STORAGE_EMULATOR_HOST = "firebase-emulators:9199";
    process.env.VITE_FIREBASE_STORAGE_EMULATOR_HOST = "localhost:9199";
    process.env.FIREBASE_STORAGE_BUCKET =
      "handmade-item-management.firebasestorage.app";
    process.env.FIREBASE_PROJECT_ID = "handmade-item-management";

    const bucket = {
      file: vi.fn()
    };
    const expiresAt = new Date("2026-04-18T10:00:00.000Z");

    await expect(
      getStorageReadUrl(
        bucket as never,
        "products/HM-000003/display/img-001.webp",
        expiresAt
      )
    ).resolves.toBe("https://example.com/emulator.webp");

    expect(Storage).toHaveBeenCalledWith({
      apiEndpoint: "http://localhost:9199",
      projectId: "handmade-item-management"
    });
    expect(storageMock.bucket).toHaveBeenCalledWith(
      "handmade-item-management.firebasestorage.app"
    );
    expect(storageMock.file).toHaveBeenCalledWith(
      "products/HM-000003/display/img-001.webp"
    );
    expect(bucket.file).not.toHaveBeenCalled();
  });

  it("uses the bucket signed URL when NODE_ENV is production even if emulator env is set", async () => {
    process.env.NODE_ENV = "production";
    process.env.FIREBASE_STORAGE_EMULATOR_HOST = "firebase-emulators:9199";
    process.env.VITE_FIREBASE_STORAGE_EMULATOR_HOST = "localhost:9199";

    const getSignedUrl = vi.fn().mockResolvedValue([
      "https://example.com/production.webp"
    ]);
    const bucket = {
      file: vi.fn().mockReturnValue({
        getSignedUrl
      })
    };
    const expiresAt = new Date("2026-04-18T10:00:00.000Z");

    await expect(
      getStorageReadUrl(
        bucket as never,
        "products/HM-000004/display/img-001.webp",
        expiresAt
      )
    ).resolves.toBe("https://example.com/production.webp");

    expect(Storage).not.toHaveBeenCalled();
    expect(bucket.file).toHaveBeenCalledWith(
      "products/HM-000004/display/img-001.webp"
    );
    expect(getSignedUrl).toHaveBeenCalledWith({
      action: "read",
      expires: expiresAt
    });
  });
});
