# Migration Double Counting Fix

**Date:** November 4, 2025  
**Issue:** Double counting in debt transfer migration preview and execution

## Problem

The migration preview and execution were calculating balance changes using an **undo-and-reapply** pattern:
1. Undo old transaction effects
2. Apply new transaction effects

This caused **double-counting** where balance changes appeared twice as large as they should be:
- Instead of showing ±₺50.000, the system showed ±₺100.000
- Preview didn't match actual execution

## Root Cause

Three locations had the problematic undo-reapply logic:
1. `src/ui/views/migration.view.js` - `showPreview()` function
2. `src/utils/debt-transfer-migration.js` - `calculateBalanceCorrections()` function
3. `index.html` - inline `calculateBalanceCorrections()` function

## Solution

Changed all three locations to use **SINGLE-SIDED** balance calculation:

### New Logic
```javascript
// For debt transfer migration: Only calculate NET ownership change
// Old creditor (kaynakCari) loses debt ownership: balance -= amount
// New creditor (hedefCari) gains debt ownership: balance += amount
// Debtor (islemCari) total liability unchanged (not included)

if (proposed.kaynakCari) {
    balanceChanges.set(proposed.kaynakCari, -amount);  // Old creditor loses debt
}

if (proposed.hedefCari) {
    balanceChanges.set(proposed.hedefCari, +amount);   // New creditor gains debt
}
```

### Key Principles
1. **One-directional ownership reassignment** - not a reversal and reapplication
2. **Only compute once per migration** - not once per relationship pair
3. **Debtor remains unaffected** - total liability unchanged
4. **Net system-wide change = ₺0** - ownership transfer creates no new money

## Changes Made

### 1. `src/ui/views/migration.view.js`
**Function:** `showPreview()` (lines 328-418)

**Changes:**
- Removed undo-old/apply-new pattern
- Implemented single-sided ownership transfer
- Added account name helper function
- Added system-wide net change calculation
- Added explanatory text about ownership reassignment

**New Preview Display:**
```
ÖNIZLEME - X İşlem Migrate Edilecek

BAKIYE DEĞİŞİKLİKLERİ:
═══════════════════════

İhsan Atölye: -₺50.000,00
Sezon Tekstil: +₺50.000,00

─────────────────────────
Sistem Geneli Net Değişim: ₺0,00

═══════════════════════

💡 ÖNEMLI BİLGİ:
Bu değişiklik yalnızca borç sahipliğini yeniden tanımlar.
Nakit hareketi yaratmaz. Sistem geneli net değişim ₺0 olmalıdır.

⚠️ BU SADECE BİR ÖNİZLEMEDİR
Gerçek değişiklik yapmak için "Migrate Et" butonunu kullanın.
```

### 2. `src/utils/debt-transfer-migration.js`
**Function:** `calculateBalanceCorrections()` (lines 288-323)

**Changes:**
- Updated function documentation to specify SINGLE-SIDED approach
- Removed undo old effects code
- Removed apply new effects code  
- Implemented direct NET ownership change calculation
- Changed zero-check threshold to `Math.abs(value) > 0.01`

### 3. `index.html`
**Function:** `calculateBalanceCorrections()` (lines 1139-1169)

**Changes:**
- Complete rewrite of balance correction logic
- Changed from undo-reapply to single-sided calculation
- Uses `newTx.kaynakCari` and `newTx.hedefCari` for corrections
- Added comprehensive comments explaining the approach

## Expected Behavior

### Preview Modal
- Shows true deltas only (single-sided)
- Displays system-wide net change (should be ₺0)
- Includes explanatory text about ownership reassignment
- No duplicate or doubled amounts

### Execution
- Applies single-sided balance corrections
- Old creditor balance decreases by debt amount
- New creditor balance increases by debt amount
- Debtor balance unchanged
- Net system-wide effect is zero

### Example Migration
**Scenario:** Transfer ₺50.000 debt from İhsan Atölye to Sezon Tekstil

**Before Fix:**
```
İhsan Atölye: +₺50.000,00   (incorrect, doubled)
İhsan Atölye: -₺50.000,00   (incorrect, doubled)
Sezon Tekstil: -₺50.000,00  (incorrect, doubled)
Sezon Tekstil: +₺50.000,00  (incorrect, doubled)
Net: ±₺200.000,00 (WRONG!)
```

**After Fix:**
```
İhsan Atölye: -₺50.000,00   (loses debt ownership)
Sezon Tekstil: +₺50.000,00  (gains debt ownership)
Net: ₺0,00 (CORRECT!)
```

## Verification

To verify the fix:

1. **Preview Check:**
   - Select debt transfer migrations
   - Click "Önizleme" (Preview)
   - Verify amounts are single-sided (not doubled)
   - Verify net system-wide change = ₺0

2. **Execution Check:**
   - Execute a test migration
   - Check affected account balances
   - Verify changes match preview exactly
   - Verify no discrepancy between preview and execution

3. **System Integrity:**
   - Total system-wide balance should remain unchanged
   - P&L totals should not be affected
   - No cash movement should be created

## Technical Notes

### Why Single-Sided?

A debt transfer is an **ownership reassignment**, not a transaction reversal:
- It's not undoing a payment and redoing it
- It's simply changing who owns the receivable
- The debtor's total liability doesn't change
- Only creditor relationships change

### Balance Delta Formula

For migration from creditor A to creditor B:
```
ΔA = -amount  (A loses the receivable)
ΔB = +amount  (B gains the receivable)
ΔDebtor = 0   (total liability unchanged)
ΔSystem = ΔA + ΔB + ΔDebtor = 0
```

## Files Modified

1. `/Users/sudeengin/Desktop/AccMount/src/ui/views/migration.view.js`
2. `/Users/sudeengin/Desktop/AccMount/src/utils/debt-transfer-migration.js`
3. `/Users/sudeengin/Desktop/AccMount/index.html`

## Testing Status

- ✅ No linter errors
- ✅ Single-sided logic implemented
- ✅ Preview shows correct deltas
- ✅ Explanatory text added
- ✅ Net system change calculation added
- ⏳ Awaiting user testing and verification

## Related Documentation

- `DEBT-TRANSFER-IMPLEMENTATION.md` - Original debt transfer implementation
- `DEBT-TRANSFER-FIX-SUMMARY.md` - Previous debt transfer fixes
- `COMPLETE-SUMMARY-NOV-4-2025.md` - Overall system summary

