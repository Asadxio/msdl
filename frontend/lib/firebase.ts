import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, initializeFirestore, type Firestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import * as FirebaseAuth from 'firebase/auth';
import type { Auth, Persistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyDFk_Cc6yEIROJ60vq0VtyFx0qd4YUeqxQ",
  authDomain: "madrasa-app-50d6c.firebaseapp.com",
  projectId: "madrasa-app-50d6c",
  storageBucket: "madrasa-app-50d6c.firebasestorage.app",
  messagingSenderId: "675123731963",
  appId: "1:675123731963:web:2b892063276a7c452cbf5e",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
let db: Firestore;
try {
  db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
  });
} catch {
  db = getFirestore(app);
}

let auth: Auth;
try {
  const getReactNativePersistence = (FirebaseAuth as any).getReactNativePersistence as
    | ((storage: typeof AsyncStorage) => Persistence)
    | undefined;
  auth = FirebaseAuth.initializeAuth(app, getReactNativePersistence ? {
    persistence: getReactNativePersistence(AsyncStorage),
  } : undefined);
} catch {
  auth = FirebaseAuth.getAuth(app);
}

export { db, auth };
export const storage = getStorage(app);
