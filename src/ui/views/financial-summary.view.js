/**
 * Financial Summary View
 * 
 * Comprehensive financial reporting with:
 * - Phase 1: Summary panel with date range selector (presets + custom)
 * - Phase 2: Detailed transaction table with CSV export
 * - Phase 3: Advanced filters and insights panels
 */

import {
    calculateFinancialSummary,
    getDateRangeForPreset,
    getDateRangeLabel,
    formatCurrency as formatCurrencyUtil,
    DATE_RANGE_PRESETS,
    filterTransactionsByDateRange
} from '../../utils/financial-summary.js';
import {
    formatTransactionDate,
    getTransactionDate as getTransactionDateUtil,
    sortTransactionsByDateDesc
} from '../../utils/date-utils.js';
import { 
    getTransactionDirection, 
    getDirectionLabel,
    getDirectionColorClass, 
    getDirectionBadgeClass, 
    ensureTransactionDirection,
    getTransactionTypeLabel,
    getTransactionTypeBadgeClass,
    getTransactionTypeColorClass
} from '../../utils/transaction-direction.js';
import { convertToCSV, downloadCSV } from '../../utils/csv-export.js';

let currentRoot = null;
let currentDeps = {};
let mounted = false;

// State management
const state = {
    transactions: [],
    accounts: [],
    dateRangePreset: DATE_RANGE_PRESETS.ALL_TIME,
    customStartDate: null,
    customEndDate: null,
    filters: {
        accountId: '',
        transactionType: '',
        showOnlyAffectsBalance: true // Filter to show only balance-affecting transactions by default
    },
    summary: null,
    reportMode: 'income' // 'income' or 'cashflow'
};

// DOM Elements
let summaryIncomeEl = null;
let summaryExpenseEl = null;
// summaryTransfersEl removed - transfers now included in expenses
let summaryBalanceEl = null;
let summaryIncomeLabelEl = null;
let summaryExpenseLabelEl = null;
let summaryBalanceLabelEl = null;
let reportModeTitleEl = null;
let dateRangeSelectEl = null;
let dateRangeLabelEl = null;
let accountFilterEl = null;
let typeFilterEl = null;
let customStartDateEl = null;
let customEndDateEl = null;
let reportTableBodyEl = null;
let reportSummaryRowEl = null;
let exportCsvBtnEl = null;
let filterResetBtnEl = null;
let topExpenseAccountsEl = null;
let topIncomeSourcesEl = null;
let transactionCountEl = null;
let reportModeToggleEl = null;
let reportAffectsBalanceFilterEl = null;

function logReportError(error) {
    console.warn('[report:error]', error);
}

/**
 * SINGLE SOURCE OF TRUTH: Select visible transaction rows based on report mode
 * This is the ONLY function that decides which transactions are visible
 * @param {Array} transactions - All transactions
 * @param {string} mode - 'income' or 'cashflow'
 * @returns {Array} Filtered transactions
 */
function selectReportRows(transactions, mode) {
    if (!Array.isArray(transactions)) return [];
    
    // Define which transaction types are visible in each mode
    // Debt transfers are shown in BOTH modes for transparency (but don't affect P&L calculations)
    const incomeTypes = ['gelir', 'gider', 'borç transferi', 'borc transferi', 'debt_transfer']; // P&L: Revenue, Expenses, and Balance Adjustments
    const cashflowTypes = ['tahsilat', 'ödeme', 'odeme', 'transfer', 'borç transferi', 'borc transferi', 'debt_transfer']; // Cash movements
    
    const visibleTypes = mode === 'income' ? incomeTypes : cashflowTypes;
    
    console.log(`[Financial Report] selectReportRows called with mode: ${mode}`);
    console.log(`[Financial Report] Visible types for ${mode} mode:`, visibleTypes.join(', '));
    
    // Filter ONLY by type - NEVER by direction for visibility
    const filtered = transactions.filter(tx => {
        const type = String(tx.islemTipi || '').toLowerCase().trim();
        return visibleTypes.includes(type);
    });
    
    console.log(`[Financial Report] Filtered ${filtered.length} out of ${transactions.length} transactions`);
    
    return filtered;
}

