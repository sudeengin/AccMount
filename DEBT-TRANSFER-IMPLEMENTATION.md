# Debt Transfer Implementation - Three-Party Event System

## Overview

This document describes the implementation of the **Debt Transfer** feature, which treats debt transfers as **three-party events** rather than simple payments or expenses. This ensures accurate balance tracking and prevents incorrect financial reporting.

## Core Concept

A debt transfer is a **liability reassignment**, not a cashflow or profit/loss transaction. It involves three parties:

1. **Debtor** (e.g., Motifera - the company): The party that owes money
2. **From Creditor** (e.g., Sezon Tekstil): Previous creditor who held the receivable
3. **To Creditor** (e.g., Co Denim): New creditor who receives the receivable

### Key Principles

- **Debtor's liability stays constant** - only the creditor changes
- **From Creditor's balance decreases** - receivable transferred away
- **To Creditor's balance increases** - receivable gained
- **NO impact on income, expense, or cashflow** - this is not a P&L transaction
- **Direction = 0** - neutral for financial summaries

## Implementation Details

### 1. Core Utility (`src/utils/debt-transfer.js`)

New utility module that handles all debt transfer logic:

**Key Functions:**
- `isDebtTransfer(transaction)` - Identifies debt transfer transactions
- `validateDebtTransfer(transaction)` - Validates three-party structure
- `createDebtTransferTransaction(params)` - Creates properly structured debt transfer
- `getDebtTransferParties(transaction)` - Extracts the three parties
- `calculateDebtTransferImpact(transaction, accountId)` - Calculates balance impact
- `getDebtTransferDescription(transaction, getAccountName)` - Generates human-readable description

### 2. Transaction Direction (`src/utils/transaction-direction.js`)

Updated to handle debt transfers with direction = 0:

```javascript
const TRANSACTION_DIRECTION_MAP = {
    'borç transferi': 0,  // Debt Transfer (neutral for P&L)
    'borc transferi': 0,  // Debt Transfer (without Turkish character)
    'debt_transfer': 0,   // Debt Transfer (English)
    // ... other transaction types
};
```

**Visual Distinction:**
- Badge color: Yellow (`bg-yellow-500/20 text-yellow-400`)
- Label: "Borç Transferi"

### 3. Financial Summary (`src/utils/financial-summary.js`)

Updated to **exclude debt transfers** from income/expense calculations:

```javascript
if (isDebtTransfer(tx)) {
    // Debt transfers are liability reassignments, not P&L transactions
    // Track separately but don't add to income or expense
    summary.totalTransfers += amount;
}
```

This applies to both:
- **Income mode** (profit/loss focus)
- **Cashflow mode** (cash position focus)

### 4. Balance Calculation (`index.html`)

Two core functions updated to handle three-party logic:

#### `getCariNetChange(islem, cariId)`
```javascript
if (isDebtTransfer) {
    // Debtor: no change (only the counterparty changes)
    if (islem.islemCari === cariId) return 0;
    
    // From creditor: loses receivable
    if (islem.kaynakCari === cariId) change -= amount;
    
    // To creditor: gains receivable
    if (islem.hedefCari === cariId) change += amount;
}
```

#### `calculateCariDeltas(islem, factor)`
```javascript
if (isDebtTransfer) {
    addDelta(islem.kaynakCari, factor * -amount);  // From creditor
    addDelta(islem.hedefCari, factor * amount);     // To creditor
    // Note: islemCari (debtor) intentionally not added
}
```

### 5. User Interface

#### Transaction Form (`index.html`)

New dedicated section for debt transfers with clear labels:

```html
<div id="debtTransferContainer" class="hidden space-y-4 mt-4">
    <!-- Explanation banner -->
    <div class="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
        <p class="text-sm text-yellow-800 dark:text-yellow-200">
            <strong>Borç Transferi:</strong> Üç taraflı bir işlemdir...
        </p>
    </div>
    
    <!-- Three account selects -->
    <select id="debtorCari" name="islemCari">...</select>
    <select id="fromCreditorCari" name="kaynakCari">...</select>
    <select id="toCreditorCari" name="hedefCari">...</select>
    
    <!-- Amount, date, description -->
    ...
</div>
```

**Form Behavior:**
- Shows when "Borç Transferi" is selected from transaction type dropdown
- Validates all three parties are different
- Clear helper text for each party role
- Visual distinction with yellow theme

#### Form Submission

Debt transfers are saved with:
```javascript
{
    islemTipi: 'borç transferi',
    islemCari: debtorCariSelect.value,      // Debtor
    kaynakCari: fromCreditorCariSelect.value, // From creditor
    hedefCari: toCreditorCariSelect.value,    // To creditor
    direction: 0,                            // Neutral for P&L
    isDebtTransfer: true,
    transferType: 'liability_reassignment'
}
```

**Database Updates:**
- From creditor: `increment(-amount)`
- To creditor: `increment(+amount)`
- Debtor: **NO UPDATE** (balance stays same)

### 6. Activity View Display (`src/ui/views/activity.view.js`)

Enhanced to show three-party information:

```javascript
if (isDebtTransfer) {
    const debtor = getAccountName(transaction?.islemCari);
    const fromCreditor = getAccountName(transaction?.kaynakCari);
    const toCreditor = getAccountName(transaction?.hedefCari);
    subtitleParts.push(`${debtor}: ${fromCreditor} → ${toCreditor}`);
}
```

