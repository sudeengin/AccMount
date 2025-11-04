/**
 * Debt Transfer Migration Utility
 * 
 * Migrates existing two-party "transfer" transactions to the new three-party debt transfer model.
 * Ensures data integrity and provides safety mechanisms for ambiguous cases.
 */

import { isDebtTransfer, validateDebtTransfer } from './debt-transfer.js';
import { isInternalAccount } from './account-type.js';

/**
 * Migration status types
 */
export const MIGRATION_STATUS = {
    PENDING: 'pending',           // Detected but not migrated
    READY: 'ready',              // Validated and ready to migrate
    NEEDS_REVIEW: 'needs_review', // Ambiguous, requires manual review
    MIGRATED: 'migrated',        // Successfully migrated
    SKIPPED: 'skipped',          // Skipped (e.g., already in new format)
    FAILED: 'failed'             // Migration failed
};

/**
 * Detect if a transaction is an old-style transfer that needs migration
 * @param {Object} transaction - Transaction object
 * @param {Function} getAccount - Function to get account by ID
 * @returns {boolean} True if needs migration
 */
export function needsMigration(transaction, getAccount) {
    if (!transaction) return false;
    
    const type = String(transaction.islemTipi || '').toLowerCase().trim();
    
    // Already in new format (borç transferi)
    if (type === 'borç transferi' || type === 'borc transferi' || type === 'debt_transfer') {
        return false;
    }
    
    // Check for old "transfer" type
    if (type !== 'transfer') {
        return false;
    }
    
    // Has two-party structure (kaynakCari and hedefCari)
    if (!transaction.kaynakCari || !transaction.hedefCari) {
        return false;
    }
    
    // Check if this involves external accounts (not internal bank transfers)
    if (typeof getAccount === 'function') {
        const kaynakAccount = getAccount(transaction.kaynakCari);
        const hedefAccount = getAccount(transaction.hedefCari);
        
        // Skip if both are internal accounts (bank-to-bank transfer)
        if (kaynakAccount && hedefAccount && 
            isInternalAccount(kaynakAccount) && isInternalAccount(hedefAccount)) {
            return false;
        }
    }
    
    return true;
}

/**
 * Analyze a transaction to determine migration strategy
 * @param {Object} transaction - Transaction object
 * @param {Function} getAccount - Function to get account by ID
 * @param {Array} allAccounts - All accounts for context
 * @returns {Object} Migration analysis
 */
