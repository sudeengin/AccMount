/**
 * Financial Summary Utility
 * 
 * Aggregates transaction data based on direction values (+1 / -1)
 * to calculate income, expenses, and net balance over date ranges.
 * 
 * Supports two calculation modes:
 * - income: Debt transfers classified as expenses (profit/loss focus)
 * - cashflow: Debt transfers excluded (cash position focus - no cash movement)
 * 
 * IMPORTANT: Debt transfers (borç transferleri) are treated as expenses in income mode
 * because they represent obligations/liabilities, even though they don't involve cash movement.
 */

import { ensureTransactionDirection } from './transaction-direction.js';
import { transactionInvolvesInternalAccount } from './account-type.js';
import { isDebtTransfer } from './debt-transfer.js';
import { getTransactionDate as getTransactionDateUtil } from './date-utils.js';

/**
 * Date range presets
 */
export const DATE_RANGE_PRESETS = {
    ALL_TIME: 'all_time',
    THIS_MONTH: 'this_month',
    LAST_30_DAYS: 'last_30_days',
    THIS_YEAR: 'this_year',
    LAST_90_DAYS: 'last_90_days'
};

/**
 * Get date range boundaries for a preset
 * @param {string} preset - The preset name
 * @returns {{start: Date|null, end: Date|null}} Date range
 */
export function getDateRangeForPreset(preset) {
    const now = new Date();
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    
    let start = null;
    
    switch (preset) {
        case DATE_RANGE_PRESETS.THIS_MONTH:
            start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
            break;
            
        case DATE_RANGE_PRESETS.LAST_30_DAYS:
            start = new Date(now);
            start.setDate(start.getDate() - 30);
            start.setHours(0, 0, 0, 0);
            break;
            
        case DATE_RANGE_PRESETS.LAST_90_DAYS:
            start = new Date(now);
            start.setDate(start.getDate() - 90);
            start.setHours(0, 0, 0, 0);
            break;
            
        case DATE_RANGE_PRESETS.THIS_YEAR:
            start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
            break;
            
        case DATE_RANGE_PRESETS.ALL_TIME:
        default:
            return { start: null, end: null };
    }
    
    return { start, end };
}

/**
 * Get transaction date - delegates to shared date utility
 * @param {Object} transaction - Transaction object
 * @returns {Date|null} Parsed date
 */
export function getTransactionDate(transaction) {
    return getTransactionDateUtil(transaction);
}

/**
 * Filter transactions by date range
 * @param {Array} transactions - Array of transactions
 * @param {Date|null} startDate - Start date (inclusive)
 * @param {Date|null} endDate - End date (inclusive)
 * @returns {Array} Filtered transactions
 */
export function filterTransactionsByDateRange(transactions, startDate, endDate) {
    if (!Array.isArray(transactions)) return [];
    
    return transactions.filter(tx => {
        const txDate = getTransactionDate(tx);
        if (!txDate) return false;
        
        if (startDate && txDate < startDate) return false;
        if (endDate && txDate > endDate) return false;
        
        return true;
    });
}

/**
 * Calculate financial summary for transactions
 * @param {Array} transactions - Array of transactions
 * @param {Object} options - Options for filtering
 * @param {Date|null} options.startDate - Start date filter
 * @param {Date|null} options.endDate - End date filter
 * @param {string} options.mode - 'income' (default) or 'cashflow'
 * @param {Function} options.getAccount - Function to get account by ID (required for internal account detection)
 * @returns {Object} Financial summary
 */
