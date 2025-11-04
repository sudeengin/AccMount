/**
 * Debt Transfer Visibility Fix Utility
 * 
 * This utility ensures all debt transfer transactions are visible in transaction history
 * and correctly affect balances. It fixes legacy records that might have been incorrectly
 * marked as logs or had affectsBalance set to false.
 * 
 * WHAT THIS FIXES:
 * 1. Sets affectsBalance = true for all debt transfers
 * 2. Removes log-only flags (isLog, recordType = 'log')
 * 3. Preserves migration metadata but ensures transactions are still visible
 * 4. Recalculates balances to include all debt transfers
 */

import { getDocs, doc, writeBatch, collection, query, where, getDoc } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
import { db } from '../services/firebase.js';
import { calculateDebtTransferImpact } from './debt-transfer.js';

/**
 * Find all debt transfer transactions in the database
 * @returns {Promise<Array>} Array of debt transfer transaction objects
 */
export async function findAllDebtTransfers() {
    console.log('[Debt Transfer Fix] Searching for all debt transfer transactions...');
    
    const transactionsRef = collection(db, 'islemler');
    
    // Get ALL transactions and filter client-side (Firestore doesn't support OR on different fields)
    const snapshot = await getDocs(transactionsRef);
    const allDebtTransfers = [];
    
    snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const type = String(data.islemTipi || '').toLowerCase().trim();
        
        // Check for explicit debt transfer types
        const isExplicitDebtTransfer = type === 'borç transferi' || 
                                       type === 'borc transferi' || 
                                       type === 'debt_transfer';
        
        // Check for three-party transfer pattern
        const isThreePartyTransfer = type === 'transfer' && data.kaynakCari && data.hedefCari;
        
        if (isExplicitDebtTransfer || isThreePartyTransfer) {
            allDebtTransfers.push({
                id: docSnap.id,
                ...data
            });
        }
    });
    
    console.log(`[Debt Transfer Fix] Found ${allDebtTransfers.length} debt transfer transactions`);
    return allDebtTransfers;
}

/**
 * Fix a single debt transfer transaction to ensure visibility
 * @param {Object} transaction - Debt transfer transaction to fix
 * @returns {Object|null} Update payload or null if no fix needed
 */
export function analyzeDebtTransferFix(transaction) {
    if (!transaction) return null;
    
    const updates = {};
    let needsUpdate = false;
    
    // 1. Ensure affectsBalance is true
    if (transaction.affectsBalance === false || transaction.affectsBalance === undefined) {
        updates.affectsBalance = true;
        needsUpdate = true;
    }
    
    // 2. Remove log-only flags
    if (transaction.isLog === true) {
        updates.isLog = false;
        needsUpdate = true;
    }
    
    if (transaction.recordType === 'log') {
        updates.recordType = 'transaction';
        needsUpdate = true;
    }
    
    // 3. Preserve migration metadata but add visibility flag
    if (transaction.migrationFlag === true || transaction.needsReview === true) {
        // Keep these flags for audit trail, but mark as visible transaction
        updates.isVisibleTransaction = true;
        needsUpdate = true;
    }
    
    return needsUpdate ? updates : null;
}

/**
 * Apply fixes to all debt transfer transactions
 * @param {boolean} dryRun - If true, only analyze without making changes
 * @returns {Promise<Object>} Summary of changes made
 */
export async function fixAllDebtTransfers(dryRun = false) {
    console.log(`[Debt Transfer Fix] Starting ${dryRun ? 'DRY RUN' : 'FIX'} operation...`);
    
    const debtTransfers = await findAllDebtTransfers();
    
    if (debtTransfers.length === 0) {
        return {
            total: 0,
            fixed: 0,
            alreadyCorrect: 0,
            errors: [],
            changes: []
        };
    }
    
    const summary = {
        total: debtTransfers.length,
        fixed: 0,
        alreadyCorrect: 0,
        errors: [],
        changes: []
    };
    
    // Analyze all transactions
    const transactionsToFix = [];
    debtTransfers.forEach(tx => {
        const updates = analyzeDebtTransferFix(tx);
        if (updates) {
            transactionsToFix.push({ id: tx.id, updates, original: tx });
            summary.changes.push({
                id: tx.id,
                type: tx.islemTipi,
                updates: Object.keys(updates),
                before: {
                    affectsBalance: tx.affectsBalance,
                    isLog: tx.isLog,
                    recordType: tx.recordType
                },
                after: updates
            });
        } else {
            summary.alreadyCorrect++;
        }
    });
    
    console.log(`[Debt Transfer Fix] Analysis complete:`);
    console.log(`  - Total debt transfers: ${summary.total}`);
    console.log(`  - Need fixing: ${transactionsToFix.length}`);
    console.log(`  - Already correct: ${summary.alreadyCorrect}`);
    
    if (dryRun) {
        console.log('[Debt Transfer Fix] DRY RUN - No changes made');
        console.log('[Debt Transfer Fix] Changes that would be made:', summary.changes);
        return summary;
    }
    
    // Apply fixes in batches (Firestore limit: 500 operations per batch)
    const BATCH_SIZE = 500;
    const batches = [];
    
    for (let i = 0; i < transactionsToFix.length; i += BATCH_SIZE) {
        batches.push(transactionsToFix.slice(i, i + BATCH_SIZE));
    }
    
    console.log(`[Debt Transfer Fix] Applying fixes in ${batches.length} batch(es)...`);
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = writeBatch(db);
        const batchItems = batches[batchIndex];
        
        batchItems.forEach(({ id, updates }) => {
            const txRef = doc(db, 'islemler', id);
            batch.update(txRef, {
                ...updates,
                _fixedAt: new Date(),
                _fixVersion: '1.0.0'
            });
        });
        
        try {
            await batch.commit();
            summary.fixed += batchItems.length;
            console.log(`[Debt Transfer Fix] Batch ${batchIndex + 1}/${batches.length} completed (${batchItems.length} transactions)`);
        } catch (error) {
            console.error(`[Debt Transfer Fix] Batch ${batchIndex + 1} failed:`, error);
            summary.errors.push({
                batch: batchIndex + 1,
                error: error.message,
                count: batchItems.length
            });
        }
    }
    
    console.log('[Debt Transfer Fix] Fix operation complete!');
    console.log(`  - Successfully fixed: ${summary.fixed}`);
    console.log(`  - Errors: ${summary.errors.length}`);
    
    return summary;
}

