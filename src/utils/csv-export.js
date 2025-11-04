/**
 * CSV Export Utility
 * Provides functions to export data to CSV format
 */

import { getAccountType, getAccountTypeLabel } from './account-type.js';
import { getTransactionTypeLabel } from './transaction-direction.js';
import { isDebtTransfer, getDebtTransferCSVCategory, getAccountRoleInDebtTransfer } from './debt-transfer.js';
import { getTransactionDisplayLabel, getDebtTransferParticipantRole } from './transaction-grouping.js';
import { isRealTransaction } from './transaction-log.js';

/**
 * Escapes a value for CSV format
 * @param {*} value - The value to escape
 * @returns {string} - The escaped value
 */
function escapeCsvValue(value) {
    if (value == null) return '';
    
    const stringValue = String(value);
    
    // If the value contains comma, quote, or newline, wrap it in quotes and escape existing quotes
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
    }
    
    return stringValue;
}

/**
 * Converts an array of objects to CSV format
 * @param {Array<Object>} data - Array of objects to convert
 * @param {Array<string>} headers - Optional custom headers
 * @param {Object} fieldMapping - Optional field name mapping { originalKey: displayName }
 * @returns {string} - CSV formatted string
 */
export function convertToCSV(data, headers = null, fieldMapping = {}) {
    if (!Array.isArray(data) || data.length === 0) {
        return '';
    }

    // Get all unique keys from the data
    const allKeys = new Set();
    data.forEach(row => {
        Object.keys(row).forEach(key => allKeys.add(key));
    });

    // Use provided headers or extract from data
    const keys = headers || Array.from(allKeys);
    
    // Create header row with mapped names
    const headerRow = keys.map(key => {
        const displayName = fieldMapping[key] || key;
        return escapeCsvValue(displayName);
    }).join(',');

    // Create data rows
    const dataRows = data.map(row => {
        return keys.map(key => {
            const value = row[key];
            
            // Handle special types
            if (value instanceof Date) {
                return escapeCsvValue(value.toLocaleString('tr-TR'));
            }
            
            // Handle Firestore Timestamp
            if (value && typeof value === 'object' && typeof value.toDate === 'function') {
                return escapeCsvValue(value.toDate().toLocaleString('tr-TR'));
            }
            
            // Handle Firestore Timestamp with seconds
            if (value && typeof value === 'object' && value.seconds) {
                const date = new Date(value.seconds * 1000);
                return escapeCsvValue(date.toLocaleString('tr-TR'));
            }
            
            return escapeCsvValue(value);
        }).join(',');
    });

    return [headerRow, ...dataRows].join('\n');
}

/**
 * Triggers a download of CSV data
 * @param {string} csvContent - The CSV content to download
 * @param {string} filename - The name of the file to download
 */
export function downloadCSV(csvContent, filename = 'export.csv') {
    if (!csvContent) {
        console.error('[CSV Export] No content to download');
        throw new Error('CSV içeriği boş.');
    }
    
    try {
        // Add BOM for proper UTF-8 encoding in Excel
        const BOM = '\uFEFF';
        const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
        
        console.log('[CSV Export] Blob created, size:', blob.size, 'bytes');
        console.log('[CSV Export] Filename:', filename);
        
        // Try using the modern approach first
        if (window.navigator && window.navigator.msSaveOrOpenBlob) {
            // IE11 and Edge legacy
            window.navigator.msSaveOrOpenBlob(blob, filename);
            console.log('[CSV Export] Downloaded using msSaveOrOpenBlob');
            return;
        }
        
        // Modern browsers
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        
        console.log('[CSV Export] Download URL created:', url);
        
        document.body.appendChild(link);
        
        // Some browsers require a small delay
        setTimeout(() => {
            link.click();
            console.log('[CSV Export] Download triggered');
            
            // Clean up
            document.body.removeChild(link);
            setTimeout(() => {
                URL.revokeObjectURL(url);
                console.log('[CSV Export] URL revoked');
            }, 250);
        }, 10);
        
    } catch (error) {
        console.error('[CSV Export] Error during download:', error);
        throw new Error(`Dosya indirme hatası: ${error.message}`);
    }
}

