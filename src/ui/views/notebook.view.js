import {
    createGeneralNote,
    deleteNote,
    fetchGeneralNotes,
    updateNote,
    toggleNoteStatus as toggleNoteStatusRepo,
    normalizeTags as normalizeTagsFromRepo
} from "../../data/notes.repo.js";
import { ensureAuthUser, getCurrentUserId } from "../../services/firebase.js";

let currentRoot = null;
let currentDeps = {};
let mounted = false;

let textareaEl = null;
let saveButtonEl = null;
let statusEl = null;
let listEl = null;
let countEl = null;
let toastFn = null;
let tagsInputEl = null;
let filterBarEl = null;
let filterChipsEl = null;
let filterClearBtnEl = null;
let filterAllBtnEl = null;
let statusFilterBarEl = null;

let loadToken = 0;
let firstPaintPending = false;

const state = {
    notes: [],
    loading: false,
    saving: false,
    edit: {
        noteId: null,
        text: "",
        tagsText: "",
        originalTags: [],
        saving: false
    },
    deleteInProgressId: null,
    completeInProgressId: null,
    filterTag: "",
    filterStatus: "all"
};

function logError(error) {
    console.warn('[notebook:error]', error);
}

function logEditError(error) {
    console.warn('[notes:edit:error]', error);
}

function logDeleteError(error) {
    console.warn('[notes:delete:error]', error);
}

function logTagError(error) {
    console.warn('[notes:tag:error]', error);
}

function logCompleteError(error) {
    console.warn('[notes:complete:error]', error);
}

function startFirstPaint() {
    if (firstPaintPending) return;
    firstPaintPending = true;
    try {
        console.time('notebook:first-paint');
    } catch (error) {
        logError(error);
    }
}

function endFirstPaint() {
    if (!firstPaintPending) return;
    firstPaintPending = false;
    try {
        console.timeEnd('notebook:first-paint');
    } catch (error) {
        logError(error);
    }
}

