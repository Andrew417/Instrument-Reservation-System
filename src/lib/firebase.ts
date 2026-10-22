import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Optional Firebase configuration fallback when config file is not provisioned
const metaEnv = (import.meta as any)?.env || {};
const firebaseConfig = {
  apiKey: metaEnv.VITE_FIREBASE_API_KEY || "mock-api-key",
  authDomain: metaEnv.VITE_FIREBASE_AUTH_DOMAIN || "mock.firebaseapp.com",
  projectId: metaEnv.VITE_FIREBASE_PROJECT_ID || "mock-project",
  storageBucket: metaEnv.VITE_FIREBASE_STORAGE_BUCKET || "mock.appspot.com",
  messagingSenderId: metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || "000000000000",
  appId: metaEnv.VITE_FIREBASE_APP_ID || "1:000000000000:web:mock",
};

export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
