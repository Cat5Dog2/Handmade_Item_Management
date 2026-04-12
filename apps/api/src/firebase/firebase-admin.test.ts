import { beforeEach, describe, expect, it, vi } from "vitest";

const getAppsMock = vi.hoisted(() => vi.fn());
const initializeAppMock = vi.hoisted(() => vi.fn());
const getAuthMock = vi.hoisted(() => vi.fn());
const verifyIdTokenMock = vi.hoisted(() => vi.fn());
const getFirestoreMock = vi.hoisted(() => vi.fn());
const getStorageMock = vi.hoisted(() => vi.fn());
const bucketMock = vi.hoisted(() => vi.fn());

vi.mock("firebase-admin/app", () => ({
  getApps: getAppsMock,
  initializeApp: initializeAppMock
}));

vi.mock("firebase-admin/auth", () => ({
  getAuth: getAuthMock
}));

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: getFirestoreMock
}));

vi.mock("firebase-admin/storage", () => ({
  getStorage: getStorageMock
}));

describe("firebase admin shared clients", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    process.env.FIREBASE_PROJECT_ID = "demo-project";
    process.env.FIREBASE_STORAGE_BUCKET = "demo-project.appspot.com";
    delete process.env.GOOGLE_CLOUD_PROJECT;
  });

  it("initializes firebase admin once and shares auth, firestore, and storage clients", async () => {
    const apps: unknown[] = [];
    const appInstance = {
      name: "default"
    };
    const firestoreDb = {
      type: "firestore"
    };
    const bucketInstance = {
      name: "demo-project.appspot.com"
    };
    const storageClient = {
      bucket: bucketMock
    };

    getAppsMock.mockImplementation(() => apps);
    initializeAppMock.mockImplementation(() => {
      apps.push(appInstance);
      return appInstance;
    });
    getAuthMock.mockReturnValue({
      verifyIdToken: verifyIdTokenMock
    });
    getFirestoreMock.mockReturnValue(firestoreDb);
    getStorageMock.mockReturnValue(storageClient);
    bucketMock.mockReturnValue(bucketInstance);
    verifyIdTokenMock.mockResolvedValue({
      uid: "uid-1"
    });

    const firebaseAdmin = await import("./firebase-admin.js");

    expect(firebaseAdmin.getFirebaseAdminApp()).toBe(appInstance);
    expect(firebaseAdmin.getFirebaseAdminApp()).toBe(appInstance);
    expect(initializeAppMock).toHaveBeenCalledTimes(1);
    expect(initializeAppMock).toHaveBeenCalledWith({
      projectId: "demo-project",
      storageBucket: "demo-project.appspot.com"
    });

    expect(firebaseAdmin.getFirestoreDb()).toBe(firestoreDb);
    expect(getFirestoreMock).toHaveBeenCalledWith(appInstance);

    expect(firebaseAdmin.getStorageBucket()).toBe(bucketInstance);
    expect(getStorageMock).toHaveBeenCalledWith(appInstance);
    expect(bucketMock).toHaveBeenCalledWith("demo-project.appspot.com");

    await expect(firebaseAdmin.verifyFirebaseIdToken("token")).resolves.toEqual({
      uid: "uid-1"
    });
    expect(getAuthMock).toHaveBeenCalledWith(appInstance);
    expect(verifyIdTokenMock).toHaveBeenCalledWith("token");
  });

  it("reuses an existing firebase admin app when one is already initialized", async () => {
    const appInstance = {
      name: "existing"
    };

    getAppsMock.mockReturnValue([appInstance]);

    const firebaseAdmin = await import("./firebase-admin.js");

    expect(firebaseAdmin.getFirebaseAdminApp()).toBe(appInstance);
    expect(initializeAppMock).not.toHaveBeenCalled();
  });
});
