/**
 * Debt Transfer Migration Service
 * 
 * Applies migrations to Firebase and manages the migration process
 */

import { doc, updateDoc, writeBatch, collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db } from "../services/firebase.js";
import { 
    migrateAllTransactions, 
    generateMigrationReport,
    validateMigrationConsistency,
    getTransactionsNeedingReview,
    MIGRATION_STATUS
} from './debt-transfer-migration.js';
import { calculateFinancialSummary } from './financial-summary.js';

const COLLECTION_NAME = "islemler";
const MIGRATION_LOG_COLLECTION = "migration_logs";

/**
 * Run migration in dry-run mode (no changes to database)
 * @param {Array} transactions - All transactions
 * @param {Object} options - Migration options
 * @returns {Promise<Object>} Migration summary
 */
export async function runDryRunMigration(transactions, options = {}) {
    const migrationSummary = migrateAllTransactions(transactions, {
        ...options,
        dryRun: true
    });
    
    // Validate consistency
    const migratedTransactions = transactions.map(tx => {
        const result = migrationSummary.results.find(r => r.id === tx.id);
        return result?.updatedTransaction || tx;
    });
    
    const consistency = validateMigrationConsistency(
        transactions,
        migratedTransactions,
        (txs) => calculateFinancialSummary(txs, { mode: 'income' })
    );
    
    migrationSummary.consistencyCheck = consistency;
    migrationSummary.report = generateMigrationReport(migrationSummary);
    
    return migrationSummary;
}

/**
 * Apply migration to Firebase (actual database changes)
 * @param {Array} transactions - All transactions
 * @param {Object} options - Migration options
 * @param {Function} onProgress - Progress callback (current, total)
 * @returns {Promise<Object>} Migration result
 */
export async function applyMigration(transactions, options = {}, onProgress = null) {
    // First, run dry run to validate
    const dryRun = await runDryRunMigration(transactions, options);
    
    if (!dryRun.consistencyCheck.valid) {
        throw new Error(`Migration would break consistency: ${dryRun.consistencyCheck.errors.join(', ')}`);
    }
    
    // Now run actual migration
    const migrationSummary = migrateAllTransactions(transactions, {
        ...options,
        dryRun: false
    });
    
    // Apply changes to Firebase in batches
    const updateResults = [];
    const transactionsToUpdate = migrationSummary.results.filter(
        r => r.updatedTransaction && 
        (r.status === MIGRATION_STATUS.COMPLETED || r.status === MIGRATION_STATUS.NEEDS_REVIEW)
    );
    
    const batchSize = 500; // Firestore batch limit
    const batches = [];
    
    for (let i = 0; i < transactionsToUpdate.length; i += batchSize) {
        const batch = transactionsToUpdate.slice(i, i + batchSize);
        batches.push(batch);
    }
    
    let processedCount = 0;
    const totalCount = transactionsToUpdate.length;
    
    for (const batch of batches) {
        const firestoreBatch = writeBatch(db);
        
        batch.forEach(result => {
            const docRef = doc(db, COLLECTION_NAME, result.id);
            firestoreBatch.update(docRef, result.updatedTransaction);
        });
        
        try {
            await firestoreBatch.commit();
            processedCount += batch.length;
            
            if (onProgress) {
                onProgress(processedCount, totalCount);
            }
            
            updateResults.push({
                success: true,
                count: batch.length
            });
        } catch (error) {
            updateResults.push({
                success: false,
                error: error.message,
                count: batch.length
            });
        }
    }
    
    // Log migration to database
    await logMigration(migrationSummary, updateResults);
    
    return {
        migrationSummary,
        updateResults,
        totalUpdated: processedCount,
        report: generateMigrationReport(migrationSummary)
    };
}

/**
 * Log migration to database for audit trail
 * @param {Object} migrationSummary - Migration summary
 * @param {Array} updateResults - Update results
 */
