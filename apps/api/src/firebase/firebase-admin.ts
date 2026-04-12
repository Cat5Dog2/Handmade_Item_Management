import { getApps, initializeApp, type AppOptions } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

function getFirebaseAdminOptions(): AppOptions | undefined {
  const projectId =
    process.env.FIREBASE_PROJECT_ID ?? process.env.GOOGLE_CLOUD_PROJECT;
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;

  const options: AppOptions = {};

  if (projectId) {
    options.projectId = projectId;
  }

  if (storageBucket) {
    options.storageBucket = storageBucket;
  }

  return Object.keys(options).length > 0 ? options : undefined;
}

export function getFirebaseAdminApp() {
  const existingApp = getApps()[0];

  if (existingApp) {
    return existingApp;
  }

  return initializeApp(getFirebaseAdminOptions());
}

export function getFirebaseAuthClient() {
  return getAuth(getFirebaseAdminApp());
}

export function getFirestoreDb() {
  return getFirestore(getFirebaseAdminApp());
}

export function getStorageClient() {
  return getStorage(getFirebaseAdminApp());
}

export function getStorageBucket(bucketName = process.env.FIREBASE_STORAGE_BUCKET) {
  return getStorageClient().bucket(bucketName);
}

export async function verifyFirebaseIdToken(idToken: string) {
  return getFirebaseAuthClient().verifyIdToken(idToken);
}
