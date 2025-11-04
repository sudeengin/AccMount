/**
 * Transaction Grouping Utility
 * 
 * Provides functions to group and categorize transactions for display and reporting.
 * Ensures debt transfers are properly separated from P&L and cashflow transactions.
 */

import { isDebtTransfer, getAccountRoleInDebtTransfer, getDebtTransferParties } from './debt-transfer.js';

/**
 * Transaction group types
 */
export const TRANSACTION_GROUPS = {
    PNL_OPERATIONS: 'pnl_operations',           // Income/Expense Operations (P&L)
    CASHFLOW_MOVEMENTS: 'cashflow_movements',   // Bank/Cash Movements
    BALANCE_ADJUSTMENTS: 'balance_adjustments'  // Debt Transfers & Admin Resets
};

/**
 * Get human-readable group label
 * @param {string} group - Group type
 * @returns {string} Label in Turkish
 */
export function getTransactionGroupLabel(group) {
    switch (group) {
        case TRANSACTION_GROUPS.PNL_OPERATIONS:
            return 'Gelir / Gider İşlemleri';  // Income / Expense Operations
        case TRANSACTION_GROUPS.CASHFLOW_MOVEMENTS:
            return 'Nakit Hareketleri';  // Cashflow Movements
        case TRANSACTION_GROUPS.BALANCE_ADJUSTMENTS:
            return 'Bakiye Düzeltmeleri';  // Balance Adjustments
        default:
            return 'Diğer İşlemler';  // Other Operations
    }
}

/**
 * Get transaction group for a transaction
 * @param {Object} transaction - Transaction object
 * @returns {string} Group type
 */
export function getTransactionGroup(transaction) {
    if (!transaction) return TRANSACTION_GROUPS.PNL_OPERATIONS;
    
    const type = String(transaction.islemTipi || '').toLowerCase().trim();
    
    // Check for administrative reset
    if (type === 'administrative_reset') {
        return TRANSACTION_GROUPS.BALANCE_ADJUSTMENTS;
    }
    
    // Check for debt transfer (three-party liability reassignment)
    if (isDebtTransfer(transaction)) {
        return TRANSACTION_GROUPS.BALANCE_ADJUSTMENTS;
    }
    
    // P&L operations: revenue and expenses
    if (type === 'gelir' || type === 'gider') {
        return TRANSACTION_GROUPS.PNL_OPERATIONS;
    }
    
    // Cashflow movements: collections, payments, transfers
    if (type === 'tahsilat' || type === 'ödeme' || type === 'odeme' || type === 'transfer') {
        return TRANSACTION_GROUPS.CASHFLOW_MOVEMENTS;
    }
    
    // Default to P&L operations
    return TRANSACTION_GROUPS.PNL_OPERATIONS;
}

/**
 * Get display label for transaction (prevents mislabeling)
 * @param {Object} transaction - Transaction object
 * @returns {string} Display label
 */
export function getTransactionDisplayLabel(transaction) {
    if (!transaction) return 'İşlem';
    
    const type = String(transaction.islemTipi || '').toLowerCase().trim();
    
    // Handle debt transfer
    if (isDebtTransfer(transaction)) {
        return 'Borç Transferi';  // Never labeled as Income or Collection
    }
    
    // Handle other transaction types
    switch (type) {
        case 'gelir':
            return 'Gelir';
        case 'gider':
            return 'Gider';
        case 'tahsilat':
            return 'Tahsilat';
        case 'ödeme':
        case 'odeme':
            return 'Ödeme';
        case 'transfer':
            return 'Transfer';
        case 'administrative_reset':
            return 'Yönetici Sıfırlaması';
        default:
            return type ? type.charAt(0).toUpperCase() + type.slice(1) : 'İşlem';
    }
}

/**
 * Get participant role description for debt transfer
 * @param {Object} transaction - Debt transfer transaction
 * @param {string} accountId - Account ID (optional, for role-specific view)
 * @param {Function} getAccountName - Function to get account name by ID
 * @returns {string} Participant role description
 */
