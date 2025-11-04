# Internal Bank Accounts Implementation

## Overview

This implementation redefines "Motifera Hesap" and similar accounts as **internal bank accounts** (cashflow anchors), separate from customer/vendor accounts (external cariler). This separation fixes inconsistencies in income and expense reporting.

## Implementation Date

November 4, 2025

## Problem Statement

Previously, all accounts (including bank accounts like "Motifera Hesap") were treated uniformly in financial calculations. This caused:

1. **Income/Expense Distortion**: Transfers between internal bank accounts were incorrectly counted as revenue or expenses
2. **Misleading Reports**: Financial summaries showed inflated income/expense figures
3. **Poor Account Organization**: Bank accounts were mixed with suppliers/customers in the UI
4. **Unclear Account Purpose**: No distinction between operational accounts (banks) and transactional accounts (suppliers/customers)

## Solution Architecture

### 1. Account Type Classification System

**New Utility**: `src/utils/account-type.js`

Provides automatic detection and classification of accounts into two types:

- **Internal Accounts** (`"internal"`): Bank accounts, cash accounts, company accounts
- **External Accounts** (`"external"`): Suppliers, customers, staff, vendors

#### Key Features:

- **Pattern-based Detection**: Automatically identifies bank accounts using keywords
  - Turkish: motifera, mutufera, banka, kasa, nakit, hesap
  - Bank names: ziraat, vakıfbank, garanti, akbank, etc.
  - Account types: vadesiz, checking, tasarruf, savings, etc.

- **Explicit Type Support**: Honors `accountType` field if set in account data

- **Conservative Defaults**: Defaults to external type when uncertain (safer approach)

### 2. Financial Calculation Updates

**Modified**: `src/utils/financial-summary.js`

#### Income Mode (Default - Profit/Loss Focus)

```javascript
// Excludes internal account transactions from revenue/expense
calculateFinancialSummary(transactions, {
    mode: 'income',
    getAccount: getAccountFunction
})
```

**Behavior**:
- ✅ Counts: Revenue from customers, Expenses to suppliers
- ❌ Excludes: Internal bank transfers (no revenue/expense impact)
- 🎯 Purpose: Accurate profit/loss reporting

#### Cashflow Mode (Cash Position Focus)

```javascript
// Includes ALL transactions including internal transfers
calculateFinancialSummary(transactions, {
    mode: 'cashflow',
    getAccount: getAccountFunction
})
```

**Behavior**:
- ✅ Counts: ALL cash movements
- ✅ Includes: Internal bank transfers
- 🎯 Purpose: Bank account reconciliation and cash position tracking

### 3. User Interface Updates

**Modified**: `src/ui/views/home.view.js`

#### Account List Segregation

The main account list now displays two distinct sections:

1. **Banka Hesapları / Kasa** (Bank Accounts / Cash)
   - Distinguished styling: Blue background with border
   - Badge indicator: "Banka/Kasa" label
   - Icon: Credit card/bank icon
   - **Includes**: Motifera Hesap and other bank accounts

2. **Cariler (Tedarikçi / Müşteri)** (Suppliers / Customers)
   - Standard styling: Gray background
   - No special badges
   - Icon: People/users icon
   - **Includes**: All external parties

#### Detail View Enhancement

Account detail pages now show:
- Account type badge (Banka/Kasa) for internal accounts
- Account type label in the subtitle area

### 4. CSV Export Enhancement

**Modified**: `src/utils/csv-export.js`

#### Accounts Export

New column added:
- **Hesap Türü** (Account Type): Shows "Banka/Kasa" or "Cari"

#### Transactions Export

New columns added:
- **İşlem Cari Türü** (Transaction Account Type)
- **Kaynak Cari Türü** (Source Account Type)
- **Hedef Cari Türü** (Target Account Type)

This allows filtering and analysis in spreadsheet applications.

### 5. Financial Summary View Integration

**Modified**: `src/ui/views/financial-summary.view.js`

- Automatically uses `income` mode to exclude internal transfers
- Passes `getAccount` function for internal account detection
- Revenue/Expense figures now reflect true profit/loss

## Account Type Detection Logic

### Internal Account Patterns

An account is classified as **internal** if:

1. Account name (`unvan`) contains:
   - motifera, motfera, mutufera
   - banka, bank
   - kasa, cash, nakit
   - hesap, account
   - şirket hesabı, işletme hesabı
   - Bank names: ziraat, vakıfbank, garanti, akbank, etc.
   - Account types: vadesiz, checking, tasarruf, savings, etc.

2. Account type (`tipi`) contains any internal pattern

3. Explicit `accountType: "internal"` field is set

### External Account Patterns

An account is classified as **external** if:

1. Account type (`tipi`) contains:
   - tedarikçi, supplier
   - müşteri, customer, client
   - personel, staff, çalışan, employee
   - vendor

2. Explicit `accountType: "external"` field is set

3. None of the internal patterns match (default)

## Example Scenarios

### Before Implementation

**Scenario**: Transfer 10,000 TL from Motifera Bank to Another Bank Account

- ❌ Counted as: 10,000 TL expense
- ❌ Financial Summary: Shows -10,000 TL net (incorrect)
- ❌ Problem: Internal transfer inflates expenses

### After Implementation

**Scenario**: Same transfer

- ✅ **Income Mode**: Excluded from calculations (no revenue/expense impact)
- ✅ **Cashflow Mode**: Tracked for bank reconciliation
- ✅ Financial Summary: Accurate profit/loss
- ✅ Result: True business performance visible

