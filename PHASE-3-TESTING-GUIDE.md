# Phase 3: Testing Guide

## Quick Start Testing

### Prerequisites
1. Navigate to AccMount directory
2. Ensure the app is running (or open `index.html` in a browser)
3. Log in to the application
4. Have some test transaction data available

### Step-by-Step Testing

## Test 1: Basic Navigation ✓

**Steps:**
1. Click on "Finansal Rapor" in the navigation bar
2. Page should load showing Financial Summary view

**Expected Results:**
- Page displays with header "Gelir ve Gider Raporu"
- Three summary cards visible (Total Income, Total Expense, Net Balance)
- Filter section with 4 inputs visible
- Two insight cards (Top 5) visible
- Transaction table at the bottom

**Pass Criteria:**
- ✅ All sections render correctly
- ✅ No console errors
- ✅ Layout is responsive

---

## Test 2: Date Range Filter ✓

**Steps:**
1. In "Başlangıç Tarihi", select a start date (e.g., 2024-01-01)
2. In "Bitiş Tarihi", select an end date (e.g., 2024-03-31)
3. Observe the results

**Expected Results:**
- Transaction table updates to show only transactions in date range
- Summary cards update with new totals
- Top 5 insights recalculate based on filtered data
- Transaction count updates

**Pass Criteria:**
- ✅ Only transactions within date range visible
- ✅ Totals are accurate
- ✅ Update happens instantly (no delay)

**Edge Cases to Test:**
- Start date > End date (should show validation message)
- Empty date range (no transactions match)
- Very narrow date range (single day)

---

## Test 3: Account Filter ✓

**Steps:**
1. Click on "Cari Filtresi" dropdown
2. Select a specific account (e.g., "ABC Müşteri")
3. Observe the results

**Expected Results:**
- Dropdown shows all accounts from transactions
- Accounts are sorted alphabetically
- Only transactions for selected account visible
- Summary cards update
- Top 5 insights may show fewer items (or empty if only 1 account)

**Pass Criteria:**
- ✅ Dropdown populated correctly
- ✅ Filter works correctly
- ✅ Can clear filter by selecting "Tüm Cariler"

**Edge Cases to Test:**
- Account with no transactions in current date range
- Account with only income transactions
- Account with only expense transactions

---

## Test 4: Transaction Type Filter ✓

**Steps:**
1. Click on "İşlem Tipi" dropdown
2. Select "Gelir (Fatura)"
3. Observe results
4. Change to "Gider"
5. Observe results

**Expected Results:**
- When "Gelir" selected:
  - Only income transactions visible
  - Total Expense should be ₺0.00
  - Top 5 Expenses should show empty message
  - Top 5 Income should populate (if data exists)

- When "Gider" selected:
  - Only expense transactions visible
  - Total Income should be ₺0.00
  - Top 5 Income should show empty message
  - Top 5 Expenses should populate (if data exists)

**Pass Criteria:**
- ✅ Type filter works correctly
- ✅ Summary cards reflect filter
- ✅ Top 5 insights adjust appropriately

**Test All Types:**
- Gelir (Fatura)
- Tahsilat
- Gider
- Ödeme
- Transfer

---

## Test 5: Combined Filters ✓

**Steps:**
1. Set start date: 2024-01-01
2. Set end date: 2024-03-31
3. Select account: "ABC Müşteri"
4. Select type: "Gelir"
5. Observe results

**Expected Results:**
- Only transactions matching ALL criteria visible:
  - Date between 2024-01-01 and 2024-03-31
  - AND account is "ABC Müşteri"
  - AND type is "Gelir"
- All displays (table, totals, insights) reflect combined filters
- Transaction count shows filtered count

**Pass Criteria:**
- ✅ All filters work together (AND logic)
- ✅ Results are accurate
- ✅ Performance remains smooth

---

## Test 6: Top 5 Expense Accounts ✓

**Steps:**
1. Clear all filters (click "Sıfırla")
2. Look at "En Çok Gider Yapılan Cariler" card
3. Verify the data

