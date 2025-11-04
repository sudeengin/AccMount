/**
 * Debt Transfer Balance Rules - Canonical Sign Mapping
 * 
 * This is the SINGLE SOURCE OF TRUTH for debt transfer balance impacts.
 * All other functions MUST reference these rules to maintain consistency.
 * 
 * DO NOT duplicate this logic elsewhere. Import and use these functions.
 */

/**
 * Debt transfer roles
 */
export const DEBT_TRANSFER_ROLES = {
    DEBTOR: 'debtor',                    // Borrower (company)
    NEW_CREDITOR: 'new_creditor',        // Lender (borç veren)
    OLD_CREDITOR: 'old_creditor'         // Settled creditor (borcu kapanan)
};

/**
 * CANONICAL BALANCE IMPACT RULES
 * 
 * These are the fundamental, unchanging rules for debt transfers:
 * 
 * 1. DEBTOR (islemCari): 0
 *    - Borrows from new creditor to pay old creditor
 *    - Total debt unchanged, only counterparty changes
 * 
 * 2. NEW CREDITOR (kaynakCari): +amount
 *    - Lender who gave the loan
 *    - Receivable INCREASES (positive)
 * 
 * 3. OLD CREDITOR (hedefCari): -amount
 *    - Creditor whose debt was settled
 *    - Receivable DECREASES (negative)
 */

/**
 * Get balance impact for a specific role
 * @param {string} role - DEBT_TRANSFER_ROLES value
 * @param {number} amount - Transaction amount (always positive)
 * @returns {number} Balance impact (can be positive, negative, or zero)
 */
export function getBalanceImpactForRole(role, amount) {
    const absAmount = Math.abs(Number(amount) || 0);
    
    switch (role) {
        case DEBT_TRANSFER_ROLES.DEBTOR:
            return 0;              // ✅ No change - debt stays same
            
        case DEBT_TRANSFER_ROLES.NEW_CREDITOR:
            return absAmount;      // ✅ Positive - receivable increases
            
        case DEBT_TRANSFER_ROLES.OLD_CREDITOR:
            return -absAmount;     // ✅ Negative - receivable decreases
            
        default:
            return 0;              // Unknown role, no impact
    }
}

/**
 * Get balance impact for a specific account in a debt transfer transaction
 * @param {Object} transaction - Debt transfer transaction object
 * @param {string} accountId - Account ID to check
 * @returns {number} Balance impact for the account
 */
export function getBalanceImpact(transaction, accountId) {
    if (!transaction || !accountId) {
        return 0;
    }
    
    const amount = Math.abs(Number(transaction.toplamTutar || transaction.tutar || 0));
    
    // Identify the account's role
    if (accountId === transaction.islemCari) {
        // DEBTOR
        return getBalanceImpactForRole(DEBT_TRANSFER_ROLES.DEBTOR, amount);
    }
    
    if (accountId === transaction.kaynakCari) {
        // NEW CREDITOR (Lender)
        return getBalanceImpactForRole(DEBT_TRANSFER_ROLES.NEW_CREDITOR, amount);
    }
    
    if (accountId === transaction.hedefCari) {
        // OLD CREDITOR (Settled)
        return getBalanceImpactForRole(DEBT_TRANSFER_ROLES.OLD_CREDITOR, amount);
    }
    
    // Account not involved in this debt transfer
    return 0;
}

/**
 * Get all balance impacts for a debt transfer
 * @param {Object} transaction - Debt transfer transaction object
 * @returns {Map} Map of accountId -> balance impact
 */
export function getAllBalanceImpacts(transaction) {
    const impacts = new Map();
    
    if (!transaction) {
        return impacts;
    }
    
    const amount = Math.abs(Number(transaction.toplamTutar || transaction.tutar || 0));
    
    // Debtor: 0
    if (transaction.islemCari) {
        impacts.set(transaction.islemCari, 0);
    }
    
    // New Creditor (Lender): +amount
    if (transaction.kaynakCari) {
        impacts.set(transaction.kaynakCari, amount);
    }
    
    // Old Creditor (Settled): -amount
    if (transaction.hedefCari) {
        impacts.set(transaction.hedefCari, -amount);
    }
    
    return impacts;
}

