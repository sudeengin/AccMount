import { collection, doc, getDoc, getDocs, limit, orderBy, query } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db } from "../services/firebase.js";

const COLLECTION_NAME = "cariler";

function accountsCollection() {
    return collection(db, COLLECTION_NAME);
}

export function listAccounts() {
    return query(accountsCollection(), orderBy("unvan"));
}

export async function fetchRecentAccounts(limitValue = 50) {
    const fetchLimit = Math.max(limitValue, 50);
    const accountsQuery = query(accountsCollection(), orderBy("olusturmaTarihi", "desc"), limit(fetchLimit));
    const snapshot = await getDocs(accountsQuery);
    return snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
}

export async function getAccount(accountId) {
    if (!accountId) return null;
    const accountRef = doc(db, COLLECTION_NAME, accountId);
    const snapshot = await getDoc(accountRef);
    if (!snapshot.exists()) return null;
    return { id: snapshot.id, ...snapshot.data() };
}

export function accountDoc(accountId) {
    return doc(db, COLLECTION_NAME, accountId);
}
