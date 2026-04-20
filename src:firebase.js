// ─── STEP 1: Replace these values with your Firebase project config ───────────
// Get these from: Firebase Console → Project Settings → Your Apps → SDK setup
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDG54PZTmtTjM1Km_D_rWFgseTTAj9_0BM",
  authDomain: "ourwallet-9153b.firebaseapp.com",
  projectId: "ourwallet-9153b",
  storageBucket: "ourwallet-9153b.firebasestorage.app",
  messagingSenderId: "903163020259",
  appId: "1:903163020259:web:6dc6b8833a8f3b3a72d6d6",
  measurementId: "G-RLXZ5TJ1PL"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);


