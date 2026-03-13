import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyCydydJqBzGlQi8ywpvCsx2UyGIyLhZXtY",
  authDomain: "smart-waste-davao.firebaseapp.com",
  databaseURL: "https://smart-waste-davao-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "smart-waste-davao",
  storageBucket: "smart-waste-davao.firebasestorage.app",
  messagingSenderId: "479420187394",
  appId: "1:479420187394:web:28f17f9caac5d96768781b",
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const firestore = getFirestore(app);
export const database = getDatabase(app);