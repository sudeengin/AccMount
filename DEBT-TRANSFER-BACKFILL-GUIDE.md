# Debt Transfer Balance Backfill Guide

**Purpose**: Fix historical account balances that were calculated with incorrect debt transfer sign logic.

## Overview

After fixing the debt transfer sign mapping bug, existing account balances in the database may be incorrect. This tool recalculates all balances from transaction history using the corrected logic.

## What This Tool Does

### The Problem
Before the sign fix, debt transfers were applying balance changes incorrectly:
- **New Creditor (Lender)**: Balance was decreasing (❌ WRONG)
- **Old Creditor (Settled)**: Balance was increasing (❌ WRONG)

### The Solution
This backfill utility:
1. **Recalculates** all account balances from transaction history
2. **Uses** the corrected `calculateAccountBalance()` function
3. **Updates** `bakiye` field for accounts with discrepancies
4. **Is idempotent** - safe to run multiple times
5. **Leaves no traces** - no logs or duplicate transactions

## How to Use

### Step 1: Add Navigation (One-Time Setup)

Add a backfill button to the admin navigation in `index.html`:

```html
<!-- Add after the Migration button -->
<button id="navBackfillBtn" class="px-4 py-2 rounded-lg bg-gray-800 text-gray-200 font-medium hover:bg-gray-700 transition">
    🔧 Admin: Balance Fix
</button>
```

### Step 2: Import the View

In the `<script type="module">` section of `index.html`, add:

```javascript
import { renderBackfillView } from "./src/ui/views/debt-transfer-backfill.view.js";
```

### Step 3: Add View Container

Add a container div in the HTML:

```html
<!-- Add after migration view -->
<div id="backfillView" class="hidden"></div>
```

### Step 4: Wire Up Navigation

Add button reference and handler:

```javascript
const navBackfillBtn = document.getElementById('navBackfillBtn');

// Add to legacySetActiveNav array:
[navDashboardBtn, navCarilerBtn, navNotebookBtn, navMigrationBtn, navBackfillBtn].forEach(btn => {
    // ...existing code
});

// Add showBackfill function:
function showBackfill() {
    legacySetActiveNav(navBackfillBtn);
    // Hide all other views
    if (dashboardView) dashboardView.classList.add('hidden');
    if (mainView) mainView.classList.add('hidden');
    if (detailView) detailView.classList.add('hidden');
    // ... hide other views
    
    const backfillView = document.getElementById('backfillView');
    if (backfillView) {
        backfillView.classList.remove('hidden');
        renderBackfillView(backfillView);
    }
}

// Add button listener:
if (navBackfillBtn) {
    navBackfillBtn.addEventListener('click', () => {
        showBackfill();
    });
}
```

### Step 5: Run the Tool

1. **Navigate** to Admin: Balance Fix
2. **Click "Analyze Balances"** to see what needs correction
3. **Review** the analysis results:
   - How many accounts affected
   - Current vs. correct balances
   - Maximum difference
4. **Click "Apply Corrections"** to fix all balances
5. **Verify** completion status

## Features

### 🔍 Analysis (Dry Run)
- **Safe preview** - shows what will change without making changes
- **Detailed breakdown** - lists each account with differences
- **Statistics** - total accounts, debt transfers, max difference
- **Export report** - download full analysis as text file

### ✅ Apply Corrections
- **Batch updates** - processes accounts in batches of 500
- **Progress indicator** - shows real-time progress
- **Atomic operations** - uses Firestore batch writes
- **Automatic verification** - checks results after completion

### 🔄 Idempotent Design
- **Safe to re-run** - calculates from transaction history each time
- **No duplicates** - updates existing balances, doesn't create new records
- **Automatic detection** - only updates accounts with discrepancies

## Technical Details

### Files Created

1. **`/src/utils/debt-transfer-backfill.js`**
   - Core backfill logic
   - Balance recalculation
   - Analysis and reporting

2. **`/src/ui/views/debt-transfer-backfill.view.js`**
   - Admin UI interface
   - Progress tracking
   - Results display

### Key Functions

#### analyzeBalanceCorrections(accounts, transactions)
Analyzes which accounts need correction:
```javascript
const corrections = analyzeBalanceCorrections(accounts, transactions);
// Returns: [{ accountId, accountName, currentBalance, calculatedBalance, difference }]
```

