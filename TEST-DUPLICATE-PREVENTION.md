# 🧪 Quick Test Guide: Duplicate Prevention

## 1-Minute Quick Test

### Test: Rapid Double-Click
1. Open the app
2. Click "+ Yeni İşlem" or open transaction modal
3. Fill in required fields:
   - Select "Gelir" or "Gider"
   - Choose an account
   - Enter amount
   - Upload an invoice image (optional but recommended)
4. **Double-click "Tümünü Kaydet" very quickly**
5. Open browser console (F12)
6. Check the transaction list

**✅ Expected**:
- Console shows: `[form:submit] Duplicate submission attempt blocked`
- Only ONE transaction appears in the list
- Only ONE success toast message
- Button re-enables after save completes

**❌ If you see duplicates**:
- Two "Starting submission" logs in console
- Two identical transactions in the list
- → Report this issue

---

## 5-Minute Comprehensive Test

### Test 1: Double-Click (All Transaction Types)

**Gelir (Income)**:
1. Create new income transaction
2. Add invoice image
3. Double-click "Tümünü Kaydet"
4. ✅ Verify: Only 1 transaction created

**Gider (Expense)**:
1. Create new expense transaction
2. Add invoice image
3. Double-click "Tümünü Kaydet"
4. ✅ Verify: Only 1 transaction created

**Ödeme (Payment)**:
1. Create new payment transaction
2. Select source and target accounts
3. Double-click "Tümünü Kaydet"
4. ✅ Verify: Only 1 transaction created

---

### Test 2: Click During Upload

1. Create new transaction (any type)
2. **Upload a LARGE image** (> 2MB if possible)
3. Click "Tümünü Kaydet"
4. **Immediately try clicking the button again** while it says "Kaydediliyor..."
5. Watch the button - it should be disabled and unclickable

**✅ Expected**:
- Button shows "Kaydediliyor..." and is grayed out
- Clicking has no effect
- Only 1 transaction created after upload completes
- Console shows only ONE "Batch committed successfully"

---

### Test 3: Keyboard Submission

1. Create new transaction
2. Fill all fields
3. Click "Tümünü Kaydet" with mouse
4. **Immediately press Enter key**
5. Check console and transaction list

**✅ Expected**:
- Console shows duplicate attempt blocked
- Only 1 transaction created
- No errors

---

### Test 4: Multi-Row Entry

1. Create "Gelir" or "Gider" transaction
2. Click "+ Yeni Satır Ekle" to add multiple rows
3. Fill 2-3 rows
4. Double-click "Tümünü Kaydet"
5. Check transaction list

**✅ Expected**:
- Only ONE set of transactions created (not doubled)
- Number of transactions = number of rows (not rows × 2)

---

### Test 5: Error Scenario

1. Create new transaction
2. **Leave required fields empty**
3. Click "Tümünü Kaydet"
4. See error toast
5. Fill the fields correctly
6. Click "Tümünü Kaydet" again

**✅ Expected**:
- Error toast appears first time
- Button re-enables after error
- Second submission works normally
- Only 1 transaction created

---

## Browser Console Monitoring

### What to Look For

Open browser console (F12 → Console tab) and watch for these logs:

**✅ Normal submission (no duplicates)**:
```
[form:submit] Starting submission
[form:submit] Committing batch with 1 transactions
[form:submit] Batch committed successfully
[form:submit] Resetting submission state in finally block
```

**✅ Duplicate attempt blocked**:
```
[form:submit] Starting submission
[form:submit] Duplicate submission attempt blocked  ← Good! Prevention working
[form:submit] Resetting submission state in finally block
```

**❌ Problem detected**:
```
[form:submit] Starting submission
[form:submit] Starting submission  ← Two starts = problem!
[form:submit] Batch committed successfully
[form:submit] Batch committed successfully  ← Two commits = duplicates!
```

---

## Quick Database Check

### Method 1: Check Transaction List
1. After saving, go to the account's detail page
2. Count the transactions
3. Should see only ONE new transaction

### Method 2: Check Timestamps
1. If you suspect duplicates, check transaction timestamps
2. Duplicates will have identical or nearly identical timestamps (< 1 second apart)
3. Duplicates will have identical amounts and descriptions

---

## Network Delay Test (Advanced)

### Simulate Slow Connection
1. Open Chrome DevTools (F12)
2. Go to "Network" tab
3. Change throttling to "Slow 3G" or "Fast 3G"
4. Create transaction with invoice image
5. Click "Tümünü Kaydet"
6. Try clicking multiple times during slow upload
7. Wait for completion

**✅ Expected**:
- Button stays disabled entire time
- Multiple clicks have no effect
- Only 1 transaction created
- Process feels slow but doesn't create duplicates

---

## Mobile Test (If Applicable)

### Touch Events
1. Open app on mobile device
2. Create transaction
3. **Rapidly tap "Tümünü Kaydet" multiple times**
4. Check if only 1 transaction created

**✅ Expected**:
- Touch events also blocked
- Same protection as mouse clicks
- Only 1 transaction

---

## What to Report

### If Test Fails

Please report with:
1. **Which test failed** (e.g., "Double-click test")
2. **Transaction type** (gelir, gider, etc.)
3. **Console logs** (copy all logs from [form:submit])
4. **Number of duplicates** (2, 3, or more?)
5. **Browser** (Chrome, Firefox, Safari, etc.)
6. **Network conditions** (Fast, slow, etc.)

### Example Good Report
```
Test: Double-click test
Type: Gelir
Browser: Chrome 120
Console logs:
  [form:submit] Starting submission
  [form:submit] Starting submission
  [form:submit] Batch committed successfully
  [form:submit] Batch committed successfully
Result: 2 identical transactions created
Network: Normal speed
```

---

## Quick Checklist

After each test, verify:
- [ ] Only 1 transaction in database
- [ ] Only 1 success toast
- [ ] Button re-enabled after save
- [ ] Console shows protection working
- [ ] No JavaScript errors in console
- [ ] Form resets properly

---

**Estimated Testing Time**: 5-10 minutes  
**Recommended Frequency**: Test once after deployment, then as needed  
**Priority**: HIGH - This prevents data corruption