function resolveTimestamp(value) {
    if (!value) return null;
    if (typeof value.toDate === 'function') return value.toDate();
    if (value.seconds) return new Date(value.seconds * 1000);
    if (value instanceof Date) return value;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatTimestamp(value) {
    const date = resolveTimestamp(value);
    if (!date) return 'Tarih yok';
    return date.toLocaleString('tr-TR', { dateStyle: 'long', timeStyle: 'short' });
}

function setStatus(message, { isError = false } = {}) {
    if (!statusEl) return;
    statusEl.textContent = message || '';
    if (isError) {
        statusEl.classList.add('text-red-500');
    } else {
        statusEl.classList.remove('text-red-500');
    }
}

function canModify(note) {
    const authorId = note?.authorId;
    if (!authorId) return true; // legacy notes without author metadata remain editable
    const currentUserId = getCurrentUserId();
    return Boolean(currentUserId && authorId === currentUserId);
}

function isEditing(noteId) {
    return state.edit.noteId === noteId;
}

function resetEditState() {
    state.edit.noteId = null;
    state.edit.text = "";
    state.edit.tagsText = "";
    state.edit.originalTags = [];
    state.edit.saving = false;
}

function normalizeTagsInput(input) {
    try {
        return normalizeTagsFromRepo(input);
    } catch (error) {
        logTagError(error);
        return [];
    }
}

function parseTagsFromText(value) {
    if (!value) return [];
    const raw = value.split(",");
    return normalizeTagsInput(raw);
}

function tagsToDisplay(tags) {
    return normalizeTagsInput(tags);
}

function tagsEqual(a = [], b = []) {
    const one = tagsToDisplay(a);
    const two = tagsToDisplay(b);
    if (one.length !== two.length) return false;
    return one.every((tag, index) => tag === two[index]);
}

function getChipClass(isActive) {
    const base = 'px-3 py-1 rounded-full text-xs font-semibold border transition';
    if (isActive) {
        return `${base} bg-indigo-600 text-white border-indigo-600`;
    }
    return `${base} bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600`;
}

function mapNotePayload(note = {}) {
    return {
        ...note,
        tags: tagsToDisplay(note.tags || []),
        status: (note.status === 'completed') ? 'completed' : 'open',
        completedAt: resolveTimestamp(note.completedAt) || null,
        completedBy: note.completedBy || null,
        createdAt: resolveTimestamp(note.createdAt) || null,
        updatedAt: resolveTimestamp(note.updatedAt) || null
    };
}

const relativeTimeFormatter = new Intl.RelativeTimeFormat('tr-TR', { numeric: 'auto' });

function formatRelativeTime(value) {
    const date = resolveTimestamp(value);
    if (!date) return '';
    const now = Date.now();
    let diffSeconds = Math.round((date.getTime() - now) / 1000);
    const units = [
        { unit: 'year', seconds: 31536000 },
        { unit: 'month', seconds: 2592000 },
        { unit: 'week', seconds: 604800 },
        { unit: 'day', seconds: 86400 },
        { unit: 'hour', seconds: 3600 },
        { unit: 'minute', seconds: 60 }
    ];
    for (const { unit, seconds } of units) {
        if (Math.abs(diffSeconds) >= seconds) {
            const value = Math.round(diffSeconds / seconds);
            return relativeTimeFormatter.format(value, unit);
        }
    }
    return relativeTimeFormatter.format(diffSeconds, 'second');
}

function getAvailableTags() {
    const allTags = new Set();
    state.notes.forEach(note => {
        tagsToDisplay(note.tags).forEach(tag => allTags.add(tag));
    });
    return Array.from(allTags).sort();
}

function applyTagFilter(notes) {
    const tag = state.filterTag;
    if (!tag) return notes.slice();
    return notes.filter(note => tagsToDisplay(note.tags).includes(tag));
}

function applyStatusFilter(notes) {
    const filter = state.filterStatus;
    if (!filter || filter === 'all') return notes.slice();
    return notes.filter(note => (note.status === filter));
}

function renderStatusFilter() {
    if (!statusFilterBarEl) return;
    statusFilterBarEl.classList.toggle('hidden', state.notes.length === 0);
    const buttons = statusFilterBarEl.querySelectorAll('button[data-status]');
    buttons.forEach(button => {
        const value = button.dataset.status || 'all';
        button.className = getChipClass(state.filterStatus === value);
    });
}

function setStatusFilter(value) {
    const normalized = value === 'completed' ? 'completed' : (value === 'open' ? 'open' : 'all');
    if (state.filterStatus === normalized) return;
    state.filterStatus = normalized;
    renderStatusFilter();
    renderNotes();
}

function handleStatusFilterClick(event) {
    const button = event.target.closest('button[data-status]');
    if (!button) return;
    event.preventDefault();
    setStatusFilter(button.dataset.status || 'all');
}

function renderTagFilter() {
    if (!filterBarEl || !filterChipsEl) return;
    const tags = getAvailableTags();
    filterBarEl.classList.toggle('hidden', tags.length === 0 && !state.filterTag);

    const fragment = document.createDocumentFragment();
    tags.forEach(tag => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.dataset.tag = tag;
        chip.className = getChipClass(state.filterTag === tag);
        chip.textContent = tag;
        fragment.appendChild(chip);
    });
    filterChipsEl.innerHTML = '';
    filterChipsEl.appendChild(fragment);

    if (filterClearBtnEl) {
        filterClearBtnEl.disabled = !state.filterTag;
    }
    if (filterAllBtnEl) {
        filterAllBtnEl.className = getChipClass(!state.filterTag);
    }
}

function setSelectedTag(tag) {
    const normalized = tag || '';
    if (state.filterTag === normalized) return;
    let timerStarted = false;
    try {
        console.time('notes:tag-apply');
        timerStarted = true;
    } catch (error) {
        logTagError(error);
    }
    state.filterTag = normalized;
    renderTagFilter();
    renderNotes();
    if (timerStarted) {
        try {
            console.timeEnd('notes:tag-apply');
        } catch (error) {
            logTagError(error);
        }
    }
}

