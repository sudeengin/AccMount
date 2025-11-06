import {
    createAccountNote,
    deleteNote,
    fetchAccountNotesFor,
    updateNote,
    toggleNoteStatus as toggleNoteStatusRepo
} from "../../data/notes.repo.js";
import { ensureAuthUser, getCurrentUserId } from "../../services/firebase.js";
import { exportAccountsToCSV, exportTransactionsToCSV } from "../../utils/csv-export.js";
import { 
    getTransactionDirection, 
    getDirectionColorClass, 
    getDirectionBadgeClass, 
    ensureTransactionDirection,
    getTransactionTypeLabel,
    getTransactionTypeBadgeClass,
    getTransactionTypeColorClass
} from "../../utils/transaction-direction.js";
import { 
    getAccountType, 
    getAccountTypeLabel, 
    isInternalAccount, 
    isExternalAccount,
    getInternalAccounts,
    getExternalAccounts
} from "../../utils/account-type.js";
import { 
    isSystemLog, 
    isRealTransaction, 
    separateTransactionsAndLogs,
    getLogTypeLabel,
    getLogDescription
} from "../../utils/transaction-log.js";
import {
    formatTransactionDate,
    sortTransactionsByDateDesc
} from "../../utils/date-utils.js";

let currentRoot = null;
let currentDeps = {};
let mounted = false;

let searchInputEl = null;
let listContainerEl = null;
let exportAccountsBtnEl = null;
let exportTransactionsBtnEl = null;
let detailNameEl = null;
let detailTypeEl = null;
let detailBalanceEl = null;
let transactionListEl = null;
let transactionCountEl = null;
let logListEl = null;
let logCountEl = null;
let transactionsTabEl = null;
let logsTabEl = null;
let transactionsTabContentEl = null;
let logsTabContentEl = null;
let newTransactionBtnEl = null;
let primaryNewTransactionBtnEl = null;
let filterTypeEl = null;
let filterStartEl = null;
let filterEndEl = null;
let filterResetBtnEl = null;
let affectsBalanceFilterEl = null;
let detailBackBtnEl = null;
let transactionBackBtnEl = null;
let transactionEditBtnEl = null;
let transactionDeleteBtnEl = null;
let dashboardSelectEl = null;
let dashboardViewDetailsBtnEl = null;
let accountNotesPanelEl = null;
let accountNotesListEl = null;
let accountNotesCountEl = null;
let accountNotesTextareaEl = null;
let accountNotesSaveBtnEl = null;
let accountNotesStatusEl = null;
const defaultTransactionFilters = () => ({
    type: "",
    start: null,
    end: null,
    showOnlyAffectsBalance: true // Filter to show only balance-affecting transactions by default
});

let accountNotesLoadToken = 0;

const state = {
    accounts: [],
    transactions: [],
    searchQuery: "",
    selectedAccountId: null,
    activeTab: 'transactions', // 'transactions' or 'logs'
    transactionFilters: defaultTransactionFilters(),
    accountNotes: {
        items: [],
        loading: false,
        saving: false,
        firstPaintPending: false,
        editingId: null,
        editingText: "",
        editSaving: false,
        deleteInProgressId: null,
        completeInProgressId: null
    }
};

const modalState = {
    openIds: new Set()
};

let firstPaintPending = false;

function logHomeError(error) {
    console.warn('[home:error]', error);
}

function logAccountNotesError(error) {
    console.warn('[account-notes:error]', error);
}

function logAccountNoteCompleteError(error) {
    console.warn('[notes:complete:error]', error);
}

function logAccountNoteEditError(error) {
    console.warn('[notes:edit:error]', error);
}

function logAccountNoteDeleteError(error) {
    console.warn('[notes:delete:error]', error);
}

function startFirstPaintTimer() {
    if (firstPaintPending) return;
    firstPaintPending = true;
    try {
        console.time('home:first-paint');
    } catch (error) {
        logHomeError(error);
    }
}

function startAccountNotesFirstPaint() {
    if (state.accountNotes.firstPaintPending) return;
    state.accountNotes.firstPaintPending = true;
    try {
        console.time('account-notes:first-paint');
    } catch (error) {
        logAccountNotesError(error);
    }
}

function endAccountNotesFirstPaint() {
    if (!state.accountNotes.firstPaintPending) return;
    state.accountNotes.firstPaintPending = false;
    try {
        console.timeEnd('account-notes:first-paint');
    } catch (error) {
        logAccountNotesError(error);
    }
}

function completeFirstPaintTimer() {
    if (!firstPaintPending) return;
    firstPaintPending = false;
    try {
        console.timeEnd('home:first-paint');
    } catch (error) {
        logHomeError(error);
    }
}

function getTransactions() {
    return Array.isArray(state.transactions) ? state.transactions : [];
}

function findAccount(accountId) {
    if (!accountId) return null;
    return state.accounts.find(acc => acc.id === accountId) || null;
}

function findTransaction(transactionId) {
    if (!transactionId) return null;
    return getTransactions().find(tx => tx.id === transactionId) || null;
}

function getAccountName(accountId) {
    if (!accountId) return "";
    if (typeof currentDeps.getAccountName === "function") {
        const name = currentDeps.getAccountName(accountId);
        if (name) return name;
    }
    const account = findAccount(accountId);
    return account ? account.unvan : "";
}

function getTransactionTitle(transaction, accountId) {
    if (typeof currentDeps.getTransactionTitle === "function") {
        return currentDeps.getTransactionTitle(transaction, accountId);
    }
    return "";
}

function getTransactionDate(transaction) {
    if (typeof currentDeps.getTransactionDate === "function") {
        return currentDeps.getTransactionDate(transaction);
    }
    const value = transaction?.tarih;
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function getTransactionNetChange(transaction, accountId) {
    if (typeof currentDeps.getTransactionNetChange === "function") {
        return currentDeps.getTransactionNetChange(transaction, accountId);
    }
    return 0;
}

function formatCurrency(value) {
    const numeric = Number(value) || 0;
    return Math.abs(numeric).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });
}