async function logMigration(migrationSummary, updateResults) {
    try {
        const logRef = collection(db, MIGRATION_LOG_COLLECTION);
        const logDoc = doc(logRef);
        
        await updateDoc(logDoc, {
            timestamp: migrationSummary.migrationDate,
            version: migrationSummary.migrationVersion,
            summary: {
                totalTransactions: migrationSummary.totalTransactions,
                totalDebtTransfers: migrationSummary.totalDebtTransfers,
                completed: migrationSummary.completed,
                needsReview: migrationSummary.needsReview,
                failed: migrationSummary.failed,
                skipped: migrationSummary.skipped
            },
            updateResults,
            report: generateMigrationReport(migrationSummary)
        });
    } catch (error) {
        console.warn('Failed to log migration:', error);
    }
}

/**
 * Get all transactions that need review from Firebase
 * @returns {Promise<Array>} Transactions needing review
 */
export async function fetchTransactionsNeedingReview() {
    try {
        const q = query(
            collection(db, COLLECTION_NAME),
            where('needsReview', '==', true)
        );
        
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error('Failed to fetch transactions needing review:', error);
        return [];
    }
}

/**
 * Mark a transaction as reviewed and update it
 * @param {string} transactionId - Transaction ID
 * @param {Object} updates - Updates to apply
 * @returns {Promise<void>}
 */
export async function markTransactionAsReviewed(transactionId, updates = {}) {
    const docRef = doc(db, COLLECTION_NAME, transactionId);
    
    await updateDoc(docRef, {
        ...updates,
        needsReview: false,
        reviewedAt: new Date(),
        migrationStatus: MIGRATION_STATUS.COMPLETED
    });
}

/**
 * Approve a pending migration for a transaction
 * @param {string} transactionId - Transaction ID
 * @param {Object} approvedData - Approved three-party structure
 * @returns {Promise<void>}
 */
export async function approvePendingMigration(transactionId, approvedData) {
    const docRef = doc(db, COLLECTION_NAME, transactionId);
    
    await updateDoc(docRef, {
        islemCari: approvedData.debtor,
        kaynakCari: approvedData.fromCreditor,
        hedefCari: approvedData.toCreditor,
        debtor: approvedData.debtor,
        fromCreditor: approvedData.fromCreditor,
        toCreditor: approvedData.toCreditor,
        direction: 0,
        needsReview: false,
        reviewedAt: new Date(),
        migrationStatus: MIGRATION_STATUS.COMPLETED,
        isMigrated: true,
        migrationDate: new Date(),
        migrationVersion: '1.0.0'
    });
}

/**
 * Reject a pending migration (keeps transaction as is, flags for later review)
 * @param {string} transactionId - Transaction ID
 * @param {string} reason - Rejection reason
 * @returns {Promise<void>}
 */
export async function rejectPendingMigration(transactionId, reason) {
    const docRef = doc(db, COLLECTION_NAME, transactionId);
    
    await updateDoc(docRef, {
        needsReview: true,
        migrationStatus: MIGRATION_STATUS.FAILED,
        rejectionReason: reason,
        rejectedAt: new Date()
    });
}

/**
 * Get migration statistics
 * @param {Array} transactions - All transactions
 * @returns {Object} Statistics
 */
export function getMigrationStatistics(transactions) {
    if (!Array.isArray(transactions)) {
        return {
            total: 0,
            migrated: 0,
            needsReview: 0,
            pending: 0
        };
    }
    
    const debtTransfers = transactions.filter(tx => {
        const type = String(tx.islemTipi || '').toLowerCase().trim();
        return type === 'borç transferi' || type === 'borc transferi' || type === 'debt_transfer';
    });
    
    return {
        total: debtTransfers.length,
        migrated: debtTransfers.filter(tx => tx.isMigrated === true).length,
        needsReview: debtTransfers.filter(tx => tx.needsReview === true).length,
        pending: debtTransfers.filter(tx => !tx.isMigrated && !tx.needsReview).length
    };
}

/**
 * Export migration report to text file
 * @param {Object} migrationSummary - Migration summary
 * @returns {Blob} Report as downloadable blob
 */
export function exportMigrationReport(migrationSummary) {
    const report = generateMigrationReport(migrationSummary);
    return new Blob([report], { type: 'text/plain;charset=utf-8' });
}