/**
 * Get current date range based on preset or custom dates
 */
function getCurrentDateRange() {
    if (state.dateRangePreset === 'custom') {
        return {
            start: state.customStartDate,
            end: state.customEndDate
        };
    }
    return getDateRangeForPreset(state.dateRangePreset);
}

/**
 * Get account by ID
 */
function getAccount(accountId) {
    if (!accountId) return null;
    
    if (typeof currentDeps.getAccount === 'function') {
        return currentDeps.getAccount(accountId);
    }
    
    return state.accounts.find(acc => acc.id === accountId) || null;
}

/**
 * Get account name by ID
 */
function getAccountName(accountId) {
    if (!accountId) return 'Bilinmeyen';
    
    if (typeof currentDeps.getAccountName === 'function') {
        return currentDeps.getAccountName(accountId);
    }
    
    const account = getAccount(accountId);
    return account ? account.unvan : 'Bilinmeyen';
}

/**
 * Get transaction date
 */
function getTransactionDate(transaction) {
    if (typeof currentDeps.getTransactionDate === 'function') {
        return currentDeps.getTransactionDate(transaction);
    }
    return getTransactionDateUtil(transaction);
}

/**
 * Format currency
 */
function formatCurrency(value) {
    return formatCurrencyUtil(value);
}

/**
 * Get filtered transactions based on all active filters
 * Uses selectReportRows as the FIRST filter to ensure single source of truth
 */
function getFilteredTransactions() {
    // STEP 1: Apply report mode selector (single source of truth)
    let filtered = selectReportRows(state.transactions, state.reportMode);
    
    // STEP 2: Apply date range filter
    const dateRange = getCurrentDateRange();
    if (dateRange.start || dateRange.end) {
        filtered = filterTransactionsByDateRange(filtered, dateRange.start, dateRange.end);
    }
    
    // STEP 3: Apply account filter
    if (state.filters.accountId) {
        filtered = filtered.filter(tx => 
            tx.islemCari === state.filters.accountId ||
            tx.kaynakCari === state.filters.accountId ||
            tx.hedefCari === state.filters.accountId
        );
    }
    
    // STEP 4: Apply transaction type filter (within visible types)
    if (state.filters.transactionType) {
        filtered = filtered.filter(tx => 
            tx.islemTipi === state.filters.transactionType
        );
    }
    
    // STEP 5: Apply affectsBalance filter
    if (state.filters.showOnlyAffectsBalance) {
        filtered = filtered.filter(tx => tx.affectsBalance !== false); // Default to true if not specified
    }
    
    return filtered;
}

/**
 * Calculate and update financial summary
 */
function updateSummary() {
    const filtered = getFilteredTransactions();
    const dateRange = getCurrentDateRange();
    
    // Pass mode from state (single source of truth)
    state.summary = calculateFinancialSummary(filtered, {
        startDate: dateRange.start,
        endDate: dateRange.end,
        getAccount: getAccount,
        mode: state.reportMode // Use state.reportMode for consistency
    });
    
    renderSummaryCards();
    renderInsights();
}

/**
 * Phase 1: Render summary cards
 */