async function handleNoteStatusToggle(noteId, nextStatus) {
    if (!noteId) return;
    const normalizedStatus = nextStatus === 'completed' ? 'completed' : 'open';
    const noteIndex = state.notes.findIndex(note => note.id === noteId);
    if (noteIndex === -1) return;

    const currentNote = state.notes[noteIndex];
    if ((currentNote.status || 'open') === normalizedStatus) return;

    const previousSnapshot = { ...currentNote };
    const currentUserId = getCurrentUserId();
    const optimisticNote = {
        ...currentNote,
        status: normalizedStatus,
        completedAt: normalizedStatus === 'completed' ? new Date() : null,
        completedBy: normalizedStatus === 'completed' ? (currentUserId || currentNote.completedBy || null) : null
    };

    state.notes.splice(noteIndex, 1, optimisticNote);
    state.completeInProgressId = noteId;
    renderNotes();

    let timerStarted = false;
    try {
        console.time('notes:complete-toggle');
        timerStarted = true;
    } catch (error) {
        logCompleteError(error);
    }

    const toggler = currentDeps.toggleNoteStatus || ((id, status) => toggleNoteStatusRepo(id, status));

    try {
        await toggler(noteId, normalizedStatus);
        if (typeof currentDeps.onNoteStatusChanged === 'function') {
            try {
                currentDeps.onNoteStatusChanged({ id: noteId, status: normalizedStatus });
            } catch (error) {
                logError(error);
            }
        }
        if (typeof toastFn === 'function') {
            toastFn(normalizedStatus === 'completed' ? 'Not tamamlandı.' : 'Not açık olarak işaretlendi.');
        }
        setStatus('');
        await loadNotes();
    } catch (error) {
        logCompleteError(error);
        setStatus(error?.message || 'Not durumu güncellenirken bir hata oluştu.', { isError: true });
        const revertIndex = state.notes.findIndex(note => note.id === noteId);
        if (revertIndex !== -1) {
            state.notes.splice(revertIndex, 1, previousSnapshot);
        }
        state.completeInProgressId = null;
        renderNotes();
    } finally {
        if (timerStarted) {
            try {
                console.timeEnd('notes:complete-toggle');
            } catch (error) {
                logCompleteError(error);
            }
        }
        state.completeInProgressId = null;
    }
}

