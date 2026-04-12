import {
  connectAuthEmulator,
  getAuth,
  onIdTokenChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type User
} from "firebase/auth";
import { getFirebaseApp } from "./firebase-app";

let hasConnectedAuthEmulator = false;

function shouldUseFirebaseEmulators() {
  return import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true";
}

function getAuthEmulatorUrl(host: string) {
  return /^https?:\/\//.test(host) ? host : `http://${host}`;
}

function getFirebaseAuth() {
  const auth = getAuth(getFirebaseApp());
  const authEmulatorHost = import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_HOST;

  if (
    shouldUseFirebaseEmulators() &&
    authEmulatorHost &&
    !hasConnectedAuthEmulator
  ) {
    connectAuthEmulator(auth, getAuthEmulatorUrl(authEmulatorHost), {
      disableWarnings: true
    });
    hasConnectedAuthEmulator = true;
  }

  return auth;
}

export function subscribeToAuthChanges(
  callback: (user: User | null) => void
) {
  return onIdTokenChanged(getFirebaseAuth(), callback);
}

export function signInWithEmail(email: string, password: string) {
  return signInWithEmailAndPassword(getFirebaseAuth(), email, password);
}

export function sendPasswordReset(email: string) {
  return sendPasswordResetEmail(getFirebaseAuth(), email);
}

export function signOutUser() {
  return signOut(getFirebaseAuth());
}
