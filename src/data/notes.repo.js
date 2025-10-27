import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDocs,
    limit,
    orderBy,
    query,
    serverTimestamp,
    updateDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db, ensureAuthUser, getCurrentUserId } from "../services/firebase.js";

const COLLECTION_NAME = "notes";

function notesCollection() {
    return collection(db, COLLECTION_NAME);
}

function normalizeTags(tagsInput) {
    if (!tagsInput) return [];
    let values = [];
    if (typeof tagsInput === "string") {
        values = tagsInput.split(",");
    } else if (Array.isArray(tagsInput)) {
        values = tagsInput.slice();
    } else {
        return [];
    }
    const normalized = new Set();
    values.forEach(value => {
        if (value == null) return;
        const tag = value.toString().trim().toLowerCase();
        if (tag) {
            normalized.add(tag);
        }
    });
    return Array.from(normalized);
}

export async function fetchGeneralNotes(limitValue = 50) {
    const fetchLimit = Math.max(limitValue * 3, 50);
    const notesQuery = query(
        notesCollection(),
        orderBy("createdAt", "desc"),
        limit(fetchLimit)
    );
    const snapshot = await getDocs(notesQuery);
    const notes = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
    return notes.filter(note => (note.type || 'general') === 'general').slice(0, limitValue);
}

export async function fetchAccountNotes(limitValue = 50) {
    const fetchLimit = Math.max(limitValue * 3, 50);
    const notesQuery = query(
        notesCollection(),
        orderBy("createdAt", "desc"),
        limit(fetchLimit)
    );
    const snapshot = await getDocs(notesQuery);
    const notes = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
    return notes.filter(note => (note.type || '').toLowerCase() === 'account').slice(0, limitValue);
}

export async function fetchAccountNotesFor(accountId, limitValue = 50) {
    if (!accountId) return [];
    const fetchLimit = Math.max(limitValue * 3, 50);
    const notesQuery = query(
        notesCollection(),
        orderBy("createdAt", "desc"),
        limit(fetchLimit)
    );
    const snapshot = await getDocs(notesQuery);
    const notes = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
    return notes
        .filter(note => (note.type || '').toLowerCase() === 'account' && note.accountId === accountId)
        .slice(0, limitValue);
}

export async function createAccountNote({ accountId, text }) {
    if (!accountId) {
        throw new Error('Cari kimliği zorunludur.');
    }
    if (!text || !text.trim()) {
        throw new Error('Not metni zorunludur.');
    }
    await ensureAuthUser().catch(() => null);
    const authorId = getCurrentUserId();
    const payload = {
        accountId,
        text: text.trim(),
        type: "account",
        createdAt: serverTimestamp(),
        updatedAt: null,
        authorId: authorId || null,
        tags: [],
        status: "open",
        completedAt: null,
        completedBy: null
    };
    const docRef = await addDoc(notesCollection(), payload);
    return { id: docRef.id, ...payload };
}

export async function createGeneralNote({ text, tags = [] }) {
    if (!text || !text.trim()) {
        throw new Error("Not metni zorunludur.");
    }
    await ensureAuthUser().catch(() => null);
    const authorId = getCurrentUserId();
    const payload = {
        text: text.trim(),
        type: "general",
        createdAt: serverTimestamp(),
        updatedAt: null,
        authorId: authorId || null,
        tags: normalizeTags(tags),
        status: "open",
        completedAt: null,
        completedBy: null
    };
    const docRef = await addDoc(notesCollection(), payload);
    return { id: docRef.id, ...payload };
}

export async function updateNote(noteId, { text, tags = [], authorId = null } = {}) {
    if (!noteId) {
        throw new Error("Not kimliği zorunludur.");
    }
    if (!text || !text.trim()) {
        throw new Error("Not metni zorunludur.");
    }
    const noteRef = doc(db, COLLECTION_NAME, noteId);
    const payload = {
        text: text.trim(),
        updatedAt: serverTimestamp(),
        tags: normalizeTags(tags)
    };
    if (authorId) {
        payload.authorId = authorId;
    }
    await updateDoc(noteRef, payload);
    return { id: noteId, ...payload };
}

export async function deleteNote(noteId) {
    if (!noteId) {
        throw new Error("Not kimliği zorunludur.");
    }
    const noteRef = doc(db, COLLECTION_NAME, noteId);
    await deleteDoc(noteRef);
}

export { normalizeTags };

export async function toggleNoteStatus(noteId, nextStatus = "open") {
    if (!noteId) {
        throw new Error("Not kimliği zorunludur.");
    }
    const normalizedStatus = nextStatus === "completed" ? "completed" : "open";
    await ensureAuthUser().catch(() => null);
    const userId = getCurrentUserId();
    const noteRef = doc(db, COLLECTION_NAME, noteId);
    const payload = {
        status: normalizedStatus,
        updatedAt: serverTimestamp()
    };
    if (normalizedStatus === "completed") {
        payload.completedAt = serverTimestamp();
        payload.completedBy = userId || null;
    } else {
        payload.completedAt = null;
        payload.completedBy = null;
    }
    await updateDoc(noteRef, payload);
    return { id: noteId, ...payload };
}
