import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, initializeFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDFk_Cc6yEIROJ60vq0VtyFx0qd4YUeqxQ",
  authDomain: "madrasa-app-50d6c.firebaseapp.com",
  projectId: "madrasa-app-50d6c",
  storageBucket: "madrasa-app-50d6c.firebasestorage.app",
  messagingSenderId: "675123731963",
  appId: "1:675123731963:web:2b892063276a7c452cbf5e",
};

let app;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

let db;
try {
  db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
  });
} catch {
  // Already initialized, get existing instance
  db = getFirestore(app);
}

export { db };