function renderSummaryCards() {
    if (!state.summary) return;
    
    // Update labels based on report mode
    const isIncomeMode = state.reportMode === 'income';
    
    if (reportModeTitleEl) {
        reportModeTitleEl.textContent = isIncomeMode 
            ? 'Gelir ve Gider Raporu' 
            : 'Nakit Akış Raporu';
    }
    
    if (summaryIncomeLabelEl) {
        summaryIncomeLabelEl.textContent = isIncomeMode 
            ? 'TOPLAM GELİR' 
            : 'NAKİT GİRİŞİ';
    }
    
    if (summaryExpenseLabelEl) {
        summaryExpenseLabelEl.textContent = isIncomeMode 
            ? 'TOPLAM GİDER' 
            : 'NAKİT ÇIKIŞI';
    }
    
    if (summaryBalanceLabelEl) {
        summaryBalanceLabelEl.textContent = isIncomeMode 
            ? 'NET BAKİYE' 
            : 'NET NAKİT';
    }
    
    if (summaryIncomeEl) {
        const incomeText = formatCurrency(state.summary.totalIncome);
        summaryIncomeEl.textContent = incomeText;
        summaryIncomeEl.setAttribute('title', incomeText); // Add tooltip for truncated values
    }
    
    if (summaryExpenseEl) {
        const expenseText = formatCurrency(state.summary.totalExpense);
        summaryExpenseEl.textContent = expenseText;
        // Note: totalExpense now includes debt transfers
        summaryExpenseEl.setAttribute('title', expenseText); // Add tooltip for truncated values
    }
    
    // summaryTransfersEl removed - transfers now included in totalExpense
    
    if (summaryBalanceEl) {
        const balance = state.summary.netBalance;
        const balanceText = formatCurrency(balance);
        summaryBalanceEl.textContent = balanceText;
        summaryBalanceEl.setAttribute('title', balanceText); // Add tooltip for truncated values
        
        // Update color based on balance
        summaryBalanceEl.classList.remove('amount-income', 'amount-expense', 'amount-neutral');
        if (balance > 0) {
            summaryBalanceEl.classList.add('amount-income');
        } else if (balance < 0) {
            summaryBalanceEl.classList.add('amount-expense');
        } else {
            summaryBalanceEl.classList.add('amount-neutral');
        }
    }
    
    if (dateRangeLabelEl) {
        if (state.dateRangePreset === 'custom') {
            const start = state.customStartDate ? state.customStartDate.toLocaleDateString('tr-TR') : '';
            const end = state.customEndDate ? state.customEndDate.toLocaleDateString('tr-TR') : '';
            dateRangeLabelEl.textContent = `${start} - ${end}`;
        } else {
            dateRangeLabelEl.textContent = getDateRangeLabel(state.dateRangePreset);
        }
    }
    
    if (transactionCountEl) {
        transactionCountEl.textContent = `${state.summary.totalCount} işlem`;
    }
}

/**
 * Phase 2: Render transaction table
 */
