import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

function getFirebaseApp() {
  const existingApp = getApps()[0];

  if (existingApp) {
    return existingApp;
  }

  const projectId =
    process.env.FIREBASE_PROJECT_ID ?? process.env.GOOGLE_CLOUD_PROJECT;

  return initializeApp(projectId ? { projectId } : undefined);
}

export async function verifyFirebaseIdToken(idToken: string) {
  return getAuth(getFirebaseApp()).verifyIdToken(idToken);
}