**Expected Results:**
- Shows up to 5 accounts with highest expenses
- Sorted by expense amount (descending)
- Each entry shows:
  - Rank number (1-5)
  - Account name
  - Total expense amount (red color)
  - Progress bar (red gradient)
  - Transaction count
- Progress bars scale relative to highest expense (rank 1 = 100%)

**Pass Criteria:**
- ✅ Calculation is accurate
- ✅ Sorting is correct
- ✅ Visual elements render properly
- ✅ Shows fewer than 5 if less data available

**Verification:**
- Manually calculate top expense account
- Compare with displayed amount
- Should match

---

## Test 7: Top 5 Income Sources ✓

**Steps:**
1. Clear all filters
2. Look at "En Çok Gelir Getiren Cariler" card
3. Verify the data

**Expected Results:**
- Shows up to 5 accounts with highest income
- Sorted by income amount (descending)
- Each entry shows:
  - Rank number (1-5)
  - Account name
  - Total income amount (green color)
  - Progress bar (green gradient)
  - Transaction count
- Progress bars scale relative to highest income

**Pass Criteria:**
- ✅ Calculation is accurate
- ✅ Sorting is correct
- ✅ Visual elements render properly
- ✅ Shows fewer than 5 if less data available

---

## Test 8: Filter Reset ✓

**Steps:**
1. Apply multiple filters:
   - Date range
   - Specific account
   - Specific type
2. Click "Sıfırla" button
3. Observe results

**Expected Results:**
- All filter inputs clear:
  - Date fields become empty
  - Account dropdown resets to "Tüm Cariler"
  - Type dropdown resets to "Tüm İşlem Tipleri"
- Full dataset displays
- Summary cards show all-time totals
- Top 5 insights show full data

**Pass Criteria:**
- ✅ All filters reset simultaneously
- ✅ Data returns to unfiltered state
- ✅ No errors in console

---

## Test 9: CSV Export (Unfiltered) ✓

**Steps:**
1. Clear all filters
2. Click "CSV Export" button
3. Check the downloaded file

**Expected Results:**
- File downloads: `finansal_rapor_YYYY-MM-DD.csv`
- Toast notification: "X işlem başarıyla CSV formatında dışa aktarıldı."
- CSV contains:
  - All transactions
  - Correct columns (Tarih, İşlem Tipi, Açıklama, Tutar, Yön, Cari Adı)
  - Totals rows at the end (Toplam Gelir, Toplam Gider, Net Bakiye)

**Pass Criteria:**
- ✅ File downloads successfully
- ✅ Filename does not include "filtrelenmis"
- ✅ Data is complete and accurate
- ✅ Totals match displayed values

---

## Test 10: CSV Export (Filtered) ✓

**Steps:**
1. Apply filters:
   - Date: 2024-01-01 to 2024-03-31
   - Account: "ABC Müşteri"
2. Click "CSV Export" button
3. Check the downloaded file

**Expected Results:**
- File downloads: `finansal_rapor_filtrelenmis_YYYY-MM-DD.csv`
- Toast notification: "X işlem (filtrelenmiş) başarıyla CSV formatında dışa aktarıldı."
- CSV contains:
  - ONLY filtered transactions
  - Totals reflect filtered data

**Pass Criteria:**
- ✅ File downloads successfully
- ✅ Filename includes "filtrelenmis"
- ✅ Only filtered data included
- ✅ Totals are correct for filtered set

---

## Test 11: Empty States ✓

### 11a: No Transactions
**Steps:**
1. Clear all filters
2. If you have no transactions, observe

**Expected:**
- Table shows: "Henüz işlem bulunmuyor."
- Summary cards show ₺0.00
- Top 5 cards show appropriate messages

### 11b: No Matches
**Steps:**
1. Apply filters that match no transactions
   - Example: Date range with no data

**Expected:**
- Table shows: "Seçilen filtrelerde işlem bulunamadı."
- Summary cards show ₺0.00
- Top 5 shows: "Seçilen filtrelerde gider/gelir bulunamadı."