## Files Modified

### New Files

1. `/src/utils/account-type.js` - Account type detection and classification system

### Modified Files

1. `/src/utils/financial-summary.js`
   - Added internal account filtering logic
   - Imports `transactionInvolvesInternalAccount` from account-type.js
   - Updated `calculateFinancialSummary` to accept `getAccount` function
   - Conditional logic for income vs cashflow modes

2. `/src/utils/csv-export.js`
   - Imports account type utilities
   - Enriches accounts with type information
   - Adds accountType columns to exports
   - Updated function signatures to accept `getAccount` parameter

3. `/src/ui/views/home.view.js`
   - Imports account type utilities
   - Segregates account list into internal/external sections
   - Creates styled account list items with badges
   - Updates detail header to show account type
   - Passes `findAccount` to CSV export

4. `/src/ui/views/financial-summary.view.js`
   - Adds `getAccount` function
   - Passes getAccount to calculateFinancialSummary
   - Explicitly uses 'income' mode for accurate reporting

## API Changes

### calculateFinancialSummary()

**Before**:
```javascript
calculateFinancialSummary(transactions, {
    startDate: Date,
    endDate: Date,
    mode: 'income' | 'cashflow'
})
```

**After**:
```javascript
calculateFinancialSummary(transactions, {
    startDate: Date,
    endDate: Date,
    mode: 'income' | 'cashflow',
    getAccount: Function  // NEW: Required for internal account detection
})
```

### exportTransactionsToCSV()

**Before**:
```javascript
exportTransactionsToCSV(transactions, getAccountName, filename)
```

**After**:
```javascript
exportTransactionsToCSV(transactions, getAccountName, filename, getAccount)
```

## Testing Recommendations

### 1. Account Classification Testing

- ✅ Verify "Motifera Hesap" is detected as internal
- ✅ Verify bank accounts appear in "Banka Hesapları" section
- ✅ Verify suppliers/customers appear in "Cariler" section
- ✅ Test search functionality across both sections

### 2. Financial Calculation Testing

- ✅ Create internal transfer (bank to bank)
- ✅ Verify it doesn't affect income/expense totals in income mode
- ✅ Verify it's tracked in cashflow mode
- ✅ Compare financial summary before/after

### 3. CSV Export Testing

- ✅ Export accounts, verify "Hesap Türü" column
- ✅ Verify Motifera shows as "Banka/Kasa"
- ✅ Export transactions, verify account type columns
- ✅ Filter by account type in spreadsheet

### 4. UI Visual Testing

- ✅ Check account list styling (blue for internal, gray for external)
- ✅ Verify badges appear on internal accounts
- ✅ Check detail view shows account type
- ✅ Test dark mode appearance

## Migration Notes

### No Database Changes Required

This implementation works with existing data structure. No migration needed.

### Automatic Detection

Accounts are automatically classified based on their name and type fields. The system uses intelligent pattern matching.

### Future Enhancement Option

For explicit control, accounts can optionally include an `accountType` field:

```javascript
{
    id: "abc123",
    unvan: "Custom Bank",
    tipi: "Banka",
    accountType: "internal"  // Optional explicit type
}
```

## Acceptance Criteria Status

✅ **Motifera transactions no longer distort income/expense totals**
- Internal account detection implemented
- Financial calculations updated to exclude internal transfers

✅ **Cashflow report reflects true bank activity**
- Cashflow mode includes all transactions
- Income mode excludes internal transfers

✅ **Cariler list only shows external parties**
- UI segregates internal and external accounts
- Clear visual distinction with sections and badges

✅ **UI clearly separates "Bank Accounts" from other accounts**
- Dedicated "Banka Hesapları / Kasa" section
- Distinct styling and badges
- Separate "Cariler" section

✅ **Net balance equals actual cash position**
- Income mode shows true profit/loss
- Cashflow mode shows true bank position
- Internal transfers don't inflate figures

## Support and Maintenance

### Adding New Internal Account Patterns

To add new patterns for automatic detection, edit `src/utils/account-type.js`:

```javascript
const INTERNAL_ACCOUNT_PATTERNS = [
    // Add new patterns here
    'new_bank_name',
    'new_pattern'
];
```

### Debugging Account Classification

Use the utility functions to check account type:

```javascript
import { getAccountType, isInternalAccount } from './utils/account-type.js';

const account = { unvan: "Motifera Hesap", tipi: "Banka" };
console.log(getAccountType(account));  // "internal"
console.log(isInternalAccount(account));  // true
```

## Performance Considerations

- Pattern matching is performed in-memory (very fast)
- No additional database queries required
- Account type is calculated on-the-fly during rendering
- Minimal performance impact

## Future Enhancements

### Potential Improvements

1. **Admin UI for Account Type Override**: Add UI to manually set account type
2. **Custom Pattern Configuration**: Allow users to define their own patterns
3. **Account Type Statistics**: Dashboard widget showing internal vs external breakdown
4. **Multi-currency Internal Accounts**: Extend to support multiple bank accounts in different currencies
5. **Bank Reconciliation View**: Dedicated view for matching bank statements with internal accounts

## Conclusion

This implementation successfully separates internal bank accounts from external cariler, providing:

- ✅ Accurate financial reporting (true profit/loss)
- ✅ Clear UI organization (banks separate from suppliers/customers)
- ✅ Better data export (account type information included)
- ✅ Flexible cashflow tracking (mode-based calculations)

The system automatically detects "Motifera Hesap" and similar accounts as internal, ensuring financial reports reflect true business performance without manual intervention.

