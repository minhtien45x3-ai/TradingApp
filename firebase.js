import { initializeApp } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890",
    authDomain: "cacon-stock-journal.firebaseapp.com",
    projectId: "cacon-stock-journal",
    storageBucket: "cacon-stock-journal.appspot.com",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abcdef1234567890abcdef"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export { doc, getDoc, setDoc, collection, getDocs, updateDoc, deleteDoc };