/**
 * Exports accounts to CSV format
 * @param {Array<Object>} accounts - Array of account objects
 * @param {string} filename - Optional filename
 */
export function exportAccountsToCSV(accounts, filename = null) {
    console.log('[CSV Export] exportAccountsToCSV called with', accounts?.length, 'accounts');
    
    if (!Array.isArray(accounts) || accounts.length === 0) {
        console.error('[CSV Export] No accounts to export');
        throw new Error('Dışa aktarılacak cari bulunamadı.');
    }

    // Enrich accounts with account type information
    const enrichedAccounts = accounts.map(account => {
        const accountType = getAccountType(account);
        const accountTypeLabel = getAccountTypeLabel(accountType);
        
        return {
            ...account,
            accountType,
            accountTypeLabel
        };
    });

    // Define the fields we want to export and their display names
    const fieldMapping = {
        'id': 'ID',
        'unvan': 'Ünvan/Ad Soyad',
        'tipi': 'Tip',
        'accountTypeLabel': 'Hesap Türü',
        'bakiye': 'Bakiye',
        'vergiNo': 'Vergi No',
        'vergiDairesi': 'Vergi Dairesi',
        'email': 'E-posta',
        'telefon': 'Telefon',
        'adres': 'Adres',
        'sehir': 'Şehir',
        'ulke': 'Ülke',
        'olusturmaTarihi': 'Oluşturma Tarihi',
        'guncellemeTarihi': 'Güncelleme Tarihi'
    };

    // Define the order of fields (accountTypeLabel added after tipi)
    const orderedFields = [
        'id',
        'unvan',
        'tipi',
        'accountTypeLabel',
        'bakiye',
        'vergiNo',
        'vergiDairesi',
        'email',
        'telefon',
        'adres',
        'sehir',
        'ulke',
        'olusturmaTarihi',
        'guncellemeTarihi'
    ];

    const csvContent = convertToCSV(enrichedAccounts, orderedFields, fieldMapping);
    console.log('[CSV Export] CSV content generated, length:', csvContent?.length);
    
    const defaultFilename = `cariler_${new Date().toISOString().split('T')[0]}.csv`;
    const finalFilename = filename || defaultFilename;
    console.log('[CSV Export] Final filename:', finalFilename);
    
    downloadCSV(csvContent, finalFilename);
}

/**
 * Exports transactions to CSV format
 * @param {Array<Object>} transactions - Array of transaction objects
 * @param {Function} getAccountName - Function to get account name by ID
 * @param {string} filename - Optional filename
 * @param {Function} getAccount - Function to get full account object by ID (for type detection)
 */
