import {
    addDoc,
    collection,
    getDocs,
    query,
    serverTimestamp,
    where
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db, ensureAuthUser, getCurrentUserId } from "../services/firebase.js";

const COLLECTION_NAME = "files";

function filesCollection() {
    return collection(db, COLLECTION_NAME);
}

export async function createInvoiceFileRecord({
    transactionId,
    accountId,
    storagePath,
    contentType,
    size,
    width = null,
    height = null,
    originalName = null
}) {
    if (!transactionId) {
        throw new Error("transactionId zorunludur.");
    }
    if (!storagePath) {
        throw new Error("storagePath zorunludur.");
    }

    await ensureAuthUser().catch(() => null);
    const createdBy = getCurrentUserId();

    const payload = {
        type: "invoice",
        transactionId,
        accountId: accountId || null,
        storagePath,
        contentType: contentType || null,
        size: size ?? null,
        width,
        height,
        originalName: originalName || null,
        createdAt: serverTimestamp(),
        createdBy: createdBy || null
    };

    const docRef = await addDoc(filesCollection(), payload);
    return { id: docRef.id, ...payload };
}

export async function listInvoiceFilesForTransaction(transactionId, limitValue = 20) {
    if (!transactionId) return [];

    const filesQuery = query(
        filesCollection(),
        where("type", "==", "invoice"),
        where("transactionId", "==", transactionId)
    );

    const snapshot = await getDocs(filesQuery);
    const files = snapshot.docs
        .map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
        .sort((a, b) => {
            const aTime = a.createdAt?.seconds || 0;
            const bTime = b.createdAt?.seconds || 0;
            return bTime - aTime;
        });
    return files.slice(0, limitValue);
}

export { filesCollection };