function renderNotes() {
    if (!listEl) return;

    renderStatusFilter();
    renderTagFilter();
    listEl.innerHTML = '';

    if (state.loading) {
        listEl.innerHTML = '<p class="text-sm text-gray-500 dark:text-gray-400">Yükleniyor...</p>';
        return;
    }

    const filteredNotes = applyStatusFilter(applyTagFilter(state.notes));
    const totalCount = filteredNotes.length;

    if (countEl) {
        const suffixParts = [];
        if (state.filterStatus === 'open') suffixParts.push('Açık');
        if (state.filterStatus === 'completed') suffixParts.push('Tamamlanan');
        if (state.filterTag) suffixParts.push(`#${state.filterTag}`);
        const suffix = suffixParts.length ? ` (${suffixParts.join(', ')})` : '';
        countEl.textContent = `${totalCount} Not${suffix}`;
    }

    if (!state.notes.length) {
        listEl.innerHTML = '<p class="text-sm text-gray-500 dark:text-gray-400">Henüz not eklenmemiş.</p>';
        endFirstPaint();
        return;
    }

    if (!filteredNotes.length) {
        listEl.innerHTML = `<div class="p-4 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-500 dark:text-gray-400">
            Seçilen filtrelere uygun not bulunamadı.
            <button id="notebookFilterClearInline" class="ml-2 text-indigo-600 dark:text-indigo-300 font-semibold underline">Filtreyi temizle</button>
        </div>`;
        endFirstPaint();
        return;
    }

    const fragment = document.createDocumentFragment();

    filteredNotes.forEach(note => {
        const card = document.createElement('div');
        card.className = 'border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900/60 shadow-sm space-y-3';
        card.dataset.noteId = note.id || '';

        const noteStatus = note.status === 'completed' ? 'completed' : 'open';
        const isCompleted = noteStatus === 'completed';
        if (isCompleted) {
            card.classList.add('bg-green-50', 'dark:bg-green-900/30');
        }

        const header = document.createElement('div');
        header.className = 'flex items-start justify-between gap-3';

        const headerLeft = document.createElement('div');
        headerLeft.className = 'flex items-center gap-2';

        const titleEl = document.createElement('h3');
        titleEl.className = 'text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide';
        titleEl.textContent = 'Genel Not';
        headerLeft.appendChild(titleEl);

        if (isCompleted) {
            const badge = document.createElement('span');
            badge.className = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-200 text-green-800 dark:bg-green-900/60 dark:text-green-200 text-xs font-semibold';
            badge.textContent = '✓ Tamamlandı';
            headerLeft.appendChild(badge);
        }

        if (note.updatedAt) {
            const editedBadge = document.createElement('span');
            editedBadge.className = 'text-xs font-semibold text-indigo-600 dark:text-indigo-300';
            editedBadge.textContent = 'Güncellendi';
            editedBadge.title = formatTimestamp(note.updatedAt);
            headerLeft.appendChild(editedBadge);
        }

        const headerRight = document.createElement('div');
        headerRight.className = 'flex flex-col items-end gap-2';

        const timestampEl = document.createElement('span');
        timestampEl.className = 'text-xs text-gray-500 dark:text-gray-400';
        timestampEl.textContent = formatTimestamp(note.createdAt);
        headerRight.appendChild(timestampEl);

        const canEdit = canModify(note);
        const editing = isEditing(note.id);
        const noteTags = tagsToDisplay(note.tags);

        if (canEdit) {
            const actions = document.createElement('div');
            actions.className = 'flex items-center gap-2';

            const toggleBtn = document.createElement('button');
            toggleBtn.type = 'button';
            toggleBtn.dataset.action = 'toggle-note-status';
            toggleBtn.dataset.id = note.id || '';
            toggleBtn.dataset.nextStatus = isCompleted ? 'open' : 'completed';
            toggleBtn.className = isCompleted
                ? 'text-xs font-semibold text-green-700 dark:text-green-300 focus:outline-none disabled:opacity-50'
                : 'text-xs font-semibold text-green-600 hover:text-green-500 focus:outline-none disabled:opacity-50';
            toggleBtn.textContent = isCompleted ? 'Geri Al' : 'Tamamlandı';
            toggleBtn.disabled = state.deleteInProgressId === note.id || state.completeInProgressId === note.id || state.edit.saving || editing;
            actions.appendChild(toggleBtn);

            if (!editing) {
                const editBtn = document.createElement('button');
                editBtn.type = 'button';
                editBtn.dataset.action = 'edit-note';
                editBtn.dataset.id = note.id || '';
                editBtn.className = 'text-xs font-semibold text-indigo-600 hover:text-indigo-500 focus:outline-none disabled:opacity-50';
                editBtn.textContent = 'Düzenle';
                editBtn.disabled = state.deleteInProgressId === note.id;
                actions.appendChild(editBtn);
            }

            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.dataset.action = 'delete-note';
            deleteBtn.dataset.id = note.id || '';
            deleteBtn.className = 'text-xs font-semibold text-red-600 hover:text-red-500 focus:outline-none disabled:opacity-50';
            deleteBtn.textContent = state.deleteInProgressId === note.id ? 'Siliniyor...' : 'Sil';
            deleteBtn.disabled = state.deleteInProgressId === note.id || state.edit.saving;
            actions.appendChild(deleteBtn);

            headerRight.appendChild(actions);
        }

        header.appendChild(headerLeft);
        header.appendChild(headerRight);
        card.appendChild(header);

        if (editing) {
            const formWrapper = document.createElement('div');
            formWrapper.className = 'space-y-3';

            const textarea = document.createElement('textarea');
            textarea.className = 'note-edit-textarea w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-100 shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-h-[120px] p-2';
            textarea.value = state.edit.text;
            textarea.disabled = state.edit.saving;
            textarea.dataset.id = note.id || '';
            formWrapper.appendChild(textarea);

            const tagsLabel = document.createElement('label');
            tagsLabel.className = 'block text-xs font-semibold text-gray-600 dark:text-gray-300';
            tagsLabel.textContent = 'Etiketler (virgülle ayırın)';
            formWrapper.appendChild(tagsLabel);

            const tagInput = document.createElement('input');
            tagInput.type = 'text';
            tagInput.className = 'note-edit-tags w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-100 shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 p-2';
            tagInput.value = state.edit.tagsText;
            tagInput.disabled = state.edit.saving;
            tagInput.dataset.id = note.id || '';
            formWrapper.appendChild(tagInput);

            const actionRow = document.createElement('div');
            actionRow.className = 'flex items-center justify-end gap-2';

            const cancelBtn = document.createElement('button');
            cancelBtn.type = 'button';
            cancelBtn.dataset.action = 'cancel-edit-note';
            cancelBtn.dataset.id = note.id || '';
            cancelBtn.className = 'px-3 py-1 rounded-md bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs font-semibold focus:outline-none';
            cancelBtn.textContent = 'Vazgeç';
            cancelBtn.disabled = state.edit.saving;
            actionRow.appendChild(cancelBtn);

            const saveBtn = document.createElement('button');
            saveBtn.type = 'button';
            saveBtn.dataset.action = 'save-edit-note';
            saveBtn.dataset.id = note.id || '';
            saveBtn.className = 'px-3 py-1 rounded-md bg-indigo-600 text-white text-xs font-semibold focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed';
            saveBtn.textContent = state.edit.saving ? 'Kaydediliyor...' : 'Kaydet';
            const trimmed = state.edit.text.trim();
            const original = (note.text || '').trim();
            const editedTags = parseTagsFromText(state.edit.tagsText);
            const originalTags = state.edit.originalTags;
            const tagsChanged = !tagsEqual(originalTags, editedTags);
            const isDirty = (trimmed && trimmed !== original) || tagsChanged;
            saveBtn.disabled = state.edit.saving || !isDirty;
            actionRow.appendChild(saveBtn);

            formWrapper.appendChild(actionRow);
            card.appendChild(formWrapper);
        } else {
            const contentEl = document.createElement('p');
            contentEl.className = 'text-sm text-gray-800 dark:text-gray-100 whitespace-pre-wrap';
            contentEl.textContent = note.text || '';
            card.appendChild(contentEl);

            if (noteTags.length) {
                const tagsRow = document.createElement('div');
                tagsRow.className = 'flex flex-wrap gap-2';
                noteTags.forEach(tag => {
                    const chip = document.createElement('span');
                    chip.className = 'px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200 text-xs font-semibold cursor-pointer hover:bg-indigo-200 dark:hover:bg-indigo-800';
                    chip.dataset.action = 'apply-tag-filter';
                    chip.dataset.tag = tag;
                    chip.textContent = tag;
                    tagsRow.appendChild(chip);
                });
                card.appendChild(tagsRow);
            }

            if (isCompleted) {
                const info = document.createElement('p');
                info.className = 'text-xs text-green-700 dark:text-green-300';
                const relative = formatRelativeTime(note.completedAt || note.updatedAt || note.createdAt);
                info.textContent = `Tamamlandı${relative ? ` • ${relative}` : ''}`;
                card.appendChild(info);
            }
        }

        fragment.appendChild(card);
    });

    listEl.appendChild(fragment);

    endFirstPaint();
}