export function calculateFinancialSummary(transactions, options = {}) {
    if (!Array.isArray(transactions)) {
        return createEmptySummary();
    }
    
    const mode = options.mode || 'income'; // Default to income-based (profit/loss)
    const getAccount = options.getAccount || null;
    
    // Filter by date range if provided
    let filteredTransactions = transactions;
    if (options.startDate || options.endDate) {
        filteredTransactions = filterTransactionsByDateRange(
            transactions,
            options.startDate,
            options.endDate
        );
    }
    
    // Ensure all transactions have direction field
    const enhancedTransactions = filteredTransactions.map(tx => 
        ensureTransactionDirection(tx)
    );
    
    // Initialize summary
    const summary = {
        totalIncome: 0,
        totalExpense: 0,
        netBalance: 0,
        
        // Transaction type breakdowns
        totalInvoiced: 0,      // gelir (revenue)
        totalCollections: 0,   // tahsilat (excluded from income in income mode)
        totalPayments: 0,      // ödeme (cash out)
        totalTransfers: 0,     // borç transferi / transfer
        
        // Counts
        incomeCount: 0,
        expenseCount: 0,
        totalCount: 0,
        
        // Date range
        dateRange: {
            start: options.startDate,
            end: options.endDate
        },
        
        // Mode
        mode
    };
    
    // Calculate aggregates based on mode
    enhancedTransactions.forEach(tx => {
        const amount = Math.abs(Number(tx.toplamTutar || tx.tutar || 0));
        const type = String(tx.islemTipi || '').toLowerCase().trim();
        
        // Check if transaction involves internal accounts
        const isInternalTransaction = getAccount && transactionInvolvesInternalAccount(tx, getAccount);
        
        // Check if this is a debt transfer (three-party liability reassignment)
        const isDebtTransferTx = isDebtTransfer(tx);
        
        summary.totalCount++;
        
        if (mode === 'income') {
            // Income mode: Only count actual revenue and expenses (profit/loss)
            // Exclude internal account transfers from revenue/expense calculations
            // Debt transfers are NOW CLASSIFIED AS EXPENSES (but don't affect cash flow)
            // gelir = revenue (income)
            // tahsilat = cash collection (NOT counted as new income)
            // gider = expense
            // ödeme/transfer = cash out (counted as expense)
            // borç transferi = debt transfer (COUNTED AS EXPENSE, but no cash flow)
            
            if (isDebtTransferTx) {
                // NEW: Debt transfers are now classified as expenses
                // They represent obligations/liabilities, even though no cash moves
                summary.totalExpense += amount;
                summary.expenseCount++;
                summary.totalTransfers += amount; // Still track separately for reference
            } else if (type === 'gelir') {
                // Only count revenue if it doesn't involve internal accounts
                // (internal transfers between bank accounts shouldn't count as revenue)
                if (!isInternalTransaction) {
                    summary.totalIncome += amount;
                    summary.incomeCount++;
                }
                summary.totalInvoiced += amount;
            } else if (type === 'tahsilat') {
                // Track separately but don't add to income
                // Tahsilat (collections) are cash movements, not new revenue
                summary.totalCollections += amount;
            } else if (type === 'gider') {
                // Only count expenses if they don't involve internal accounts
                if (!isInternalTransaction) {
                    summary.totalExpense += amount;
                    summary.expenseCount++;
                }
            } else if (type === 'ödeme' || type === 'odeme') {
                // Only count payments if they're not internal transfers
                if (!isInternalTransaction) {
                    summary.totalExpense += amount;
                    summary.expenseCount++;
                }
                summary.totalPayments += amount;
            } else if (type === 'transfer') {
                // Only count transfers as expenses if they're not between internal accounts
                if (!isInternalTransaction) {
                    summary.totalExpense += amount;
                    summary.expenseCount++;
                }
                summary.totalTransfers += amount;
            }
        } else {
            // Cashflow mode: ONLY count actual cash movements (tahsilat + ödeme)
            // Excludes: gelir, gider (accrual basis), transfers, and debt transfers
            // This mode shows actual cash position changes
            
            if (isDebtTransferTx) {
                // Debt transfers don't involve cash movement, just liability reassignment
                summary.totalTransfers += amount;
            } else if (type === 'tahsilat') {
                // Cash collection (cash in)
                summary.totalIncome += amount;
                summary.incomeCount++;
                summary.totalCollections += amount;
            } else if (type === 'ödeme' || type === 'odeme') {
                // Cash payment (cash out)
                summary.totalExpense += amount;
                summary.expenseCount++;
                summary.totalPayments += amount;
            } else if (type === 'gelir') {
                // Track but don't count (accrual, not cash)
                summary.totalInvoiced += amount;
            } else if (type === 'transfer' || type === 'borç transferi' || type === 'borc transferi') {
                // Track but don't count (no cash movement)
                summary.totalTransfers += amount;
            }
        }
    });
    
    // Calculate net balance: Net = Revenue - Expenses
    summary.netBalance = summary.totalIncome - summary.totalExpense;
    
    return summary;
}

/**
 * Create an empty summary object
 * @returns {Object} Empty summary
 */
function createEmptySummary() {
    return {
        totalIncome: 0,
        totalExpense: 0,
        netBalance: 0,
        totalInvoiced: 0,
        totalCollections: 0,
        totalPayments: 0,
        totalTransfers: 0,
        incomeCount: 0,
        expenseCount: 0,
        totalCount: 0,
        dateRange: {
            start: null,
            end: null
        },
        mode: 'income'
    };
}

/**
 * Format currency value
 * @param {number} value - Amount to format
 * @returns {string} Formatted currency
 */
export function formatCurrency(value) {
    const numeric = Number(value) || 0;
    return Math.abs(numeric).toLocaleString('tr-TR', { 
        style: 'currency', 
        currency: 'TRY',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

/**
 * Format date range label
 * @param {string} preset - Preset name
 * @returns {string} Human-readable label
 */
export function getDateRangeLabel(preset) {
    switch (preset) {
        case DATE_RANGE_PRESETS.THIS_MONTH:
            return 'Bu Ay';
        case DATE_RANGE_PRESETS.LAST_30_DAYS:
            return 'Son 30 Gün';
        case DATE_RANGE_PRESETS.LAST_90_DAYS:
            return 'Son 90 Gün';
        case DATE_RANGE_PRESETS.THIS_YEAR:
            return 'Bu Yıl';
        case DATE_RANGE_PRESETS.ALL_TIME:
        default:
            return 'Tüm Zamanlar';
    }
}

/**
 * Get summary statistics as percentage
 * @param {Object} summary - Financial summary
 * @returns {Object} Statistics with percentages
 */
export function getSummaryStatistics(summary) {
    const total = summary.totalIncome + summary.totalExpense;
    
    return {
        incomePercentage: total > 0 ? (summary.totalIncome / total) * 100 : 0,
        expensePercentage: total > 0 ? (summary.totalExpense / total) * 100 : 0,
        profitMargin: summary.totalIncome > 0 
            ? (summary.netBalance / summary.totalIncome) * 100 
            : 0
    };
}