function renderTransactionTable() {
    if (!reportTableBodyEl) return;
    
    try {
        reportTableBodyEl.innerHTML = '';
        
        const filtered = getFilteredTransactions();
        
        // Sort by date descending using shared utility
        const sorted = sortTransactionsByDateDesc(filtered);
        
        if (sorted.length === 0) {
            const emptyRow = document.createElement('tr');
            emptyRow.className = 'bg-card-bg';
            emptyRow.innerHTML = `
                <td colspan="5" class="px-6 py-8 text-center text-neutral-text">
                    Seçilen kriterlere uygun işlem bulunamadı.
                </td>
            `;
            reportTableBodyEl.appendChild(emptyRow);
            return;
        }
        
        // Render transaction rows
        sorted.forEach((tx, index) => {
            // Check if this is a debt transfer (comprehensive check matching home.view.js)
            const txType = String(tx.islemTipi || '').toLowerCase().trim();
            const isDebtTransfer = (txType === 'transfer' && tx.kaynakCari && tx.hedefCari) ||
                                   txType === 'borç transferi' || 
                                   txType === 'borc transferi' || 
                                   txType === 'debt_transfer';
            
            // Debug logging for debt transfers
            if (tx.kaynakCari && tx.hedefCari) {
                console.log('[Financial Report] Transaction:', {
                    type: tx.islemTipi,
                    normalized: txType,
                    hasSource: !!tx.kaynakCari,
                    hasTarget: !!tx.hedefCari,
                    isDebtTransfer
                });
            }
            
            // Check if transaction affects balance
            const affectsBalance = tx.affectsBalance !== false; // Default to true if not specified
            const shouldDim = !state.filters.showOnlyAffectsBalance && !affectsBalance;
            
            // Get transaction type label and badge
            const typeLabel = getTransactionTypeLabel(tx);
            let badgeClass = getTransactionTypeBadgeClass(tx);
            
            // Use purple badge styling for debt transfers
            if (isDebtTransfer) {
                // Use inline styles with Tailwind classes as fallback
                badgeClass = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap';
                console.log('[Financial Report] Applied debt transfer badge to:', typeLabel);
            }
            
            // Determine amount color
            let amountClass;
            if (isDebtTransfer) {
                // Neutral white for debt transfers
                amountClass = 'text-[#E8E9EB]';
            } else {
                // Use standardized colors for other transactions
                const txWithDirection = ensureTransactionDirection(tx);
                const direction = txWithDirection.direction || 0;
                if (direction === +1) {
                    amountClass = 'amount-positive';
                } else if (direction === -1) {
                    amountClass = 'amount-negative';
                } else {
                    amountClass = 'text-gray-500';
                }
            }
            
            // Get formatted date using shared utility
            const dateStr = formatTransactionDate(tx);
            
            // Get amount
            const amount = Math.abs(Number(tx.toplamTutar || tx.tutar || 0));
            
            // Get description - special handling for debt transfers
            let description;
            if (isDebtTransfer && tx.kaynakCari && tx.hedefCari) {
                const sourceAccount = getAccountName(tx.kaynakCari);
                const targetAccount = getAccountName(tx.hedefCari);
                description = `${sourceAccount} → ${targetAccount}`;
            } else {
                description = tx.aciklama || '-';
            }
            
            // Get account name
            const accountName = getAccountName(tx.islemCari || tx.kaynakCari || tx.hedefCari);
            
            // Create row with alternating dark tones and optional dimming
            const row = document.createElement('tr');
            let rowClass = index % 2 === 0 ? 'bg-[#151A22]' : 'bg-[#1A1F2A]';
            if (shouldDim) {
                rowClass += ' opacity-50';
            }
            row.className = rowClass;
            row.innerHTML = `
                <td class="px-4 py-3 text-sm text-[#E8E9EB] whitespace-nowrap">${dateStr}</td>
                <td class="px-4 py-3 text-sm whitespace-nowrap">
                    <span class="${badgeClass}" ${isDebtTransfer ? 'style="background: rgba(139, 92, 246, 0.2); color: #C4B5FD; border: 1px solid rgba(139, 92, 246, 0.3);"' : ''}>${typeLabel}</span>
                </td>
                <td class="px-4 py-3 text-sm text-[#E8E9EB]">${description}</td>
                <td class="px-4 py-3 text-sm font-bold ${amountClass} text-right whitespace-nowrap">${formatCurrency(amount)}</td>
                <td class="px-4 py-3 text-sm text-[#E8E9EB] whitespace-nowrap">${accountName}</td>
            `;
            reportTableBodyEl.appendChild(row);
        });
        
        // Render summary row
        if (reportSummaryRowEl && state.summary) {
            const hasTransfers = state.summary.totalTransfers > 0;
            reportSummaryRowEl.innerHTML = `
                <td colspan="3" class="px-4 py-3 text-sm font-bold transaction-title text-right">Toplam:</td>
                <td class="px-4 py-3 text-sm font-bold text-right">
                    <div class="flex flex-col gap-1 items-end">
                        <div class="amount-positive">Gelir: ${formatCurrency(state.summary.totalIncome)}</div>
                        <div class="amount-negative">
                            Gider: ${formatCurrency(state.summary.totalExpense)}
                            ${hasTransfers ? `<span class="text-purple-400 text-xs ml-2" title="Borç transferleri dahil (${formatCurrency(state.summary.totalTransfers)})">↔</span>` : ''}
                        </div>
                        <div class="${state.summary.netBalance >= 0 ? 'amount-positive' : 'amount-negative'}">
                            Net: ${formatCurrency(state.summary.netBalance)}
                        </div>
                    </div>
                </td>
                <td class="px-4 py-3 text-sm transaction-subtitle">${state.summary.totalCount} işlem</td>
            `;
        }
    } catch (error) {
        logReportError(error);
    }
}

