# Internal Bank Accounts - Testing Guide

## Quick Validation Checklist

### 1. Visual Verification (5 minutes)

#### Account List Display
- [ ] Open the Cariler (Accounts) view
- [ ] Look for two distinct sections:
  - **"Banka Hesapları / Kasa"** section at the top (blue background)
  - **"Cariler (Tedarikçi / Müşteri)"** section below
- [ ] Verify "Motifera Hesap" appears in the bank accounts section
- [ ] Verify suppliers/customers appear in the cariler section
- [ ] Check that internal accounts have a "Banka/Kasa" badge

#### Account Detail View
- [ ] Click on "Motifera Hesap"
- [ ] Verify the detail view shows "• Banka/Kasa" in the type field
- [ ] Click on a supplier/customer account
- [ ] Verify no special badge appears

### 2. Financial Calculations (10 minutes)

#### Test Scenario: Internal Transfer

1. **Before**: Note your current financial summary totals
2. **Create**: Transfer 10,000 TL from Motifera to another bank account
   - Transaction Type: "Transfer" or "Ödeme"
   - From: Motifera Hesap (internal)
   - To: Another bank account (internal)
3. **Verify**: 
   - [ ] Financial Summary income/expense totals DO NOT change
   - [ ] Transaction appears in transaction list
   - [ ] Bank balances update correctly

#### Test Scenario: External Payment

1. **Create**: Payment 5,000 TL from Motifera to a supplier
   - Transaction Type: "Ödeme"
   - From: Motifera Hesap (internal)
   - To: Supplier (external)
2. **Verify**:
   - [ ] Financial Summary expense increases by 5,000 TL
   - [ ] Correctly appears as expense
   - [ ] Bank balance decreases

### 3. CSV Export Verification (5 minutes)

#### Accounts Export
- [ ] Click "Export Accounts" button
- [ ] Open CSV file in Excel/Google Sheets
- [ ] Verify "Hesap Türü" (Account Type) column exists
- [ ] Verify Motifera shows as "Banka/Kasa"
- [ ] Verify suppliers show as "Cari"

#### Transactions Export
- [ ] Select an account
- [ ] Click "Export Transactions"
- [ ] Open CSV file
- [ ] Verify account type columns exist:
  - İşlem Cari Türü
  - Kaynak Cari Türü
  - Hedef Cari Türü
- [ ] Verify types are correctly labeled

### 4. Search Functionality (2 minutes)

- [ ] Use search box to search for "Motifera"
- [ ] Verify it appears in results
- [ ] Search for a supplier name
- [ ] Verify correct account appears

### 5. Edge Cases (5 minutes)

#### New Account Creation
- [ ] Create a new account with "Banka" in the type field
- [ ] Verify it appears in "Banka Hesapları" section
- [ ] Create a new account with "Tedarikçi" in the type
- [ ] Verify it appears in "Cariler" section

#### Multiple Bank Accounts
- [ ] Verify all bank accounts group together
- [ ] Verify they maintain separate balances
- [ ] Test transfer between them doesn't affect profit/loss

## Expected Results Summary

### ✅ PASS Criteria

1. **Account Segregation**: Internal and external accounts appear in separate sections
2. **Financial Accuracy**: Internal transfers don't affect income/expense totals
3. **CSV Export**: Account type information included in exports
4. **Visual Clarity**: Badges and styling distinguish account types
5. **Balance Integrity**: All balances calculate correctly

### ❌ FAIL Indicators

1. All accounts mixed together in one section
2. Internal transfers appear as income/expense
3. Missing account type columns in CSV
4. No visual distinction between account types
5. Incorrect balance calculations

## Quick Regression Test (After Updates)

Run these three quick checks after any code changes:

1. **Visual**: Does the account list show two sections?
2. **Calculation**: Does an internal transfer leave income/expense unchanged?
3. **Export**: Does the CSV include account type columns?

If all three pass, the implementation is working correctly.

## Troubleshooting

### Issue: Motifera not appearing as internal
**Solution**: Check account name matches patterns in `account-type.js`
- Pattern includes: "motifera", "motfera", "mutufera"
- Case-insensitive matching

### Issue: Financial totals still include internal transfers
**Solution**: Ensure `getAccount` function is passed to `calculateFinancialSummary`
- Check `financial-summary.view.js`
- Verify `mode: 'income'` is set

### Issue: Accounts not separated in UI
**Solution**: Check imports in `home.view.js`
- Verify `account-type.js` utilities imported
- Check `renderAccountList` function implementation

## Performance Check

The implementation should have minimal performance impact:
- Page load: No noticeable difference
- Account list rendering: < 100ms for 100 accounts
- Financial calculations: < 50ms for 1000 transactions
- CSV export: Same speed as before

## Support

If you encounter any issues:

1. Check browser console for errors
2. Verify all files were updated correctly
3. Review `INTERNAL-BANK-ACCOUNTS-IMPLEMENTATION.md` for details
4. Check that no linter errors exist

## Success Confirmation

Once you can answer "YES" to all these questions, the implementation is successful:

1. ✅ Can you see Motifera in the "Banka Hesapları" section?
2. ✅ Do internal transfers NOT affect your profit/loss numbers?
3. ✅ Can you export account types in CSV?
4. ✅ Is there clear visual distinction between bank accounts and suppliers?
5. ✅ Do all account balances calculate correctly?

**If all YES**: Implementation successful! 🎉

**If any NO**: Review the troubleshooting section above.

