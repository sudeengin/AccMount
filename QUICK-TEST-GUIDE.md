# Quick Test Guide - Report Mode & Summary Card Fixes

## 🚀 Quick Start

### Step 1: Start the Application
```bash
cd /Users/sudeengin/Desktop/AccMount
npm run dev
```

The app will open automatically at `http://localhost:3000`

### Step 2: Navigate to Financial Summary
1. Click on **"Finansal Özet"** in the navigation bar
2. You should see the financial summary view with three summary cards

---

## ✅ Test Checklist

### Visual Testing (Summary Cards)

**Test A: Check Summary Card Layout**
- [ ] All three cards (Income, Expense, Balance) are the same height
- [ ] No text wraps to a second line
- [ ] All amounts are clearly visible

**Test B: Test with Large Numbers**
If you have large amounts (> ₺1M):
- [ ] Amounts stay on one line
- [ ] If truncated, you see "..." at the end
- [ ] Hovering shows the full amount in a tooltip

**Test C: Responsive Testing**
Resize your browser window:
- [ ] On narrow screens, text scales down appropriately
- [ ] Cards maintain consistent spacing
- [ ] No horizontal scrolling occurs

---

### Functional Testing (Report Modes)

**Test D: Income Mode (Gelir/Gider)**
1. In the dropdown "Rapor Türü", select **"Gelir/Gider (P&L)"**
2. Open browser console (F12)
3. Check:
   - [ ] Console shows: `Report mode changed: ... → income`
   - [ ] Console shows: `Visible types for income mode: gelir, gider`
   - [ ] Transaction table shows only `gelir` and `gider` transactions
   - [ ] Summary cards show labels: "TOPLAM GELİR", "TOPLAM GİDER", "NET BAKİYE"

**Test E: Cashflow Mode (Nakit Akışı)**
1. In the dropdown "Rapor Türü", select **"Nakit Akışı"**
2. Check console again
3. Check:
   - [ ] Console shows: `Report mode changed: income → cashflow`
   - [ ] Console shows: `Visible types for cashflow mode: tahsilat, ödeme, ...`
   - [ ] Transaction table shows only cash movement transactions
   - [ ] Summary cards show labels: "NAKİT GİRİŞİ", "NAKİT ÇIKIŞI", "NET NAKİT"

**Test F: Mode Switching**
1. Switch between modes 3-4 times rapidly
2. Check:
   - [ ] Numbers change immediately
   - [ ] Table rows change (different transactions appear/disappear)
   - [ ] No errors in console
   - [ ] Transaction count updates correctly

**Test G: Filter Interaction**
1. Select Income Mode
2. Open "İşlem Tipi" filter dropdown
   - [ ] Should show only `gelir` and `gider` options
3. Select Cashflow Mode
4. Open "İşlem Tipi" filter dropdown again
   - [ ] Should show only `tahsilat`, `ödeme`, `transfer` options

**Test H: CSV Export**
1. Select Income Mode
2. Click "CSV Dışa Aktar" button
3. Open the downloaded CSV file
   - [ ] Contains only `gelir` and `gider` transactions
4. Go back, select Cashflow Mode
5. Click "CSV Dışa Aktar" again
6. Open the new CSV file
   - [ ] Contains only cash movement transactions

---

## 🐛 Troubleshooting

### If Report Mode Doesn't Work:

**Check Console Logs:**
1. Press F12 to open developer tools
2. Go to Console tab
3. Look for messages starting with `[Financial Report]`
4. You should see messages when you switch modes

**If you see an error:**
- Copy the error message
- Check if it mentions a missing file or function
- Try hard-refresh: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)

**If no console messages appear:**
- The event listener might not be attached
- Try refreshing the page
- Check if JavaScript is enabled in your browser

### If Summary Cards Still Overflow:

**Clear Cache:**
1. Hard-refresh: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)
2. Or clear browser cache completely

**Verify CSS is loaded:**
1. Press F12 → Network tab
2. Refresh page
3. Look for `dist/styles.css`
4. It should load with status 200 (green)

---

## 📊 Expected Console Output

When you switch to **Income Mode**, you should see:
```
[Financial Report] Report mode changed: cashflow → income
[Financial Report] selectReportRows called with mode: income
[Financial Report] Visible types for income mode: gelir, gider
[Financial Report] Filtered 15 out of 50 transactions
[Financial Report] Visible transactions after mode change: 15
[Financial Report] Transaction types in view: gelir, gider
```

When you switch to **Cashflow Mode**, you should see:
```
[Financial Report] Report mode changed: income → cashflow
[Financial Report] selectReportRows called with mode: cashflow
[Financial Report] Visible types for cashflow mode: tahsilat, ödeme, odeme, transfer, borç transferi, borc transferi
[Financial Report] Filtered 35 out of 50 transactions
[Financial Report] Visible transactions after mode change: 35
[Financial Report] Transaction types in view: tahsilat, ödeme, transfer
```