async function loadNotes() {
    const token = ++loadToken;
    state.loading = true;
    renderNotes();

    const fetcher = currentDeps.fetchNotes || fetchGeneralNotes;

    try {
        await ensureAuthUser().catch(() => null);
        const notes = await fetcher(50);
        if (!mounted || token !== loadToken) return;
        state.notes = Array.isArray(notes) ? notes.map(mapNotePayload) : [];
        if (state.filterTag) {
            const available = getAvailableTags();
            if (!available.includes(state.filterTag)) {
                state.filterTag = '';
            }
        }
    } catch (error) {
        if (!mounted || token !== loadToken) return;
        logError(error);
        setStatus('Notlar yüklenirken bir hata oluştu.', { isError: true });
        state.notes = [];
    } finally {
        if (!mounted || token !== loadToken) return;
        state.loading = false;
        state.completeInProgressId = null;
        renderNotes();
    }
}

async function handleSave(event) {
    if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
    }
    if (!textareaEl || state.saving) return;

    const text = (textareaEl.value || '').trim();
    if (!text) {
        setStatus('Lütfen kaydetmeden önce bir not yazın.', { isError: true });
        return;
    }
    const tags = parseTagsFromText(tagsInputEl ? tagsInputEl.value : '');

    state.saving = true;
    if (saveButtonEl) {
        saveButtonEl.disabled = true;
    }
    setStatus('Kaydediliyor...');

    const creator = currentDeps.createNote || (payload => createGeneralNote(payload));

    try {
        await creator({ text, tags });
        if (!mounted) return;
        textareaEl.value = '';
        if (tagsInputEl) {
            tagsInputEl.value = '';
        }
        setStatus('Not kaydedildi.');
        if (typeof toastFn === 'function') {
            toastFn('Not kaydedildi.');
        }
        if (typeof currentDeps.onNoteCreated === 'function') {
            try {
                currentDeps.onNoteCreated();
            } catch (error) {
                logError(error);
            }
        }
        await loadNotes();
        setTimeout(() => {
            if (mounted) {
                setStatus('');
            }
        }, 3000);
    } catch (error) {
        if (!mounted) return;
        logError(error);
        setStatus(error?.message || 'Not kaydedilirken bir hata oluştu.', { isError: true });
        if (typeof toastFn === 'function') {
            toastFn(error?.message || 'Not kaydedilirken bir hata oluştu.', true);
        }
    } finally {
        if (!mounted) return;
        state.saving = false;
        if (saveButtonEl) {
            saveButtonEl.disabled = false;
        }
        if (!state.loading) {
            renderNotes();
        }
    }
}