/**
 * Phase 3: Render insights panels
 */
function renderInsights() {
    renderTopExpenseAccounts();
    renderTopIncomeSources();
}

/**
 * Calculate top accounts by total amount
 */
function getTopAccountsByDirection(direction, limit = 5) {
    const filtered = getFilteredTransactions();
    const accountTotals = new Map();
    
    filtered.forEach(tx => {
        const txWithDirection = ensureTransactionDirection(tx);
        if (txWithDirection.direction !== direction) return;
        
        const accountId = tx.islemCari || tx.kaynakCari || tx.hedefCari;
        if (!accountId) return;
        
        const amount = Math.abs(Number(tx.toplamTutar || tx.tutar || 0));
        accountTotals.set(accountId, (accountTotals.get(accountId) || 0) + amount);
    });
    
    // Convert to array and sort
    const sorted = Array.from(accountTotals.entries())
        .map(([accountId, total]) => ({
            accountId,
            accountName: getAccountName(accountId),
            total
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, limit);
    
    return sorted;
}

/**
 * Render top expense accounts
 */
function renderTopExpenseAccounts() {
    if (!topExpenseAccountsEl) return;
    
    const topAccounts = getTopAccountsByDirection(-1, 5);
    
    if (topAccounts.length === 0) {
        topExpenseAccountsEl.innerHTML = '<p class="text-sm text-neutral-text">Veri yok</p>';
        return;
    }
    
    const maxAmount = topAccounts[0]?.total || 1;
    
    topExpenseAccountsEl.innerHTML = '';
    topAccounts.forEach((item, index) => {
        const percentage = (item.total / maxAmount) * 100;
        
        const row = document.createElement('div');
        row.className = 'space-y-1';
        row.innerHTML = `
            <div class="flex justify-between text-sm">
                <span class="text-neutral-text">${index + 1}. ${item.accountName}</span>
                <span class="font-semibold amount-expense">${formatCurrency(item.total)}</span>
            </div>
            <div class="w-full bg-card-border rounded-full h-2 overflow-hidden">
                <div class="bg-expense h-full rounded-full transition-all duration-700 ease-out" 
                     style="width: ${percentage}%"></div>
            </div>
        `;
        topExpenseAccountsEl.appendChild(row);
    });
}

/**
 * Render top income sources
 */
function renderTopIncomeSources() {
    if (!topIncomeSourcesEl) return;
    
    const topAccounts = getTopAccountsByDirection(+1, 5);
    
    if (topAccounts.length === 0) {
        topIncomeSourcesEl.innerHTML = '<p class="text-sm text-neutral-text">Veri yok</p>';
        return;
    }
    
    const maxAmount = topAccounts[0]?.total || 1;
    
    topIncomeSourcesEl.innerHTML = '';
    topAccounts.forEach((item, index) => {
        const percentage = (item.total / maxAmount) * 100;
        
        const row = document.createElement('div');
        row.className = 'space-y-1';
        row.innerHTML = `
            <div class="flex justify-between text-sm">
                <span class="text-neutral-text">${index + 1}. ${item.accountName}</span>
                <span class="font-semibold amount-income">${formatCurrency(item.total)}</span>
            </div>
            <div class="w-full bg-card-border rounded-full h-2 overflow-hidden">
                <div class="bg-income h-full rounded-full transition-all duration-700 ease-out" 
                     style="width: ${percentage}%"></div>
            </div>
        `;
        topIncomeSourcesEl.appendChild(row);
    });
}

/**
 * Phase 2: Export to CSV
 */
function handleExportCSV() {
    const filtered = getFilteredTransactions();
    
    if (filtered.length === 0) {
        if (typeof currentDeps.showToast === 'function') {
            currentDeps.showToast('Dışa aktarılacak işlem bulunamadı.', true);
        }
        return;
    }
    
    // Prepare data for CSV
    const csvData = filtered.map(tx => {
        const amount = Math.abs(Number(tx.toplamTutar || tx.tutar || 0));
        const typeLabel = getTransactionTypeLabel(tx);
        
        // Special handling for debt transfers (comprehensive check)
        const txType = String(tx.islemTipi || '').toLowerCase().trim();
        const isDebtTransfer = (txType === 'transfer' && tx.kaynakCari && tx.hedefCari) ||
                               txType === 'borç transferi' || 
                               txType === 'borc transferi' || 
                               txType === 'debt_transfer';
        
        let description = tx.aciklama || '';
        if (isDebtTransfer && tx.kaynakCari && tx.hedefCari) {
            const sourceAccount = getAccountName(tx.kaynakCari);
            const targetAccount = getAccountName(tx.hedefCari);
            description = `${sourceAccount} → ${targetAccount}`;
        }
        
        return {
            tarih: formatTransactionDate(tx),  // Use shared date utility
            islem: typeLabel,  // Transaction type label (matches table column "İşlem")
            aciklama: description,
            tutar: amount,
            cari: getAccountName(tx.islemCari || tx.kaynakCari || tx.hedefCari)
        };
    });
    
    const fieldMapping = {
        'tarih': 'Tarih',
        'islem': 'İşlem',
        'aciklama': 'Açıklama',
        'tutar': 'Tutar',
        'cari': 'Cari'
    };
    
    const orderedFields = ['tarih', 'islem', 'aciklama', 'tutar', 'cari'];
    
    const csvContent = convertToCSV(csvData, orderedFields, fieldMapping);
    const filename = `financial_report_${new Date().toISOString().split('T')[0]}.csv`;
    
    try {
        downloadCSV(csvContent, filename);
        if (typeof currentDeps.showToast === 'function') {
            currentDeps.showToast(`${filtered.length} işlem başarıyla dışa aktarıldı.`);
        }
    } catch (error) {
        console.error('[Financial Report] CSV export error:', error);
        if (typeof currentDeps.showToast === 'function') {
            currentDeps.showToast('CSV dışa aktarma sırasında bir hata oluştu.', true);
        }
    }
}

/**
 * Event Handlers
 */
function handleDateRangeChange(event) {
    state.dateRangePreset = event.target.value;
    
    if (state.dateRangePreset === 'custom') {
        if (customStartDateEl) customStartDateEl.classList.remove('hidden');
        if (customEndDateEl) customEndDateEl.classList.remove('hidden');
    } else {
        if (customStartDateEl) customStartDateEl.classList.add('hidden');
        if (customEndDateEl) customEndDateEl.classList.add('hidden');
        state.customStartDate = null;
        state.customEndDate = null;
    }
    
    updateSummary();
    renderTransactionTable();
}

function handleCustomDateChange() {
    if (customStartDateEl?.value) {
        state.customStartDate = new Date(customStartDateEl.value);
        state.customStartDate.setHours(0, 0, 0, 0);
    }
    
    if (customEndDateEl?.value) {
        state.customEndDate = new Date(customEndDateEl.value);
        state.customEndDate.setHours(23, 59, 59, 999);
    }
    
    updateSummary();
    renderTransactionTable();
}

function handleAccountFilterChange(event) {
    state.filters.accountId = event.target.value;
    updateSummary();
    renderTransactionTable();
}

function handleTypeFilterChange(event) {
    state.filters.transactionType = event.target.value;
    updateSummary();
    renderTransactionTable();
}

function handleAffectsBalanceFilterChange(event) {
    state.filters.showOnlyAffectsBalance = event.target.checked;
    updateSummary();
    renderTransactionTable();
}

function handleReportModeChange(event) {
    const oldMode = state.reportMode;
    state.reportMode = event.target.value;
    
    console.log(`[Financial Report] Report mode changed: ${oldMode} → ${state.reportMode}`);
    
    // Reset transaction type filter when mode changes
    state.filters.transactionType = '';
    if (typeFilterEl) typeFilterEl.value = '';
    
    // Repopulate type filter with mode-appropriate options
    populateFilters();
    
    // Log filtered transactions before and after
    const filtered = getFilteredTransactions();
    console.log(`[Financial Report] Visible transactions after mode change: ${filtered.length}`);
    console.log(`[Financial Report] Transaction types in view:`, 
        [...new Set(filtered.map(tx => tx.islemTipi))].join(', '));
    
    updateSummary();
    renderTransactionTable();
}

function handleResetFilters() {
    state.dateRangePreset = DATE_RANGE_PRESETS.ALL_TIME;
    state.customStartDate = null;
    state.customEndDate = null;
    state.filters.accountId = '';
    state.filters.transactionType = '';
    state.filters.showOnlyAffectsBalance = true;
    
    if (dateRangeSelectEl) dateRangeSelectEl.value = DATE_RANGE_PRESETS.ALL_TIME;
    if (accountFilterEl) accountFilterEl.value = '';
    if (typeFilterEl) typeFilterEl.value = '';
    if (reportAffectsBalanceFilterEl) reportAffectsBalanceFilterEl.checked = true;
    if (customStartDateEl) {
        customStartDateEl.value = '';
        customStartDateEl.classList.add('hidden');
    }
    if (customEndDateEl) {
        customEndDateEl.value = '';
        customEndDateEl.classList.add('hidden');
    }
    
    updateSummary();
    renderTransactionTable();
}

/**
 * Populate filter options
 */
function populateFilters() {
    // Populate account filter
    if (accountFilterEl && state.accounts) {
        accountFilterEl.innerHTML = '<option value="">Tüm Cariler</option>';
        state.accounts.forEach(account => {
            const option = document.createElement('option');
            option.value = account.id;
            option.textContent = account.unvan;
            accountFilterEl.appendChild(option);
        });
    }
    
    // Populate type filter - ONLY show types relevant to current mode
    if (typeFilterEl) {
        // Get visible transactions based on mode
        const visibleTransactions = selectReportRows(state.transactions, state.reportMode);
        
        const types = new Set();
        visibleTransactions.forEach(tx => {
            if (tx.islemTipi) types.add(tx.islemTipi);
        });
        
        typeFilterEl.innerHTML = '<option value="">Tüm Tipler</option>';
        Array.from(types).sort().forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type;
            typeFilterEl.appendChild(option);
        });
    }
}

