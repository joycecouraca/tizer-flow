import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Suas credenciais (mantidas do seu exemplo)
const firebaseConfig = {
  apiKey: "AIzaSyAXzHCgk3u7_p0GNfjsfUWrwz6WTyJJqkg",
  authDomain: "tirzeflow.firebaseapp.com",
  projectId: "tirzeflow",
  storageBucket: "tirzeflow.firebasestorage.app",
  messagingSenderId: "99575407392",
  appId: "1:99575407392:web:cf8ff44f2092590e48ed45"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
