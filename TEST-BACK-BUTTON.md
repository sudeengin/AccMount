# 🧪 Quick Test Guide: "Cari Detaya Dön" Button

## Quick 5-Minute Test

### Test 1: From Dashboard to Bank Account
1. Open the application
2. Go to **Dashboard** (Gösterge Paneli)
3. Select a bank account from dropdown
4. Click **"Detayları Görüntüle"** button
5. Click on any transaction in the list
6. Click **"Cari Detaya Dön"** button

**Expected**: ✅ Should return to the bank account's detail page (not generic view)

---

### Test 2: From Account List
1. Go to **Cariler** (Accounts)
2. Click on any account (customer or supplier)
3. Click on any transaction in the transaction list
4. Click **"Cari Detaya Dön"** button

**Expected**: ✅ Should return to that specific account's detail page

---

### Test 3: Different Transaction Types
Test with each transaction type:

#### Gelir (Income)
1. Find an account with income transactions
2. View the account detail
3. Click on a **gelir** transaction
4. Click **"Cari Detaya Dön"**
5. **Expected**: Returns to the income source account

#### Gider (Expense)
1. Find an account with expense transactions
2. View the account detail
3. Click on a **gider** transaction
4. Click **"Cari Detaya Dön"**
5. **Expected**: Returns to the expense target account

#### Transfer/Ödeme/Tahsilat
1. Find an account with transfer transactions
2. View the account detail
3. Click on a transfer transaction
4. Click **"Cari Detaya Dön"**
5. **Expected**: Returns to the source or target account

---

### Test 4: Filter Preservation
1. Go to any account detail page
2. Apply a filter (date range or transaction type)
3. Click on a transaction
4. Click **"Cari Detaya Dön"**

**Expected**: ✅ Filters should still be active when you return

---

### Test 5: Multiple Navigation Cycles
1. View Account A detail
2. Click transaction 1 → View detail
3. Click "Cari Detaya Dön" → Back to Account A
4. Click transaction 2 → View detail  
5. Click "Cari Detaya Dön" → Back to Account A
6. Click transaction 3 → View detail
7. Click "Cari Detaya Dön" → Back to Account A

**Expected**: ✅ Each time returns to Account A (no state mixing)

---

## What to Check

### ✅ Success Indicators
- ✓ Always returns to the correct account detail page
- ✓ Account name matches in header
- ✓ Transaction list shows transactions for that account
- ✓ No page reload or flashing
- ✓ No 404 or error messages
- ✓ No console errors (press F12 to check)
- ✓ Filters remain active if they were set

### ❌ Failure Indicators
- ✗ Returns to wrong account
- ✗ Shows generic "Cari Detay" without specific account
- ✗ Page reloads
- ✗ Console errors
- ✗ Filters reset when returning
- ✗ Empty transaction list
- ✗ Error toast messages

---

## Quick Browser Console Check

Open browser console (F12) and look for:
- ❌ Any red error messages
- ✅ Should see clean navigation logs

---

## If You Find Issues

1. **Note the exact steps** you took
2. **Check browser console** (F12) for errors
3. **Note the transaction type** you were viewing
4. **Note which view** you started from (dashboard, account list, etc.)

---

## Testing on Different Browsers

Quick test on:
- ✅ Chrome/Edge
- ✅ Firefox  
- ✅ Safari (if on Mac)

---

## Performance Check

Navigation should be:
- ⚡ Fast (< 200ms)
- 🎯 Accurate (correct account every time)
- 💾 Persistent (remembers context)

---

## Test Complete When:

✅ All 5 test scenarios pass  
✅ No console errors  
✅ Navigation feels natural and intuitive  
✅ Tested on primary browser  

---

**Estimated Testing Time**: 5-10 minutes  
**Complexity**: Easy  
**Required Knowledge**: Basic app navigation