function resolveTimestamp(value) {
    if (!value) return null;
    if (typeof value.toDate === 'function') return value.toDate();
    if (value.seconds) return new Date(value.seconds * 1000);
    if (value instanceof Date) return value;
    if (typeof value === 'string') {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
}

function formatTimestampForDisplay(value) {
    const date = resolveTimestamp(value);
    if (!date) return '';
    return date.toLocaleString('tr-TR', { dateStyle: 'long', timeStyle: 'short' });
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

function mapAccountNotePayload(note = {}) {
    return {
        ...note,
        status: note?.status === 'completed' ? 'completed' : 'open',
        completedAt: resolveTimestamp(note?.completedAt) || null,
        completedBy: note?.completedBy || null,
        createdAt: resolveTimestamp(note?.createdAt) || null,
        updatedAt: resolveTimestamp(note?.updatedAt) || null
    };
}

function accountMatchesSearch(account, query) {
    const normalized = (query || "").trim().toLowerCase();
    if (!normalized) return true;

    const basicFields = [
        account.unvan,
        account.tipi,
        account.vergiNo,
        account.email,
        account.telefon
    ];

    if (basicFields.some(field => typeof field === "string" && field.toLowerCase().includes(normalized))) {
        return true;
    }

    const relatedTransactions = getTransactions().filter(tx =>
        tx.islemCari === account.id ||
        tx.kaynakCari === account.id ||
        tx.hedefCari === account.id
    );

    return relatedTransactions.some(tx => {
        const title = getTransactionTitle(tx, account.id);
        const otherFields = [
            title,
            tx.aciklama,
            tx.faturaNumarasi,
            getAccountName(tx.kaynakCari),
            getAccountName(tx.hedefCari),
            tx.islemTipi
        ];
        return otherFields.some(field => typeof field === "string" && field.toLowerCase().includes(normalized));
    });
}

function filterAccounts() {
    if (!state.searchQuery) return state.accounts;
    return state.accounts.filter(account => accountMatchesSearch(account, state.searchQuery));
}

function renderEmptyMessage(container, message) {
    if (!container) return;
    container.innerHTML = `<p class="text-gray-500 dark:text-gray-400">${message}</p>`;
}

function renderAccountList() {
    if (!listContainerEl) return;
    try {
        listContainerEl.innerHTML = "";

        if (!state.accounts.length) {
            renderEmptyMessage(listContainerEl, "Henüz cari eklenmemiş.");
            return;
        }

        const displayAccounts = filterAccounts();
        if (!displayAccounts.length) {
            renderEmptyMessage(listContainerEl, "Arama kriterlerine uygun cari bulunamadı.");
            return;
        }

        // Separate accounts by type
        const internalAccounts = getInternalAccounts(displayAccounts);
        const externalAccounts = getExternalAccounts(displayAccounts);

        const fragment = document.createDocumentFragment();

        // Render internal accounts section (Bank Accounts)
        if (internalAccounts.length > 0) {
            const internalHeader = document.createElement("div");
            internalHeader.className = "mb-3 mt-2";
            internalHeader.innerHTML = `
                <h3 class="text-sm font-semibold text-indigo-600 dark:text-indigo-300 uppercase tracking-wide flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z"/>
                        <path fill-rule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clip-rule="evenodd"/>
                    </svg>
                    Banka Hesapları / Kasa
                </h3>
            `;
            fragment.appendChild(internalHeader);

            internalAccounts.forEach(account => {
                const accountEl = createAccountListItem(account, true);
                fragment.appendChild(accountEl);
            });

            // Add separator
            const separator = document.createElement("div");
            separator.className = "my-4 border-t border-gray-300 dark:border-gray-600";
            fragment.appendChild(separator);
        }

        // Render external accounts section (Suppliers/Customers)
        if (externalAccounts.length > 0) {
            const externalHeader = document.createElement("div");
            externalHeader.className = "mb-3";
            externalHeader.innerHTML = `
                <h3 class="text-sm font-semibold text-indigo-600 dark:text-indigo-300 uppercase tracking-wide flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/>
                    </svg>
                    Cariler (Tedarikçi / Müşteri)
                </h3>
            `;
            fragment.appendChild(externalHeader);

            externalAccounts.forEach(account => {
                const accountEl = createAccountListItem(account, false);
                fragment.appendChild(accountEl);
            });
        }

        listContainerEl.appendChild(fragment);
    } catch (error) {
        logHomeError(error);
    } finally {
        completeFirstPaintTimer();
    }
}

function createAccountListItem(account, isInternal) {
    const bakiye = Number(account.bakiye || 0);
    const bakiyeRenk = bakiye > 0 ? "text-green-500" : (bakiye < 0 ? "text-red-500" : "text-gray-500");
    const accountTypeLabel = getAccountTypeLabel(getAccountType(account));
    
    // Different styling for internal vs external accounts
    const bgClass = isInternal 
        ? "bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800" 
        : "bg-gray-50 dark:bg-gray-700";

    const wrapper = document.createElement("div");
    wrapper.className = `${bgClass} p-4 rounded-lg flex justify-between items-center transition-all mb-2`;
    wrapper.innerHTML = `
        <div class="flex-grow cursor-pointer cari-item" data-id="${account.id}">
            <div class="flex items-center gap-2">
                <p class="font-semibold text-lg">${account.unvan}</p>
                ${isInternal ? '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200">Banka/Kasa</span>' : ''}
            </div>
            <p class="text-sm text-gray-500 dark:text-gray-400">${account.tipi || accountTypeLabel}</p>
        </div>
        <div class="flex items-center flex-shrink-0">
            <div class="text-right mr-4 cursor-pointer cari-item" data-id="${account.id}">
                <p class="font-bold text-xl ${bakiyeRenk}">${formatCurrency(bakiye)}</p>
                <p class="text-xs text-gray-500 dark:text-gray-400">Bakiye</p>
            </div>
            <button data-id="${account.id}" data-unvan="${account.unvan}" class="delete-cari-btn p-2 rounded-full text-gray-400 hover:text-red-500 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clip-rule="evenodd" /></svg>
            </button>
        </div>
    `;
    return wrapper;
}

function formatBalanceClass(balance) {
    if (balance > 0) return "text-3xl font-bold text-green-500";
    if (balance < 0) return "text-3xl font-bold text-red-500";
    return "text-3xl font-bold text-gray-500";
}

function updateDetailHeader(account) {
    if (!detailNameEl || !detailTypeEl || !detailBalanceEl) return;

    if (!account) {
        detailNameEl.textContent = "";
        detailTypeEl.textContent = "";
        detailBalanceEl.textContent = "";
        detailBalanceEl.className = "text-3xl font-bold text-gray-500";
        return;
    }

    const accountType = getAccountType(account);
    const accountTypeLabel = getAccountTypeLabel(accountType);
    const isInternal = accountType === "internal";
    
    detailNameEl.textContent = account.unvan || "";
    
    // Show account type info in the detail view
    const typeText = account.tipi || accountTypeLabel;
    const typeWithBadge = isInternal 
        ? `${typeText} • Banka/Kasa` 
        : typeText;
    detailTypeEl.textContent = typeWithBadge;
    
    // Calculate balance from transactions for verification
    const storedBalance = Number(account.bakiye || 0);
    const accountId = account.id;
    const relatedTransactions = filterTransactionsByAccount(accountId);
    
    let calculatedBalance = 0;
    relatedTransactions.forEach(tx => {
        // Only include transactions that affect balance
        // Pending transfers (affectsBalance=false) should not be counted
        const affectsBalance = tx.affectsBalance !== false; // Default to true
        if (affectsBalance) {
            const netChange = getTransactionNetChange(tx, accountId);
            calculatedBalance += netChange;
        }
    });
    
    // Show stored balance (with warning if mismatch)
    const balanceDiff = Math.abs(storedBalance - calculatedBalance);
    const hasMismatch = balanceDiff > 0.01;
    
    if (hasMismatch) {
        // Show both balances with warning
        const warningIcon = '⚠️';
        detailBalanceEl.innerHTML = `
            <span class="text-orange-500" title="Bakiye uyumsuzluğu! Veritabanı: ${formatCurrency(storedBalance)}, Hesaplanan: ${formatCurrency(calculatedBalance)}">
                ${warningIcon} ${formatCurrency(storedBalance)}
            </span>
            <div class="text-xs text-orange-400 mt-1">
                (İşlemlerden hesaplanan: ${formatCurrency(calculatedBalance)})
            </div>
        `;
        detailBalanceEl.className = "text-3xl font-bold";
    } else {
        detailBalanceEl.textContent = formatCurrency(storedBalance);
        detailBalanceEl.className = formatBalanceClass(storedBalance);
    }
}

function parseDateValue(value, isEnd = false) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    if (isEnd) {
        date.setHours(23, 59, 59, 999);
    } else {
        date.setHours(0, 0, 0, 0);
    }
    return date;
}

function formatDateForInput(date) {
    if (!date) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function filterTransactionsByAccount(accountId) {
    if (!accountId) return [];
    return getTransactions().filter(tx =>
        tx.islemCari === accountId ||
        tx.kaynakCari === accountId ||
        tx.hedefCari === accountId
    );
}

function applyTransactionFilters(transactions) {
    const { type, start, end } = state.transactionFilters;
    return transactions.filter(tx => {
        if (type && tx.islemTipi !== type) return false;
        const txDate = getTransactionDate(tx);
        if (start && (!txDate || txDate < start)) return false;
        if (end && (!txDate || txDate > end)) return false;
        return true;
    });
}

function sortTransactions(transactions) {
    // Use shared date utility for consistent sorting
    return sortTransactionsByDateDesc(transactions);
}

function buildTransactionDescription(transaction) {
    const txType = String(transaction.islemTipi || '').toLowerCase().trim();
    const existingDesc = (transaction.aciklama || '').trim();
    
    // If description exists and is meaningful (>10 chars), keep it
    if (existingDesc.length >= 10) {
        // Add invoice number if it exists
        if (transaction.faturaNumarasi) {
            return `${existingDesc}<br><span class="text-xs text-gray-500 dark:text-gray-400">Fatura No: ${transaction.faturaNumarasi}</span>`;
        }
        return existingDesc;
    }
    
    // Auto-generate for tahsilat, ödeme, and transfer types
    const shouldAutoGenerate = txType === 'tahsilat' || txType === 'ödeme' || txType === 'odeme' || txType === 'transfer';
    
    if (!shouldAutoGenerate) {
        // Return existing description or invoice number if available
        const parts = [];
        if (transaction.faturaNumarasi) {
            parts.push(`Fatura No: ${transaction.faturaNumarasi}`);
        }
        if (existingDesc) {
            parts.push(existingDesc);
        }
        return parts.join('<br>') || '-';
    }
    
    // Build contextual description
    const sourceAccount = getAccountName(transaction.kaynakCari);
    const targetAccount = getAccountName(transaction.hedefCari);
    const amount = Math.abs(Number(transaction.toplamTutar || transaction.tutar || 0));
    const invoiceNo = transaction.faturaNumarasi || transaction.faturaNo;
    
    const formattedAmount = formatCurrency(amount);
    
    let description = '';
    
    // Check if this is a debt transfer
    const isDebtTransfer = (txType === 'transfer' && transaction.kaynakCari && transaction.hedefCari) ||
                           txType === 'borç transferi' || 
                           txType === 'borc transferi' || 
                           txType === 'debt_transfer';
    
    if (txType === 'tahsilat') {
        // Collection (Incoming payment)
        if (sourceAccount) {
            description = `${sourceAccount}'dan ${formattedAmount} tahsil edildi`;
            if (invoiceNo) {
                description += ` (Fatura: ${invoiceNo})`;
            }
        } else {
            description = `${formattedAmount} tahsilat`;
            if (invoiceNo) {
                description += ` (Fatura: ${invoiceNo})`;
            }
        }
    } else if (txType === 'ödeme' || txType === 'odeme') {
        // Payment (Outgoing payment)
        if (sourceAccount && targetAccount) {
            description = `${sourceAccount}'tan ${targetAccount}'e ${formattedAmount} ödeme yapıldı`;
        } else if (targetAccount) {
            description = `${targetAccount}'e ${formattedAmount} ödeme yapıldı`;
        } else if (sourceAccount) {
            description = `${sourceAccount}'tan ${formattedAmount} ödeme`;
        } else {
            description = `${formattedAmount} ödeme`;
        }
        
        // Add existing note if any
        if (existingDesc) {
            description += ` – ${existingDesc}`;
        }
    } else if (isDebtTransfer) {
        // Debt transfer: use arrow notation with badge
        if (sourceAccount && targetAccount) {
            description = `${sourceAccount} → ${targetAccount} (${formattedAmount})`;
            // Add existing note if any
            if (existingDesc) {
                description += ` – ${existingDesc}`;
            }
        } else {
            description = `Borç Transferi (${formattedAmount})`;
        }
    } else if (txType === 'transfer') {
        // Regular transfer
        if (sourceAccount && targetAccount) {
            description = `${sourceAccount} → ${targetAccount} (${formattedAmount})`;
        } else {
            description = `Transfer (${formattedAmount})`;
        }
        
        // Add existing note if any
        if (existingDesc) {
            description += ` – ${existingDesc}`;
        }
    }
    
    // Fallback to arrow notation if description is still empty
    if (!description && sourceAccount && targetAccount) {
        description = `${sourceAccount} → ${targetAccount} (${formattedAmount})`;
    }
    
    // Truncate if too long (max 120 chars for display)
    let displayDesc = description || existingDesc || '-';
    let fullDesc = displayDesc;
    
    if (displayDesc.length > 120) {
        displayDesc = displayDesc.substring(0, 117) + '...';
        // Return with title attribute for tooltip
        return `<span title="${fullDesc.replace(/"/g, '&quot;')}">${displayDesc}</span>`;
    }
    
    return displayDesc;
}

function renderTransactionList() {
    if (!transactionListEl) return;
    let timerStarted = false;
    try {
        console.time('home:list-render');
        timerStarted = true;

        transactionListEl.innerHTML = "";

        if (!state.selectedAccountId) {
            if (transactionCountEl) transactionCountEl.textContent = "0";
            renderEmptyMessage(transactionListEl, "Cari seçiniz.");
            renderLogList([]); // Clear logs too
            return;
        }

        const accountId = state.selectedAccountId;
        const relatedRecords = filterTransactionsByAccount(accountId);
        
        // Separate real transactions from system logs
        const { transactions: realTransactions, logs: systemLogs } = separateTransactionsAndLogs(relatedRecords);
        
        const filtered = applyTransactionFilters(realTransactions);
        const sorted = sortTransactions(filtered);

        if (transactionCountEl) transactionCountEl.textContent = `${sorted.length}`;
        
        // Render system logs separately
        renderLogList(systemLogs, accountId);

        if (!sorted.length) {
            const message = relatedTransactions.length === 0
                ? 'Bu cari için işlem geçmişi bulunmuyor.'
                : 'Seçilen filtrelere uygun işlem bulunmuyor.';
            renderEmptyMessage(transactionListEl, message);
            return;
        }

        const fragment = document.createDocumentFragment();
        
        // Apply affectsBalance filter if enabled
        const visibleTransactions = state.transactionFilters.showOnlyAffectsBalance
            ? sorted.filter(tx => {
                // Only show transactions that affect balance (affectsBalance !== false)
                const affectsBalance = tx.affectsBalance !== false; // Default to true
                return affectsBalance;
            })
            : sorted; // Show all transactions including non-balance-affecting ones

        visibleTransactions.forEach(tx => {
            // Use shared date utility for consistent formatting
            const tarih = formatTransactionDate(tx);
            const title = getTransactionTitle(tx, accountId);
            const netChange = getTransactionNetChange(tx, accountId);
            
            // Check if this is a debt transfer
            const txType = String(tx.islemTipi || '').toLowerCase().trim();
            const isDebtTransfer = (txType === 'transfer' && tx.kaynakCari && tx.hedefCari) ||
                                   txType === 'borç transferi' || 
                                   txType === 'borc transferi' || 
                                   txType === 'debt_transfer';
            
            // Check if transaction affects balance
            const affectsBalance = tx.affectsBalance !== false; // Default to true if not specified
            const isPending = isDebtTransfer && !affectsBalance;
            
            // Use type-based labels instead of direction-based
            const typeLabel = getTransactionTypeLabel(tx);
            const typeBadgeClass = getTransactionTypeBadgeClass(tx);
            const typeColorClass = getTransactionTypeColorClass(tx);
            
            // Only show – sign for negative amounts (outflows), not + for positive (inflows)
            const amountSign = netChange < 0 ? '–' : '';
            // Use standardized amount color classes
            let amountClass;
            if (isPending) {
                amountClass = 'amount-muted';
            } else if (netChange > 0) {
                amountClass = 'amount-positive';
            } else if (netChange < 0) {
                amountClass = 'amount-negative';
            } else {
                amountClass = 'text-gray-500';
            }
            const effectiveAmount = Math.abs(netChange) > 0 ? Math.abs(netChange) : Math.abs(Number(tx.toplamTutar || tx.tutar || 0));
            const formattedAmount = formatCurrency(effectiveAmount);
            let description = buildTransactionDescription(tx);

            if ((tx.islemTipi === 'gelir' || tx.islemTipi === 'gider') && typeof tx.vergiOrani !== 'undefined') {
                const vergisiz = formatCurrency(tx.tutar || 0);
                description += `
                    <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                       (${vergisiz} + %${tx.vergiOrani} KDV)
                    </div>
                `;
            }

            const item = document.createElement('div');
            // Apply standardized transaction card styling
            const cardClass = isPending ? 'transaction-card-muted' : 'transaction-card';
            item.className = `islem-item ${cardClass} flex justify-between items-center`;
            item.dataset.id = tx.id;
            
            // Build type badge HTML with standardized styling
            let badgeHTML = '';
            if (isPending) {
                // Pending transfer badge with standardized classes
                badgeHTML = `
                    <span class="badge-transfer-muted ml-2" title="Bu transfer bakiyeye dahil değil (affectsBalance=false)">
                        Transfer
                    </span>
                    <span class="badge-warning ml-2" title="Bakiyeye dahil değil">
                        ⚠️ Bakiyeye Dahil Değil
                    </span>
                `;
            } else if (typeLabel) {
                // Check if this is a transfer type for purple badge
                const txType = String(tx.islemTipi || '').toLowerCase().trim();
                const isTransferType = txType === 'transfer' || txType === 'borç transferi' || txType === 'borc transferi';
                const badgeClass = isTransferType ? 'badge-transfer' : typeBadgeClass;
                badgeHTML = `<span class="${badgeClass} ml-2">${typeLabel}</span>`;
            }
            
            // Add auto-payment badge
            const autoBadgeHTML = (tx.source === 'auto_from_expense') ?
                `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 ml-2" title="Gider kaydıyla birlikte otomatik oluşturuldu">🤖 Otomatik</span>` : '';
            
            // Use standardized typography classes
            const titleClass = isPending ? 'transaction-title-muted' : 'transaction-title';
            const subtitleClass = isPending ? 'transaction-subtitle-muted' : 'transaction-subtitle';
            
            item.innerHTML = `
                <div class="flex-grow">
                    <p class="${titleClass} flex items-center flex-wrap">
                        <span>${title}</span>
                        ${badgeHTML}
                        ${autoBadgeHTML}
                    </p>
                    <p class="${subtitleClass} mt-1">${description}</p>
                </div>
                <div class="text-right ml-4 flex-shrink-0 flex items-center gap-2">
                    <div>
                        <p class="font-bold text-lg ${amountClass}">${isPending ? '' : amountSign}${formattedAmount}</p>
                        <p class="${subtitleClass} mt-0.5">${tarih}</p>
                    </div>
                    <div class="flex flex-col gap-1">
                        <button data-id="${tx.id}" class="edit-islem-btn p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793z"/><path d="M11.379 5.793L4 13.172V16h2.828l7.379-7.379-2.828-2.828z"/></svg>
                        </button>
                        <button data-id="${tx.id}" class="delete-islem-btn p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors">
                           <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clip-rule="evenodd" /></svg>
                        </button>
                    </div>
                </div>
            `;
            fragment.appendChild(item);
        });

        transactionListEl.appendChild(fragment);
    } catch (error) {
        logHomeError(error);
    } finally {
        if (timerStarted) {
            try {
                console.timeEnd('home:list-render');
            } catch (error) {
                logHomeError(error);
            }
        }
    }
}

/**
 * Switch between tabs
 */
function switchTab(tabName) {
    state.activeTab = tabName;
    
    // Update tab button styles
    if (transactionsTabEl && logsTabEl) {
        const activeClasses = 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm';
        const inactiveClasses = 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200';
        
        if (tabName === 'transactions') {
            transactionsTabEl.className = `tab-button px-4 py-2 rounded-md font-medium text-sm transition ${activeClasses}`;
            logsTabEl.className = `tab-button px-4 py-2 rounded-md font-medium text-sm transition ${inactiveClasses}`;
        } else {
            transactionsTabEl.className = `tab-button px-4 py-2 rounded-md font-medium text-sm transition ${inactiveClasses}`;
            logsTabEl.className = `tab-button px-4 py-2 rounded-md font-medium text-sm transition ${activeClasses}`;
        }
    }
    
    // Show/hide tab content
    if (transactionsTabContentEl && logsTabContentEl) {
        if (tabName === 'transactions') {
            transactionsTabContentEl.classList.remove('hidden');
            logsTabContentEl.classList.add('hidden');
        } else {
            transactionsTabContentEl.classList.add('hidden');
            logsTabContentEl.classList.remove('hidden');
        }
    }
}

/**
 * Render system logs list
 */
function renderLogList(logs = [], accountId = null) {
    if (!logListEl) return;
    
    logListEl.innerHTML = "";
    
    // Update log count badge
    if (logCountEl) logCountEl.textContent = logs.length;
    
    console.log('[home:logs] Rendering', logs.length, 'system logs for account', accountId);
    
    // Show empty state if no logs
    if (!logs.length) {
        const emptyState = document.createElement('div');
        emptyState.className = 'bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border-2 border-dashed border-gray-300 dark:border-gray-700 p-8 rounded-2xl text-center';
        emptyState.innerHTML = `
            <div class="max-w-sm mx-auto">
                <div class="bg-gray-200 dark:bg-gray-700 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg class="w-6 h-6 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                    </svg>
                </div>
                <p class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Henüz sistem logu bulunmuyor
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-400">
                    Borç transferi, migration veya yönetici sıfırlama işlemleri burada görünecektir
                </p>
            </div>
        `;
        logListEl.appendChild(emptyState);
        return;
    }
    
    console.log('[home:logs] Rendering', logs.length, 'system logs');
    
    const sortedLogs = sortTransactions(logs);
    const fragment = document.createDocumentFragment();
    
    sortedLogs.forEach(log => {
        // Use shared date utility for consistent formatting
        const tarih = formatTransactionDate(log);
        const typeLabel = getLogTypeLabel(log);
        const description = getLogDescription(log, (id) => {
            const account = state.accounts.find(a => a.id === id);
            return account?.unvan || id;
        });
        
        // Use same card structure as transactions but with muted styling
        const logItem = document.createElement('div');
        logItem.className = 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 rounded-2xl shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors';
        
        const amount = Math.abs(Number(log.toplamTutar || log.tutar || 0));
        const formattedAmount = amount > 0 ? formatCurrency(amount) : '';
        
        logItem.innerHTML = `
            <div class="flex items-start justify-between">
                <div class="flex-grow flex items-start gap-2">
                    <!-- Info icon for logs -->
                    <svg class="w-4 h-4 text-gray-400 dark:text-gray-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
                    </svg>
                    <div class="flex-grow">
                        <div class="flex items-center gap-2 mb-1">
                            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-500/20 text-gray-500 dark:text-gray-400 border border-gray-500/30">
                                ${typeLabel}
                            </span>
                            ${log.needsReview ? `
                                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border border-yellow-500/30">
                                    İnceleme Gerekli
                                </span>
                            ` : ''}
                        </div>
                        <p class="text-base font-semibold text-gray-600 dark:text-gray-300">${description}</p>
                        ${log.aciklama ? `<p class="text-sm text-gray-500 dark:text-gray-400 mt-1">${log.aciklama}</p>` : ''}
                    </div>
                </div>
                <div class="text-right ml-4 flex-shrink-0">
                    ${formattedAmount ? `
                        <p class="font-bold text-lg text-gray-400 dark:text-gray-500">${formattedAmount}</p>
                    ` : ''}
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">${tarih}</p>
                </div>
            </div>
        `;
        
        fragment.appendChild(logItem);
    });
    
    logListEl.appendChild(fragment);
}

function openModal(id, payload = {}) {
    if (!id) return;
    if (typeof currentDeps.openLegacyModal === "function") {
        currentDeps.openLegacyModal(id, payload);
    }
    modalState.openIds.add(id);
}

function closeModal(id) {
    if (!id) return;
    if (typeof currentDeps.closeLegacyModal === "function") {
        currentDeps.closeLegacyModal(id);
    }
    modalState.openIds.delete(id);
}

function closeAllModals() {
    const ids = Array.from(modalState.openIds);
    ids.forEach(id => closeModal(id));
    modalState.openIds.clear();
}

function setAccountNotesStatus(message, { isError = false } = {}) {
    if (!accountNotesStatusEl) return;
    accountNotesStatusEl.textContent = message || '';
    accountNotesStatusEl.classList.toggle('text-red-500', Boolean(message) && isError);
}

function canModifyAccountNote(note) {
    const authorId = note?.authorId;
    if (!authorId) return true; // allow editing legacy notes without author metadata
    const currentUserId = getCurrentUserId();
    return Boolean(currentUserId && authorId === currentUserId);
}

function isAccountNoteEditing(noteId) {
    return state.accountNotes.editingId === noteId;
}

function resetAccountNoteEditState() {
    state.accountNotes.editingId = null;
    state.accountNotes.editingText = "";
    state.accountNotes.editSaving = false;
}

async function handleAccountNoteToggle(noteId, nextStatus) {
    if (!noteId) return;
    const normalizedStatus = nextStatus === 'completed' ? 'completed' : 'open';
    const index = state.accountNotes.items.findIndex(note => note.id === noteId);
    if (index === -1) return;
    const currentNote = state.accountNotes.items[index];
    if ((currentNote.status || 'open') === normalizedStatus) return;

    const previousSnapshot = { ...currentNote };
    const currentUserId = getCurrentUserId();
    const optimisticNote = {
        ...currentNote,
        status: normalizedStatus,
        completedAt: normalizedStatus === 'completed' ? new Date() : null,
        completedBy: normalizedStatus === 'completed' ? (currentUserId || currentNote.completedBy || null) : null
    };

    state.accountNotes.items.splice(index, 1, optimisticNote);
    state.accountNotes.completeInProgressId = noteId;
    renderAccountNotes();

    let timerStarted = false;
    try {
        console.time('notes:complete-toggle');
        timerStarted = true;
    } catch (error) {
        logAccountNoteCompleteError(error);
    }

    const toggler = currentDeps.toggleAccountNoteStatus || ((id, status) => toggleNoteStatusRepo(id, status));

    try {
        await toggler(noteId, normalizedStatus);
        if (typeof currentDeps.onAccountNoteStatusChanged === 'function') {
            try {
                currentDeps.onAccountNoteStatusChanged({ id: noteId, status: normalizedStatus, accountId: state.selectedAccountId });
            } catch (error) {
                logAccountNotesError(error);
            }
        }
        if (typeof currentDeps.showToast === 'function') {
            currentDeps.showToast(normalizedStatus === 'completed' ? 'Not tamamlandı.' : 'Not açık olarak işaretlendi.');
        }
        setAccountNotesStatus('');
        await loadAccountNotes(state.selectedAccountId);
    } catch (error) {
        logAccountNoteCompleteError(error);
        setAccountNotesStatus(error?.message || 'Not durumu güncellenirken bir hata oluştu.', { isError: true });
        const revertIndex = state.accountNotes.items.findIndex(note => note.id === noteId);
        if (revertIndex !== -1) {
            state.accountNotes.items.splice(revertIndex, 1, previousSnapshot);
        }
        state.accountNotes.completeInProgressId = null;
        renderAccountNotes();
    } finally {
        if (timerStarted) {
            try {
                console.timeEnd('notes:complete-toggle');
            } catch (error) {
                logAccountNoteCompleteError(error);
            }
        }
        state.accountNotes.completeInProgressId = null;
    }
}

function renderAccountNotes() {
    if (!accountNotesListEl) return;

    if (state.accountNotes.loading) {
        accountNotesListEl.innerHTML = '<p class="text-sm text-gray-500 dark:text-gray-400">Yükleniyor...</p>';
        return;
    }

    if (!state.accountNotes.items.length) {
        accountNotesListEl.innerHTML = state.selectedAccountId
            ? '<p class="text-sm text-gray-500 dark:text-gray-400">Bu cari için henüz not eklenmemiş.</p>'
            : '<p class="text-sm text-gray-500 dark:text-gray-400">Cari seçiniz.</p>';
        if (accountNotesCountEl) accountNotesCountEl.textContent = '0 Not';
        endAccountNotesFirstPaint();
        return;
    }

    const fragment = document.createDocumentFragment();
    state.accountNotes.items.forEach(note => {
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

        const titleEl = document.createElement('span');
        titleEl.className = 'text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-300';
        titleEl.textContent = 'Cari Notu';
        headerLeft.appendChild(titleEl);

        if (isCompleted) {
            const badge = document.createElement('span');
            badge.className = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-200 text-green-800 dark:bg-green-900/60 dark:text-green-200 text-xs font-semibold';
            badge.textContent = '✓ Tamamlandı';
            headerLeft.appendChild(badge);
        }

        if (note.updatedAt) {
            const editedBadge = document.createElement('span');
            editedBadge.className = 'text-xs font-semibold text-indigo-500 dark:text-indigo-200';
            editedBadge.textContent = 'Güncellendi';
            editedBadge.title = formatTimestampForDisplay(note.updatedAt);
            headerLeft.appendChild(editedBadge);
        }

        const headerRight = document.createElement('div');
        headerRight.className = 'flex flex-col items-end gap-2';

        const timeEl = document.createElement('span');
        timeEl.className = 'text-xs text-gray-500 dark:text-gray-400';
        timeEl.textContent = formatTimestampForDisplay(note.createdAt) || 'Tarih yok';
        headerRight.appendChild(timeEl);

        const canEdit = canModifyAccountNote(note);
        const editing = isAccountNoteEditing(note.id);

        if (canEdit) {
            const actions = document.createElement('div');
            actions.className = 'flex items-center gap-2';

            const toggleBtn = document.createElement('button');
            toggleBtn.type = 'button';
            toggleBtn.dataset.action = 'toggle-account-note';
            toggleBtn.dataset.id = note.id || '';
            toggleBtn.dataset.nextStatus = isCompleted ? 'open' : 'completed';
            toggleBtn.className = isCompleted
                ? 'text-xs font-semibold text-green-700 dark:text-green-300 focus:outline-none disabled:opacity-50'
                : 'text-xs font-semibold text-green-600 hover:text-green-500 focus:outline-none disabled:opacity-50';
            toggleBtn.textContent = isCompleted ? 'Geri Al' : 'Tamamlandı';
            toggleBtn.disabled = state.accountNotes.deleteInProgressId === note.id || state.accountNotes.completeInProgressId === note.id || state.accountNotes.editSaving || editing;
            actions.appendChild(toggleBtn);

            if (!editing) {
                const editBtn = document.createElement('button');
                editBtn.type = 'button';
                editBtn.dataset.action = 'edit-account-note';
                editBtn.dataset.id = note.id || '';
                editBtn.className = 'text-xs font-semibold text-indigo-600 hover:text-indigo-500 focus:outline-none disabled:opacity-50';
                editBtn.textContent = 'Düzenle';
                editBtn.disabled = state.accountNotes.deleteInProgressId === note.id;
                actions.appendChild(editBtn);
            }

            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.dataset.action = 'delete-account-note';
            deleteBtn.dataset.id = note.id || '';
            deleteBtn.className = 'text-xs font-semibold text-red-600 hover:text-red-500 focus:outline-none disabled:opacity-50';
            deleteBtn.textContent = state.accountNotes.deleteInProgressId === note.id ? 'Siliniyor...' : 'Sil';
            deleteBtn.disabled = state.accountNotes.deleteInProgressId === note.id || state.accountNotes.editSaving;
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
            textarea.className = 'account-note-edit-textarea w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-100 shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-h-[120px] p-2';
            textarea.value = state.accountNotes.editingText;
            textarea.disabled = state.accountNotes.editSaving;
            textarea.dataset.id = note.id || '';
            formWrapper.appendChild(textarea);

            const actionRow = document.createElement('div');
            actionRow.className = 'flex items-center justify-end gap-2';

            const cancelBtn = document.createElement('button');
            cancelBtn.type = 'button';
            cancelBtn.dataset.action = 'cancel-account-note-edit';
            cancelBtn.dataset.id = note.id || '';
            cancelBtn.className = 'px-3 py-1 rounded-md bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs font-semibold focus:outline-none';
            cancelBtn.textContent = 'Vazgeç';
            cancelBtn.disabled = state.accountNotes.editSaving;
            actionRow.appendChild(cancelBtn);

            const saveBtn = document.createElement('button');
            saveBtn.type = 'button';
            saveBtn.dataset.action = 'save-account-note-edit';
            saveBtn.dataset.id = note.id || '';
            saveBtn.className = 'px-3 py-1 rounded-md bg-indigo-600 text-white text-xs font-semibold focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed';
            saveBtn.textContent = state.accountNotes.editSaving ? 'Kaydediliyor...' : 'Kaydet';
            const trimmed = state.accountNotes.editingText.trim();
            const original = (note.text || '').trim();
            const isDirty = trimmed && trimmed !== original;
            saveBtn.disabled = state.accountNotes.editSaving || !isDirty;
            actionRow.appendChild(saveBtn);

            formWrapper.appendChild(actionRow);
            card.appendChild(formWrapper);
        } else {
            const contentEl = document.createElement('p');
            contentEl.className = 'text-sm text-gray-800 dark:text-gray-100 whitespace-pre-wrap';
            contentEl.textContent = note.text || '';
            card.appendChild(contentEl);

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

    accountNotesListEl.innerHTML = '';
    accountNotesListEl.appendChild(fragment);
    if (accountNotesCountEl) accountNotesCountEl.textContent = `${state.accountNotes.items.length} Not`;
    endAccountNotesFirstPaint();
}

async function loadAccountNotes(accountId) {
    if (!accountNotesPanelEl) return;

    if (!accountId) {
        state.accountNotes.items = [];
        state.accountNotes.loading = false;
        renderAccountNotes();
        return;
    }

    const token = ++accountNotesLoadToken;
    state.accountNotes.loading = true;
    setAccountNotesStatus('');
    renderAccountNotes();
    startAccountNotesFirstPaint();

    const fetcher = typeof currentDeps.fetchAccountNotesFor === 'function'
        ? currentDeps.fetchAccountNotesFor
        : fetchAccountNotesFor;

    try {
        await ensureAuthUser().catch(() => null);
        const notes = await fetcher(accountId, 50);
        if (!mounted || token !== accountNotesLoadToken) return;
        state.accountNotes.items = Array.isArray(notes) ? notes.map(mapAccountNotePayload) : [];
        if (state.accountNotes.editingId && !state.accountNotes.items.some(note => note.id === state.accountNotes.editingId)) {
            resetAccountNoteEditState();
        }
    } catch (error) {
        if (!mounted || token !== accountNotesLoadToken) return;
        logAccountNotesError(error);
        setAccountNotesStatus('Cari notları yüklenirken bir hata oluştu.', { isError: true });
        state.accountNotes.items = [];
    } finally {
        if (!mounted || token !== accountNotesLoadToken) return;
        state.accountNotes.loading = false;
        state.accountNotes.completeInProgressId = null;
        renderAccountNotes();
    }
}

async function handleAccountNoteSave(event) {
    if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
    }
    if (!state.selectedAccountId || !accountNotesTextareaEl || state.accountNotes.saving) return;

    const text = (accountNotesTextareaEl.value || '').trim();
    if (!text) {
        setAccountNotesStatus('Lütfen kaydetmeden önce bir not yazın.', { isError: true });
        return;
    }

    state.accountNotes.saving = true;
    setAccountNotesStatus('Kaydediliyor...');
    if (accountNotesSaveBtnEl) accountNotesSaveBtnEl.disabled = true;

    const creator = typeof currentDeps.createAccountNote === 'function'
        ? currentDeps.createAccountNote
        : createAccountNote;

    try {
        await creator({ accountId: state.selectedAccountId, text });
        if (!mounted) return;
        accountNotesTextareaEl.value = '';
        setAccountNotesStatus('Not kaydedildi.');
        if (typeof currentDeps.onAccountNoteCreated === 'function') {
            currentDeps.onAccountNoteCreated({ accountId: state.selectedAccountId });
        }
        loadAccountNotes(state.selectedAccountId);
        if (typeof currentDeps.showToast === 'function') {
            currentDeps.showToast('Cari notu eklendi.');
        }
    } catch (error) {
        if (!mounted) return;
        logAccountNotesError(error);
        setAccountNotesStatus(error?.message || 'Not kaydedilirken bir hata oluştu.', { isError: true });
        if (typeof currentDeps.showToast === 'function') {
            currentDeps.showToast(error?.message || 'Not kaydedilirken bir hata oluştu.', true);
        }
    } finally {
        if (!mounted) return;
        state.accountNotes.saving = false;
        if (accountNotesSaveBtnEl) accountNotesSaveBtnEl.disabled = false;
    }
}

function startAccountNoteEdit(noteId) {
    const note = state.accountNotes.items.find(item => item.id === noteId);
    if (!note || !canModifyAccountNote(note)) return;
    state.accountNotes.editingId = noteId;
    state.accountNotes.editingText = note.text || '';
    state.accountNotes.editSaving = false;
    renderAccountNotes();
}

function cancelAccountNoteEdit() {
    resetAccountNoteEditState();
    renderAccountNotes();
}

async function saveAccountNoteEdit(noteId) {
    if (!isAccountNoteEditing(noteId) || state.accountNotes.editSaving) return;
    const note = state.accountNotes.items.find(item => item.id === noteId);
    if (!note) return;

    const trimmed = state.accountNotes.editingText.trim();
    if (!trimmed) {
        setAccountNotesStatus('Not metni zorunludur.', { isError: true });
        return;
    }

    state.accountNotes.editSaving = true;
    let timerStarted = false;
    try {
        console.time('notes:edit');
        timerStarted = true;
    } catch (error) {
        logAccountNoteEditError(error);
    }
    renderAccountNotes();

    await ensureAuthUser().catch(() => null);
    const currentUserId = getCurrentUserId();
    const updater = currentDeps.updateAccountNote || ((id, payload) => updateNote(id, payload));
    try {
        await updater(noteId, {
            text: trimmed,
            authorId: note.authorId || currentUserId || null
        });
        if (!mounted) return;
        resetAccountNoteEditState();
        setAccountNotesStatus('');
        if (typeof currentDeps.showToast === 'function') {
            currentDeps.showToast('Not güncellendi.');
        }
        if (typeof currentDeps.onAccountNoteUpdated === 'function') {
            try {
                currentDeps.onAccountNoteUpdated({ accountId: state.selectedAccountId });
            } catch (error) {
                logAccountNotesError(error);
            }
        }
        await loadAccountNotes(state.selectedAccountId);
    } catch (error) {
        if (!mounted) return;
        logAccountNoteEditError(error);
        setAccountNotesStatus(error?.message || 'Not düzenlenirken bir hata oluştu.', { isError: true });
        if (typeof currentDeps.showToast === 'function') {
            currentDeps.showToast(error?.message || 'Not düzenlenirken bir hata oluştu.', true);
        }
    } finally {
        if (timerStarted) {
            try {
                console.timeEnd('notes:edit');
            } catch (error) {
                logAccountNoteEditError(error);
            }
        }
        if (mounted) {
            state.accountNotes.editSaving = false;
            renderAccountNotes();
        }
    }
}

function requestAccountNoteDelete(noteId) {
    const note = state.accountNotes.items.find(item => item.id === noteId);
    if (!note || !canModifyAccountNote(note)) return;

    const message = 'Bu notu silmek istediğinize emin misiniz?';
    const payload = {
        title: 'Notu Sil',
        message,
        onConfirm: () => {
            executeAccountNoteDelete(noteId);
        }
    };
    openModal('confirmation', payload);
}

async function executeAccountNoteDelete(noteId) {
    if (state.accountNotes.deleteInProgressId === noteId) return;
    const note = state.accountNotes.items.find(item => item.id === noteId);
    if (!note || !canModifyAccountNote(note)) return;

    state.accountNotes.deleteInProgressId = noteId;
    let timerStarted = false;
    try {
        console.time('notes:delete');
        timerStarted = true;
    } catch (error) {
        logAccountNoteDeleteError(error);
    }
    renderAccountNotes();

    const deleter = currentDeps.deleteAccountNote || (id => deleteNote(id));
    try {
        await deleter(noteId);
        if (!mounted) return;
        setAccountNotesStatus('');
        if (typeof currentDeps.showToast === 'function') {
            currentDeps.showToast('Not silindi.');
        }
        if (typeof currentDeps.onAccountNoteDeleted === 'function') {
            try {
                currentDeps.onAccountNoteDeleted({ accountId: state.selectedAccountId });
            } catch (error) {
                logAccountNotesError(error);
            }
        }
        if (isAccountNoteEditing(noteId)) {
            resetAccountNoteEditState();
        }
        await loadAccountNotes(state.selectedAccountId);
    } catch (error) {
        if (!mounted) return;
        logAccountNoteDeleteError(error);
        setAccountNotesStatus(error?.message || 'Not silinirken bir hata oluştu.', { isError: true });
        if (typeof currentDeps.showToast === 'function') {
            currentDeps.showToast(error?.message || 'Not silinirken bir hata oluştu.', true);
        }
    } finally {
        if (timerStarted) {
            try {
                console.timeEnd('notes:delete');
            } catch (error) {
                logAccountNoteDeleteError(error);
            }
        }
        if (mounted) {
            state.accountNotes.deleteInProgressId = null;
            renderAccountNotes();
        }
    }
}

function handleAccountNotesListClick(event) {
    if (!accountNotesListEl) return;
    const trigger = event.target.closest('[data-action]');
    if (!trigger || !accountNotesListEl.contains(trigger)) return;
    const noteId = trigger.dataset.id || '';
    const action = trigger.dataset.action;

    switch (action) {
        case 'edit-account-note':
            startAccountNoteEdit(noteId);
            break;
        case 'cancel-account-note-edit':
            cancelAccountNoteEdit();
            break;
        case 'save-account-note-edit':
            saveAccountNoteEdit(noteId);
            break;
        case 'delete-account-note':
            requestAccountNoteDelete(noteId);
            break;
        case 'toggle-account-note':
            handleAccountNoteToggle(noteId, trigger.dataset.nextStatus || 'open');
            break;
        default:
            break;
    }
}

function handleAccountNotesListInput(event) {
    if (!accountNotesListEl) return;
    const target = event.target;
    if (!target || !target.classList.contains('account-note-edit-textarea')) return;
    const noteId = target.dataset.id || '';
    if (!isAccountNoteEditing(noteId)) return;
    state.accountNotes.editingText = target.value || '';
    const saveBtn = accountNotesListEl.querySelector(`button[data-action="save-account-note-edit"][data-id="${noteId}"]`);
    if (saveBtn) {
        const note = state.accountNotes.items.find(item => item.id === noteId);
        const trimmed = state.accountNotes.editingText.trim();
        const original = (note?.text || '').trim();
        const isDirty = Boolean(trimmed && trimmed !== original);
        saveBtn.disabled = state.accountNotes.editSaving || !isDirty;
    }
}

function handleAccountNoteKeydown(event) {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        handleAccountNoteSave(event);
    }
}

function handleSearchInput(event) {
    state.searchQuery = (event.target.value || "").toString();
    renderAccountList();
}

function handleAccountListClick(event) {
    const deleteBtn = event.target.closest(".delete-cari-btn");
    if (deleteBtn) {
        const accountId = deleteBtn.dataset.id;
        const accountName = deleteBtn.dataset.unvan;
        if (typeof currentDeps.onAccountDelete === "function") {
            currentDeps.onAccountDelete({ id: accountId, name: accountName });
        }
        return;
    }

    const item = event.target.closest(".cari-item");
    if (item) {
        const accountId = item.dataset.id;
        if (typeof currentDeps.onAccountSelect === "function") {
            currentDeps.onAccountSelect(accountId);
        }
    }
}

function openCreateTransaction(accountId = null) {
    const resolvedId = accountId || state.selectedAccountId || null;
    openModal('transaction', {
        mode: 'create',
        accountId: resolvedId,
        account: findAccount(resolvedId)
    });
}

function handlePrimaryNewTransactionClick() {
    openCreateTransaction();
}

function handleDetailNewTransactionClick() {
    if (!state.selectedAccountId) return;
    openModal('transaction', {
        mode: 'create',
        accountId: state.selectedAccountId,
        account: findAccount(state.selectedAccountId)
    });
}

function handleTransactionEdit(transactionId) {
    const transaction = findTransaction(transactionId);
    if (!transaction) return;
    openModal('transaction', {
        mode: 'edit',
        transactionId,
        transaction,
        accountId: state.selectedAccountId
    });
}

function handleTransactionDelete(transactionId) {
    const transaction = findTransaction(transactionId);
    if (!transaction) return;

    const payload = {
        title: 'İşlemi Sil',
        message: 'Bu işlemi silmek istediğinize emin misiniz? Bu işlem, ilgili cari bakiyesini de güncelleyecektir.',
        onConfirm: () => {
            if (typeof currentDeps.legacyDelete === 'function') {
                return currentDeps.legacyDelete({ transaction });
            }
            return undefined;
        }
    };
    openModal('confirmation', payload);
}

function handleTransactionListClick(event) {
    const deleteBtn = event.target.closest('.delete-islem-btn');
    if (deleteBtn) {
        handleTransactionDelete(deleteBtn.dataset.id);
        return;
    }

    const editBtn = event.target.closest('.edit-islem-btn');
    if (editBtn) {
        handleTransactionEdit(editBtn.dataset.id);
        return;
    }

    const item = event.target.closest('.islem-item');
    if (item && typeof currentDeps.onTransactionShow === 'function') {
        currentDeps.onTransactionShow(item.dataset.id);
    }
}

function handleDetailBackButtonClick(event) {
    if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
    }
    try {
        if (typeof currentDeps.onDetailBack === 'function') {
            currentDeps.onDetailBack();
        }
    } catch (error) {
        logHomeError(error);
    }
}

function handleTransactionDetailBackClick(event) {
    if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
    }
    try {
        if (typeof currentDeps.onTransactionBack === 'function') {
            currentDeps.onTransactionBack();
        }
    } catch (error) {
        logHomeError(error);
    }
}

function handleTransactionDetailEditClick(event) {
    if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
    }
    try {
        if (typeof currentDeps.onTransactionEdit === 'function') {
            currentDeps.onTransactionEdit();
        }
    } catch (error) {
        logHomeError(error);
    }
}

