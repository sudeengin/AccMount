import { fetchRecentAccounts } from "../../data/accounts.repo.js";
import {
    fetchAccountNotes,
    fetchGeneralNotes,
    normalizeTags as normalizeTagsFromRepo
} from "../../data/notes.repo.js";
import { fetchRecentTransactions } from "../../data/transactions.repo.js";
import { 
    getTransactionDirection, 
    getDirectionColorClass, 
    getDirectionBadgeClass, 
    ensureTransactionDirection,
    getTransactionTypeLabel,
    getTransactionTypeBadgeClass
} from "../../utils/transaction-direction.js";

let currentRoot = null;
let currentDeps = {};
let mounted = false;

let listEl = null;
let tagFilterEl = null;
let tagChipsEl = null;
let tagClearBtnEl = null;
let tagAllBtnEl = null;

let firstPaintPending = false;
let loadToken = 0;

const state = {
    items: [],
    loading: false,
    error: null,
    selectedTag: ''
};

let accountStatusCache = null;

function logStatusError(error) {
    console.warn('[activity:status:error]', error);
}

function logError(error) {
    console.warn('[activity:error]', error);
}

function logNormalizeError(error) {
    console.warn('[activity:normalize:error]', error);
}

function normalizeTagList(input) {
    try {
        return normalizeTagsFromRepo(input);
    } catch (error) {
        logTagError(error);
        return [];
    }
}

function getChipClass(isActive) {
    const base = 'px-3 py-1 rounded-full text-xs font-semibold border transition';
    if (isActive) {
        return `${base} bg-indigo-600 text-white border-indigo-600`;
    }
    return `${base} bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600`;
}

function getAvailableTagsFromItems() {
    const set = new Set();
    state.items.forEach(item => {
        if (Array.isArray(item.tags)) {
            item.tags.forEach(tag => set.add(tag));
        }
    });
    return Array.from(set).sort();
}

function applyTagFilterToItems(items) {
    const tag = state.selectedTag;
    if (!tag) return items.slice();
    return items.filter(item => Array.isArray(item.tags) && item.tags.includes(tag));
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

function renderTagFilters() {
    if (!tagFilterEl || !tagChipsEl) return;
    const tags = getAvailableTagsFromItems();
    tagFilterEl.classList.toggle('hidden', tags.length === 0 && !state.selectedTag);

    const fragment = document.createDocumentFragment();
    tags.forEach(tag => {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.tag = tag;
        button.className = getChipClass(state.selectedTag === tag);
        button.textContent = tag;
        fragment.appendChild(button);
    });
    tagChipsEl.innerHTML = '';
    tagChipsEl.appendChild(fragment);

    if (tagAllBtnEl) {
        tagAllBtnEl.className = getChipClass(!state.selectedTag);
    }
    if (tagClearBtnEl) {
        tagClearBtnEl.disabled = !state.selectedTag;
    }
}

function setSelectedTag(tag) {
    const normalized = tag || '';
    if (state.selectedTag === normalized) return;
    let timerStarted = false;
    try {
        console.time('notes:tag-apply');
        timerStarted = true;
    } catch (error) {
        logTagError(error);
    }
    state.selectedTag = normalized;
    renderTagFilters();
    renderActivity();
    if (timerStarted) {
        try {
            console.timeEnd('notes:tag-apply');
        } catch (error) {
            logTagError(error);
        }
    }
}

function handleTagFilterClick(event) {
    const button = event.target.closest('button[data-tag]');
    if (!button) return;
    event.preventDefault();
    setSelectedTag(button.dataset.tag || '');
}

function handleTagFilterClear(event) {
    if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
    }
    setSelectedTag('');
}

function handleListClick(event) {
    if (event.target && event.target.id === 'activityFilterClearInline') {
        event.preventDefault();
        setSelectedTag('');
        return;
    }
    const chip = event.target.closest('[data-action="filter-tag"]');
    if (chip) {
        event.preventDefault();
        setSelectedTag(chip.dataset.tag || '');
    }
}

