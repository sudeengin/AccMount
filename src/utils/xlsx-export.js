/**
 * XLSX Export Utility
 * Provides functions to export data to Excel format
 * Uses SheetJS (xlsx) library for native spreadsheet support
 * 
 * Note: This module expects XLSX to be loaded globally via CDN
 * Add to index.html: <script src="https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js"></script>
 */

// XLSX library loaded globally from CDN
const XLSX = window.XLSX;

/**
 * Download XLSX file
 * @param {Object} workbook - XLSX workbook object
 * @param {string} filename - Name of file to download
 */
function downloadXLSX(workbook, filename = 'export.xlsx') {
    try {
        // Write workbook to binary array
        const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        
        // Create blob and download
        const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        
        document.body.appendChild(link);
        
        setTimeout(() => {
            link.click();
            console.log('[XLSX Export] Download triggered');
            
            // Clean up
            document.body.removeChild(link);
            setTimeout(() => {
                URL.revokeObjectURL(url);
                console.log('[XLSX Export] URL revoked');
            }, 250);
        }, 10);
        
    } catch (error) {
        console.error('[XLSX Export] Error during download:', error);
        throw new Error(`Dosya indirme hatası: ${error.message}`);
    }
}

/**
 * Format number as Excel numeric value with sign
 * @param {number} amount - Amount to format
 * @param {boolean} isNegative - Whether to apply negative sign
 * @returns {number} Numeric value for Excel
 */
function formatNumericValue(amount, isNegative = false) {
    const num = Number(amount || 0);
    if (isNaN(num)) return 0;
    
    const value = Math.abs(num);
    return isNegative ? -value : value;
}

/**
 * Export Financial Summary Report to XLSX
 * Matches Dashboard display exactly: Tarih | İşlem | Açıklama | Tutar | Cari
 * 
 * @param {Array<Object>} transactions - Filtered transactions (same as Dashboard)
 * @param {Function} getAccountName - Function to get account name by ID
 * @param {Function} getTransactionTypeLabel - Function to get transaction type label
 * @param {Function} formatTransactionDate - Function to format transaction date
 * @param {Function} generateCashFlowDescription - Function to generate description
 * @param {string} reportMode - 'income' or 'cashflow'
 * @param {string} filename - Optional filename
 */
export function exportFinancialReportToXLSX({
    transactions,
    getAccountName,
    getTransactionTypeLabel,
    formatTransactionDate,
    generateCashFlowDescription,
    reportMode,
    filename = null
}) {
    console.log('[XLSX Export] exportFinancialReportToXLSX called with', transactions?.length, 'transactions');
    
    if (!Array.isArray(transactions) || transactions.length === 0) {
        console.error('[XLSX Export] No transactions to export');
        throw new Error('Dışa aktarılacak işlem bulunamadı.');
    }

    // Prepare data rows matching Dashboard exactly
    const rows = transactions.map(tx => {
        const amount = Math.abs(Number(tx.toplamTutar || tx.tutar || 0));
        const typeLabel = getTransactionTypeLabel(tx);
        
        // Check if this is a debt transfer
        const txType = String(tx.islemTipi || '').toLowerCase().trim();
        const isDebtTransfer = (txType === 'transfer' && tx.kaynakCari && tx.hedefCari) ||
                               txType === 'borç transferi' || 
                               txType === 'borc transferi' || 
                               txType === 'debt_transfer';
        
        // Generate description
        let description = tx.aciklama || '';
        if (isDebtTransfer && tx.kaynakCari && tx.hedefCari) {
            const sourceAccount = getAccountName(tx.kaynakCari);
            const targetAccount = getAccountName(tx.hedefCari);
            description = `${sourceAccount} → ${targetAccount}`;
        } else {
            const descResult = generateCashFlowDescription(tx, reportMode);
            description = descResult.description;
        }
        
        // Determine sign based on transaction type and report mode
        let numericAmount;
        if (reportMode === 'cashflow') {
            // Cash Flow mode: Only tahsilat and ödeme (transfers excluded at filter level)
            if (txType === 'tahsilat') {
                numericAmount = formatNumericValue(amount, false); // Positive (cash inflow)
            } else if (txType === 'ödeme' || txType === 'odeme') {
                numericAmount = formatNumericValue(amount, true); // Negative (cash outflow)
            } else {
                // Should not reach here in cashflow mode (transfers filtered out)
                numericAmount = formatNumericValue(amount, false);
            }
        } else {
            // Income/Expense mode: gelir, gider, and debt transfers
            if (txType === 'gelir') {
                numericAmount = formatNumericValue(amount, false); // Positive
            } else if (txType === 'gider') {
                numericAmount = formatNumericValue(amount, true); // Negative
            } else if (isDebtTransfer) {
                numericAmount = formatNumericValue(amount, true); // Negative
            } else {
                numericAmount = formatNumericValue(amount, false);
            }
        }
        
        return [
            formatTransactionDate(tx),  // Tarih
            typeLabel,                   // İşlem
            description,                 // Açıklama
            numericAmount,               // Tutar (as number)
            getAccountName(tx.islemCari || tx.kaynakCari || tx.hedefCari) // Cari
        ];
    });

    // Create header row
    const headers = ['Tarih', 'İşlem', 'Açıklama', 'Tutar', 'Cari'];
    
    // Combine headers and data
    const wsData = [headers, ...rows];
    
    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    // Set column widths
    ws['!cols'] = [
        { wch: 12 },  // Tarih
        { wch: 18 },  // İşlem
        { wch: 50 },  // Açıklama
        { wch: 15 },  // Tutar
        { wch: 25 }   // Cari
    ];
    
    // Format number column (Tutar - column D)
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let row = 1; row <= range.e.r; row++) { // Start from 1 to skip header
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: 3 }); // Column D (0-indexed = 3)
        if (ws[cellAddress]) {
            ws[cellAddress].t = 'n'; // Force number type
            ws[cellAddress].z = '#,##0.00'; // Number format with 2 decimals
        }
    }
    
    // Apply header styling
    const headerStyle = {
        font: { bold: true, sz: 11, name: 'Inter' },
        fill: { fgColor: { rgb: '151A22' } },
        alignment: { vertical: 'center', horizontal: 'center' }
    };
    
    for (let col = 0; col <= 4; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
        if (!ws[cellAddress]) ws[cellAddress] = {};
        ws[cellAddress].s = headerStyle;
    }
    
    // Create workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, reportMode === 'cashflow' ? 'Nakit Akışı' : 'Gelir-Gider');
    
    // Generate filename
    const defaultFilename = `financial_report_${new Date().toISOString().split('T')[0]}.xlsx`;
    const finalFilename = filename || defaultFilename;
    
    console.log('[XLSX Export] Final filename:', finalFilename);
    
    // Download file
    downloadXLSX(wb, finalFilename);
}

