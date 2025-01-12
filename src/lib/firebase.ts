import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDlmPW0gDy3U1wP_TGYyyQKkzd-eapVFsg",
  authDomain: "devconnect-30ce9.firebaseapp.com",
  projectId: "devconnect-30ce9",
  storageBucket: "devconnect-30ce9.firebasestorage.app",
  messagingSenderId: "301099853727",
  appId: "1:301099853727:web:f15e9f2cbb4a8b72c53faa",
  measurementId: "G-T94M0WQFWG"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);