function enterEditMode(noteId) {
    const note = state.notes.find(item => item.id === noteId);
    if (!note || !canModify(note)) return;
    state.edit.noteId = noteId;
    state.edit.text = note.text || '';
    state.edit.tagsText = tagsToDisplay(note.tags).join(', ');
    state.edit.originalTags = tagsToDisplay(note.tags);
    state.edit.saving = false;
    renderNotes();
}

function cancelEditMode() {
    resetEditState();
    renderNotes();
}

async function saveEdit(noteId) {
    if (!isEditing(noteId) || state.edit.saving) return;
    const note = state.notes.find(item => item.id === noteId);
    if (!note) return;
    const trimmed = state.edit.text.trim();
    if (!trimmed) {
        setStatus('Not metni zorunludur.', { isError: true });
        return;
    }
    const tags = parseTagsFromText(state.edit.tagsText);
    const originalTags = state.edit.originalTags;
    if (trimmed === (note.text || '').trim() && tagsEqual(originalTags, tags)) {
        setStatus('Değişiklik bulunmuyor.', { isError: false });
        return;
    }

    state.edit.saving = true;
    let timerStarted = false;
    try {
        console.time('notes:edit');
        timerStarted = true;
    } catch (error) {
        logEditError(error);
    }
    renderNotes();

    await ensureAuthUser().catch(() => null);
    const currentUserId = getCurrentUserId();
    const updater = currentDeps.updateNote || ((id, payload) => updateNote(id, payload));
    try {
        await updater(noteId, {
            text: trimmed,
            tags,
            authorId: note.authorId || currentUserId || null
        });
        if (!mounted) return;
        resetEditState();
        if (typeof toastFn === 'function') {
            toastFn('Not güncellendi.');
        }
        if (typeof currentDeps.onNoteUpdated === 'function') {
            try {
                currentDeps.onNoteUpdated();
            } catch (error) {
                logError(error);
            }
        }
        await loadNotes();
    } catch (error) {
        if (!mounted) return;
        logEditError(error);
        setStatus(error?.message || 'Not düzenlenirken bir hata oluştu.', { isError: true });
        if (typeof toastFn === 'function') {
            toastFn(error?.message || 'Not düzenlenirken bir hata oluştu.', true);
        }
    } finally {
        if (timerStarted) {
            try {
                console.timeEnd('notes:edit');
            } catch (error) {
                logEditError(error);
            }
        }
        if (mounted) {
            state.edit.saving = false;
            renderNotes();
        }
    }
}