**Pass Criteria:**
- ✅ Empty states display correctly
- ✅ Messages are clear and helpful
- ✅ No console errors

---

## Test 12: Responsive Design ✓

### 12a: Mobile (< 768px)
**Steps:**
1. Resize browser to mobile width
2. Navigate through all sections

**Expected:**
- Single column layout
- Filters stack vertically
- Summary cards stack vertically
- Top 5 insights stack vertically
- Table scrolls horizontally if needed
- All text remains readable

### 12b: Tablet (768px - 1024px)
**Expected:**
- Two-column grid for insights
- Two-column grid for filters
- Proper spacing

### 12c: Desktop (> 1024px)
**Expected:**
- Optimal layout
- No horizontal scroll
- Proper use of space

**Pass Criteria:**
- ✅ Layout adapts correctly at all breakpoints
- ✅ No content is cut off
- ✅ All interactions work on all screen sizes

---

## Test 13: Dark Mode ✓

**Steps:**
1. Toggle dark mode (if available in your app)
2. Navigate to Financial Report
3. Observe all sections

**Expected Results:**
- All sections adapt to dark mode
- Colors maintain contrast
- Income: green tones adjusted
- Expense: red tones adjusted
- Text remains readable
- Progress bars visible

**Pass Criteria:**
- ✅ Dark mode colors correct
- ✅ Sufficient contrast
- ✅ All elements visible

---

## Test 14: Performance ✓

### 14a: Large Dataset (1000+ transactions)
**Steps:**
1. Ensure you have 1000+ transactions
2. Navigate to Financial Report
3. Apply various filters
4. Observe responsiveness

**Expected:**
- Initial load: < 1 second
- Filter changes: < 100ms
- No UI freezing
- Smooth scrolling

### 14b: Rapid Filter Changes
**Steps:**
1. Quickly change filters multiple times
2. Click through different accounts rapidly

**Expected:**
- No lag or stuttering
- Updates happen instantly
- No console errors

**Pass Criteria:**
- ✅ Performance remains smooth
- ✅ No memory leaks
- ✅ CPU usage reasonable

---

## Test 15: Edge Cases ✓

### 15a: Single Transaction
**Steps:**
1. Filter to show only one transaction

**Expected:**
- All calculations work
- Top 5 shows 1 item
- No division by zero errors

### 15b: Very Large Amounts
**Steps:**
1. Test with transaction amounts > ₺1,000,000

**Expected:**
- Currency formats correctly
- No overflow issues
- Progress bars render correctly

### 15c: Special Characters in Account Names
**Steps:**
1. Test with accounts having special chars (ş, ğ, ı, etc.)

**Expected:**
- Names display correctly
- Sorting works with Turkish locale
- No encoding issues

**Pass Criteria:**
- ✅ All edge cases handled gracefully
- ✅ No crashes or errors

---

## Test 16: Data Refresh ✓

**Steps:**
1. Navigate to Financial Report
2. Add a new transaction (using the app)
3. Return to Financial Report
4. Observe if data updates

**Expected:**
- New transaction appears
- Totals recalculate
- Top 5 updates if necessary
- Account filter repopulates

**Pass Criteria:**
- ✅ Data refreshes correctly
- ✅ No stale data displayed

---

## Test 17: Browser Compatibility ✓

**Test on Multiple Browsers:**
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

**Expected:**
- All features work identically
- CSS renders correctly
- No browser-specific errors

**Pass Criteria:**
- ✅ Works on all major browsers
- ✅ No visual glitches

---

## Test 18: Accessibility ✓

### Keyboard Navigation
**Steps:**
1. Use Tab key to navigate
2. Use Enter/Space to activate buttons
3. Use Arrow keys in dropdowns

**Expected:**
- All interactive elements focusable
- Focus indicators visible (indigo ring)
- Logical tab order

### Screen Reader
**Steps:**
1. Enable screen reader (VoiceOver/NVDA)
2. Navigate through page

**Expected:**
- All labels read correctly
- Form inputs have proper labels
- Button purposes clear

