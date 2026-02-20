import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD658A0xdvdWqmpgHhlBy1JH1fjrkLnOts",
  authDomain: "expenseme.firebaseapp.com",
  projectId: "expenseme",
  storageBucket: "expenseme.firebasestorage.app",
  messagingSenderId: "488723545865",
  appId: "1:488723545865:web:fac8712603fcb76cf69dd8",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