/**
 * Validate that a set of balance impacts follows the canonical rules
 * @param {Map|Object} impacts - Balance impacts to validate (accountId -> amount)
 * @param {Object} transaction - The debt transfer transaction
 * @returns {{valid: boolean, errors: string[]}} Validation result
 */
export function validateBalanceImpacts(impacts, transaction) {
    const errors = [];
    
    if (!transaction) {
        errors.push('Transaction is required');
        return { valid: false, errors };
    }
    
    const amount = Math.abs(Number(transaction.toplamTutar || transaction.tutar || 0));
    const impactsMap = impacts instanceof Map ? impacts : new Map(Object.entries(impacts || {}));
    
    // Check debtor (should be 0)
    if (transaction.islemCari) {
        const debtorImpact = impactsMap.get(transaction.islemCari) || 0;
        if (Math.abs(debtorImpact) > 0.01) {
            errors.push(`Debtor impact should be 0, got ${debtorImpact}`);
        }
    }
    
    // Check new creditor (should be +amount)
    if (transaction.kaynakCari) {
        const newCreditorImpact = impactsMap.get(transaction.kaynakCari) || 0;
        if (Math.abs(newCreditorImpact - amount) > 0.01) {
            errors.push(`New creditor impact should be +${amount}, got ${newCreditorImpact}`);
        }
    }
    
    // Check old creditor (should be -amount)
    if (transaction.hedefCari) {
        const oldCreditorImpact = impactsMap.get(transaction.hedefCari) || 0;
        if (Math.abs(oldCreditorImpact + amount) > 0.01) {
            errors.push(`Old creditor impact should be -${amount}, got ${oldCreditorImpact}`);
        }
    }
    
    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Format balance impact with sign for display
 * @param {number} impact - Balance impact value
 * @param {string} currency - Currency symbol (default: ₺)
 * @returns {string} Formatted string with + or - sign
 */
export function formatBalanceImpact(impact, currency = '₺') {
    const numericImpact = Number(impact) || 0;
    const absValue = Math.abs(numericImpact);
    const formatted = absValue.toLocaleString('tr-TR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
    
    if (Math.abs(numericImpact) < 0.01) {
        return `${currency}0,00`; // No sign for zero
    }
    
    return numericImpact > 0 
        ? `+${currency}${formatted}` 
        : `-${currency}${formatted}`;
}

/**
 * Get role label for display
 * @param {string} role - DEBT_TRANSFER_ROLES value
 * @returns {string} Human-readable label
 */
export function getRoleLabel(role) {
    switch (role) {
        case DEBT_TRANSFER_ROLES.DEBTOR:
            return 'Borçlu (Şirket)';
        case DEBT_TRANSFER_ROLES.NEW_CREDITOR:
            return 'Yeni Alacaklı (Borç Veren)';
        case DEBT_TRANSFER_ROLES.OLD_CREDITOR:
            return 'Eski Alacaklı (Borcu Kapanan)';
        default:
            return 'Bilinmeyen Rol';
    }
}

/**
 * Assert that balance impacts are correct (throws if not)
 * Useful for defensive programming and debugging
 * @param {Map|Object} impacts - Balance impacts
 * @param {Object} transaction - Debt transfer transaction
 * @throws {Error} If validation fails
 */
export function assertCorrectBalanceImpacts(impacts, transaction) {
    const validation = validateBalanceImpacts(impacts, transaction);
    
    if (!validation.valid) {
        throw new Error(
            `Invalid debt transfer balance impacts:\n` +
            validation.errors.join('\n')
        );
    }
}

/**
 * Reference documentation for this module
 */
export const DOCUMENTATION = {
    purpose: 'Canonical source of truth for debt transfer balance rules',
    principle: 'Debt transfer is a LIABILITY REASSIGNMENT, not a cashflow event',
    rules: {
        debtor: '0 (total debt unchanged, only counterparty changes)',
        newCreditor: '+amount (receivable gained)',
        oldCreditor: '-amount (receivable lost)'
    },
    fields: {
        islemCari: 'Debtor (company)',
        kaynakCari: 'New Creditor (lender)',
        hedefCari: 'Old Creditor (settled)'
    },
    usage: 'Import and use these functions. Do NOT duplicate logic elsewhere.'
};