function handleTransactionDetailDeleteClick(event) {
    if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
    }
    try {
        if (typeof currentDeps.onTransactionDelete === 'function') {
            currentDeps.onTransactionDelete();
        }
    } catch (error) {
        logHomeError(error);
    }
}

function handleDashboardSelectChange(event) {
    try {
        if (typeof currentDeps.onDashboardBankChange === 'function') {
            currentDeps.onDashboardBankChange(event?.target?.value || "");
        }
    } catch (error) {
        logHomeError(error);
    }
}

function handleDashboardDetailsClick(event) {
    if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
    }
    try {
        if (typeof currentDeps.onDashboardViewDetails === 'function') {
            currentDeps.onDashboardViewDetails();
        }
    } catch (error) {
        logHomeError(error);
    }
}

function handleFilterTypeChange(event) {
    state.transactionFilters.type = event.target.value || "";
    renderTransactionList();
}

function handleFilterStartChange(event) {
    const newStart = parseDateValue(event.target.value, false);
    if (state.transactionFilters.end && newStart && newStart > state.transactionFilters.end) {
        if (typeof currentDeps.showToast === 'function') {
            currentDeps.showToast('Başlangıç tarihi, bitiş tarihinden büyük olamaz.', true);
        }
        event.target.value = formatDateForInput(state.transactionFilters.start);
        return;
    }
    state.transactionFilters.start = newStart;
    renderTransactionList();
}