/**
 * Recalculate account balances including all debt transfers
 * @param {string} accountId - Account ID to recalculate
 * @param {Array} allTransactions - All transactions for this account
 * @returns {number} Calculated balance
 */
export function recalculateBalanceWithDebtTransfers(accountId, allTransactions) {
    if (!accountId || !Array.isArray(allTransactions)) {
        return 0;
    }
    
    let balance = 0;
    
    allTransactions.forEach(tx => {
        const type = String(tx.islemTipi || '').toLowerCase().trim();
        const isDebtTransfer = type === 'borç transferi' || type === 'borc transferi' || type === 'debt_transfer';
        
        if (isDebtTransfer) {
            // Use the debt transfer impact calculation
            const impact = calculateDebtTransferImpact(tx, accountId);
            balance += impact;
        } else {
            // Standard transaction logic (implement based on your transaction direction rules)
            // This is a placeholder - you should use your existing balance calculation logic
            const amount = Number(tx.toplamTutar || tx.tutar || 0);
            
            if (tx.islemCari === accountId) {
                // Primary account
                if (type === 'gelir' || type === 'tahsilat') {
                    balance += amount;
                } else if (type === 'gider' || type === 'ödeme' || type === 'odeme') {
                    balance -= amount;
                }
            } else if (tx.kaynakCari === accountId) {
                balance -= amount;
            } else if (tx.hedefCari === accountId) {
                balance += amount;
            }
        }
    });
    
    return balance;
}

/**
 * Verify all account balances after fixing debt transfers
 * @returns {Promise<Array>} Array of accounts with balance mismatches
 */
export async function verifyBalancesAfterFix() {
    console.log('[Debt Transfer Fix] Verifying account balances...');
    
    const accountsRef = collection(db, 'cariler');
    const transactionsRef = collection(db, 'islemler');
    
    const accountsSnapshot = await getDocs(accountsRef);
    const transactionsSnapshot = await getDocs(transactionsRef);
    
    const transactions = [];
    transactionsSnapshot.forEach(doc => {
        transactions.push({ id: doc.id, ...doc.data() });
    });
    
    const mismatches = [];
    
    for (const accountDoc of accountsSnapshot.docs) {
        const account = { id: accountDoc.id, ...accountDoc.data() };
        const storedBalance = Number(account.bakiye || 0);
        
        // Get all transactions for this account
        const accountTransactions = transactions.filter(tx =>
            tx.islemCari === account.id ||
            tx.kaynakCari === account.id ||
            tx.hedefCari === account.id
        );
        
        const calculatedBalance = recalculateBalanceWithDebtTransfers(account.id, accountTransactions);
        const diff = Math.abs(storedBalance - calculatedBalance);
        
        if (diff > 0.01) {
            mismatches.push({
                accountId: account.id,
                accountName: account.unvan,
                storedBalance,
                calculatedBalance,
                difference: diff,
                transactionCount: accountTransactions.length
            });
        }
    }
    
    console.log(`[Debt Transfer Fix] Balance verification complete`);
    console.log(`  - Accounts checked: ${accountsSnapshot.size}`);
    console.log(`  - Mismatches found: ${mismatches.length}`);
    
    if (mismatches.length > 0) {
        console.warn('[Debt Transfer Fix] Accounts with balance mismatches:', mismatches);
    }
    
    return mismatches;
}

/**
 * Complete fix workflow: fix transactions and verify balances
 * @param {boolean} dryRun - If true, only analyze without making changes
 * @returns {Promise<Object>} Complete summary
 */
export async function completeDebtTransferVisibilityFix(dryRun = false) {
    console.log('[Debt Transfer Fix] Starting complete visibility fix workflow...');
    console.log(`[Debt Transfer Fix] Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE (applying changes)'}`);
    
    const startTime = Date.now();
    
    // Step 1: Fix all debt transfer transactions
    const fixSummary = await fixAllDebtTransfers(dryRun);
    
    // Step 2: Verify balances (only if not dry run)
    let balanceVerification = null;
    if (!dryRun) {
        balanceVerification = await verifyBalancesAfterFix();
    }
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    const completeSummary = {
        mode: dryRun ? 'DRY_RUN' : 'LIVE',
        duration: `${duration}s`,
        transactions: fixSummary,
        balances: balanceVerification,
        timestamp: new Date().toISOString()
    };
    
    console.log('[Debt Transfer Fix] ✅ Workflow complete!');
    console.log('[Debt Transfer Fix] Summary:', completeSummary);
    
    return completeSummary;
}