/**
 * Mount the view
 */
function mount(container, deps = {}) {
    if (!container) {
        console.warn('[Financial Report] mount called without container');
        return;
    }
    
    currentRoot = container;
    currentDeps = deps;
    
    // Get DOM elements
    summaryIncomeEl = container.querySelector('#summaryIncome');
    summaryExpenseEl = container.querySelector('#summaryExpense');
    // summaryTransfersEl removed - transfers now included in expenses
    summaryBalanceEl = container.querySelector('#summaryBalance');
    summaryIncomeLabelEl = container.querySelector('#summaryIncomeLabel');
    summaryExpenseLabelEl = container.querySelector('#summaryExpenseLabel');
    summaryBalanceLabelEl = container.querySelector('#summaryBalanceLabel');
    reportModeTitleEl = container.querySelector('#reportModeTitle');
    reportModeToggleEl = container.querySelector('#reportModeToggle');
    dateRangeSelectEl = container.querySelector('#dateRangeSelect');
    dateRangeLabelEl = container.querySelector('#dateRangeLabel');
    accountFilterEl = container.querySelector('#accountFilter');
    typeFilterEl = container.querySelector('#typeFilter');
    customStartDateEl = container.querySelector('#customStartDate');
    customEndDateEl = container.querySelector('#customEndDate');
    reportTableBodyEl = container.querySelector('#reportTableBody');
    reportSummaryRowEl = container.querySelector('#reportSummaryRow');
    exportCsvBtnEl = container.querySelector('#exportCsvBtn');
    filterResetBtnEl = container.querySelector('#filterResetBtn');
    topExpenseAccountsEl = container.querySelector('#topExpenseAccounts');
    topIncomeSourcesEl = container.querySelector('#topIncomeSources');
    transactionCountEl = container.querySelector('#transactionCount');
    reportAffectsBalanceFilterEl = container.querySelector('#reportAffectsBalanceFilter');
    
    // Attach event listeners
    if (reportModeToggleEl) {
        reportModeToggleEl.addEventListener('change', handleReportModeChange);
    }
    if (dateRangeSelectEl) {
        dateRangeSelectEl.addEventListener('change', handleDateRangeChange);
    }
    if (customStartDateEl) {
        customStartDateEl.addEventListener('change', handleCustomDateChange);
    }
    if (customEndDateEl) {
        customEndDateEl.addEventListener('change', handleCustomDateChange);
    }
    if (accountFilterEl) {
        accountFilterEl.addEventListener('change', handleAccountFilterChange);
    }
    if (typeFilterEl) {
        typeFilterEl.addEventListener('change', handleTypeFilterChange);
    }
    if (reportAffectsBalanceFilterEl) {
        reportAffectsBalanceFilterEl.addEventListener('change', handleAffectsBalanceFilterChange);
    }
    if (exportCsvBtnEl) {
        exportCsvBtnEl.addEventListener('click', handleExportCSV);
    }
    if (filterResetBtnEl) {
        filterResetBtnEl.addEventListener('click', handleResetFilters);
    }
    
    mounted = true;
    
    // Initial render
    populateFilters();
    updateSummary();
    renderTransactionTable();
}