function requestDeleteConfirmation(note) {
    if (typeof currentDeps.confirmDelete === 'function') {
        try {
            const result = currentDeps.confirmDelete({
                title: 'Notu Sil',
                message: 'Bu notu silmek istediğinize emin misiniz?'
            });
            if (result && typeof result.then === 'function') {
                return result.then(Boolean).catch(error => {
                    logDeleteError(error);
                    return false;
                });
            }
            return Promise.resolve(Boolean(result));
        } catch (error) {
            logDeleteError(error);
            return Promise.resolve(false);
        }
    }
    return Promise.resolve(window.confirm('Bu notu silmek istediğinize emin misiniz?'));
}

async function deleteNotebookNote(noteId) {
    if (state.deleteInProgressId === noteId) return;
    const note = state.notes.find(item => item.id === noteId);
    if (!note || !canModify(note)) return;

    const confirmed = await requestDeleteConfirmation(note);
    if (!confirmed) return;

    state.deleteInProgressId = noteId;
    let timerStarted = false;
    try {
        console.time('notes:delete');
        timerStarted = true;
    } catch (error) {
        logDeleteError(error);
    }
    renderNotes();

    const deleter = currentDeps.deleteNote || (id => deleteNote(id));
    try {
        await deleter(noteId);
        if (!mounted) return;
        if (typeof toastFn === 'function') {
            toastFn('Not silindi.');
        }
        if (typeof currentDeps.onNoteDeleted === 'function') {
            try {
                currentDeps.onNoteDeleted();
            } catch (error) {
                logError(error);
            }
        }
        if (isEditing(noteId)) {
            resetEditState();
        }
        await loadNotes();
    } catch (error) {
        if (!mounted) return;
        logDeleteError(error);
        setStatus(error?.message || 'Not silinirken bir hata oluştu.', { isError: true });
        if (typeof toastFn === 'function') {
            toastFn(error?.message || 'Not silinirken bir hata oluştu.', true);
        }
    } finally {
        if (timerStarted) {
            try {
                console.timeEnd('notes:delete');
            } catch (error) {
                logDeleteError(error);
            }
        }
        if (mounted) {
            state.deleteInProgressId = null;
            renderNotes();
        }
    }
}

function handleListClick(event) {
    if (event.target && event.target.id === 'notebookFilterClearInline') {
        event.preventDefault();
        setStatusFilter('all');
        setSelectedTag('');
        return;
    }
    const trigger = event.target.closest('[data-action]');
    if (!trigger || !listEl || !listEl.contains(trigger)) return;
    const noteId = trigger.dataset.id || '';
    const action = trigger.dataset.action;

    switch (action) {
        case 'edit-note':
            enterEditMode(noteId);
            break;
        case 'cancel-edit-note':
            cancelEditMode();
            break;
        case 'save-edit-note':
            saveEdit(noteId);
            break;
        case 'delete-note':
            deleteNotebookNote(noteId);
            break;
        case 'apply-tag-filter':
            setSelectedTag(trigger.dataset.tag || '');
            break;
        case 'toggle-note-status':
            handleNoteStatusToggle(noteId, trigger.dataset.nextStatus || 'open');
            break;
        default:
            break;
    }
}

function handleListInput(event) {
    const target = event.target;
    if (!target) return;
    const noteId = target.dataset.id || '';
    if (!isEditing(noteId)) return;

    if (target.classList.contains('note-edit-textarea')) {
        state.edit.text = target.value || '';
    } else if (target.classList.contains('note-edit-tags')) {
        state.edit.tagsText = target.value || '';
    } else {
        return;
    }

    const saveBtn = listEl ? listEl.querySelector(`button[data-action="save-edit-note"][data-id="${noteId}"]`) : null;
    if (saveBtn) {
        const note = state.notes.find(item => item.id === noteId);
        const trimmed = state.edit.text.trim();
        const original = (note?.text || '').trim();
        const editedTags = parseTagsFromText(state.edit.tagsText);
        const tagsChanged = !tagsEqual(state.edit.originalTags, editedTags);
        const isDirty = (trimmed && trimmed !== original) || tagsChanged;
        saveBtn.disabled = state.edit.saving || !isDirty;
    }
}

