/**
 * Debt Transfer Balance Backfill Utility
 * 
 * Fixes historical account balances that were calculated with incorrect debt transfer signs.
 * Recalculates all account balances from transaction history using the GLOBAL SIGN STANDARD.
 * 
 * GLOBAL SIGN STANDARD:
 * - Account Balance: Positive (+) = receivable (they owe us), Negative (−) = payable (we owe them)
 * - Transaction Delta: Positive (+) = moves toward receivable, Negative (−) = moves toward payable
 * 
 * For Debt Transfers (liability reassignment):
 * - Debtor (islemCari): Total debt unchanged → delta = 0
 * - New Creditor (kaynakCari): Our payable INCREASES → delta = −amount
 * - Old Creditor (hedefCari): Our payable DECREASES → delta = +amount
 * 
 * This is idempotent and safe to run multiple times.
 */

import { doc, writeBatch, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db, getCurrentUserId } from "../services/firebase.js";
import { calculateAccountBalance } from "./account-reset.js";
import { isDebtTransfer } from "./debt-transfer.js";

/**
 * Analyze which accounts need balance corrections
 * @param {Array} accounts - All accounts
 * @param {Array} transactions - All transactions
 * @returns {Array} Accounts that need correction with details
 */
export function analyzeBalanceCorrections(accounts, transactions) {
    if (!Array.isArray(accounts) || !Array.isArray(transactions)) {
        return [];
    }

    const corrections = [];
    
    accounts.forEach(account => {
        const currentBalance = Number(account.bakiye || 0);
        const calculatedBalance = calculateAccountBalance(account.id, transactions);
        
        const difference = calculatedBalance - currentBalance;
        
        // Only include accounts with a difference (tolerance of 0.01 for floating point)
        if (Math.abs(difference) > 0.01) {
            corrections.push({
                accountId: account.id,
                accountName: account.unvan,
                currentBalance,
                calculatedBalance,
                difference,
                needsCorrection: true
            });
        }
    });
    
    return corrections;
}

/**
 * Count debt transfers in transaction history
 * @param {Array} transactions - All transactions
 * @returns {Object} Statistics about debt transfers
 */
export function getDebtTransferStatistics(transactions) {
    if (!Array.isArray(transactions)) {
        return { total: 0, active: 0, deleted: 0 };
    }
    
    const debtTransfers = transactions.filter(tx => isDebtTransfer(tx));
    const active = debtTransfers.filter(tx => !tx.isDeleted);
    const deleted = debtTransfers.filter(tx => tx.isDeleted);
    
    return {
        total: debtTransfers.length,
        active: active.length,
        deleted: deleted.length
    };
}

/**
 * Generate a detailed report of balance corrections
 * @param {Array} corrections - Correction analysis from analyzeBalanceCorrections
 * @param {Array} transactions - All transactions
 * @returns {string} Human-readable report
 */
export function generateCorrectionReport(corrections, transactions) {
    const stats = getDebtTransferStatistics(transactions);
    
    let report = '═══════════════════════════════════════════════════════\n';
    report += '  DEBT TRANSFER BALANCE CORRECTION REPORT\n';
    report += '  (Global Sign Standard Enforcement)\n';
    report += '═══════════════════════════════════════════════════════\n\n';
    
    report += `Date: ${new Date().toLocaleString('tr-TR')}\n\n`;
    
    report += '--- Global Sign Standard ---\n';
    report += 'Account Balance:\n';
    report += '  Positive (+) = Receivable (they owe us)\n';
    report += '  Negative (−) = Payable (we owe them)\n\n';
    report += 'Debt Transfer Deltas:\n';
    report += '  Debtor:       ₺0 (total debt unchanged)\n';
    report += '  New Creditor: −amount (payable increases)\n';
    report += '  Old Creditor: +amount (payable decreases)\n\n';
    
    report += '--- Debt Transfer Statistics ---\n';
    report += `Total Debt Transfers: ${stats.total}\n`;
    report += `Active: ${stats.active}\n`;
    report += `Deleted: ${stats.deleted}\n\n`;
    
    report += '--- Balance Corrections Needed ---\n';
    report += `Total Accounts: ${corrections.length}\n\n`;
    
    if (corrections.length === 0) {
        report += '✓ No corrections needed. All balances are accurate!\n';
        report += '✓ Global sign standard is properly enforced.\n\n';
        return report;
    }
    
    report += 'Accounts requiring correction:\n\n';
    
    corrections.forEach((correction, index) => {
        report += `${index + 1}. ${correction.accountName}\n`;
        report += `   Account ID: ${correction.accountId}\n`;
        report += `   Current Balance: ${formatCurrency(correction.currentBalance)}\n`;
        report += `   Correct Balance: ${formatCurrency(correction.calculatedBalance)}\n`;
        report += `   Difference: ${formatCurrency(correction.difference)} ${correction.difference > 0 ? '↑' : '↓'}\n`;
        report += '\n';
    });
    
    report += '═══════════════════════════════════════════════════════\n';
    report += 'RECOMMENDATION: Run applyBalanceCorrections() to fix\n';
    report += '═══════════════════════════════════════════════════════\n';
    
    return report;
}

/**
 * Apply balance corrections to all affected accounts
 * @param {Array} accounts - All accounts
 * @param {Array} transactions - All transactions
 * @param {Function} onProgress - Optional progress callback (current, total)
 * @returns {Promise<Object>} Result summary
 */