function handleFilterEndChange(event) {
    const newEnd = parseDateValue(event.target.value, true);
    if (state.transactionFilters.start && newEnd && newEnd < state.transactionFilters.start) {
        if (typeof currentDeps.showToast === 'function') {
            currentDeps.showToast('Bitiş tarihi, başlangıç tarihinden küçük olamaz.', true);
        }
        event.target.value = formatDateForInput(state.transactionFilters.end);
        return;
    }
    state.transactionFilters.end = newEnd;
    renderTransactionList();
}

function handleFilterReset(event) {
    if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
    }
    resetTransactionFilters();
}

function handleAffectsBalanceFilterChange(event) {
    state.transactionFilters.showOnlyAffectsBalance = event.target.checked;
    renderTransactionList();
}

function handleExportAccountsClick(event) {
    if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
    }
    
    try {
        const displayAccounts = filterAccounts();
        
        if (!displayAccounts || displayAccounts.length === 0) {
            if (typeof currentDeps.showToast === 'function') {
                currentDeps.showToast('Dışa aktarılacak cari bulunamadı.', true);
            }
            return;
        }
        
        const isFiltered = state.searchQuery && state.searchQuery.trim().length > 0;
        const filename = isFiltered 
            ? `cariler_filtrelenmis_${new Date().toISOString().split('T')[0]}.csv`
            : null;
        
        exportAccountsToCSV(displayAccounts, filename);
        
        const message = isFiltered
            ? `${displayAccounts.length} cari (filtrelenmiş sonuçlar) başarıyla CSV formatında dışa aktarıldı.`
            : `${displayAccounts.length} cari başarıyla CSV formatında dışa aktarıldı.`;
        
        if (typeof currentDeps.showToast === 'function') {
            currentDeps.showToast(message);
        }
    } catch (error) {
        logHomeError(error);
        if (typeof currentDeps.showToast === 'function') {
            currentDeps.showToast(error?.message || 'CSV dışa aktarma sırasında bir hata oluştu.', true);
        }
    }
}