export function exportTransactionsToCSV(transactions, getAccountName = null, filename = null, getAccount = null) {
    console.log('[CSV Export] exportTransactionsToCSV called with', transactions?.length, 'transactions');
    
    if (!Array.isArray(transactions) || transactions.length === 0) {
        console.error('[CSV Export] No transactions to export');
        throw new Error('Dışa aktarılacak işlem bulunamadı.');
    }

    // Filter to only include real financial transactions (exclude logs)
    const realTransactions = transactions.filter(tx => isRealTransaction(tx));
    
    console.log('[CSV Export] Filtered to', realTransactions.length, 'real transactions (excluded', 
                transactions.length - realTransactions.length, 'logs)');
    
    if (realTransactions.length === 0) {
        throw new Error('Dışa aktarılacak finansal işlem bulunamadı (sadece log kayıtları var).');
    }

    // Process transactions to add account names, types, categories, and display labels
    const processedTransactions = realTransactions.map(tx => {
        const processed = { ...tx };
        
        // Add affectsBalance status
        processed.affectsBalanceStatus = tx.affectsBalance !== false ? 'Evet' : 'Hayır (Pending)';
        
        // Add human-readable transaction type label
        processed.islemTipiLabel = getTransactionTypeLabel(tx);
        
        // Add display label (prevents mislabeling, e.g., debt transfers as income)
        processed.displayLabel = getTransactionDisplayLabel(tx);
        
        // Add participant role for debt transfers
        if (isDebtTransfer(tx)) {
            processed.participantRole = getDebtTransferParticipantRole(tx, null, getAccountName);
        } else {
            processed.participantRole = '';
        }
        
        // Categorize debt transfers separately
        if (isDebtTransfer(tx)) {
            processed.category = getDebtTransferCSVCategory(); // "Liability Transfer"
        } else {
            // Standard transaction categories based on type
            const type = String(tx.islemTipi || '').toLowerCase().trim();
            if (type === 'gelir') {
                processed.category = 'Income';
            } else if (type === 'gider') {
                processed.category = 'Expense';
            } else if (type === 'tahsilat') {
                processed.category = 'Collection';
            } else if (type === 'ödeme' || type === 'odeme') {
                processed.category = 'Payment';
            } else if (type === 'transfer') {
                processed.category = 'Transfer';
            } else if (type === 'administrative_reset') {
                processed.category = 'Administrative Reset';
            } else {
                processed.category = 'Other';
            }
        }
        
        if (getAccountName) {
            if (tx.islemCari) {
                processed.islemCariAd = getAccountName(tx.islemCari);
            }
            if (tx.kaynakCari) {
                processed.kaynakCariAd = getAccountName(tx.kaynakCari);
            }
            if (tx.hedefCari) {
                processed.hedefCariAd = getAccountName(tx.hedefCari);
            }
        }
        
        // Add account type information if getAccount function is provided
        if (getAccount) {
            if (tx.islemCari) {
                const account = getAccount(tx.islemCari);
                if (account) {
                    const accountType = getAccountType(account);
                    processed.islemCariTip = getAccountTypeLabel(accountType);
                }
            }
            if (tx.kaynakCari) {
                const account = getAccount(tx.kaynakCari);
                if (account) {
                    const accountType = getAccountType(account);
                    processed.kaynakCariTip = getAccountTypeLabel(accountType);
                }
            }
            if (tx.hedefCari) {
                const account = getAccount(tx.hedefCari);
                if (account) {
                    const accountType = getAccountType(account);
                    processed.hedefCariTip = getAccountTypeLabel(accountType);
                }
            }
        }
        
        return processed;
    });

    // Define the fields we want to export and their display names
    const fieldMapping = {
        'id': 'ID',
        'category': 'Kategori',
        'displayLabel': 'Görünen Etiket',
        'participantRole': 'Katılımcı Rolleri',
        'islemTipi': 'İşlem Tipi (Kod)',
        'islemTipiLabel': 'İşlem Tipi',
        'affectsBalanceStatus': 'Bakiyeye Dahil',
        'tutar': 'Tutar',
        'toplamTutar': 'Toplam Tutar',
        'vergiOrani': 'Vergi Oranı (%)',
        'tarih': 'Tarih',
        'aciklama': 'Açıklama',
        'faturaNumarasi': 'Fatura Numarası',
        'islemCariAd': 'İşlem Cari',
        'islemCariTip': 'İşlem Cari Türü',
        'kaynakCariAd': 'Kaynak Cari',
        'kaynakCariTip': 'Kaynak Cari Türü',
        'hedefCariAd': 'Hedef Cari',
        'hedefCariTip': 'Hedef Cari Türü',
        'kayitTarihi': 'Kayıt Tarihi'
    };

    const orderedFields = [
        'id',
        'tarih',
        'category',
        'displayLabel',
        'participantRole',
        'islemTipiLabel',
        'affectsBalanceStatus',
        'tutar',
        'vergiOrani',
        'toplamTutar',
        'islemCariAd',
        'islemCariTip',
        'kaynakCariAd',
        'kaynakCariTip',
        'hedefCariAd',
        'hedefCariTip',
        'faturaNumarasi',
        'aciklama',
        'kayitTarihi'
    ];

    const csvContent = convertToCSV(processedTransactions, orderedFields, fieldMapping);
    console.log('[CSV Export] CSV content generated, length:', csvContent?.length);
    
    const defaultFilename = `islemler_${new Date().toISOString().split('T')[0]}.csv`;
    const finalFilename = filename || defaultFilename;
    console.log('[CSV Export] Final filename:', finalFilename);
    
    downloadCSV(csvContent, finalFilename);
}

