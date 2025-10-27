import { collection, doc, getDoc, getDocs, limit, query, orderBy } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db } from "../services/firebase.js";

const COLLECTION_NAME = "islemler";

function transactionsCollection() {
    return collection(db, COLLECTION_NAME);
}

export function listTransactions() {
    return query(transactionsCollection(), orderBy("kayitTarihi", "desc"));
}

export async function fetchRecentTransactions(limitValue = 100) {
    const transactionsQuery = query(listTransactions(), limit(limitValue));
    const snapshot = await getDocs(transactionsQuery);
    return snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
}

export async function getTransaction(transactionId) {
    if (!transactionId) return null;
    const transactionRef = doc(db, COLLECTION_NAME, transactionId);
    const snapshot = await getDoc(transactionRef);
    if (!snapshot.exists()) return null;
    return { id: snapshot.id, ...snapshot.data() };
}

export function transactionDoc(transactionId) {
    return doc(db, COLLECTION_NAME, transactionId);
}