function handleExportTransactionsClick(event) {
    if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
    }
    
    try {
        if (!state.selectedAccountId) {
            if (typeof currentDeps.showToast === 'function') {
                currentDeps.showToast('Lütfen önce bir cari seçin.', true);
            }
            return;
        }
        
        const accountId = state.selectedAccountId;
        const relatedTransactions = filterTransactionsByAccount(accountId);
        const filtered = applyTransactionFilters(relatedTransactions);
        const sorted = sortTransactions(filtered);
        
        if (!sorted || sorted.length === 0) {
            if (typeof currentDeps.showToast === 'function') {
                currentDeps.showToast('Dışa aktarılacak işlem bulunamadı.', true);
            }
            return;
        }
        
        const account = findAccount(accountId);
        const accountName = account ? account.unvan : 'cari';
        const sanitizedName = accountName.replace(/[^a-zA-Z0-9-_]/g, '_').toLowerCase();
        
        const hasFilters = state.transactionFilters.type || 
                          state.transactionFilters.start || 
                          state.transactionFilters.end;
        
        const filename = hasFilters
            ? `${sanitizedName}_islemler_filtrelenmis_${new Date().toISOString().split('T')[0]}.csv`
            : `${sanitizedName}_islemler_${new Date().toISOString().split('T')[0]}.csv`;
        
        // Pass findAccount function to export for account type detection
        exportTransactionsToCSV(sorted, getAccountName, filename, findAccount);
        
        const message = hasFilters
            ? `${sorted.length} işlem (filtrelenmiş) başarıyla CSV formatında dışa aktarıldı.`
            : `${sorted.length} işlem başarıyla CSV formatında dışa aktarıldı.`;
        
        if (typeof currentDeps.showToast === 'function') {
            currentDeps.showToast(message);
        }
    } catch (error) {
        logHomeError(error);
        if (typeof currentDeps.showToast === 'function') {
            currentDeps.showToast(error?.message || 'CSV dışa aktarma sırasında bir hata oluştu.', true);
        }
    }
}