function logTagError(error) {
    console.warn('[notes:tag:error]', error);
}

function startFirstPaint() {
    if (firstPaintPending) return;
    firstPaintPending = true;
    try {
        console.time('activity:first-paint');
    } catch (error) {
        logError(error);
    }
}

function endFirstPaint() {
    if (!firstPaintPending) return;
    firstPaintPending = false;
    try {
        console.timeEnd('activity:first-paint');
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

function getTransactionDate(transaction) {
    if (!transaction) return null;
    if (typeof currentDeps.getTransactionDate === 'function') {
        const date = currentDeps.getTransactionDate(transaction);
        if (date) return date;
    }
    const candidates = [
        transaction.tarih,
        transaction.kayitTarihi,
        transaction.guncellemeTarihi,
        transaction.createdAt,
        transaction.updatedAt
    ];
    for (const candidate of candidates) {
        const resolved = resolveTimestamp(candidate);
        if (resolved) return resolved;
    }
    return null;
}

function formatTimestamp(value) {
    const date = resolveTimestamp(value);
    if (!date) return 'Tarih yok';
    return date.toLocaleString('tr-TR', { dateStyle: 'long', timeStyle: 'short' });
}

function formatCurrency(value) {
    if (typeof currentDeps.formatCurrency === 'function') {
        return currentDeps.formatCurrency(value);
    }
    const numeric = Number(value) || 0;
    return numeric.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });
}

function getAccountName(accountId) {
    if (!accountId) return 'Bilinmeyen Cari';
    if (accountStatusCache && accountStatusCache.has(accountId)) {
        const entry = accountStatusCache.get(accountId);
        if (entry && entry.name) return entry.name;
    }
    if (typeof currentDeps.getAccountName === 'function') {
        const name = currentDeps.getAccountName(accountId);
        if (name) return name;
    }
    return 'Bilinmeyen Cari';
}

function getTransactionTitle(transaction) {
    if (typeof currentDeps.getTransactionTitle === 'function') {
        const title = currentDeps.getTransactionTitle(transaction, null);
        if (title) return title;
    }
    const tip = (transaction?.islemTipi || '').toString();
    if (!tip) return 'Transaction';
    return tip.charAt(0).toUpperCase() + tip.slice(1);
}
const KIND_PRIORITY = {
    'transaction': 0,
    'account-note': 1,
    'general-note': 1,
    'account-created': 2
};

function kindPriority(kind) {
    return KIND_PRIORITY[kind] ?? 3;
}

function buildDedupeKey(kind, item, ts) {
    const data = item?.data || {};
    if (kind === 'transaction' && data?.id) {
        return `transaction:${data.id}`;
    }
    if ((kind === 'general-note' || kind === 'account-note') && data?.id) {
        return `${kind}:${data.id}`;
    }
    if (kind === 'account-created' && data?.id) {
        return `account-created:${data.id}`;
    }
    if (kind === 'account-note' && data?.accountId) {
        return `account-note:${data.accountId}:${ts.getTime()}`;
    }
    if (kind === 'transaction') {
        const amount = item?.amount ?? 0;
        return `transaction:${ts.getTime()}:${item?.title || ''}:${amount}`;
    }
    return `${kind}:${ts.getTime()}:${item?.title || ''}`;
}

