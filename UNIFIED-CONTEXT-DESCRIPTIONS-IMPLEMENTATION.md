# Unified Context Descriptions in Account Detail View

**Status:** ✅ Implemented  
**Date:** November 6, 2025  
**File Modified:** `src/ui/views/home.view.js`

---

## Goal

Bring the same compact, contextual description logic from the **Nakit Akışı** report into the **Cari Detay Sayfası** (Account Detail View), ensuring every transaction clearly shows "who paid whom" or "who collected from whom."

---

## Implementation Summary

The `buildTransactionDescription` function in `src/ui/views/home.view.js` has been enhanced to automatically generate rich, contextual descriptions for transactions in the İşlem Geçmişi (Transaction History) section of any Account Detail page.

### Key Changes

1. **Smart Description Generation**
   - If a transaction has a meaningful description (≥10 characters), it is preserved
   - For short or missing descriptions, contextual information is auto-generated
   - Applies to `tahsilat`, `ödeme`, and `transfer` transaction types

2. **Contextual Information Included**
   - Source account (`kaynakCari`) and target account (`hedefCari`) names
   - Transaction amount in formatted currency (₺)
   - Invoice number (`faturaNumarasi`) when available
   - Existing notes are preserved and appended when present

3. **Transaction Type Handling**

   **Tahsilat (Collection):**
   ```
   "Vakko'dan ₺342,012.00 tahsil edildi (Fatura: OLD2025000041)"
   "Müşteri A'dan ₺50,000.00 tahsil edildi"
   ```

   **Ödeme (Payment):**
   ```
   "Motifera Hesap'tan Sena Engin'e ₺110,000.00 ödeme yapıldı"
   "Tedarikçi B'e ₺25,000.00 ödeme yapıldı"
   ```

   **Transfer:**
   ```
   "Sezon Tekstil → Atilla Atölye (₺27,300.00)"
   "Hesap A → Hesap B (₺15,000.00)"
   ```

   **Borç Transferi (Debt Transfer):**
   ```
   "Banka X → Şirket → Alacaklı Y (₺100,000.00)"
   "Kaynak → Hedef (₺50,000.00) [Borç Transferi]"
   ```

4. **Tooltip Support**
   - Descriptions longer than 120 characters are truncated with "..."
   - Full description is available via hover tooltip
   - Preserves user experience for long contextual information

5. **Invoice Number Display**
   - When an existing description is present, invoice number is shown below it in smaller gray text
   - When auto-generating, invoice number is included inline in parentheses

---

## Technical Details

### Function: `buildTransactionDescription(transaction)`

**Location:** `src/ui/views/home.view.js` (lines 546-660)

**Logic Flow:**

1. **Check Existing Description**
   ```javascript
   if (existingDesc.length >= 10) {
       // Keep existing description, optionally add invoice number
   }
   ```

2. **Determine if Auto-Generation is Needed**
   ```javascript
   const shouldAutoGenerate = txType === 'tahsilat' || 
                              txType === 'ödeme' || 
                              txType === 'odeme' || 
                              txType === 'transfer';
   ```

3. **Extract Transaction Context**
   - Source account name from `transaction.kaynakCari`
   - Target account name from `transaction.hedefCari`
   - Amount from `transaction.toplamTutar` or `transaction.tutar`
   - Invoice number from `transaction.faturaNumarasi`

4. **Build Contextual Description**
   - Use Turkish grammatical structures (e.g., "'dan", "'e", "'tan")
   - Format amount with `formatCurrency()` utility
   - Include all relevant parties
   - Append existing notes when present

5. **Handle Edge Cases**
   - Missing source or target accounts
   - Debt transfer detection
   - Truncation for long descriptions
   - Fallback to arrow notation when needed

---

## Visual Consistency

The implementation ensures visual consistency between two key views:

| Feature | Account Detail View | Nakit Akışı Report |
|---------|-------------------|-------------------|
| **Auto-generation** | ✅ Yes (tahsilat, ödeme, transfer) | ✅ Yes (tahsilat, ödeme) |
| **Source & Target** | ✅ Included | ✅ Included |
| **Amount Display** | ✅ Formatted (₺) | ✅ Formatted (₺) |
| **Invoice Numbers** | ✅ Inline or below | ✅ Inline |
| **Truncation** | ✅ 120 chars + tooltip | ✅ 120 chars + tooltip |
| **Badges** | ✅ Colored type badges | ✅ Colored type badges |

### Badge Colors (Preserved)

- **Tahsilat:** Blue (`#438BDA`)
- **Ödeme:** Orange (`#E28A49`)
- **Borç Transferi:** Purple (`#7C63E5`)

---

## No Data Mutation

⚠️ **Important:** These descriptions are computed **dynamically** at render time.

- Firestore documents remain **unchanged**
- No database writes are performed
- Original `aciklama` field is preserved
- Changes are purely presentational

---

## User Experience Benefits

1. **Instant Context:** Users immediately understand what happened in each transaction
2. **No Manual Entry Required:** System fills in obvious details automatically
3. **Consistent Format:** All transactions follow the same readable pattern
4. **Preserved Notes:** User-entered descriptions are never lost
5. **Tooltip Fallback:** Long descriptions don't clutter the UI

---

## Example Comparisons

### Before Implementation

```
Transaction 1:
  Type: Tahsilat
  Description: [Empty]
  
Transaction 2:
  Type: Ödeme
  Description: "Fatura No: INV-2025-001"
```

### After Implementation

```
Transaction 1:
  Type: Tahsilat
  Description: "Vakko'dan ₺342,012.00 tahsil edildi"
  
Transaction 2:
  Type: Ödeme
  Description: "Motifera Hesap'tan Sena Engin'e ₺110,000.00 ödeme yapıldı (Fatura: INV-2025-001)"
```

---

## Code Quality

✅ **No Linter Errors**  
✅ **Consistent with Existing Patterns**  
✅ **Reuses Utility Functions** (`formatCurrency`, `getAccountName`)  
✅ **Handles Edge Cases**  
✅ **Turkish Language Support**

---

## Testing Recommendations

To verify the implementation:

1. **View Account Detail Page**
   - Navigate to any account (Cariler → Select Account)
   - Check İşlem Geçmişi tab

2. **Check Different Transaction Types**
   - Tahsilat records should show collection descriptions
   - Ödeme records should show payment descriptions
   - Transfer records should show arrow notation
   - Debt transfers should identify parties

3. **Verify Edge Cases**
   - Transactions with existing descriptions (preserved)
   - Transactions with invoice numbers (included)
   - Transactions with missing source/target (handled gracefully)
   - Very long descriptions (truncated with tooltip)

4. **Confirm No Data Mutation**
   - Check Firestore console
   - Verify `aciklama` fields are unchanged
   - Confirm no unexpected writes

---

## Related Files

- **Modified:** `src/ui/views/home.view.js` (buildTransactionDescription function)
- **Reference:** `src/ui/views/financial-summary.view.js` (generateCashFlowDescription function)
- **Utilities Used:**
  - `formatCurrency()` (from shared context)
  - `getAccountName()` (from deps)

---

## Conclusion

The unified context descriptions feature successfully bridges the gap between the Nakit Akışı report and the Account Detail View, providing users with consistent, readable, and informative transaction descriptions across all views of the application.

Every transaction now tells a clear story: **who paid whom, how much, and why.**

---

**Implementation Complete** ✅