function attachEventListeners() {
    if (searchInputEl) {
        searchInputEl.addEventListener('input', handleSearchInput);
    }
    if (listContainerEl) {
        listContainerEl.addEventListener('click', handleAccountListClick);
    }
    if (exportAccountsBtnEl) {
        exportAccountsBtnEl.addEventListener('click', handleExportAccountsClick);
    }
    if (exportTransactionsBtnEl) {
        exportTransactionsBtnEl.addEventListener('click', handleExportTransactionsClick);
    }
    if (newTransactionBtnEl) {
        newTransactionBtnEl.addEventListener('click', handleDetailNewTransactionClick);
    }
    if (primaryNewTransactionBtnEl) {
        primaryNewTransactionBtnEl.addEventListener('click', handlePrimaryNewTransactionClick);
    }
    if (transactionListEl) {
        transactionListEl.addEventListener('click', handleTransactionListClick);
    }
    if (transactionsTabEl) {
        transactionsTabEl.addEventListener('click', () => switchTab('transactions'));
    }
    if (logsTabEl) {
        logsTabEl.addEventListener('click', () => switchTab('logs'));
    }
    if (detailBackBtnEl) {
        detailBackBtnEl.addEventListener('click', handleDetailBackButtonClick);
    }
    if (transactionBackBtnEl) {
        transactionBackBtnEl.addEventListener('click', handleTransactionDetailBackClick);
    }
    if (transactionEditBtnEl) {
        transactionEditBtnEl.addEventListener('click', handleTransactionDetailEditClick);
    }
    if (transactionDeleteBtnEl) {
        transactionDeleteBtnEl.addEventListener('click', handleTransactionDetailDeleteClick);
    }
    if (dashboardSelectEl) {
        dashboardSelectEl.addEventListener('change', handleDashboardSelectChange);
    }
    if (dashboardViewDetailsBtnEl) {
        dashboardViewDetailsBtnEl.addEventListener('click', handleDashboardDetailsClick);
    }
    if (filterTypeEl) {
        filterTypeEl.addEventListener('change', handleFilterTypeChange);
    }
    if (filterStartEl) {
        filterStartEl.addEventListener('change', handleFilterStartChange);
    }
    if (filterEndEl) {
        filterEndEl.addEventListener('change', handleFilterEndChange);
    }
    if (filterResetBtnEl) {
        filterResetBtnEl.addEventListener('click', handleFilterReset);
    }
    if (affectsBalanceFilterEl) {
        affectsBalanceFilterEl.addEventListener('change', handleAffectsBalanceFilterChange);
    }
    if (accountNotesSaveBtnEl) {
        accountNotesSaveBtnEl.addEventListener('click', handleAccountNoteSave);
    }
    if (accountNotesTextareaEl) {
        accountNotesTextareaEl.addEventListener('keydown', handleAccountNoteKeydown);
    }
    if (accountNotesListEl) {
        accountNotesListEl.addEventListener('click', handleAccountNotesListClick);
        accountNotesListEl.addEventListener('input', handleAccountNotesListInput);
    }
}

