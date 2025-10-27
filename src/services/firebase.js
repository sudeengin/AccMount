import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyAGdas38WmY06iqyt7cYVv6P4Q18riP3iU",
  authDomain: "accmount-b1a61.firebaseapp.com",
  projectId: "accmount-b1a61",
  storageBucket: "accmount-b1a61.appspot.com",
  messagingSenderId: "135195887185",
  appId: "1:135195887185:web:17f901e8c2356d1a8b5a70"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const storage = getStorage(app);

let resolveAuthReady;
let rejectAuthReady;
const authReadyPromise = new Promise((resolve, reject) => {
  resolveAuthReady = resolve;
  rejectAuthReady = reject;
});

onAuthStateChanged(
  auth,
  (user) => {
    if (user) {
      resolveAuthReady?.(user);
    }
  },
  (error) => {
    console.error("Anonim oturum izleme hatası:", error);
    rejectAuthReady?.(error);
  }
);

signInAnonymously(auth).catch(error => {
  console.error("Anonim oturum açma hatası:", error);
  rejectAuthReady?.(error);
});

const db = getFirestore(app);

function ensureAuthUser() {
  if (auth.currentUser) {
    return Promise.resolve(auth.currentUser);
  }
  return authReadyPromise.catch(() => auth.currentUser || null);
}

function getCurrentUserId() {
  return auth.currentUser ? auth.currentUser.uid : null;
}

export { db, auth, storage, ensureAuthUser, getCurrentUserId };
