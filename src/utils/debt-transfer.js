/**
 * Debt Transfer Utility
 * 
 * Handles "Debt Transfer" as a three-party event:
 * - Debtor: The company (e.g., Motifera) - liability stays constant
 * - From Creditor: Previous creditor (receivable transferred away, balance decreases)
 * - To Creditor: New creditor (receivable gained, balance increases)
 * 
 * Key Principles:
 * 1. Debt transfer is a LIABILITY REASSIGNMENT, not a cashflow or P&L transaction
 * 2. Does NOT affect income, expense, or cash position
 * 3. Only changes which party the company owes money to
 * 4. Total liability remains constant, only the counterparty changes
 */

/**
 * Check if a transaction is a debt transfer
 * @param {Object} transaction - Transaction object
 * @returns {boolean} True if transaction is a debt transfer
 */
export function isDebtTransfer(transaction) {
    if (!transaction) return false;
    
    const type = String(transaction.islemTipi || '').toLowerCase().trim();
    
    // Explicit debt transfer types
    const isExplicitDebtTransfer = type === 'borç transferi' || type === 'borc transferi' || type === 'debt_transfer';
    
    // Three-party transfer pattern (kaynakCari -> hedefCari via debt)
    // This is how older debt transfers were stored
    const isThreePartyTransfer = type === 'transfer' && transaction.kaynakCari && transaction.hedefCari;
    
    return isExplicitDebtTransfer || isThreePartyTransfer;
}

/**
 * Validate a debt transfer transaction structure
 * @param {Object} transaction - Transaction object to validate
 * @returns {{valid: boolean, errors: string[]}} Validation result
 */