function detachEventListeners() {
    if (searchInputEl) {
        searchInputEl.removeEventListener('input', handleSearchInput);
    }
    if (listContainerEl) {
        listContainerEl.removeEventListener('click', handleAccountListClick);
    }
    if (exportAccountsBtnEl) {
        exportAccountsBtnEl.removeEventListener('click', handleExportAccountsClick);
    }
    if (exportTransactionsBtnEl) {
        exportTransactionsBtnEl.removeEventListener('click', handleExportTransactionsClick);
    }
    if (newTransactionBtnEl) {
        newTransactionBtnEl.removeEventListener('click', handleDetailNewTransactionClick);
    }
    if (primaryNewTransactionBtnEl) {
        primaryNewTransactionBtnEl.removeEventListener('click', handlePrimaryNewTransactionClick);
    }
    if (transactionListEl) {
        transactionListEl.removeEventListener('click', handleTransactionListClick);
    }
    if (filterTypeEl) {
        filterTypeEl.removeEventListener('change', handleFilterTypeChange);
    }
    if (detailBackBtnEl) {
        detailBackBtnEl.removeEventListener('click', handleDetailBackButtonClick);
    }
    if (transactionBackBtnEl) {
        transactionBackBtnEl.removeEventListener('click', handleTransactionDetailBackClick);
    }
    if (transactionEditBtnEl) {
        transactionEditBtnEl.removeEventListener('click', handleTransactionDetailEditClick);
    }
    if (transactionDeleteBtnEl) {
        transactionDeleteBtnEl.removeEventListener('click', handleTransactionDetailDeleteClick);
    }
    if (dashboardSelectEl) {
        dashboardSelectEl.removeEventListener('change', handleDashboardSelectChange);
    }
    if (dashboardViewDetailsBtnEl) {
        dashboardViewDetailsBtnEl.removeEventListener('click', handleDashboardDetailsClick);
    }
    if (filterStartEl) {
        filterStartEl.removeEventListener('change', handleFilterStartChange);
    }
    if (filterEndEl) {
        filterEndEl.removeEventListener('change', handleFilterEndChange);
    }
    if (filterResetBtnEl) {
        filterResetBtnEl.removeEventListener('click', handleFilterReset);
    }
    if (affectsBalanceFilterEl) {
        affectsBalanceFilterEl.removeEventListener('change', handleAffectsBalanceFilterChange);
    }
    if (accountNotesSaveBtnEl) {
        accountNotesSaveBtnEl.removeEventListener('click', handleAccountNoteSave);
    }
    if (accountNotesTextareaEl) {
        accountNotesTextareaEl.removeEventListener('keydown', handleAccountNoteKeydown);
    }
    if (accountNotesListEl) {
        accountNotesListEl.removeEventListener('click', handleAccountNotesListClick);
        accountNotesListEl.removeEventListener('input', handleAccountNotesListInput);
    }
}

