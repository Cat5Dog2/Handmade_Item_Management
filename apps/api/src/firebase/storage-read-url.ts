import { Storage } from "@google-cloud/storage";

interface SignedUrlFile {
  getSignedUrl(options: { action: "read"; expires: Date }): Promise<[string]>;
}

interface SignedUrlBucket {
  name?: string;
  file(path: string): SignedUrlFile;
}

interface StorageLike {
  bucket(name: string): SignedUrlBucket;
}

interface StorageReadUrlOptions {
  emulatorSigningStorage?: StorageLike;
}

const DEFAULT_EMULATOR_PUBLIC_HOST = "localhost:9199";
const SIGNED_URL_ACTION = "read";

let cachedEmulatorSigningStorage: StorageLike | null = null;
let cachedEmulatorSigningStorageHost: string | null = null;

function isStorageEmulatorEnabled() {
  return (
    process.env.NODE_ENV !== "production" &&
    Boolean(process.env.FIREBASE_STORAGE_EMULATOR_HOST)
  );
}

function resolveBucketName(bucket: SignedUrlBucket) {
  return (
    bucket.name ??
    process.env.FIREBASE_STORAGE_BUCKET ??
    process.env.VITE_FIREBASE_STORAGE_BUCKET ??
    null
  );
}

function resolveEmulatorPublicHost() {
  return (
    process.env.VITE_FIREBASE_STORAGE_EMULATOR_HOST ??
    DEFAULT_EMULATOR_PUBLIC_HOST
  );
}

function getEmulatorSigningStorage() {
  const publicHost = resolveEmulatorPublicHost();

  if (
    !cachedEmulatorSigningStorage ||
    cachedEmulatorSigningStorageHost !== publicHost
  ) {
    cachedEmulatorSigningStorage = new Storage({
      apiEndpoint: `http://${publicHost}`,
      projectId: process.env.FIREBASE_PROJECT_ID ?? process.env.GOOGLE_CLOUD_PROJECT
    });
    cachedEmulatorSigningStorageHost = publicHost;
  }

  return cachedEmulatorSigningStorage;
}

export async function getStorageReadUrl(
  bucket: SignedUrlBucket,
  path: string,
  expiresAt: Date,
  options: StorageReadUrlOptions = {}
) {
  if (isStorageEmulatorEnabled()) {
    const bucketName = resolveBucketName(bucket);

    if (!bucketName) {
      throw new Error("FIREBASE_STORAGE_BUCKET is required for Storage URLs.");
    }

    const signingStorage =
      options.emulatorSigningStorage ?? getEmulatorSigningStorage();
    const [url] = await signingStorage
      .bucket(bucketName)
      .file(path)
      .getSignedUrl({
        action: SIGNED_URL_ACTION,
        expires: expiresAt
      });

    return url;
  }

  const [url] = await bucket.file(path).getSignedUrl({
    action: SIGNED_URL_ACTION,
    expires: expiresAt
  });

  return url;
}
