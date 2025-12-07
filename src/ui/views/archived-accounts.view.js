/**
 * Archived Accounts View
 * Displays archived accounts that are hidden from the main cariler page
 */

import { 
    getAccountType, 
    getAccountTypeLabel, 
    isInternalAccount, 
    isExternalAccount,
    getInternalAccounts,
    getExternalAccounts
} from "../../utils/account-type.js";

let currentRoot = null;
let currentDeps = {};
let mounted = false;

let searchInputEl = null;
let listContainerEl = null;
let backBtnEl = null;

const state = {
    archivedAccounts: [],
    searchQuery: ""
};

function logError(error) {
    console.warn('[archived-accounts:error]', error);
}

function formatCurrency(value) {
    const numeric = Number(value) || 0;
    return Math.abs(numeric).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });
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

    return basicFields.some(field => typeof field === "string" && field.toLowerCase().includes(normalized));
}

function filterAccounts() {
    // Filter archived accounts based on search query
    if (!state.searchQuery) return state.archivedAccounts;
    return state.archivedAccounts.filter(account => accountMatchesSearch(account, state.searchQuery));
}

function renderEmptyMessage(container, message) {
    if (!container) return;
    container.innerHTML = `<p class="text-gray-500 dark:text-gray-400">${message}</p>`;
}

function renderAccountList() {
    if (!listContainerEl) return;
    try {
        listContainerEl.innerHTML = "";

        if (!state.archivedAccounts.length) {
            renderEmptyMessage(listContainerEl, "Arşivlenmiş cari bulunmuyor.");
            return;
        }

        const displayAccounts = filterAccounts();
        if (!displayAccounts.length) {
            renderEmptyMessage(listContainerEl, "Arama kriterlerine uygun arşivlenmiş cari bulunamadı.");
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
                    Banka Hesapları / Kasa (Arşivlenmiş)
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
                    Cariler (Tedarikçi / Müşteri) (Arşivlenmiş)
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
        logError(error);
    }
}

function createAccountListItem(account, isInternal) {
    const bakiye = Number(account.bakiye || 0);
    const bakiyeRenk = bakiye > 0 ? "text-green-500" : (bakiye < 0 ? "text-red-500" : "text-gray-500");
    const accountTypeLabel = getAccountTypeLabel(getAccountType(account));
    
    // Muted styling for archived accounts
    const bgClass = isInternal 
        ? "bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200/50 dark:border-blue-800/50 opacity-75" 
        : "bg-gray-50/50 dark:bg-gray-700/50 opacity-75";

    const wrapper = document.createElement("div");
    wrapper.className = `${bgClass} p-4 rounded-lg flex justify-between items-center transition-all mb-2`;
    wrapper.innerHTML = `
        <div class="flex-grow cursor-pointer archived-cari-item" data-id="${account.id}">
            <div class="flex items-center gap-2">
                <p class="font-semibold text-lg">${account.unvan}</p>
                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200">Arşivlenmiş</span>
                ${isInternal ? '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200">Banka/Kasa</span>' : ''}
            </div>
            <p class="text-sm text-gray-500 dark:text-gray-400">${account.tipi || accountTypeLabel}</p>
        </div>
        <div class="flex items-center flex-shrink-0">
            <div class="text-right mr-4 cursor-pointer archived-cari-item" data-id="${account.id}">
                <p class="font-bold text-xl ${bakiyeRenk}">${formatCurrency(bakiye)}</p>
                <p class="text-xs text-gray-500 dark:text-gray-400">Bakiye</p>
            </div>
        </div>
    `;
    return wrapper;
}

function handleSearchInput(event) {
    state.searchQuery = (event.target.value || "").toString();
    renderAccountList();
}

function handleAccountListClick(event) {
    const item = event.target.closest(".archived-cari-item");
    if (item) {
        const accountId = item.dataset.id;
        if (accountId && typeof currentDeps.onAccountSelect === "function") {
            try {
                currentDeps.onAccountSelect(accountId);
            } catch (error) {
                logError(error);
                console.error('[archived-accounts] Error selecting account:', error);
            }
        }
    }
}

function handleBackClick(event) {
    if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
    }
    try {
        if (typeof currentDeps.onBack === 'function') {
            currentDeps.onBack();
        }
    } catch (error) {
        logError(error);
    }
}

function attachEventListeners() {
    if (searchInputEl) {
        searchInputEl.addEventListener('input', handleSearchInput);
    }
    if (listContainerEl) {
        listContainerEl.addEventListener('click', handleAccountListClick);
    }
    if (backBtnEl) {
        backBtnEl.addEventListener('click', handleBackClick);
    }
}

function detachEventListeners() {
    if (searchInputEl) {
        searchInputEl.removeEventListener('input', handleSearchInput);
    }
    if (listContainerEl) {
        listContainerEl.removeEventListener('click', handleAccountListClick);
    }
    if (backBtnEl) {
        backBtnEl.removeEventListener('click', handleBackClick);
    }
}

function mount(container, deps = {}) {
    if (!container) {
        console.warn('[archived-accounts.view] mount called without container');
        return;
    }

    currentRoot = container;
    currentDeps = deps;

    searchInputEl = container.querySelector('#archivedAccountsSearchInput');
    listContainerEl = container.querySelector('#archivedAccountsList');
    backBtnEl = container.querySelector('#archivedAccountsBackBtn');

    if (searchInputEl) {
        searchInputEl.value = state.searchQuery;
    }

    attachEventListeners();
    if (currentRoot) currentRoot.classList.remove('hidden');
    renderAccountList();
    mounted = true;
}

function unmount() {
    detachEventListeners();
    if (currentRoot) currentRoot.classList.add('hidden');
    searchInputEl = null;
    listContainerEl = null;
    backBtnEl = null;
    currentRoot = null;
    currentDeps = {};
    mounted = false;
}

function setArchivedAccounts(accounts = []) {
    state.archivedAccounts = Array.isArray(accounts) ? accounts.slice() : [];
    renderAccountList();
}

export default {
    mount,
    unmount,
    isMounted: () => mounted,
    getRoot: () => currentRoot,
    getDeps: () => ({ ...currentDeps }),
    setArchivedAccounts
};