function mount(container, deps = {}) {
    if (!container) {
        console.warn('[home.view] mount called without container');
        return;
    }

    currentRoot = container;
    currentDeps = deps;

    searchInputEl = container.querySelector('#cariSearchInput');
    listContainerEl = container.querySelector('#cariList');
    exportAccountsBtnEl = container.querySelector('#exportAccountsBtn');
    exportTransactionsBtnEl = container.querySelector('#exportTransactionsBtn');
    detailNameEl = container.querySelector('#detailCariUnvan');
    detailTypeEl = container.querySelector('#detailCariTipi');
    detailBalanceEl = container.querySelector('#detailCariBakiye');
    transactionListEl = container.querySelector('#islemList');
    transactionCountEl = container.querySelector('#detailIslemCount');
    logListEl = container.querySelector('#logList');
    logCountEl = container.querySelector('#detailLogCount');
    transactionsTabEl = container.querySelector('#transactionsTab');
    logsTabEl = container.querySelector('#logsTab');
    transactionsTabContentEl = container.querySelector('#transactionsTabContent');
    logsTabContentEl = container.querySelector('#logsTabContent');
    newTransactionBtnEl = container.querySelector('#detailIslemBtn');
    primaryNewTransactionBtnEl = container.querySelector('#openModalBtn');
    filterTypeEl = container.querySelector('#detailIslemTipFilter');
    filterStartEl = container.querySelector('#detailIslemStart');
    filterEndEl = container.querySelector('#detailIslemEnd');
    filterResetBtnEl = container.querySelector('#detailResetFilters');
    affectsBalanceFilterEl = container.querySelector('#affectsBalanceFilter');
    detailBackBtnEl = container.querySelector('#backToListBtn');
    transactionBackBtnEl = container.querySelector('#islemDetailBackBtn');
    transactionEditBtnEl = container.querySelector('#islemDetailEditBtn');
    transactionDeleteBtnEl = container.querySelector('#islemDetailDeleteBtn');
    dashboardSelectEl = container.querySelector('#dashboardBankSelect');
    dashboardViewDetailsBtnEl = container.querySelector('#dashboardViewDetailsBtn');
    accountNotesPanelEl = container.querySelector('#accountNotesPanel');
    accountNotesListEl = container.querySelector('#accountNotesList');
    accountNotesCountEl = container.querySelector('#accountNotesCount');
    accountNotesTextareaEl = container.querySelector('#accountNotesTextarea');
    accountNotesSaveBtnEl = container.querySelector('#accountNotesSaveBtn');
    accountNotesStatusEl = container.querySelector('#accountNotesStatus');

    if (searchInputEl) {
        searchInputEl.value = state.searchQuery;
    }
    if (filterTypeEl) filterTypeEl.value = state.transactionFilters.type || '';
    if (filterStartEl) filterStartEl.value = formatDateForInput(state.transactionFilters.start);
    if (filterEndEl) filterEndEl.value = formatDateForInput(state.transactionFilters.end);
    if (affectsBalanceFilterEl) affectsBalanceFilterEl.checked = state.transactionFilters.showOnlyAffectsBalance !== false;

    attachEventListeners();
    if (currentRoot) currentRoot.classList.remove('hidden');
    startFirstPaintTimer();
    renderAccountList();
    renderTransactionList();
    if (accountNotesPanelEl) {
        accountNotesPanelEl.classList.toggle('hidden', !state.selectedAccountId);
        if (state.selectedAccountId) {
            startAccountNotesFirstPaint();
            loadAccountNotes(state.selectedAccountId);
        } else {
            renderAccountNotes();
        }
    }
    mounted = true;
}

function unmount() {
    detachEventListeners();
    closeAllModals();
    if (currentRoot) currentRoot.classList.add('hidden');
    searchInputEl = null;
    listContainerEl = null;
    exportAccountsBtnEl = null;
    exportTransactionsBtnEl = null;
    detailNameEl = null;
    detailTypeEl = null;
    detailBalanceEl = null;
    transactionListEl = null;
    transactionCountEl = null;
    logListEl = null;
    logCountEl = null;
    transactionsTabEl = null;
    logsTabEl = null;
    transactionsTabContentEl = null;
    logsTabContentEl = null;
    newTransactionBtnEl = null;
    primaryNewTransactionBtnEl = null;
    filterTypeEl = null;
    filterStartEl = null;
    filterEndEl = null;
    filterResetBtnEl = null;
    detailBackBtnEl = null;
    transactionBackBtnEl = null;
    transactionEditBtnEl = null;
    transactionDeleteBtnEl = null;
    dashboardSelectEl = null;
    dashboardViewDetailsBtnEl = null;
    accountNotesPanelEl = null;
    accountNotesListEl = null;
    accountNotesCountEl = null;
    accountNotesTextareaEl = null;
    accountNotesSaveBtnEl = null;
    accountNotesStatusEl = null;
    state.accountNotes.items = [];
    state.accountNotes.loading = false;
    state.accountNotes.saving = false;
    state.accountNotes.firstPaintPending = false;
    resetAccountNoteEditState();
    state.accountNotes.deleteInProgressId = null;
    state.accountNotes.completeInProgressId = null;
    accountNotesLoadToken += 1;
    if (firstPaintPending) {
        try {
            console.timeEnd('home:first-paint');
        } catch (error) {
            logHomeError(error);
        } finally {
            firstPaintPending = false;
        }
    }
    currentRoot = null;
    currentDeps = {};
    mounted = false;
}

function setAccounts(accounts = []) {
    state.accounts = Array.isArray(accounts) ? accounts.slice() : [];
    if (state.selectedAccountId) {
        const matched = findAccount(state.selectedAccountId);
        if (!matched) {
            state.selectedAccountId = null;
        }
        updateDetailHeader(matched);
    }
    renderAccountList();
    renderTransactionList();
}

function setTransactions(transactions = []) {
    state.transactions = Array.isArray(transactions) ? transactions.slice() : [];
    renderTransactionList();
}

function resetTransactionFilters(options = {}) {
    state.transactionFilters = defaultTransactionFilters();
    if (filterTypeEl) filterTypeEl.value = '';
    if (filterStartEl) filterStartEl.value = '';
    if (filterEndEl) filterEndEl.value = '';
    if (affectsBalanceFilterEl) affectsBalanceFilterEl.checked = true;
    if (!options.silent) {
        renderTransactionList();
    }
}

function setSelectedAccount(account) {
    const previousId = state.selectedAccountId;
    state.selectedAccountId = account && account.id ? account.id : null;
    resetAccountNoteEditState();
    state.accountNotes.deleteInProgressId = null;
    updateDetailHeader(account || null);
    if (previousId !== state.selectedAccountId) {
        resetTransactionFilters({ silent: true });
    }
    renderTransactionList();
    if (accountNotesPanelEl) {
        if (state.selectedAccountId) {
            accountNotesPanelEl.classList.remove('hidden');
            setAccountNotesStatus('');
            startAccountNotesFirstPaint();
            loadAccountNotes(state.selectedAccountId);
        } else {
            accountNotesPanelEl.classList.add('hidden');
            state.accountNotes.items = [];
            state.accountNotes.loading = false;
            setAccountNotesStatus('');
            renderAccountNotes();
        }
    }
}

export default {
    mount,
    unmount,
    isMounted: () => mounted,
    getRoot: () => currentRoot,
    getDeps: () => ({ ...currentDeps }),
    setAccounts,
    setTransactions,
    setSelectedAccount,
    resetTransactionFilters,
    setSearchQuery: value => {
        state.searchQuery = value || '';
        renderAccountList();
    },
    modal: {
        open: openModal,
        close: closeModal
    }
};
