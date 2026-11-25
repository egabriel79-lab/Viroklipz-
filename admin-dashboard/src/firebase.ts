import { initializeApp } from 'firebase/app';
import { GoogleAuthProvider, getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Configuración compartida con la base de datos Firestore de Viroklipz
const firebaseConfig = {
  projectId: 'nixi-18175',
  appId: '1:29678232559:web:b385c3491e30609ca74c1a',
  apiKey: 'AIzaSyDcg6DhxS0YF6aPsniGGGN4rYKFsQDwg2w',
  authDomain: 'nixi-18175.firebaseapp.com',
  firestoreDatabaseId: 'ai-studio-7fa9d191-669e-450e-a908-de7aaf9be995',
  storageBucket: 'nixi-18175.firebasestorage.app',
  messagingSenderId: '29678232559',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const googleProvider = new GoogleAuthProvider();

export const OWNER_EMAILS = ['egabriel79@gmail.com'];
