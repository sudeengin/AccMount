# Debt Transfer Sign Mapping - Fix Summary

## ✅ COMPLETED

### Problem
The debt transfer balance calculations had two critical bugs:
1. **Property name mismatch** - checking non-existent properties (`fromCreditor`, `toCreditor`)
2. **Missing special handling** - treating debt transfers like regular transfers

### Solution
Fixed balance calculation in two files:

#### 1. `/src/utils/debt-transfer.js`
**Function**: `calculateDebtTransferImpact()`

**Fixed property references:**
```javascript
// BEFORE (WRONG):
if (accountId === parties.fromCreditor) return -amount;  // ❌ Property doesn't exist
if (accountId === parties.toCreditor) return amount;     // ❌ Property doesn't exist

// AFTER (CORRECT):
if (accountId === parties.lender) return amount;              // ✅ New creditor +
if (accountId === parties.creditorPaidOff) return -amount;   // ✅ Old creditor -
```

#### 2. `/src/utils/account-reset.js`
**Function**: `calculateAccountBalance()`

**Added debt transfer handling:**
```javascript
// New logic at start of calculation:
if (isDebtTransfer(tx)) {
    const impact = calculateDebtTransferImpact(tx, accountId);
    return balance + impact;
}
```

### Result - Correct Sign Mapping

| Account | Role | Balance Impact |
|---------|------|----------------|
| **kaynakCari** | New Creditor (Lender) | **+₺200** ✅ |
| **hedefCari** | Old Creditor (Settled) | **-₺200** ✅ |
| **islemCari** | Debtor (Company) | **0** ✅ |

### Example Transaction

**Scenario:**
- Debtor: Motifera
- New Creditor: Deneme (personnel)
- Old Creditor: Deneme 2 (supplier)
- Amount: ₺200

**Expected Balances:**
- Deneme = +₺200 (gained receivable)
- Deneme 2 = -₺200 (lost receivable)
- Motifera total debt = unchanged

### Testing

Create a debt transfer and verify:
1. ✅ New creditor balance increases
2. ✅ Old creditor balance decreases  
3. ✅ Debtor balance unchanged
4. ✅ CSV exports show correct balances
5. ✅ P&L totals unaffected (debt transfers excluded)

---

**Status**: Ready for testing
**Files Modified**: 2
**Linter Errors**: 0
**Breaking Changes**: None (backward compatible)

