import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
// 👇 Sửa dòng dưới này: Thêm deleteDoc vào danh sách import
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    // ... (giữ nguyên config cũ của bạn) ...
    apiKey: "AIzaSyCKpkEF55M4sw0gvPd9wLBvMGWChrAv0DM",
    authDomain: "quanlyxaydung-cc893.firebaseapp.com",
    projectId: "quanlyxaydung-cc893",
    storageBucket: "quanlyxaydung-cc893.firebasestorage.app",
    messagingSenderId: "96930416829",
    appId: "1:96930416829:web:ab6ab70124accb6697cfd4",
    measurementId: "G-GYWX0RDFMZ"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

console.log("🔥 Firebase Connected");
// 👇 Sửa dòng cuối cùng: Thêm deleteDoc vào danh sách export
export { db, doc, getDoc, setDoc, collection, getDocs, updateDoc, deleteDoc };