function toActivityItems({ generalNotes = [], accountNotes = [], transactions = [], accounts = [] } = {}) {
    const normalized = [];
    const seenKeys = new Set();
    const localStatusMap = new Map();
    console.time('activity:status-enrich');
    try {
        accounts.forEach(account => {
            if (!account?.id) return;
            const statusRaw = (account?.durum || '').toLowerCase();
            const status = statusRaw === 'archived' ? 'archived' : (statusRaw === 'deleted' ? 'deleted' : 'live');
            localStatusMap.set(account.id, {
                name: account?.unvan || 'Cari',
                status,
                deletedAt: resolveTimestamp(account?.deletedAt),
                archivedAt: resolveTimestamp(account?.archivedAt)
            });
        });
    } catch (error) {
        logStatusError(error);
    } finally {
        console.timeEnd('activity:status-enrich');
    }
    accountStatusCache = localStatusMap;

    console.time('activity:normalize');
    try {
        const pushItem = (item) => {
            const key = buildDedupeKey(item.kind, item, item.ts);
            if (seenKeys.has(key)) return;
            item.dedupeKey = key;
            seenKeys.add(key);
            normalized.push(item);
        };

        accounts.forEach(account => {
            const ts = resolveTimestamp(account?.olusturmaTarihi) || new Date(0);
            const title = account?.unvan || 'Yeni Cari';
            const entry = accountStatusCache.get(account.id);
            const normalizedStatus = entry?.status || 'live';
            pushItem({
                kind: 'account-created',
                ts,
                title,
                subtitle: account?.tipi || 'Cari',
                accountName: title,
                accountStatus: normalizedStatus,
                deletedAt: entry?.deletedAt || null,
                archivedAt: entry?.archivedAt || null,
                data: account,
                tags: [],
                status: 'open',
                completedAt: null
            });
        });

        generalNotes.forEach(note => {
            const ts = resolveTimestamp(note?.createdAt) || new Date(0);
            const tags = normalizeTagList(note?.tags || []);
            const status = note?.status === 'completed' ? 'completed' : 'open';
            const completedAt = resolveTimestamp(note?.completedAt) || null;
            pushItem({
                kind: 'general-note',
                ts,
                title: 'Genel Not',
                subtitle: note?.text || '',
                accountStatus: 'live',
                data: note,
                tags,
                status,
                completedAt
            });
        });

        accountNotes.forEach(note => {
            const ts = resolveTimestamp(note?.createdAt) || new Date(0);
            const accountName = getAccountName(note?.accountId);
            let entry = note?.accountId ? accountStatusCache.get(note.accountId) : null;
            if (!entry && note?.accountId) {
                entry = {
                    name: accountName,
                    status: 'deleted',
                    deletedAt: null,
                    archivedAt: null
                };
                accountStatusCache.set(note.accountId, entry);
            }
            pushItem({
                kind: 'account-note',
                ts,
                title: accountName,
                subtitle: note?.text || '',
                accountName,
                accountStatus: entry?.status || 'deleted',
                deletedAt: entry?.deletedAt || null,
                archivedAt: entry?.archivedAt || null,
                data: note,
                tags: normalizeTagList(note?.tags || []),
                status: note?.status === 'completed' ? 'completed' : 'open',
                completedAt: resolveTimestamp(note?.completedAt) || null
            });
        });

        transactions.forEach(transaction => {
            const ts = getTransactionDate(transaction) || new Date(0);
            const amount = Number(transaction?.toplamTutar ?? transaction?.tutar ?? 0) || 0;
            const type = String(transaction?.islemTipi || '').toLowerCase().trim();
            const isDebtTransfer = type === 'borç transferi' || type === 'borc transferi' || type === 'debt_transfer';
            
            const subtitleParts = [];
            const aciklama = (transaction?.aciklama || '').trim();
            if (aciklama) subtitleParts.push(aciklama);
            if (transaction?.islemTipi) subtitleParts.push(`Tür: ${transaction.islemTipi}`);
            if (transaction?.faturaNumarasi) subtitleParts.push(`Fatura: ${transaction.faturaNumarasi}`);
            
            // For debt transfers, add party information
            // Flow: Lender → Debtor → Creditor Paid Off
            if (isDebtTransfer) {
                const debtor = getAccountName(transaction?.islemCari);
                const lender = getAccountName(transaction?.kaynakCari);
                const creditorPaidOff = getAccountName(transaction?.hedefCari);
                if (debtor && lender && creditorPaidOff) {
                    subtitleParts.push(`${lender} → ${debtor} → ${creditorPaidOff}`);
                }
            }
            
            const subtitle = subtitleParts.join(' • ');
            const accountId = transaction?.islemCari || transaction?.kaynakCari || transaction?.hedefCari;
            let statusEntry = accountId ? accountStatusCache.get(accountId) : null;
            if (!statusEntry && accountId) {
                const fallbackName = getAccountName(accountId);
                statusEntry = {
                    name: fallbackName,
                    status: 'deleted',
                    deletedAt: null,
                    archivedAt: null
                };
                accountStatusCache.set(accountId, statusEntry);
            }
            pushItem({
                kind: 'transaction',
                ts,
                title: getTransactionTitle(transaction),
                subtitle,
                amount,
                amountFormatted: formatCurrency(amount),
                accountName: getAccountName(transaction?.islemCari || transaction?.kaynakCari || transaction?.hedefCari),
                accountStatus: statusEntry?.status || (accountId ? 'deleted' : 'live'),
                deletedAt: statusEntry?.deletedAt || null,
                archivedAt: statusEntry?.archivedAt || null,
                data: transaction,
                tags: [],
                status: 'open',
                completedAt: null,
                isDebtTransfer
            });
        });
    } catch (error) {
        logNormalizeError(error);
    } finally {
        console.timeEnd('activity:normalize');
    }

    console.time('activity:sort');
    try {
        normalized.sort((a, b) => {
            const timeDelta = b.ts.getTime() - a.ts.getTime();
            if (timeDelta !== 0) return timeDelta;
            const priorityDelta = kindPriority(a.kind) - kindPriority(b.kind);
            if (priorityDelta !== 0) return priorityDelta;
            return (a.dedupeKey || '').localeCompare(b.dedupeKey || '');
        });
    } catch (error) {
        logNormalizeError(error);
    } finally {
        console.timeEnd('activity:sort');
    }

    return normalized;
}

