/**
 * Account Reset Utility
 * Provides admin functions to reset account balances
 */

import { doc, runTransaction, serverTimestamp, collection } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db, getCurrentUserId } from "../services/firebase.js";
import { isDebtTransfer, calculateDebtTransferImpact } from "./debt-transfer.js";

/**
 * Calculate the current balance of an account from its transactions
 * @param {string} accountId - The account ID
 * @param {Array<Object>} allTransactions - All transactions in the system
 * @returns {number} - The calculated balance
 */
export function calculateAccountBalance(accountId, allTransactions) {
    if (!accountId || !Array.isArray(allTransactions)) {
        return 0;
    }

    return allTransactions.reduce((balance, tx) => {
        // Skip deleted transactions
        if (tx.isDeleted) return balance;

        // Handle debt transfers separately with special sign logic
        if (isDebtTransfer(tx)) {
            const impact = calculateDebtTransferImpact(tx, accountId);
            return balance + impact;
        }

        // Handle multi-entry transactions (gelir/gider)
        if (tx.islemCari === accountId) {
            const amount = Number(tx.toplamTutar || tx.tutar || 0);
            if (tx.islemTipi === 'gelir') {
                return balance + amount;
            } else if (tx.islemTipi === 'gider') {
                return balance - amount;
            } else if (tx.islemTipi === 'administrative_reset') {
                // Administrative reset adjusts the balance
                return balance + amount;
            }
        }

        // Handle transfer-type transactions (tahsilat/ödeme/transfer)
        if (tx.kaynakCari === accountId) {
            return balance - Number(tx.tutar || 0);
        }
        if (tx.hedefCari === accountId) {
            return balance + Number(tx.tutar || 0);
        }

        return balance;
    }, 0);
}

/**
 * Check if an account has been administratively reset
 * @param {string} accountId - The account ID
 * @param {Array<Object>} allTransactions - All transactions in the system
 * @returns {boolean} - True if account has been reset
 */
export function hasBeenReset(accountId, allTransactions) {
    if (!accountId || !Array.isArray(allTransactions)) {
        return false;
    }

    return allTransactions.some(tx => 
        tx.islemCari === accountId && 
        tx.islemTipi === 'administrative_reset' &&
        !tx.isDeleted
    );
}

/**
 * Get the most recent reset transaction for an account
 * @param {string} accountId - The account ID
 * @param {Array<Object>} allTransactions - All transactions in the system
 * @returns {Object|null} - The most recent reset transaction or null
 */
export function getLastResetTransaction(accountId, allTransactions) {
    if (!accountId || !Array.isArray(allTransactions)) {
        return null;
    }

    const resetTransactions = allTransactions
        .filter(tx => 
            tx.islemCari === accountId && 
            tx.islemTipi === 'administrative_reset' &&
            !tx.isDeleted
        )
        .sort((a, b) => {
            const timeA = a.kayitTarihi?.seconds || 0;
            const timeB = b.kayitTarihi?.seconds || 0;
            return timeB - timeA; // Most recent first
        });

    return resetTransactions.length > 0 ? resetTransactions[0] : null;
}

/**
 * Reset an account balance to zero
 * Creates an administrative reset transaction and updates the account balance
 * 
 * @param {string} accountId - The account ID to reset
 * @param {Array<Object>} allTransactions - All transactions in the system
 * @returns {Promise<Object>} - Promise that resolves with the created transaction
 * @throws {Error} - If user is not admin or if operation fails
 */
export async function resetAccountBalance(accountId, allTransactions) {
    if (!accountId) {
        throw new Error('Hesap ID gereklidir.');
    }

    const currentUserId = getCurrentUserId();
    if (!currentUserId) {
        throw new Error('Kullanıcı kimlik doğrulaması yapılmamış.');
    }

    // Calculate current balance
    const currentBalance = calculateAccountBalance(accountId, allTransactions);

    // If balance is already zero, no need to reset
    if (Math.abs(currentBalance) < 0.01) {
        throw new Error('Hesap bakiyesi zaten sıfır.');
    }

    // Calculate the adjustment amount (negative of current balance)
    const adjustmentAmount = -currentBalance;

    let newTransactionId = null;

    try {
        await runTransaction(db, async (transaction) => {
            // Create the administrative reset transaction
            const transactionRef = doc(collection(db, "islemler"));
            newTransactionId = transactionRef.id;

            const resetTransaction = {
                islemTipi: 'administrative_reset',
                islemCari: accountId,
                direction: 0,
                tutar: Math.abs(adjustmentAmount),
                toplamTutar: Math.abs(adjustmentAmount),
                tarih: new Date(),
                aciklama: 'Hesap manuel olarak sıfırlandı.',
                isDeleted: false,
                kayitTarihi: serverTimestamp(),
                vergiOrani: 0,
                faturaNumarasi: '',
                kaynakCari: null,
                hedefCari: null,
                is_system_adjustment: true,
                adjusted_by: currentUserId,
                adjustment_amount: adjustmentAmount
            };

            // Update account balance to zero
            const accountRef = doc(db, "cariler", accountId);
            
            // Set the transaction
            transaction.set(transactionRef, resetTransaction);
            
            // Update the account balance directly to zero (to ensure consistency)
            transaction.update(accountRef, { 
                bakiye: 0,
                lastResetAt: serverTimestamp(),
                lastResetBy: currentUserId
            });
        });

        return {
            id: newTransactionId,
            success: true,
            message: 'Hesap bakiyesi başarıyla sıfırlandı.'
        };
    } catch (error) {
        console.error('[Account Reset] Error:', error);
        throw new Error(error.message || 'Hesap sıfırlama işlemi başarısız oldu.');
    }
}

/**
 * Validate if user has permission to reset accounts
 * Note: Since there's no user role system yet, this returns true for all authenticated users
 * TODO: Implement proper role-based access control when user roles are added
 * 
 * @returns {boolean} - True if user can reset accounts
 */
export function canResetAccounts() {
    const currentUserId = getCurrentUserId();
    
    // For now, allow all authenticated users
    // In the future, check user role: return user.role === 'admin'
    return Boolean(currentUserId);
}