function handleFilterBarClick(event) {
    const button = event.target.closest('button[data-tag]');
    if (!button) return;
    event.preventDefault();
    const tag = button.dataset.tag || '';
    setSelectedTag(tag);
}

function handleFilterClearClick(event) {
    if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
    }
    setSelectedTag('');
}

function attachEventListeners() {
    if (saveButtonEl) {
        saveButtonEl.addEventListener('click', handleSave);
    }
    if (filterBarEl) {
        filterBarEl.addEventListener('click', handleFilterBarClick);
    }
    if (filterClearBtnEl) {
        filterClearBtnEl.addEventListener('click', handleFilterClearClick);
    }
    if (statusFilterBarEl) {
        statusFilterBarEl.addEventListener('click', handleStatusFilterClick);
    }
    if (listEl) {
        listEl.addEventListener('click', handleListClick);
        listEl.addEventListener('input', handleListInput);
    }
}

function detachEventListeners() {
    if (saveButtonEl) {
        saveButtonEl.removeEventListener('click', handleSave);
    }
    if (filterBarEl) {
        filterBarEl.removeEventListener('click', handleFilterBarClick);
    }
    if (filterClearBtnEl) {
        filterClearBtnEl.removeEventListener('click', handleFilterClearClick);
    }
    if (statusFilterBarEl) {
        statusFilterBarEl.removeEventListener('click', handleStatusFilterClick);
    }
    if (listEl) {
        listEl.removeEventListener('click', handleListClick);
        listEl.removeEventListener('input', handleListInput);
    }
}

function mount(container, deps = {}) {
    if (!container) {
        logError(new Error('notebook.view mount called without container'));
        return;
    }

    currentRoot = container;
    currentDeps = deps;
    mounted = true;

    textareaEl = container.querySelector('#notebookTextarea');
    saveButtonEl = container.querySelector('#saveNotebookBtn');
    statusEl = container.querySelector('#notebookStatus');
    listEl = container.querySelector('#notebookList');
    countEl = container.querySelector('#notebookCount');
    tagsInputEl = container.querySelector('#notebookTagsInput');
    filterBarEl = container.querySelector('#notebookTagFilterBar');
    filterChipsEl = container.querySelector('#notebookTagChips');
    filterClearBtnEl = container.querySelector('#notebookTagClearBtn');
    filterAllBtnEl = container.querySelector('#notebookTagAllBtn');
    statusFilterBarEl = container.querySelector('#notebookStatusFilterBar');
    toastFn = typeof deps.showToast === 'function' ? deps.showToast : null;

    startFirstPaint();
    attachEventListeners();
    loadNotes();
}

function unmount() {
    loadToken += 1;
    mounted = false;
    detachEventListeners();
    textareaEl = null;
    saveButtonEl = null;
    statusEl = null;
    listEl = null;
    countEl = null;
    tagsInputEl = null;
    filterBarEl = null;
    filterChipsEl = null;
    filterClearBtnEl = null;
    filterAllBtnEl = null;
    statusFilterBarEl = null;
    toastFn = null;
    currentRoot = null;
    currentDeps = {};
    state.notes = [];
    state.loading = false;
    state.saving = false;
    resetEditState();
    state.deleteInProgressId = null;
    state.completeInProgressId = null;
    state.filterTag = '';
    state.filterStatus = 'all';
    if (firstPaintPending) {
        firstPaintPending = false;
        try {
            console.timeEnd('notebook:first-paint');
        } catch (error) {
            logError(error);
        }
    }
}

export default {
    mount,
    unmount,
    isMounted: () => mounted
};
