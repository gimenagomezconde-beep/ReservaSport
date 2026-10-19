
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";

import {
    getFirestore,
    connectFirestoreEmulator
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

import {
    getAuth,
    connectAuthEmulator
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyBQYPcgBU8q89HXOWXaurOCYJi9rgkkhQs",
    authDomain: "reservasport-7e292.firebaseapp.com",
    projectId: "reservasport-7e292",
    storageBucket: "reservasport-7e292.firebasestorage.app",
    messagingSenderId: "855947920162",
    appId: "1:855947920162:web:8d4b83738464cafae31b7b"
};

const app = initializeApp(firebaseConfig);

const db = getFirestore(app);
const auth = getAuth(app);

// Usar emuladores solamente en el equipo local.
const esLocal =
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1";

if (esLocal) {
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
    connectAuthEmulator(auth, "http://127.0.0.1:9099");
}

export { app, db, auth };
