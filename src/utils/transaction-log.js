/**
 * Transaction vs Log Utility
 * 
 * Distinguishes between real financial transactions (affect balances)
 * and informational logs (migration records, admin actions, etc.)
 */

/**
 * Check if a record is a system log (informational, non-financial)
 * @param {Object} record - Transaction/log record
 * @returns {boolean} True if this is a log, not a real transaction
 */
export function isSystemLog(record) {
    if (!record) return false;
    
    // CRITICAL: Debt transfers are ALWAYS real transactions, never logs
    // Check this FIRST before any other conditions
    const type = String(record.islemTipi || '').toLowerCase().trim();
    
    // Debt transfer detection: either explicitly named OR three-party transfer
    const isExplicitDebtTransfer = type === 'borç transferi' || type === 'borc transferi' || type === 'debt_transfer';
    const isThreePartyTransfer = type === 'transfer' && record.kaynakCari && record.hedefCari;
    const isDebtTransfer = isExplicitDebtTransfer || isThreePartyTransfer;
    
    if (isDebtTransfer) {
        // Debt transfers ALWAYS affect balances and should appear in transaction history
        // Even if they have migrationFlag or other metadata, they are real transactions
        return false;
    }
    
    // Migration records are logs (but NOT debt transfers, handled above)
    if (record.migrationFlag === true) return true;
    if (record.needsReview === true) return true;
    
    // Administrative resets are logs (balance corrections, not transactions)
    if (type === 'administrative_reset') return true;
    
    // Explicitly marked as log
    if (record.isLog === true) return true;
    if (record.recordType === 'log') return true;
    
    return false;
}

/**
 * Check if a record is a real financial transaction
 * @param {Object} record - Transaction/log record
 * @returns {boolean} True if this is a real transaction
 */
export function isRealTransaction(record) {
    if (!record) return false;
    
    // Logs are not real transactions
    if (isSystemLog(record)) return false;
    
    // Deleted transactions are not real
    if (record.isDeleted === true) return false;
    
    // Must have a valid transaction type
    const type = String(record.islemTipi || '').toLowerCase().trim();
    if (!type) return false;
    
    // Valid transaction types (balance-affecting)
    const validTypes = [
        'gelir', 
        'gider', 
        'tahsilat', 
        'ödeme', 
        'odeme',
        'borç transferi',
        'borc transferi',
        'debt_transfer',
        'transfer' // Include regular transfers (three-party transfers are debt transfers)
    ];
    
    return validTypes.includes(type);
}

/**
 * Get log type label
 * @param {Object} log - Log record
 * @returns {string} Human-readable log type
 */
export function getLogTypeLabel(log) {
    if (!log) return 'Sistem Logu';
    
    if (log.migrationFlag === true || log.needsReview === true) {
        return 'Migration Kaydı';
    }
    
    const type = String(log.islemTipi || '').toLowerCase().trim();
    
    if (type === 'borç transferi' || type === 'borc transferi' || type === 'debt_transfer') {
        return 'Borç Transferi (Bilgi Kaydı)';
    }
    
    if (type === 'administrative_reset') {
        return 'Yönetici Sıfırlaması';
    }
    
    if (log.recordType === 'balance_correction') {
        return 'Bakiye Düzeltmesi';
    }
    
    return 'Sistem Logu';
}

/**
 * Get log description
 * @param {Object} log - Log record
 * @param {Function} getAccountName - Function to get account name by ID
 * @returns {string} Log description
 */
export function getLogDescription(log, getAccountName) {
    if (!log) return '';
    
    const logType = String(log.islemTipi || '').toLowerCase().trim();
    
    if (log.migrationFlag === true) {
        const needsReview = log.needsReview ? ' (İnceleme Gerekli)' : '';
        return `Borç transferi migration kaydı${needsReview}`;
    }
    
    if (logType === 'borç transferi' || logType === 'borc transferi' || logType === 'debt_transfer') {
        // Get party names
        const debtor = typeof getAccountName === 'function' ? getAccountName(log.islemCari) : 'Borçlu';
        const lender = typeof getAccountName === 'function' ? getAccountName(log.kaynakCari) : 'Borç Veren';
        const paidOff = typeof getAccountName === 'function' ? getAccountName(log.hedefCari) : 'Borcu Kapanan';
        
        return `Borç sahipliği değişikliği: ${lender} → ${debtor} → ${paidOff}. Bu işlem yalnızca borç sahipliğini gösterir, nakit akışına etki etmez.`;
    }
    
    if (logType === 'administrative_reset') {
        const accountName = typeof getAccountName === 'function' 
            ? getAccountName(log.islemCari) 
            : 'Hesap';
        return `${accountName} bakiyesi sıfırlandı`;
    }
    
    return log.aciklama || getLogTypeLabel(log);
}

/**
 * Filter transactions to get only real ones (exclude logs)
 * @param {Array} records - Array of transaction/log records
 * @returns {Array} Only real transactions
 */
export function filterRealTransactions(records) {
    if (!Array.isArray(records)) return [];
    return records.filter(isRealTransaction);
}

/**
 * Filter transactions to get only logs
 * @param {Array} records - Array of transaction/log records
 * @returns {Array} Only logs
 */
export function filterSystemLogs(records) {
    if (!Array.isArray(records)) return [];
    return records.filter(isSystemLog);
}

/**
 * Separate records into transactions and logs
 * @param {Array} records - Array of transaction/log records
 * @returns {{transactions: Array, logs: Array}} Separated records
 */
export function separateTransactionsAndLogs(records) {
    if (!Array.isArray(records)) {
        return { transactions: [], logs: [] };
    }
    
    const transactions = [];
    const logs = [];
    
    records.forEach(record => {
        if (isSystemLog(record)) {
            logs.push(record);
        } else if (isRealTransaction(record)) {
            transactions.push(record);
        }
    });
    
    return { transactions, logs };
}