export function getDebtTransferParticipantRole(transaction, accountId = null, getAccountName = null) {
    if (!isDebtTransfer(transaction)) {
        return '';
    }
    
    const parties = getDebtTransferParties(transaction);
    
    const debtorName = typeof getAccountName === 'function' 
        ? getAccountName(parties.debtor) 
        : parties.debtor || 'Bilinmeyen';
    const lenderName = typeof getAccountName === 'function' 
        ? getAccountName(parties.lender) 
        : parties.lender || 'Bilinmeyen';
    const paidOffName = typeof getAccountName === 'function' 
        ? getAccountName(parties.creditorPaidOff) 
        : parties.creditorPaidOff || 'Bilinmeyen';
    
    // If viewing from specific account perspective
    if (accountId) {
        const role = getAccountRoleInDebtTransfer(transaction, accountId);
        
        switch (role) {
            case 'debtor':
                return `Borçlu: ${debtorName} | Borç Veren: ${lenderName} | Borcu Kapanan: ${paidOffName}`;
            case 'lender':
                return `Borç Veren: ${lenderName} | Borçlu: ${debtorName} | Borcu Kapanan: ${paidOffName}`;
            case 'creditor_paid_off':
                return `Borcu Kapanan: ${paidOffName} | Borçlu: ${debtorName} | Borç Veren: ${lenderName}`;
            default:
                break;
        }
    }
    
    // General view (all parties) - flow from left to right
    return `${lenderName} → ${debtorName} → ${paidOffName}`;
}

/**
 * Get color class for transaction group
 * @param {string} group - Group type
 * @returns {string} CSS color class
 */
export function getTransactionGroupColorClass(group) {
    switch (group) {
        case TRANSACTION_GROUPS.PNL_OPERATIONS:
            return 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10';
        case TRANSACTION_GROUPS.CASHFLOW_MOVEMENTS:
            return 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10';
        case TRANSACTION_GROUPS.BALANCE_ADJUSTMENTS:
            return 'border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/10';
        default:
            return 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/10';
    }
}

/**
 * Get color class for transaction type badge
 * @param {Object} transaction - Transaction object
 * @returns {string} CSS color class
 */
export function getTransactionTypeColorClass(transaction) {
    if (!transaction) return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    
    const type = String(transaction.islemTipi || '').toLowerCase().trim();
    
    // Debt transfer: violet/purple
    if (isDebtTransfer(transaction)) {
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    }
    
    // Income: green
    if (type === 'gelir') {
        return 'bg-green-500/20 text-green-400 border-green-500/30';
    }
    
    // Expense: red
    if (type === 'gider') {
        return 'bg-red-500/20 text-red-400 border-red-500/30';
    }
    
    // Collection: blue
    if (type === 'tahsilat') {
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    }
    
    // Payment: orange
    if (type === 'ödeme' || type === 'odeme') {
        return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    }
    
    // Transfer: amber
    if (type === 'transfer') {
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    }
    
    // Administrative reset: slate (gray)
    if (type === 'administrative_reset') {
        return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
    
    // Default: neutral gray
    return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
}

/**
 * Group transactions by their category
 * @param {Array} transactions - Array of transaction objects
 * @returns {Object} Grouped transactions { group: transactions[] }
 */
export function groupTransactions(transactions) {
    if (!Array.isArray(transactions)) {
        return {
            [TRANSACTION_GROUPS.PNL_OPERATIONS]: [],
            [TRANSACTION_GROUPS.CASHFLOW_MOVEMENTS]: [],
            [TRANSACTION_GROUPS.BALANCE_ADJUSTMENTS]: []
        };
    }
    
    const grouped = {
        [TRANSACTION_GROUPS.PNL_OPERATIONS]: [],
        [TRANSACTION_GROUPS.CASHFLOW_MOVEMENTS]: [],
        [TRANSACTION_GROUPS.BALANCE_ADJUSTMENTS]: []
    };
    
    transactions.forEach(tx => {
        const group = getTransactionGroup(tx);
        if (grouped[group]) {
            grouped[group].push(tx);
        } else {
            // Fallback to P&L if group unknown
            grouped[TRANSACTION_GROUPS.PNL_OPERATIONS].push(tx);
        }
    });
    
    return grouped;
}

/**
 * Get transaction group statistics
 * @param {Array} transactions - Array of transaction objects
 * @returns {Object} Statistics per group
 */
export function getTransactionGroupStatistics(transactions) {
    const grouped = groupTransactions(transactions);
    
    const stats = {};
    
    Object.keys(grouped).forEach(groupKey => {
        const groupTransactions = grouped[groupKey];
        const total = groupTransactions.reduce((sum, tx) => {
            return sum + Math.abs(Number(tx.toplamTutar || tx.tutar || 0));
        }, 0);
        
        stats[groupKey] = {
            count: groupTransactions.length,
            total,
            label: getTransactionGroupLabel(groupKey)
        };
    });
    
    return stats;
}