function renderActivity() {
    if (!listEl) return;

    renderTagFilters();
    listEl.innerHTML = '';

    if (state.loading) {
        listEl.innerHTML = '<p class="text-sm text-gray-500 dark:text-gray-400">Yükleniyor...</p>';
        return;
    }

    if (state.error) {
        listEl.innerHTML = `<p class="text-sm text-red-500">${state.error}</p>`;
        endFirstPaint();
        return;
    }

    if (!state.items.length) {
        listEl.innerHTML = '<p class="text-sm text-gray-500 dark:text-gray-400">Henüz aktivite bulunmuyor.</p>';
        endFirstPaint();
        return;
    }

    const filteredItems = applyTagFilterToItems(state.items);

    if (!filteredItems.length) {
        listEl.innerHTML = `<div class="p-4 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-500 dark:text-gray-400">
            Seçilen etikete ait aktivite bulunamadı.
            <button id="activityFilterClearInline" class="ml-2 text-indigo-600 dark:text-indigo-300 font-semibold underline">Filtreyi temizle</button>
        </div>`;
        endFirstPaint();
        return;
    }

    const fragment = document.createDocumentFragment();

    filteredItems.forEach(item => {
        const card = document.createElement('div');
        card.className = 'border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800 shadow-sm';
        const isCompleted = item.status === 'completed';
        if (isCompleted) {
            card.classList.add('bg-green-50', 'dark:bg-green-900/20');
        }

        const header = document.createElement('div');
        header.className = 'flex items-center justify-between mb-2';

        const label = document.createElement('span');
        label.className = 'text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-300';

        const timestamp = document.createElement('span');
        timestamp.className = 'text-xs text-gray-500 dark:text-gray-400';
        timestamp.textContent = formatTimestamp(item.ts);

        const body = document.createElement('div');
        body.className = 'space-y-1';

        const appendStatusLabel = (element, activityItem) => {
            const status = activityItem?.accountStatus || 'live';
            if (status === 'live') return;
            const label = document.createElement('span');
            label.className = 'ml-1 text-xs font-normal text-gray-500 dark:text-gray-400';
            if (status === 'deleted') {
                label.textContent = '(silinmiş)';
                if (activityItem.deletedAt) {
                    label.title = `Silindi: ${formatTimestamp(activityItem.deletedAt)}`;
                }
            } else if (status === 'archived') {
                label.textContent = '(arşivli)';
                if (activityItem.archivedAt) {
                    label.title = `Arşivlendi: ${formatTimestamp(activityItem.archivedAt)}`;
                }
            }
            element.appendChild(document.createTextNode(' '));
            element.appendChild(label);
        };

        switch (item.kind) {
            case 'account-created': {
                label.textContent = 'Account Created';
                const titleEl = document.createElement('p');
                titleEl.className = 'text-sm font-semibold text-gray-900 dark:text-white';
                titleEl.textContent = item.title || item.accountName || 'Yeni Cari';
                const subtitleEl = document.createElement('p');
                subtitleEl.className = 'text-sm text-gray-700 dark:text-gray-200';
                subtitleEl.textContent = item.subtitle || '';
                appendStatusLabel(titleEl, item);
                body.appendChild(titleEl);
                if (subtitleEl.textContent) {
                    body.appendChild(subtitleEl);
                }
                break;
            }
            case 'general-note': {
                label.textContent = 'General Note';
                const titleEl = document.createElement('p');
                titleEl.className = 'text-sm font-semibold text-gray-900 dark:text-white';
                titleEl.textContent = item.title || 'Genel Not';
                const subtitleEl = document.createElement('p');
                subtitleEl.className = 'text-sm text-gray-800 dark:text-gray-100 whitespace-pre-wrap';
                subtitleEl.textContent = item.subtitle || '';
                appendStatusLabel(titleEl, item);
                body.appendChild(titleEl);
                body.appendChild(subtitleEl);
                break;
            }
            case 'account-note': {
                label.textContent = 'Account Note';
                const titleEl = document.createElement('p');
                titleEl.className = 'text-sm font-semibold text-gray-900 dark:text-white';
                titleEl.textContent = item.title || item.accountName || 'Cari Notu';
                const subtitleEl = document.createElement('p');
                subtitleEl.className = 'text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap';
                subtitleEl.textContent = item.subtitle || '';
                appendStatusLabel(titleEl, item);
                body.appendChild(titleEl);
                body.appendChild(subtitleEl);
                break;
            }
            case 'transaction':
            default: {
                label.textContent = 'Transaction';
                
                // Use type-based labels instead of direction-based
                const txData = item.data || {};
                const typeLabel = getTransactionTypeLabel(txData);
                const typeBadgeClass = getTransactionTypeBadgeClass(txData);
                
                const titleEl = document.createElement('p');
                titleEl.className = 'text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2';
                
                const titleText = document.createElement('span');
                titleText.textContent = item.title || 'Transaction';
                titleEl.appendChild(titleText);
                
                // Add type badge
                if (typeLabel) {
                    const badge = document.createElement('span');
                    badge.className = `inline-flex items-center ${typeBadgeClass}`;
                    badge.textContent = typeLabel;
                    titleEl.appendChild(badge);
                }
                
                // Add auto-payment badge
                if (txData.source === 'auto_from_expense') {
                    const autoBadge = document.createElement('span');
                    autoBadge.className = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
                    autoBadge.textContent = '🤖 Otomatik';
                    autoBadge.title = 'Gider kaydıyla birlikte otomatik oluşturuldu';
                    titleEl.appendChild(autoBadge);
                }

                const amountEl = document.createElement('p');
                amountEl.className = 'text-sm text-gray-700 dark:text-gray-200';
                amountEl.textContent = item.amountFormatted || formatCurrency(item.amount || 0);

                body.appendChild(titleEl);
                body.appendChild(amountEl);
                appendStatusLabel(titleEl, item);

                if (item.subtitle) {
                    const detailsEl = document.createElement('p');
                    detailsEl.className = 'text-xs text-gray-500 dark:text-gray-400';
                    detailsEl.textContent = item.subtitle;
                    body.appendChild(detailsEl);
                }
                break;
            }
        }

        header.appendChild(label);
        header.appendChild(timestamp);
        card.appendChild(header);
        card.appendChild(body);

        if (isCompleted) {
            const info = document.createElement('p');
            info.className = 'text-xs text-green-700 dark:text-green-300 mt-2';
            const relative = formatRelativeTime(item.completedAt || item.ts);
            info.textContent = `Tamamlandı${relative ? ` • ${relative}` : ''}`;
            card.appendChild(info);
        }

        if (Array.isArray(item.tags) && item.tags.length) {
            const tagsRow = document.createElement('div');
            tagsRow.className = 'flex flex-wrap gap-2 mt-2';
            item.tags.forEach(tag => {
                const chip = document.createElement('span');
                chip.className = 'px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200 text-xs font-semibold cursor-pointer hover:bg-indigo-200 dark:hover:bg-indigo-800';
                chip.dataset.action = 'filter-tag';
                chip.dataset.tag = tag;
                chip.textContent = tag;
                tagsRow.appendChild(chip);
            });
            card.appendChild(tagsRow);
        }
        fragment.appendChild(card);
    });

    listEl.appendChild(fragment);
    endFirstPaint();
}