---

## 📸 Visual Examples

### Income Mode (Gelir/Gider)
```
┌─────────────────────────────────────────────────────────────┐
│ Gelir ve Gider Raporu                                       │
│ Dönem: Tüm Zamanlar                                         │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │TOPLAM GELİR │  │TOPLAM GİDER │  │ NET BAKİYE  │        │
│  │   ↑         │  │      ↓      │  │      ₺      │        │
│  │₺1.000.000,00│  │ ₺500.000,00 │  │ ₺500.000,00 │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
├─────────────────────────────────────────────────────────────┤
│ Transactions:                                               │
│ ✅ gelir   - ₺100.000,00 - Revenue from sales              │
│ ❌ gider   - ₺50.000,00  - Office rent                     │
│ ✅ gelir   - ₺200.000,00 - Service income                  │
│                                                             │
│ (tahsilat, ödeme, transfer are HIDDEN)                     │
└─────────────────────────────────────────────────────────────┘
```

### Cashflow Mode (Nakit Akışı)
```
┌─────────────────────────────────────────────────────────────┐
│ Nakit Akış Raporu                                           │
│ Dönem: Tüm Zamanlar                                         │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │NAKİT GİRİŞİ │  │NAKİT ÇIKIŞI │  │  NET NAKİT  │        │
│  │      ↑      │  │      ↓      │  │      ₺      │        │
│  │₺800.000,00  │  │ ₺600.000,00 │  │ ₺200.000,00 │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
├─────────────────────────────────────────────────────────────┤
│ Transactions:                                               │
│ 💰 tahsilat - ₺100.000,00 - Payment collected              │
│ 💸 ödeme    - ₺50.000,00  - Supplier payment               │
│ 🔄 transfer - ₺30.000,00  - Bank transfer                  │
│                                                             │
│ (gelir and gider are HIDDEN)                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 Success Criteria

You can consider the implementation successful if:

### Visual ✅
- [ ] No text overflow in summary cards
- [ ] All amounts on single line
- [ ] Tooltips work on hover
- [ ] Consistent card heights

### Functional ✅
- [ ] Switching modes changes visible transactions
- [ ] Summary totals recalculate correctly
- [ ] Transaction count updates
- [ ] CSV export respects selected mode
- [ ] Console logs confirm filtering is working

---

## 📝 Notes for Testing

### Transaction Type Requirements
For full testing, you need transactions with these types:
- ✅ `gelir` - Will appear in Income mode
- ✅ `gider` - Will appear in Income mode
- ✅ `tahsilat` - Will appear in Cashflow mode
- ✅ `ödeme` - Will appear in Cashflow mode
- ✅ `transfer` or `borç transferi` - Will appear in Cashflow mode

If you only have one type of transaction, the mode switching will still work, but you'll only see data in one mode.

### Creating Test Data
If needed, you can create test transactions with different types to verify the filtering:

1. Create a `gelir` transaction → Should appear in Income mode
2. Create a `tahsilat` transaction → Should appear in Cashflow mode
3. Switch between modes to see them appear/disappear

---

## 🔧 Debug Mode

### Viewing All Debug Information
To see detailed logging:
1. Open browser console (F12)
2. Navigate to Financial Summary
3. Switch between report modes
4. Watch console output

### What to Look For
✅ **Good Output:**
```
[Financial Report] selectReportRows called with mode: income
[Financial Report] Visible types for income mode: gelir, gider
[Financial Report] Filtered 10 out of 25 transactions
```

❌ **Problematic Output:**
```
[Financial Report] Filtered 0 out of 0 transactions
```
↳ This means no transactions are loaded - check data loading

```
TypeError: Cannot read property 'islemTipi' of undefined
```
↳ This means transaction data structure is incorrect

---

## 📞 Need Help?

If tests fail, check:
1. **REPORT-MODE-IMPLEMENTATION-SUMMARY.md** - Full technical details
2. **VISUAL-CHANGES-SUMMARY.md** - Visual changes explanation
3. Console logs - Error messages will guide you

Most issues can be solved by:
- Hard refresh (Ctrl+Shift+R / Cmd+Shift+R)
- Clearing browser cache
- Checking console for JavaScript errors
- Verifying transaction data has correct `islemTipi` values

---

## ✨ All Tests Passed?

If all tests pass:
1. **Optional:** Remove debug console.log statements from `financial-summary.view.js` (lines 93-102 and 589-602)
2. Consider the implementation production-ready
3. Monitor user feedback for any edge cases

**That's it! You're done! 🎉**