**Pass Criteria:**
- ✅ Fully keyboard accessible
- ✅ Screen reader friendly

---

## Test 19: Error Handling ✓

### Network Issues
**Steps:**
1. Simulate network error
2. Try to load Financial Report

**Expected:**
- Graceful error message
- No console crashes
- Ability to retry

### Invalid Data
**Steps:**
1. Simulate corrupted transaction data
2. Observe error handling

**Expected:**
- Doesn't crash the app
- Shows error message
- Other sections still work

**Pass Criteria:**
- ✅ Errors handled gracefully
- ✅ User informed of issues

---

## Test 20: Localization ✓

**Verify Turkish Text:**
- All labels in Turkish
- Date formats use Turkish locale
- Currency symbol: ₺ (Turkish Lira)
- Number formatting: dot for thousands, comma for decimals

**Expected:**
- "Cari" not "Account"
- "İşlem Tipi" not "Transaction Type"
- ₺10.000,00 format (Turkish style)

**Pass Criteria:**
- ✅ All text properly localized
- ✅ Formats match Turkish standards

---

## Regression Tests

**Ensure Existing Features Still Work:**
1. Basic transaction list ✓
2. Summary cards ✓
3. Date range filter (original functionality) ✓
4. Transaction table sorting ✓
5. Navigation between views ✓
6. Export without filters ✓

**Pass Criteria:**
- ✅ No existing features broken
- ✅ All original functionality intact

---

## Bug Report Template

If you find any issues during testing, use this template:

```
**Bug Title:** [Brief description]

**Steps to Reproduce:**
1. 
2. 
3. 

**Expected Result:**
[What should happen]

**Actual Result:**
[What actually happens]

**Severity:** [Critical / High / Medium / Low]

**Screenshots:** [If applicable]

**Browser/Device:** [Chrome 120 / iPhone 12 / etc.]

**Console Errors:** [Any error messages]
```

---

## Performance Benchmarks

**Target Metrics:**
- Initial Load: < 1 second
- Filter Change: < 100ms
- Top 5 Calculation: < 50ms
- CSV Export: < 2 seconds for 1000 transactions
- Memory Usage: < 100MB
- No memory leaks over 30 minutes

**How to Test:**
1. Open Chrome DevTools
2. Go to Performance tab
3. Record while using the app
4. Check timing and memory

---

## Final Checklist

Before marking Phase 3 as complete:

**Functionality:**
- [ ] All filters work independently
- [ ] All filters work combined
- [ ] Top 5 insights calculate correctly
- [ ] CSV export works with filters
- [ ] Reset button clears all filters

**UI/UX:**
- [ ] Visual hierarchy clear
- [ ] Colors consistent (green/red theme)
- [ ] Responsive on all devices
- [ ] Dark mode works
- [ ] Empty states appropriate

**Performance:**
- [ ] No lag with 1000+ transactions
- [ ] Smooth filter transitions
- [ ] No memory leaks

**Quality:**
- [ ] No console errors
- [ ] No linter warnings
- [ ] Code well-documented
- [ ] Accessible (keyboard, screen reader)

**Documentation:**
- [ ] Implementation guide complete
- [ ] UI guide complete
- [ ] Testing guide complete

---

## Success Criteria Summary

**Phase 3 is successful when:**

✅ All 20 tests pass
✅ All regression tests pass
✅ Performance benchmarks met
✅ All acceptance criteria met
✅ No critical or high severity bugs
✅ Documentation complete
✅ User can efficiently analyze financial data with new filters
✅ Top 5 insights provide valuable information
✅ System remains performant and stable

---

## Next Steps After Testing

1. **Fix any bugs found**
2. **Optimize performance if needed**
3. **Gather user feedback**
4. **Plan Phase 4 enhancements** (if any)
5. **Create user training materials**

---

## Contact for Issues

If you encounter any problems during testing, please document them using the bug report template above and provide:
- Detailed steps to reproduce
- Screenshots or screen recordings
- Console logs
- Environment details (browser, OS, device)

Happy Testing! 🚀