/**
 * Unmount the view
 */
function unmount() {
    if (reportModeToggleEl) {
        reportModeToggleEl.removeEventListener('change', handleReportModeChange);
    }
    if (dateRangeSelectEl) {
        dateRangeSelectEl.removeEventListener('change', handleDateRangeChange);
    }
    if (customStartDateEl) {
        customStartDateEl.removeEventListener('change', handleCustomDateChange);
    }
    if (customEndDateEl) {
        customEndDateEl.removeEventListener('change', handleCustomDateChange);
    }
    if (accountFilterEl) {
        accountFilterEl.removeEventListener('change', handleAccountFilterChange);
    }
    if (typeFilterEl) {
        typeFilterEl.removeEventListener('change', handleTypeFilterChange);
    }
    if (reportAffectsBalanceFilterEl) {
        reportAffectsBalanceFilterEl.removeEventListener('change', handleAffectsBalanceFilterChange);
    }
    if (exportCsvBtnEl) {
        exportCsvBtnEl.removeEventListener('click', handleExportCSV);
    }
    if (filterResetBtnEl) {
        filterResetBtnEl.removeEventListener('click', handleResetFilters);
    }
    
    currentRoot = null;
    currentDeps = {};
    mounted = false;
}

/**
 * Set transactions data
 */
function setTransactions(transactions) {
    state.transactions = Array.isArray(transactions) ? transactions : [];
    if (mounted) {
        populateFilters();
        updateSummary();
        renderTransactionTable();
    }
}

/**
 * Set accounts data
 */
function setAccounts(accounts) {
    state.accounts = Array.isArray(accounts) ? accounts : [];
    if (mounted) {
        populateFilters();
        renderInsights();
    }
}

export default {
    mount,
    unmount,
    setTransactions,
    setAccounts,
    isMounted: () => mounted
};