#### applyBalanceCorrections(accounts, transactions, onProgress)
Applies corrections to database:
```javascript
const result = await applyBalanceCorrections(accounts, transactions, (current, total) => {
    console.log(`Progress: ${current}/${total}`);
});
// Returns: { success, correctedCount, skippedCount, corrections, message }
```

#### verifyCorrections(accounts, transactions)
Verifies corrections were applied:
```javascript
const verification = verifyCorrections(accounts, transactions);
// Returns: { success, remainingIssues, issues, message }
```

### Database Updates

The tool updates the following fields on affected accounts:
```javascript
{
    bakiye: calculatedBalance,              // Corrected balance
    lastBalanceCorrection: serverTimestamp(),
    correctedBy: currentUserId,
    correctionReason: 'Debt transfer balance backfill',
    previousBalance: currentBalance
}
```

## Safety Measures

### ✅ No Transaction Modification
- **Never touches** transaction records
- **Only updates** account `bakiye` fields
- **Preserves** transaction history intact

### ✅ Audit Trail
- **Timestamps** when correction was applied
- **Records** who applied the correction
- **Stores** previous balance for reference
- **Logs** correction reason

### ✅ Validation
- **Pre-check** - analyzes before making changes
- **Post-check** - verifies corrections after applying
- **Error handling** - rolls back on failure (batch writes)

## Usage Scenarios

### Scenario 1: First-Time Fix
1. Code fix deployed
2. Run analysis → finds 10 accounts with discrepancies
3. Apply corrections → all balances fixed
4. Re-run analysis → no corrections needed ✓

### Scenario 2: Periodic Check
1. User reports wrong balance
2. Run analysis → finds 2 accounts off
3. Investigate cause (manual transactions?)
4. Apply corrections → balances restored
5. Verify → all correct ✓

### Scenario 3: Post-Import
1. Import old data from CSV
2. Run analysis → finds many discrepancies
3. Apply corrections → recalculates all from history
4. Export CSV → verify balances match ✓

## Troubleshooting

### "No corrections needed"
✅ **Good!** All balances are already accurate.

### "X accounts need correction"
ℹ️ **Normal** after sign fix deployment. Run apply corrections.

### "Corrections applied with warnings"
⚠️ **Check** remaining issues. May need manual review.

### "Batch N failed"
❌ **Error** during batch write. Check:
- Firebase permissions
- Network connectivity
- Firestore quota limits

## Expected Results

### Before Correction
```
Deneme (Lender):     ₺300  (should be ₺500)  ❌
Deneme 2 (Settled):  ₺700  (should be ₺500)  ❌
```

### After Correction
```
Deneme (Lender):     ₺500  ✅
Deneme 2 (Settled):  ₺500  ✅
```

### P&L and Cashflow
- ✅ **Unchanged** - only balance recalculation, no transaction changes
- ✅ **Consistent** - all financial summaries remain accurate

## Best Practices

### 1. Run Analysis First
Always preview before applying. Review the report to understand what will change.

### 2. Export Report
Download the analysis report for your records before applying corrections.

### 3. Backup First (Optional)
While the tool is safe, you may want to export a CSV backup of accounts before running.

### 4. Verify After
After applying, re-run analysis to confirm no remaining discrepancies.

### 5. One-Time Use
This tool is meant for one-time correction after the sign fix. Not needed for ongoing operations.

## Support

### Logs
Check browser console for detailed logs:
```javascript
[Backfill] Loaded N accounts and M transactions
[Backfill] Analysis complete: { corrections: [...] }
[Backfill] Corrections applied: { correctedCount: N }
```

### Error Messages
- **"User must be authenticated"** - Login required
- **"Failed to load data"** - Firebase connection issue
- **"Batch N failed"** - Transaction write error

### Contact
If you encounter issues, check:
1. Browser console for error details
2. Firebase console for quota/permission issues
3. This guide for troubleshooting steps

---

## Quick Reference

### Commands
1. **Analyze**: Preview what needs fixing
2. **Apply**: Fix all identified issues
3. **Export**: Download analysis report
4. **Refresh**: Re-run analysis with latest data

### Status Messages
- ✅ "All balances correct" - No action needed
- ⚠️ "X accounts need correction" - Run apply corrections
- ✓ "Corrections applied successfully" - Done!

### Key Features
- 🔍 Safe dry-run preview
- ✅ One-click fix all
- 📥 Downloadable reports
- 🔄 Idempotent (safe to re-run)
- 📊 Progress tracking
- ✓ Automatic verification

---

**Last Updated**: November 4, 2025  
**Version**: 1.0  
**Status**: Ready for deployment