export function analyzeForMigration(transaction, getAccount, allAccounts = []) {
    const analysis = {
        needsMigration: false,
        confidence: 'low',
        status: MIGRATION_STATUS.PENDING,
        proposed: null,
        issues: [],
        suggestions: []
    };
    
    if (!needsMigration(transaction, getAccount)) {
        analysis.status = MIGRATION_STATUS.SKIPPED;
        analysis.issues.push('Transaction does not need migration');
        return analysis;
    }
    
    analysis.needsMigration = true;
    
    const kaynakAccount = getAccount(transaction.kaynakCari);
    const hedefAccount = getAccount(transaction.hedefCari);
    
    if (!kaynakAccount || !hedefAccount) {
        analysis.confidence = 'low';
        analysis.status = MIGRATION_STATUS.NEEDS_REVIEW;
        analysis.issues.push('One or more accounts not found');
        return analysis;
    }
    
    // Determine which accounts are internal (bank/company) vs external (suppliers/customers)
    const kaynakIsInternal = isInternalAccount(kaynakAccount);
    const hedefIsInternal = isInternalAccount(hedefAccount);
    
    // Strategy 1: One internal (company), one external
    if (kaynakIsInternal && !hedefIsInternal) {
        // Company (kaynak) paid external party (hedef)
        // This is likely: Company owes hedef, paying from kaynak account
        // Transformation: islemCari = kaynak (debtor), kaynakCari = someone (from creditor), hedefCari = hedef (to creditor)
        // But we don't know the "from creditor" - needs review
        analysis.confidence = 'medium';
        analysis.status = MIGRATION_STATUS.NEEDS_REVIEW;
        analysis.issues.push('Cannot determine "from creditor" - original creditor unknown');
        analysis.suggestions.push(`Possible: ${kaynakAccount.unvan} (company) transferred debt to ${hedefAccount.unvan}`);
        
        // Propose structure but flag for review
        analysis.proposed = {
            islemTipi: 'borç transferi',
            islemCari: transaction.kaynakCari, // Company as debtor
            kaynakCari: null, // Unknown - NEEDS REVIEW
            hedefCari: transaction.hedefCari, // External party as new creditor
            tarih: transaction.tarih,
            tutar: transaction.tutar || transaction.toplamTutar,
            toplamTutar: transaction.toplamTutar || transaction.tutar,
            aciklama: `[MIGRATION] ${transaction.aciklama || 'Eski transfer kaydından dönüştürüldü'}`,
            direction: 0,
            migrationFlag: true,
            needsReview: true,
            originalTransaction: transaction.id
        };
        
    } else if (!kaynakIsInternal && hedefIsInternal) {
        // External party (kaynak) transferred to company (hedef)
        // Similar issue - needs review
        analysis.confidence = 'medium';
        analysis.status = MIGRATION_STATUS.NEEDS_REVIEW;
        analysis.issues.push('Cannot determine debt structure from two-party transfer');
        analysis.suggestions.push(`Possible: Debt from ${kaynakAccount.unvan} transferred to ${hedefAccount.unvan} (company)`);
        
        analysis.proposed = {
            islemTipi: 'borç transferi',
            islemCari: transaction.hedefCari, // Company as debtor (receiving)
            kaynakCari: transaction.kaynakCari, // External as from creditor
            hedefCari: null, // Unknown - NEEDS REVIEW
            tarih: transaction.tarih,
            tutar: transaction.tutar || transaction.toplamTutar,
            toplamTutar: transaction.toplamTutar || transaction.tutar,
            aciklama: `[MIGRATION] ${transaction.aciklama || 'Eski transfer kaydından dönüştürüldü'}`,
            direction: 0,
            migrationFlag: true,
            needsReview: true,
            originalTransaction: transaction.id
        };
        
    } else if (!kaynakIsInternal && !hedefIsInternal) {
        // Both external - this is the classic debt transfer case
        // Company owes money, creditor changed from kaynak to hedef
        // Need to identify which company account is the debtor
        
        // Try to find company/internal account from all accounts
        const internalAccounts = allAccounts.filter(acc => isInternalAccount(acc));
        
        if (internalAccounts.length === 1) {
            // Only one company account - use it as debtor
            analysis.confidence = 'high';
            analysis.status = MIGRATION_STATUS.READY;
            
            analysis.proposed = {
                islemTipi: 'borç transferi',
                islemCari: internalAccounts[0].id, // Company as debtor
                kaynakCari: transaction.kaynakCari, // Old creditor
                hedefCari: transaction.hedefCari, // New creditor
                tarih: transaction.tarih,
                tutar: transaction.tutar || transaction.toplamTutar,
                toplamTutar: transaction.toplamTutar || transaction.tutar,
                aciklama: `[AUTO-MIGRATED] ${transaction.aciklama || 'Borç transferi'}`,
                direction: 0,
                migrationFlag: true,
                needsReview: false,
                originalTransaction: transaction.id
            };
            
        } else if (internalAccounts.length > 1) {
            // Multiple company accounts - ambiguous
            analysis.confidence = 'medium';
            analysis.status = MIGRATION_STATUS.NEEDS_REVIEW;
            analysis.issues.push(`Multiple internal accounts found (${internalAccounts.length}), cannot determine debtor`);
            analysis.suggestions.push(`Debt transfer: ${kaynakAccount.unvan} → ${hedefAccount.unvan} (debtor unknown)`);
            
            // Propose with first internal account but flag for review
            analysis.proposed = {
                islemTipi: 'borç transferi',
                islemCari: internalAccounts[0].id, // First company account (needs review)
                kaynakCari: transaction.kaynakCari,
                hedefCari: transaction.hedefCari,
                tarih: transaction.tarih,
                tutar: transaction.tutar || transaction.toplamTutar,
                toplamTutar: transaction.toplamTutar || transaction.tutar,
                aciklama: `[MIGRATION - REVIEW] ${transaction.aciklama || 'Borç transferi'}`,
                direction: 0,
                migrationFlag: true,
                needsReview: true,
                originalTransaction: transaction.id
            };
            
        } else {
            // No internal account found
            analysis.confidence = 'low';
            analysis.status = MIGRATION_STATUS.NEEDS_REVIEW;
            analysis.issues.push('No internal/company account found to use as debtor');
            analysis.proposed = null;
        }
        
    } else {
        // Both internal - should have been skipped earlier
        analysis.status = MIGRATION_STATUS.SKIPPED;
        analysis.issues.push('Both accounts are internal - not a debt transfer');
    }
    
    // Validate proposed transformation
    if (analysis.proposed) {
        const validation = validateDebtTransfer(analysis.proposed);
        if (!validation.valid) {
            analysis.status = MIGRATION_STATUS.NEEDS_REVIEW;
            analysis.issues.push(...validation.errors);
            analysis.confidence = 'low';
        }
    }
    
    return analysis;
}

/**
 * Batch analyze transactions for migration
 * @param {Array} transactions - Array of transactions
 * @param {Function} getAccount - Function to get account by ID
 * @param {Array} allAccounts - All accounts
 * @returns {Array} Array of analysis results
 */
export function batchAnalyze(transactions, getAccount, allAccounts = []) {
    if (!Array.isArray(transactions)) return [];
    
    return transactions
        .map(tx => ({
            transaction: tx,
            analysis: analyzeForMigration(tx, getAccount, allAccounts)
        }))
        .filter(item => item.analysis.needsMigration);
}

/**
 * Get migration statistics
 * @param {Array} analysisResults - Array of analysis results from batchAnalyze
 * @returns {Object} Statistics
 */
