/**
 * Date Utility Functions
 * 
 * Shared utilities for parsing and formatting dates consistently
 * across all transaction tables and views.
 */

/**
 * Parse a date value from various formats
 * Handles Firestore timestamps, Date objects, and strings
 * 
 * @param {any} dateValue - The date value to parse
 * @returns {Date|null} Parsed Date object or null
 */
export function parseDate(dateValue) {
    if (!dateValue) return null;
    
    // Handle Firestore Timestamp
    if (typeof dateValue.toDate === 'function') {
        return dateValue.toDate();
    }
    
    // Handle timestamp with seconds
    if (dateValue.seconds) {
        return new Date(dateValue.seconds * 1000);
    }
    
    // Handle Date object
    if (dateValue instanceof Date) {
        return dateValue;
    }
    
    // Handle string
    if (typeof dateValue === 'string') {
        const parsed = new Date(dateValue);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    
    return null;
}

/**
 * Format a date value for display in transaction tables
 * Returns "—" (em dash) if no valid date exists
 * 
 * @param {any} dateValue - The date value to format
 * @returns {string} Formatted date string or em dash
 */
export function formatDate(dateValue) {
    if (!dateValue) return "—";
    
    const date = parseDate(dateValue);
    if (!date) return "—";
    
    return date.toLocaleDateString("tr-TR");
}

/**
 * Get transaction date with priority: islemTarihi > tarih > kayitTarihi
 * 
 * @param {Object} transaction - Transaction object
 * @returns {Date|null} Parsed date or null
 */
export function getTransactionDate(transaction) {
    if (!transaction) return null;
    
    // Use first available field: islemTarihi, tarih, or kayitTarihi
    const value = transaction.islemTarihi || transaction.tarih || transaction.kayitTarihi;
    return parseDate(value);
}

/**
 * Format a transaction date for display
 * 
 * @param {Object} transaction - Transaction object
 * @returns {string} Formatted date string or em dash
 */
export function formatTransactionDate(transaction) {
    const date = getTransactionDate(transaction);
    return date ? date.toLocaleDateString("tr-TR") : "—";
}

/**
 * Sort transactions by date descending (newest first)
 * 
 * @param {Array} transactions - Array of transactions
 * @returns {Array} Sorted transactions
 */
export function sortTransactionsByDateDesc(transactions) {
    if (!Array.isArray(transactions)) return [];
    
    return [...transactions].sort((a, b) => {
        const dateA = getTransactionDate(a);
        const dateB = getTransactionDate(b);
        const timeA = dateA ? dateA.getTime() : 0;
        const timeB = dateB ? dateB.getTime() : 0;
        
        // Sort by date first
        if (timeA !== timeB) {
            return timeB - timeA; // Descending order
        }
        
        // If dates are equal, use record creation time as tiebreaker
        const recordA = a.kayitTarihi?.seconds || 0;
        const recordB = b.kayitTarihi?.seconds || 0;
        return recordB - recordA;
    });
}

/**
 * Compare two dates for sorting
 * 
 * @param {any} dateA - First date value
 * @param {any} dateB - Second date value
 * @returns {number} Comparison result (-1, 0, or 1)
 */
export function compareDates(dateA, dateB) {
    const parsedA = parseDate(dateA);
    const parsedB = parseDate(dateB);
    
    const timeA = parsedA ? parsedA.getTime() : 0;
    const timeB = parsedB ? parsedB.getTime() : 0;
    
    if (timeA < timeB) return -1;
    if (timeA > timeB) return 1;
    return 0;
}

