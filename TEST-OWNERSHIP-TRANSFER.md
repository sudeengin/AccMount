# Test: Debt Transfer Ownership Validation

## Setup

### Accounts
1. **Motifera** (Debtor/Company)
2. **Deneme** (New Creditor) - Balance: ₺0
3. **deneme2** (Old Creditor) - Balance: ₺200

## Test Case 1: Full Settlement ✅

**Action:** Transfer ₺200 from deneme2 to Deneme

**Input:**
- Debtor: Motifera
- New Creditor: Deneme
- Old Creditor: deneme2
- Amount: ₺200

**Expected Confirmation:**
```
✅ Deneme (New Creditor)
   Current: ₺0,00
   Change: +₺200,00
   New: ₺200,00
   → Loan given

❌ deneme2 (Old Creditor)
   Current: ₺200,00
   Change: -₺200,00
   New: ₺0,00
   → Receivable fully settled

⚪ Motifera (Debtor)
   Debt change: ₺0,00
   → Total debt same, creditor changed
```

**After Confirmation:**
- ✅ Deneme: ₺200
- ✅ deneme2: ₺0 (fully settled)
- ✅ Motifera: Total debt unchanged

## Test Case 2: Partial Settlement ✅

**Setup:** deneme2 has ₺500 balance

**Action:** Transfer ₺200 from deneme2 to Deneme

**Expected Result:**
- ✅ Deneme: +₺200 → ₺200
- ✅ deneme2: ₺500 - ₺200 = ₺300
- ✅ Confirmation shows "Receivable reduced" (not "fully settled")

## Test Case 3: Insufficient Receivable ❌

**Setup:** deneme2 has ₺100 balance

**Action:** Transfer ₺200 from deneme2 to Deneme

**Expected Result:**
```
❌ ERROR:
deneme2 doesn't have sufficient receivable.
Current receivable: ₺100,00
Transfer amount: ₺200,00
Deficit: ₺100,00

Debt transfer requires old creditor to have 
receivable equal to or greater than transfer amount.
```

**Transaction:** BLOCKED - not created

## Test Case 4: Zero Balance Old Creditor ❌

**Setup:** deneme2 has ₺0 balance

**Action:** Transfer ₺200 from deneme2 to Deneme

**Expected Result:**
```
❌ ERROR:
deneme2 doesn't have sufficient receivable.
Current receivable: ₺0,00
Transfer amount: ₺200,00
Deficit: ₺200,00
```

**Transaction:** BLOCKED

## Test Case 5: Negative Balance Prevention ✅

**This is the key fix!**

**Old behavior (bug):**
- deneme2: ₺0
- Transfer: ₺200
- Result: deneme2 = -₺200 ❌

**New behavior (correct):**
- deneme2: ₺0
- Transfer: ₺200
- Result: BLOCKED with error ✅

## Verification Steps

### After Each Valid Transfer:

1. **Check balances:**
   ```
   Deneme = oldBalance + transferAmount
   deneme2 = oldBalance - transferAmount
   Motifera total debt = unchanged
   ```

2. **Recalculate system totals:**
   ```
   Run backfill analysis
   Verify no discrepancies
   ```

3. **Check no negative balances:**
   ```
   SELECT * FROM accounts WHERE balance < 0
   Result: Empty (no negative balances)
   ```

4. **Verify idempotent:**
   ```
   Recalculate all balances from transaction history
   Compare to current balances
   Result: Identical
   ```

## Edge Cases

### Edge Case 1: Exact Match
- Old creditor: ₺200
- Transfer: ₺200
- Result: ₺0 (fully settled) ✅

### Edge Case 2: Small Difference
- Old creditor: ₺200.01
- Transfer: ₺200.00
- Result: ₺0.01 remaining ✅

### Edge Case 3: Floating Point
- Old creditor: ₺199.99
- Transfer: ₺200.00
- Result: BLOCKED (insufficient) ✅

## Success Criteria

✅ Old creditor never goes negative
✅ Validation blocks insufficient transfers
✅ Confirmation shows before/after accurately
✅ "Fully settled" vs "reduced" shown correctly
✅ System remains idempotent after transfers
✅ No negative balances in database
✅ Recalculation produces same results

## Status: READY FOR TESTING