export async function applyBalanceCorrections(accounts, transactions, onProgress = null) {
    const currentUserId = getCurrentUserId();
    if (!currentUserId) {
        throw new Error('User must be authenticated to apply balance corrections');
    }
    
    // Analyze what needs to be corrected
    const corrections = analyzeBalanceCorrections(accounts, transactions);
    
    if (corrections.length === 0) {
        return {
            success: true,
            correctedCount: 0,
            skippedCount: accounts.length,
            corrections: [],
            message: 'No corrections needed. All balances are already accurate.'
        };
    }
    
    // Apply corrections in batches (Firestore limit is 500 per batch)
    const batchSize = 500;
    const batches = [];
    
    for (let i = 0; i < corrections.length; i += batchSize) {
        batches.push(corrections.slice(i, i + batchSize));
    }
    
    let totalCorrected = 0;
    const correctionResults = [];
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const currentBatch = batches[batchIndex];
        const batch = writeBatch(db);
        
        currentBatch.forEach(correction => {
            const accountRef = doc(db, "cariler", correction.accountId);
            
            batch.update(accountRef, {
                bakiye: correction.calculatedBalance,
                lastBalanceCorrection: serverTimestamp(),
                correctedBy: currentUserId,
                correctionReason: 'Debt transfer balance backfill',
                previousBalance: correction.currentBalance
            });
            
            correctionResults.push({
                accountId: correction.accountId,
                accountName: correction.accountName,
                oldBalance: correction.currentBalance,
                newBalance: correction.calculatedBalance,
                difference: correction.difference
            });
        });
        
        try {
            await batch.commit();
            totalCorrected += currentBatch.length;
            
            // Report progress
            if (typeof onProgress === 'function') {
                onProgress(totalCorrected, corrections.length);
            }
        } catch (error) {
            console.error(`Batch ${batchIndex + 1} failed:`, error);
            throw new Error(`Failed to apply corrections in batch ${batchIndex + 1}: ${error.message}`);
        }
    }
    
    return {
        success: true,
        correctedCount: totalCorrected,
        skippedCount: accounts.length - totalCorrected,
        corrections: correctionResults,
        message: `Successfully corrected ${totalCorrected} account balances.`
    };
}

/**
 * Verify that corrections were applied successfully
 * @param {Array} accounts - All accounts (refreshed after correction)
 * @param {Array} transactions - All transactions
 * @returns {Object} Verification result
 */
export function verifyCorrections(accounts, transactions) {
    const remaining = analyzeBalanceCorrections(accounts, transactions);
    
    return {
        success: remaining.length === 0,
        remainingIssues: remaining.length,
        issues: remaining,
        message: remaining.length === 0 
            ? '✓ All balances verified. Corrections applied successfully.'
            : `⚠ ${remaining.length} accounts still have balance discrepancies.`
    };
}

/**
 * Check if any accounts need correction (quick check)
 * @param {Array} accounts - All accounts
 * @param {Array} transactions - All transactions
 * @returns {boolean} True if corrections are needed
 */
export function needsCorrection(accounts, transactions) {
    const corrections = analyzeBalanceCorrections(accounts, transactions);
    return corrections.length > 0;
}

/**
 * Get correction summary for display
 * @param {Array} accounts - All accounts
 * @param {Array} transactions - All transactions
 * @returns {Object} Summary statistics
 */
export function getCorrectionSummary(accounts, transactions) {
    const corrections = analyzeBalanceCorrections(accounts, transactions);
    const stats = getDebtTransferStatistics(transactions);
    
    const totalDifference = corrections.reduce((sum, c) => sum + Math.abs(c.difference), 0);
    const maxDifference = corrections.length > 0 
        ? Math.max(...corrections.map(c => Math.abs(c.difference)))
        : 0;
    
    return {
        needsCorrection: corrections.length > 0,
        accountsAffected: corrections.length,
        totalAccounts: accounts.length,
        debtTransferCount: stats.active,
        totalDifference,
        maxDifference,
        corrections
    };
}

/**
 * Export correction report to downloadable file
 * @param {Array} accounts - All accounts
 * @param {Array} transactions - All transactions
 * @returns {Blob} Report file blob
 */
export function exportCorrectionReport(accounts, transactions) {
    const corrections = analyzeBalanceCorrections(accounts, transactions);
    const report = generateCorrectionReport(corrections, transactions);
    
    return new Blob([report], { type: 'text/plain;charset=utf-8' });
}

/**
 * Format currency for display
 * @param {number} value - Amount to format
 * @returns {string} Formatted currency
 */
function formatCurrency(value) {
    const numeric = Number(value) || 0;
    return numeric.toLocaleString('tr-TR', {
        style: 'currency',
        currency: 'TRY',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

/**
 * Dry run - analyze without making changes
 * @param {Array} accounts - All accounts
 * @param {Array} transactions - All transactions
 * @returns {Object} Analysis results
 */
export function dryRun(accounts, transactions) {
    const corrections = analyzeBalanceCorrections(accounts, transactions);
    const stats = getDebtTransferStatistics(transactions);
    const report = generateCorrectionReport(corrections, transactions);
    
    return {
        needsCorrection: corrections.length > 0,
        corrections,
        statistics: stats,
        report,
        accountsToUpdate: corrections.length,
        estimatedTime: `${Math.ceil(corrections.length / 100)} seconds`
    };
}

