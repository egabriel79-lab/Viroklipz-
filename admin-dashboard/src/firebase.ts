import { initializeApp } from 'firebase/app';
import { GoogleAuthProvider, getAuth } from 'firebase/auth';
import { getFirestore, initializeFirestore, type Firestore } from 'firebase/firestore';

const firebaseConfig = {
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'nixi-18175',
  appId:
    import.meta.env.VITE_FIREBASE_APP_ID ||
    '1:29678232559:web:b385c3491e30609ca74c1a',
  apiKey:
    import.meta.env.VITE_FIREBASE_API_KEY ||
    'AIzaSyDcg6DhxS0YF6aPsniGGGN4rYKFsQDwg2w',
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'nixi-18175.firebaseapp.com',
  firestoreDatabaseId:
    import.meta.env.VITE_FIREBASE_DATABASE_ID ||
    'ai-studio-7fa9d191-669e-450e-a908-de7aaf9be995',
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'nixi-18175.firebasestorage.app',
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '29678232559',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

function createResilientFirestore(): Firestore {
  try {
    return initializeFirestore(
      app,
      { experimentalForceLongPolling: true },
      firebaseConfig.firestoreDatabaseId,
    );
  } catch {
    return getFirestore(app, firebaseConfig.firestoreDatabaseId);
  }
}

export const db = createResilientFirestore();

const rawOwnerEmails = String(
  import.meta.env.VITE_OWNER_EMAILS || 'egabriel79@gmail.com',
);
export const OWNER_EMAILS = rawOwnerEmails
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);