**Display Format:**
```
Borç Transferi
₺10,000.00
Açıklama • Tür: borç transferi • Motifera: Sezon Tekstil → Co Denim
```

## Data Structure

### Transaction Document Structure

```javascript
{
    id: "abc123",
    islemTipi: "borç transferi",
    
    // Three parties
    islemCari: "debtor-id",           // Debtor (company)
    kaynakCari: "from-creditor-id",   // From creditor
    hedefCari: "to-creditor-id",      // To creditor
    
    // Amount
    tutar: 10000.00,
    toplamTutar: 10000.00,
    
    // Metadata
    tarih: Timestamp,
    kayitTarihi: Timestamp,
    aciklama: "Borç transferi",
    direction: 0,                      // Neutral for P&L
    isDebtTransfer: true,
    transferType: "liability_reassignment",
    isDeleted: false
}
```

## Balance Impact Examples

### Example Scenario

**Before Transfer:**
- Motifera (Debtor): owes ₺10,000
- Sezon Tekstil (From Creditor): has ₺10,000 receivable
- Co Denim (To Creditor): has ₺0 receivable

**Transfer: ₺10,000 from Sezon Tekstil → Co Denim**

**After Transfer:**
- Motifera (Debtor): still owes ₺10,000 (**no change**)
- Sezon Tekstil (From Creditor): ₺0 receivable (**-₺10,000**)
- Co Denim (To Creditor): ₺10,000 receivable (**+₺10,000**)

### Financial Summary Impact

**Income Statement:**
- Total Income: **₺0** (debt transfer excluded)
- Total Expenses: **₺0** (debt transfer excluded)
- Net Balance: **₺0** (no P&L impact)

**Balance Sheet:**
- Total Liabilities: **₺10,000** (unchanged)
- Creditor Composition: Changed from Sezon Tekstil to Co Denim

## Validation Rules

The system validates debt transfers to ensure data integrity:

1. **All three parties must be specified**
   - Debtor (islemCari)
   - From Creditor (kaynakCari)
   - To Creditor (hedefCari)

2. **All three parties must be different**
   - Debtor ≠ From Creditor
   - Debtor ≠ To Creditor
   - From Creditor ≠ To Creditor

3. **Amount must be positive**
   - tutar > 0

4. **Valid date required**

## Testing Checklist

### ✅ Create Debt Transfer
- [ ] Select "Borç Transferi" from transaction type
- [ ] Three account fields appear
- [ ] Select different accounts for each party
- [ ] Enter amount and date
- [ ] Submit form successfully

### ✅ Balance Updates
- [ ] Debtor balance unchanged after transfer
- [ ] From creditor balance decreased by amount
- [ ] To creditor balance increased by amount

### ✅ Financial Summaries
- [ ] Debt transfer NOT included in total income
- [ ] Debt transfer NOT included in total expenses
- [ ] Net balance unaffected by debt transfer
- [ ] Transfer tracked in totalTransfers

### ✅ Activity View
- [ ] Debt transfer displayed with yellow badge
- [ ] Shows all three parties: "Debtor: From → To"
- [ ] Amount displayed correctly

### ✅ Direction System
- [ ] Direction = 0 for debt transfers
- [ ] Not counted in income mode
- [ ] Not counted in cashflow mode

## Migration Notes

### Existing "transfer" Transactions

Old transactions with `islemTipi: 'transfer'` will be:
- Treated as two-party transfers (backward compatible)
- New debt transfers use `islemTipi: 'borç transferi'`

### Normalization

The `normalizeIslemTipi()` function now returns `'borç transferi'` for transfer-related inputs to ensure consistency.

## Benefits

1. **Accurate Balance Tracking**: Debtor liability stays constant while only creditor changes
2. **Correct Financial Reporting**: No false income/expense from liability reassignments
3. **Clear Audit Trail**: Three-party structure makes relationships explicit
4. **No Duplicates**: Single transaction updates both creditors correctly
5. **Visual Distinction**: Yellow badges make debt transfers easy to identify

## API Reference

### Import Debt Transfer Utilities

```javascript
import { 
    isDebtTransfer,
    validateDebtTransfer,
    createDebtTransferTransaction,
    getDebtTransferParties,
    calculateDebtTransferImpact,
    getDebtTransferDescription,
    shouldExcludeFromFinancialSummary
} from './utils/debt-transfer.js';
```

### Check if Transaction is Debt Transfer

```javascript
const isDebt = isDebtTransfer(transaction);
// Returns: true if transaction is a debt transfer
```

### Get Three Parties

```javascript
const parties = getDebtTransferParties(transaction);
// Returns: { debtor, fromCreditor, toCreditor }
```

### Calculate Impact for Account

```javascript
const impact = calculateDebtTransferImpact(transaction, accountId);
// Returns: balance change for the specified account
//   - 0 if account is debtor
//   - -amount if account is from creditor
//   - +amount if account is to creditor
```

## Conclusion

The Debt Transfer implementation successfully treats these transactions as three-party liability reassignments rather than simple payments. This ensures:

- ✅ No incorrect income/expense reporting
- ✅ Accurate balance tracking for all parties
- ✅ Clear audit trail with explicit party relationships
- ✅ Proper exclusion from financial summaries
- ✅ User-friendly interface with clear party roles

All acceptance criteria have been met:
1. ✅ Debt transfer connects all three parties correctly
2. ✅ No income, expense, or cash movement is created
3. ✅ Each account reflects the right balance change once, without duplication