export function validateDebtTransfer(transaction) {
    const errors = [];
    
    if (!transaction) {
        errors.push('Transaction object is required');
        return { valid: false, errors };
    }
    
    if (!isDebtTransfer(transaction)) {
        errors.push('Transaction is not a debt transfer type');
    }
    
    // Check for three parties
    const debtor = transaction.debtor || transaction.islemCari;
    const fromCreditor = transaction.fromCreditor || transaction.kaynakCari;
    const toCreditor = transaction.toCreditor || transaction.hedefCari;
    
    if (!debtor) {
        errors.push('Debtor (islemCari) is required');
    }
    
    if (!fromCreditor) {
        errors.push('From Creditor (kaynakCari) is required');
    }
    
    if (!toCreditor) {
        errors.push('To Creditor (hedefCari) is required');
    }
    
    // Check that all three parties are different
    if (debtor && fromCreditor && debtor === fromCreditor) {
        errors.push('Debtor and From Creditor must be different accounts');
    }
    
    if (debtor && toCreditor && debtor === toCreditor) {
        errors.push('Debtor and To Creditor must be different accounts');
    }
    
    if (fromCreditor && toCreditor && fromCreditor === toCreditor) {
        errors.push('From Creditor and To Creditor must be different accounts');
    }
    
    // Check amount
    const amount = Math.abs(Number(transaction.toplamTutar || transaction.tutar || 0));
    if (amount <= 0) {
        errors.push('Transfer amount must be greater than zero');
    }
    
    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Create a debt transfer transaction object
 * @param {Object} params - Debt transfer parameters
 * @param {string} params.debtor - Debtor account ID (the company)
 * @param {string} params.lender - Lender account ID (borç veren / new creditor)
 * @param {string} params.creditorPaidOff - Creditor paid off account ID (borcu kapanan / old creditor)
 * @param {number} params.amount - Transfer amount
 * @param {Date|Object} params.date - Transaction date
 * @param {string} params.description - Optional description
 * @param {string} params.invoiceNumber - Optional invoice/reference number
 * @param {Object} params.metadata - Optional additional metadata
 * @returns {Object} Debt transfer transaction object
 */
export function createDebtTransferTransaction({
    debtor,
    lender,
    creditorPaidOff,
    amount,
    date,
    description = '',
    invoiceNumber = '',
    metadata = {}
}) {
    const transaction = {
        islemTipi: 'borç transferi',
        
        // Three-party structure
        islemCari: debtor,              // The debtor (company/borrower) - no balance change
        kaynakCari: lender,             // Lender (borç veren / new creditor, balance decreases -amount)
        hedefCari: creditorPaidOff,     // Creditor paid off (borcu kapanan / old creditor, balance increases +amount)
        
        // Amount
        toplamTutar: Math.abs(Number(amount)),
        tutar: Math.abs(Number(amount)),
        vergisizTutar: Math.abs(Number(amount)),
        vergiTutari: 0,
        vergiOrani: 0,
        
        // Date
        tarih: date,
        kayitTarihi: new Date(),
        
        // Description
        aciklama: description || 'Borç transferi',
        faturaNumarasi: invoiceNumber || '',
        
        // Direction: 0 for debt transfer (not income or expense)
        direction: 0,
        
        // Metadata for clarity
        isDebtTransfer: true,
        transferType: 'debt_settlement_via_borrowing',
        linkedParties: {
            debtor,
            lender,
            creditorPaidOff
        },
        
        // Additional metadata
        ...metadata
    };
    
    // Validate before returning
    const validation = validateDebtTransfer(transaction);
    if (!validation.valid) {
        throw new Error(`Invalid debt transfer: ${validation.errors.join(', ')}`);
    }
    
    return transaction;
}

/**
 * Get the parties involved in a debt transfer
 * @param {Object} transaction - Debt transfer transaction
 * @returns {{debtor: string|null, lender: string|null, creditorPaidOff: string|null}}
 */
export function getDebtTransferParties(transaction) {
    if (!transaction || !isDebtTransfer(transaction)) {
        return {
            debtor: null,
            lender: null,
            creditorPaidOff: null
        };
    }
    
    return {
        debtor: transaction.debtor || transaction.islemCari || null,
        lender: transaction.lender || transaction.kaynakCari || null, // Borç veren (new creditor)
        creditorPaidOff: transaction.creditorPaidOff || transaction.hedefCari || null // Borcu kapanan (old creditor)
    };
}

/**
 * Calculate balance impact of a debt transfer for a specific account
 * 
 * GLOBAL SIGN STANDARD:
 * - Account Balance: Positive (+) = receivable (they owe us), Negative (−) = payable (we owe them)
 * - Transaction Delta: Positive (+) = moves toward receivable, Negative (−) = moves toward payable
 * 
 * For Debt Transfer (liability reassignment):
 * - Debtor (islemCari): Total debt unchanged → delta = 0
 * - New Creditor (kaynakCari/lender): Our payable to them INCREASES → delta = −amount
 * - Old Creditor (hedefCari/settled): Our payable to them DECREASES → delta = +amount
 * 
 * @param {Object} transaction - Debt transfer transaction
 * @param {string} accountId - Account ID to check
 * @returns {number} Balance change (delta) for the account
 */
export function calculateDebtTransferImpact(transaction, accountId) {
    if (!transaction || !accountId || !isDebtTransfer(transaction)) {
        return 0;
    }
    
    const amount = Math.abs(Number(transaction.toplamTutar || transaction.tutar || 0));
    const parties = getDebtTransferParties(transaction);
    
    // ═══════════════════════════════════════════════════════════════
    // GLOBAL SIGN STANDARD - DEBT TRANSFER DELTAS:
    // 
    // 1. Debtor (islemCari):           0        - Total debt unchanged
    // 2. New Creditor (kaynakCari):   -amount   - Our payable increases (moves toward negative)
    // 3. Old Creditor (hedefCari):    +amount   - Our payable decreases (moves toward positive)
    // 
    // This ensures consistent sign meaning across ALL account views.
    // ═══════════════════════════════════════════════════════════════
    
    // DEBTOR: No balance change (liability stays constant, only counterparty changes)
    if (accountId === parties.debtor) {
        return 0;  // ✅ Rule 1: No change
    }
    
    // NEW CREDITOR (Lender): Our payable to them increases
    // kaynakCari = lender = we now owe them more
    if (accountId === parties.lender) {
        return -amount;  // ✅ Rule 2: Negative delta (payable increases)
    }
    
    // OLD CREDITOR (Settled): Our payable to them decreases
    // hedefCari = creditorPaidOff = we now owe them less (or zero)
    if (accountId === parties.creditorPaidOff) {
        return +amount;  // ✅ Rule 3: Positive delta (payable decreases)
    }
    
    // Account not involved in this debt transfer
    return 0;
}

/**
 * Get human-readable description of a debt transfer
 * @param {Object} transaction - Debt transfer transaction
 * @param {Function} getAccountName - Function to get account name by ID
 * @returns {string} Description
 */
export function getDebtTransferDescription(transaction, getAccountName) {
    if (!transaction || !isDebtTransfer(transaction)) {
        return '';
    }
    
    const parties = getDebtTransferParties(transaction);
    const amount = Math.abs(Number(transaction.toplamTutar || transaction.tutar || 0));
    
    const debtorName = typeof getAccountName === 'function' 
        ? getAccountName(parties.debtor) 
        : parties.debtor || 'Bilinmeyen';
    const lenderName = typeof getAccountName === 'function' 
        ? getAccountName(parties.lender) 
        : parties.lender || 'Bilinmeyen';
    const paidOffName = typeof getAccountName === 'function' 
        ? getAccountName(parties.creditorPaidOff) 
        : parties.creditorPaidOff || 'Bilinmeyen';
    
    const formattedAmount = amount.toLocaleString('tr-TR', {
        style: 'currency',
        currency: 'TRY',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
    
    return `${lenderName} → ${debtorName} → ${paidOffName} (${formattedAmount})`;
}

/**
 * Enrich a debt transfer transaction with calculated fields
 * @param {Object} transaction - Debt transfer transaction
 * @param {Function} getAccountName - Function to get account name by ID
 * @returns {Object} Enriched transaction
 */
export function enrichDebtTransfer(transaction, getAccountName) {
    if (!transaction || !isDebtTransfer(transaction)) {
        return transaction;
    }
    
    const parties = getDebtTransferParties(transaction);
    const description = getDebtTransferDescription(transaction, getAccountName);
    
    return {
        ...transaction,
        isDebtTransfer: true,
        direction: 0, // Neutral for P&L
        parties,
        generatedDescription: description
    };
}

/**
 * Check if debt transfer should be excluded from financial summaries
 * @param {Object} transaction - Transaction to check
 * @returns {boolean} True if should be excluded from income/expense calculations
 */
export function shouldExcludeFromFinancialSummary(transaction) {
    return isDebtTransfer(transaction);
}

/**
 * Get the role of an account in a debt transfer
 * @param {Object} transaction - Debt transfer transaction
 * @param {string} accountId - Account ID to check
 * @returns {"debtor" | "lender" | "creditor_paid_off" | null} Account role
 */
export function getAccountRoleInDebtTransfer(transaction, accountId) {
    if (!transaction || !accountId || !isDebtTransfer(transaction)) {
        return null;
    }
    
    const parties = getDebtTransferParties(transaction);
    
    if (accountId === parties.debtor) {
        return 'debtor';
    }
    if (accountId === parties.lender) {
        return 'lender';
    }
    if (accountId === parties.creditorPaidOff) {
        return 'creditor_paid_off';
    }
    
    return null;
}

/**
 * Get role-aware label for debt transfer from account's perspective
 * @param {Object} transaction - Debt transfer transaction
 * @param {string} accountId - Account ID viewing the transaction
 * @returns {string} Role-specific label
 */
export function getDebtTransferRoleLabel(transaction, accountId) {
    const role = getAccountRoleInDebtTransfer(transaction, accountId);
    
    switch (role) {
        case 'debtor':
            return 'Borç Alındı ve Ödendi'; // Borrowed and Paid
        case 'lender':
            return 'Borç Verildi'; // Loan Given
        case 'creditor_paid_off':
            return 'Alacak Tahsil Edildi'; // Receivable Collected
        default:
            return 'Borç Transferi';
    }
}

/**
 * Get role-aware description for debt transfer
 * @param {Object} transaction - Debt transfer transaction
 * @param {string} accountId - Account ID viewing the transaction
 * @param {Function} getAccountName - Function to get account name by ID
 * @returns {string} Role-specific description
 */
export function getDebtTransferRoleDescription(transaction, accountId, getAccountName) {
    if (!transaction || !accountId || !isDebtTransfer(transaction)) {
        return '';
    }
    
    const parties = getDebtTransferParties(transaction);
    const role = getAccountRoleInDebtTransfer(transaction, accountId);
    const amount = Math.abs(Number(transaction.toplamTutar || transaction.tutar || 0));
    
    const formattedAmount = amount.toLocaleString('tr-TR', {
        style: 'currency',
        currency: 'TRY',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
    
    const debtorName = typeof getAccountName === 'function' 
        ? getAccountName(parties.debtor) 
        : parties.debtor || 'Bilinmeyen';
    const lenderName = typeof getAccountName === 'function' 
        ? getAccountName(parties.lender) 
        : parties.lender || 'Bilinmeyen';
    const paidOffName = typeof getAccountName === 'function' 
        ? getAccountName(parties.creditorPaidOff) 
        : parties.creditorPaidOff || 'Bilinmeyen';
    
    switch (role) {
        case 'debtor':
            // Company view: "Borrowed from X to pay Y"
            return `${lenderName}'den borç alındı, ${paidOffName}'e ödendi (${formattedAmount})`;
        case 'lender':
            // Lender view: "Gave loan to X (who paid Y)"
            return `${debtorName}'e borç verildi (${paidOffName}'e ödeme için, ${formattedAmount})`;
        case 'creditor_paid_off':
            // Paid off creditor view: "Receivable collected (via loan from X)"
            return `Alacak tahsil edildi (${lenderName} üzerinden, ${formattedAmount})`;
        default:
            return getDebtTransferDescription(transaction, getAccountName);
    }
}

/**
 * Get CSV export category for debt transfer
 * @returns {string} CSV category name
 */
export function getDebtTransferCSVCategory() {
    return 'Liability Transfer';
}

/**
 * Check if account is involved in debt transfer
 * @param {Object} transaction - Debt transfer transaction
 * @param {string} accountId - Account ID to check
 * @returns {boolean} True if account is involved in the transfer
 */
export function isAccountInvolvedInDebtTransfer(transaction, accountId) {
    return getAccountRoleInDebtTransfer(transaction, accountId) !== null;
}