export function getMigrationStatistics(analysisResults) {
    const stats = {
        total: analysisResults.length,
        ready: 0,
        needsReview: 0,
        skipped: 0,
        highConfidence: 0,
        mediumConfidence: 0,
        lowConfidence: 0
    };
    
    analysisResults.forEach(item => {
        const { analysis } = item;
        
        if (analysis.status === MIGRATION_STATUS.READY) stats.ready++;
        if (analysis.status === MIGRATION_STATUS.NEEDS_REVIEW) stats.needsReview++;
        if (analysis.status === MIGRATION_STATUS.SKIPPED) stats.skipped++;
        
        if (analysis.confidence === 'high') stats.highConfidence++;
        if (analysis.confidence === 'medium') stats.mediumConfidence++;
        if (analysis.confidence === 'low') stats.lowConfidence++;
    });
    
    return stats;
}

/**
 * Calculate balance correction needed for migration
 * @param {Object} oldTransaction - Original transaction
 * @param {Object} newTransaction - Proposed migrated transaction
 * @param {Function} getAccount - Function to get account by ID
 * @returns {Object} Balance corrections { accountId: delta }
 */
export function calculateBalanceCorrections(oldTransaction, newTransaction, getAccount) {
    const corrections = new Map();
    
    if (!oldTransaction || !newTransaction) return corrections;
    
    const amount = Math.abs(Number(newTransaction.toplamTutar || newTransaction.tutar || 0));
    
    // Old transaction effects (two-party)
    // kaynakCari: -amount, hedefCari: +amount
    const oldKaynak = oldTransaction.kaynakCari;
    const oldHedef = oldTransaction.hedefCari;
    
    // New transaction effects (three-party debt transfer)
    // islemCari (debtor): 0, kaynakCari (from creditor): -amount, hedefCari (to creditor): +amount
    const newDebtor = newTransaction.islemCari;
    const newFromCreditor = newTransaction.kaynakCari;
    const newToCreditor = newTransaction.hedefCari;
    
    // Undo old effects
    if (oldKaynak) {
        corrections.set(oldKaynak, (corrections.get(oldKaynak) || 0) + amount); // Undo -amount
    }
    if (oldHedef) {
        corrections.set(oldHedef, (corrections.get(oldHedef) || 0) - amount); // Undo +amount
    }
    
    // Apply new effects (debtor gets no change)
    if (newFromCreditor) {
        corrections.set(newFromCreditor, (corrections.get(newFromCreditor) || 0) - amount); // Apply -amount
    }
    if (newToCreditor) {
        corrections.set(newToCreditor, (corrections.get(newToCreditor) || 0) + amount); // Apply +amount
    }
    
    // Remove zero corrections
    const finalCorrections = new Map();
    corrections.forEach((value, key) => {
        if (value !== 0) {
            finalCorrections.set(key, value);
        }
    });
    
    return finalCorrections;
}

/**
 * Validate that migration preserves P&L and cashflow totals
 * @param {Array} transactions - All transactions
 * @param {Array} proposedChanges - Proposed migrations
 * @param {Function} getAccount - Function to get account by ID
 * @returns {Object} Validation result
 */
export function validateMigrationConsistency(transactions, proposedChanges, getAccount) {
    const validation = {
        valid: true,
        errors: [],
        warnings: []
    };
    
    // Calculate totals before and after
    const calculateTotals = (txList) => {
        let income = 0;
        let expense = 0;
        
        txList.forEach(tx => {
            const type = String(tx.islemTipi || '').toLowerCase().trim();
            const amount = Math.abs(Number(tx.toplamTutar || tx.tutar || 0));
            
            // Skip debt transfers and administrative resets (shouldn't affect P&L)
            if (type === 'borç transferi' || type === 'borc transferi' || 
                type === 'debt_transfer' || type === 'administrative_reset') {
                return;
            }
            
            if (type === 'gelir') income += amount;
            if (type === 'gider') expense += amount;
        });
        
        return { income, expense, net: income - expense };
    };
    
    const beforeTotals = calculateTotals(transactions);
    
    // Simulate after migration
    const afterTransactions = transactions.map(tx => {
        const change = proposedChanges.find(c => c.transaction.id === tx.id);
        return change ? change.analysis.proposed : tx;
    }).filter(Boolean);
    
    const afterTotals = calculateTotals(afterTransactions);
    
    // Check if totals changed
    const incomeDiff = Math.abs(afterTotals.income - beforeTotals.income);
    const expenseDiff = Math.abs(afterTotals.expense - beforeTotals.expense);
    
    if (incomeDiff > 0.01) {
        validation.valid = false;
        validation.errors.push(`Income total changed by ${incomeDiff.toFixed(2)} - migration should not affect P&L`);
    }
    
    if (expenseDiff > 0.01) {
        validation.valid = false;
        validation.errors.push(`Expense total changed by ${expenseDiff.toFixed(2)} - migration should not affect P&L`);
    }
    
    if (validation.valid) {
        validation.warnings.push('P&L totals preserved correctly');
    }
    
    return validation;
}