async function loadActivity() {
    const token = ++loadToken;
    state.loading = true;
    state.error = null;
    renderActivity();

    try {
        const [generalNotes, accountNotes, transactions, accounts] = await Promise.all([
            fetchGeneralNotes(50),
            fetchAccountNotes(50),
            fetchRecentTransactions(100),
            fetchRecentAccounts(50).catch(() => [])
        ]);

        if (!mounted || token !== loadToken) return;
        state.items = toActivityItems({ generalNotes, accountNotes, transactions, accounts });
        if (state.selectedTag) {
            const tags = getAvailableTagsFromItems();
            if (!tags.includes(state.selectedTag)) {
                state.selectedTag = '';
            }
        }
    } catch (error) {
        if (!mounted || token !== loadToken) return;
        logError(error);
        state.items = [];
        state.error = 'Aktivite akışı yüklenemedi.';
        state.selectedTag = '';
    } finally {
        if (!mounted || token !== loadToken) return;
        state.loading = false;
        renderActivity();
    }
}

function mount(container, deps = {}) {
    if (!container) {
        logError(new Error('activity.view mount called without container'));
        return;
    }

    currentRoot = container;
    currentDeps = deps;
    listEl = container.querySelector('#activityList');
    tagFilterEl = container.querySelector('#activityTagFilterBar');
    tagChipsEl = container.querySelector('#activityTagChips');
    tagClearBtnEl = container.querySelector('#activityTagClearBtn');
    tagAllBtnEl = container.querySelector('#activityTagAllBtn');
    mounted = true;

    if (tagFilterEl) {
        tagFilterEl.addEventListener('click', handleTagFilterClick);
    }
    if (tagClearBtnEl) {
        tagClearBtnEl.addEventListener('click', handleTagFilterClear);
    }
    if (listEl) {
        listEl.addEventListener('click', handleListClick);
    }

    startFirstPaint();
    loadActivity();
}

function unmount() {
    loadToken += 1;
    if (tagFilterEl) {
        tagFilterEl.removeEventListener('click', handleTagFilterClick);
    }
    if (tagClearBtnEl) {
        tagClearBtnEl.removeEventListener('click', handleTagFilterClear);
    }
    if (listEl) {
        listEl.removeEventListener('click', handleListClick);
    }
    mounted = false;
    currentRoot = null;
    currentDeps = {};
    listEl = null;
    tagFilterEl = null;
    tagChipsEl = null;
    tagClearBtnEl = null;
    tagAllBtnEl = null;
    state.items = [];
    state.loading = false;
    state.error = null;
    state.selectedTag = '';
    accountStatusCache = null;
    if (firstPaintPending) {
        firstPaintPending = false;
        try {
            console.timeEnd('activity:first-paint');
        } catch (error) {
            logError(error);
        }
    }
}

export default {
    mount,
    unmount,
    isMounted: () => mounted,
    reload: () => {
        if (!mounted) return;
        loadActivity();
    }
};
