/**
 * Transaction Direction Utility
 * 
 * Maps transaction types to their financial direction:
 * +1 for income (positive cash flow)
 * -1 for expense (negative cash flow)
 */

/**
 * Transaction type to direction mapping
 * @type {Object.<string, number>}
 */
const TRANSACTION_DIRECTION_MAP = {
    'gelir': +1,        // Income
    'tahsilat': +1,     // Collection/Receivable
    'gider': -1,        // Expense
    'ödeme': -1,        // Payment
    'odeme': -1,        // Payment (without Turkish character)
    'transfer': -1,     // Transfer (general)
    'borç transferi': 0,  // Debt Transfer (three-party liability reassignment)
    'borc transferi': 0,  // Debt Transfer (without Turkish character)
    'debt_transfer': 0,   // Debt Transfer (English)
    'administrative_reset': 0  // Administrative Reset (balance adjustment)
};

/**
 * Get the financial direction for a transaction type
 * @param {string} transactionType - The transaction type (islemTipi)
 * @returns {number} +1 for income, -1 for expense, 0 for unknown
 */
export function getTransactionDirection(transactionType) {
    if (!transactionType) return 0;
    
    const normalized = String(transactionType).toLowerCase().trim();
    
    // Direct match
    if (TRANSACTION_DIRECTION_MAP.hasOwnProperty(normalized)) {
        return TRANSACTION_DIRECTION_MAP[normalized];
    }
    
    // Fallback pattern matching
    if (normalized.includes('gelir') || normalized.includes('tahsil')) {
        return +1;
    }
    
    // Check for debt transfer first (neutral direction)
    if (normalized.includes('borç transferi') || normalized.includes('borc transferi') || 
        normalized === 'debt_transfer') {
        return 0;
    }
    
    if (normalized.includes('gider') || normalized.includes('ödeme') || 
        normalized.includes('odeme') || normalized.includes('transfer')) {
        return -1;
    }
    
    // Default to 0 for unknown types
    return 0;
}

/**
 * Get a human-readable label for a transaction direction
 * @param {number} direction - The direction value (+1, -1, or 0)
 * @returns {string} Human-readable label
 */
export function getDirectionLabel(direction) {
    if (direction > 0) return 'Gelir';
    if (direction < 0) return 'Gider';
    return 'Bilinmeyen';
}

/**
 * Get type-specific label for a transaction (preferred over direction label)
 * @param {Object} transaction - Transaction object
 * @returns {string} Human-readable type label
 */
export function getTransactionTypeLabel(transaction) {
    if (!transaction) return 'Bilinmeyen';
    
    const type = String(transaction.islemTipi || '').toLowerCase().trim();
    
    switch (type) {
        case 'gelir':
            return 'Gelir';
        case 'tahsilat':
            return 'Tahsilat';
        case 'gider':
            return 'Gider';
        case 'ödeme':
        case 'odeme':
            return 'Ödeme';
        case 'transfer':
            return 'Transfer';
        case 'borç transferi':
        case 'borc transferi':
        case 'debt_transfer':
            return 'Borç Transferi';
        case 'administrative_reset':
            return 'Sıfırlama (Admin)';
        default:
            return type ? type.charAt(0).toUpperCase() + type.slice(1) : 'Bilinmeyen';
    }
}

/**
 * Get CSS class for styling based on direction
 * @param {number} direction - The direction value (+1, -1, or 0)
 * @returns {string} CSS class name
 */
export function getDirectionColorClass(direction) {
    if (direction > 0) return 'amount-income';
    if (direction < 0) return 'amount-expense';
    return 'amount-neutral';
}

/**
 * Get background CSS class for badges based on direction
 * @param {number} direction - The direction value (+1, -1, or 0)
 * @returns {string} CSS class name for background
 */
export function getDirectionBadgeClass(direction) {
    if (direction > 0) return 'badge-income';
    if (direction < 0) return 'badge-expense';
    return 'bg-neutral-text/20 text-neutral-text border border-neutral-text/30 px-2 py-0.5 rounded-full text-xs font-semibold';
}

/**
 * Get type-specific badge class for a transaction (preferred over direction badge)
 * @param {Object} transaction - Transaction object
 * @returns {string} CSS class name for badge
 */
export function getTransactionTypeBadgeClass(transaction) {
    if (!transaction) return 'bg-neutral-text/20 text-neutral-text border border-neutral-text/30 px-2 py-0.5 rounded-full text-xs font-semibold';
    
    const type = String(transaction.islemTipi || '').toLowerCase().trim();
    
    switch (type) {
        case 'gelir':
            return 'bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full text-xs font-semibold';
        case 'tahsilat':
            return 'bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full text-xs font-semibold';
        case 'gider':
            return 'bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full text-xs font-semibold';
        case 'ödeme':
        case 'odeme':
            return 'bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded-full text-xs font-semibold';
        case 'transfer':
            return 'bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full text-xs font-semibold';
        case 'borç transferi':
        case 'borc transferi':
        case 'debt_transfer':
            return 'bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full text-xs font-semibold';
        case 'administrative_reset':
            return 'bg-slate-500/20 text-slate-400 border border-slate-500/30 px-2 py-0.5 rounded-full text-xs font-semibold italic';
        default:
            return 'bg-neutral-text/20 text-neutral-text border border-neutral-text/30 px-2 py-0.5 rounded-full text-xs font-semibold';
    }
}

/**
 * Get type-specific color class for amount display
 * @param {Object} transaction - Transaction object
 * @returns {string} CSS class name for amount color
 */
export function getTransactionTypeColorClass(transaction) {
    if (!transaction) return 'amount-neutral';
    
    const type = String(transaction.islemTipi || '').toLowerCase().trim();
    
    switch (type) {
        case 'gelir':
            return 'amount-income';
        case 'tahsilat':
            return 'text-blue-400';
        case 'gider':
            return 'amount-expense';
        case 'ödeme':
        case 'odeme':
            return 'text-orange-400';
        case 'transfer':
            return 'text-purple-400';
        case 'borç transferi':
        case 'borc transferi':
        case 'debt_transfer':
            return 'text-purple-400';
        case 'administrative_reset':
            return 'text-slate-400';
        default:
            return 'amount-neutral';
    }
}

/**
 * Validate if a transaction object has a valid direction
 * @param {Object} transaction - Transaction object
 * @returns {boolean} True if direction is valid
 */
export function hasValidDirection(transaction) {
    if (!transaction) return false;
    const direction = transaction.direction || transaction.yon;
    return direction === +1 || direction === -1;
}

/**
 * Ensure a transaction has a direction field
 * If direction is missing, calculate it from transaction type
 * @param {Object} transaction - Transaction object
 * @returns {Object} Transaction with direction field
 */
export function ensureTransactionDirection(transaction) {
    if (!transaction) return transaction;
    
    // Check if direction already exists
    if (hasValidDirection(transaction)) {
        return transaction;
    }
    
    // Calculate direction from transaction type
    const direction = getTransactionDirection(transaction.islemTipi);
    
    return {
        ...transaction,
        direction
    };
}

