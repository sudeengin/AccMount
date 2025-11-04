# Test Plan: Debt Transfer Sign Mapping

## Test Scenario

### Setup Accounts
1. **Motifera** (Debtor - Company account)
2. **Deneme** (New Creditor - Personnel account)
3. **Deneme 2** (Old Creditor - Supplier account)

### Test Case 1: Create Debt Transfer

**Action**: Create a debt transfer transaction
- **Debtor**: Motifera
- **New Creditor (Lender)**: Deneme
- **Old Creditor (Paid Off)**: Deneme 2
- **Amount**: ₺200.00
- **Date**: Today
- **Description**: "Test debt transfer sign mapping"

### Expected Results

#### Account Balances (After Transaction)

| Account | Initial | Change | Final | Status |
|---------|---------|--------|-------|--------|
| **Deneme** | X | **+₺200** | X + 200 | ✅ Receivable increased |
| **Deneme 2** | Y | **-₺200** | Y - 200 | ✅ Receivable decreased |
| **Motifera** | Z | **0** | Z | ✅ Total debt unchanged |

#### Transaction Display

**In Deneme's account view:**
- Label: "Borç Verildi" (Loan Given)
- Amount: +₺200 (green/positive)
- Description: Shows relationship with Motifera and Deneme 2

**In Deneme 2's account view:**
- Label: "Alacak Tahsil Edildi" (Receivable Collected)
- Amount: -₺200 (red/negative)
- Description: Shows receivable was settled

**In Motifera's account view:**
- Label: "Borç Alındı ve Ödendi" (Borrowed and Paid)
- Amount: ±₺0 (neutral/gray)
- Description: Shows borrowed from Deneme to pay Deneme 2

### Test Case 2: Verify Financial Summary

**Action**: Check Financial Summary view

**Expected:**
- ✅ Debt transfer does NOT appear in income
- ✅ Debt transfer does NOT appear in expenses
- ✅ Net P&L is unchanged
- ✅ Total income/expense counts unchanged
- ✅ Transaction appears in "Liability Transfers" section (if displayed)

### Test Case 3: CSV Export

**Action**: Export transactions to CSV

**Expected:**
- ✅ Transaction type: "borç transferi"
- ✅ Category: "Liability Transfer"
- ✅ Display Label: Correct role-based label
- ✅ All three parties shown correctly:
  - islemCari = Motifera
  - kaynakCari = Deneme
  - hedefCari = Deneme 2

### Test Case 4: Delete Debt Transfer

**Action**: Delete the debt transfer transaction

**Expected:**
- ✅ Deneme balance: -₺200 (reverses the increase)
- ✅ Deneme 2 balance: +₺200 (reverses the decrease)
- ✅ Motifera balance: unchanged (still 0 impact)

### Test Case 5: Multiple Debt Transfers

**Action**: Create two consecutive debt transfers

**Transaction 1:**
- Motifera borrows ₺200 from Deneme to pay Deneme 2

**Transaction 2:**
- Motifera borrows ₺150 from Deneme 3 to pay Deneme

**Expected Cumulative Results:**
- Deneme: +₺200 - ₺150 = **+₺50** ✅
- Deneme 2: **-₺200** ✅
- Deneme 3: **+₺150** ✅
- Motifera: **0** (net zero impact) ✅

## Verification Checklist

### Functional Tests
- [ ] Create debt transfer transaction
- [ ] Verify Deneme balance increased by ₺200
- [ ] Verify Deneme 2 balance decreased by ₺200
- [ ] Verify Motifera balance unchanged
- [ ] Check account detail views show correct signs
- [ ] Verify transaction descriptions are correct
- [ ] Check role-based labels (Borç Verildi, Alacak Tahsil Edildi)

### Financial Integrity
- [ ] P&L totals unaffected by debt transfer
- [ ] Financial Summary excludes debt transfer from income/expense
- [ ] CSV export shows correct category "Liability Transfer"
- [ ] CSV export shows all three parties correctly

### Edge Cases
- [ ] Delete debt transfer and verify balance reversal
- [ ] Create multiple debt transfers and verify cumulative balances
- [ ] Export to CSV and verify balance consistency
- [ ] Test with different account types (personnel, supplier, etc.)

### System Consistency
- [ ] No console errors
- [ ] Transaction log shows correct information
- [ ] Account search/filter works correctly
- [ ] Dark mode displays correctly
- [ ] Mobile view displays correctly (if applicable)

## Known Correct Behavior

### What Should NOT Happen
- ❌ Debt transfers appearing as income or expense
- ❌ Wrong sign on creditor balances
- ❌ Debtor balance changing
- ❌ P&L totals affected by debt transfers
- ❌ Cashflow showing money movement for debt transfers

### What SHOULD Happen
- ✅ New creditor balance increases (gained receivable)
- ✅ Old creditor balance decreases (lost receivable)
- ✅ Debtor balance unchanged (liability same, just different party)
- ✅ P&L totals unchanged (not a revenue/expense event)
- ✅ Categorized as "Liability Transfer" in exports

## Technical Notes

### Key Functions Fixed
1. `calculateDebtTransferImpact()` - `/src/utils/debt-transfer.js`
2. `calculateAccountBalance()` - `/src/utils/account-reset.js`

### Transaction Structure
```javascript
{
    islemTipi: 'borç transferi',
    islemCari: 'motifera-id',      // Debtor (0 impact)
    kaynakCari: 'deneme-id',        // Lender (+amount)
    hedefCari: 'deneme2-id',        // Settled (-amount)
    toplamTutar: 200,
    direction: 0,                   // Neutral for P&L
    isDebtTransfer: true
}
```

### Balance Calculation Logic
```javascript
// For each account:
if (accountId === debtor) return 0;
if (accountId === lender) return +amount;
if (accountId === creditorPaidOff) return -amount;
```

---

**Test Status**: Ready for execution  
**Prerequisites**: Accounts created (Motifera, Deneme, Deneme 2)  
**Expected Duration**: 15-20 minutes  
**Pass Criteria**: All balances match expected results, no P&L impact

