/**
 * MSLB Firebase Admin SDK Initialization
 *
 * Uses Application Default Credentials (ADC) in all environments.
 * - Local development: Firebase Emulator Suite / gcloud auth
 * - Production (Cloud Functions): Automatic service account credential
 *
 * DO NOT hard-code service account JSON here.
 * DO NOT commit credentials to Git.
 *
 * firebase-admin v14+ uses modular sub-package imports.
 * The monolithic `admin.firestore()`, `admin.auth()` etc. namespace was removed.
 */
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getMessaging } from "firebase-admin/messaging";
import { getStorage } from "firebase-admin/storage";

if (!getApps().length) {
  initializeApp({
    projectId: process.env.GCLOUD_PROJECT || process.env.FIREBASE_CONFIG ? undefined : "madrasa-app-50d6c",
  });
}

export const db = getFirestore();
export const auth = getAuth();
export const messaging = getMessaging();
export const storage = getStorage();
