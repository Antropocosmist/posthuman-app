import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyB1rOehhgvjyqQMR7ZYs2dPDzOM76_5qyg",
    authDomain: "posthuman-app-55b32.firebaseapp.com",
    projectId: "posthuman-app-55b32",
    storageBucket: "posthuman-app-55b32.firebasestorage.app",
    messagingSenderId: "45773448168",
    appId: "1:45773448168:web:bae011428aeda4138f3a5d"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
