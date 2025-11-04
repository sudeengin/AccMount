# 🧪 Quick Test Guide: Auto-Payment Feature

## 1-Minute Quick Test

### Test: Basic Auto-Payment Creation
1. Click "+ Yeni İşlem" button
2. Select "Gider" (Expense) from the dropdown
3. Fill in the form:
   - Select an account (e.g., supplier)
   - Enter amount: 1000
   - Set tax: 18%
   - **✅ Check the box "Ödeme yapıldı (gider kaydıyla birlikte)"**
   - Notice the hint appears: "✓ Kaydı oluşturduğunuzda ödeme işlemi de otomatik eklenecek."
4. Click "Tümünü Kaydet"
5. Check the success message

**✅ Expected**:
- Toast shows: "1 adet gider kaydedildi. 1 ödeme otomatik oluşturuldu. ✓"
- Transaction list shows 2 records (1 expense + 1 payment)
- Payment has "🤖 Otomatik" badge

---

## 5-Minute Comprehensive Test

### Test 1: Without Auto-Payment (Normal Flow)
1. Create new expense (Gider)
2. Fill all fields
3. **Leave "Ödeme yapıldı" unchecked**
4. Click "Tümünü Kaydet"
5. Check transaction list

**✅ Expected**:
- Only 1 expense record created
- No payment record
- Toast: "1 adet işlem başarıyla kaydedildi."
- Normal behavior (backwards compatible)

---

### Test 2: With Auto-Payment Checked
1. Create new expense (Gider)
2. Fill all fields:
   - Account: Select a supplier
   - Amount: 1000 TL
   - Tax: 18%
   - Description: "Test expense"
3. **✅ Check "Ödeme yapıldı"**
4. Verify hint appears
5. Click "Tümünü Kaydet"
6. Check transaction list
7. Check account balances

**✅ Expected**:
- Toast: "1 adet gider kaydedildi. 1 ödeme otomatik oluşturuldu. ✓"
- **2 transactions created**:
  - Expense (Gider): Supplier balance -1180
  - Payment (Ödeme): Bank balance -1180, Supplier balance +1180
- Net: Bank -1180, Supplier 0
- Payment has "🤖 Otomatik" badge
- Payment description: "Test expense (Otomatik ödeme)"

---

### Test 3: Multiple Rows (Mixed)
1. Create new Gider transaction
2. Add 3 rows:
   - **Row 1**: Amount 500 TL, **check** auto-payment
   - **Row 2**: Amount 750 TL, **leave unchecked**
   - **Row 3**: Amount 1000 TL, **check** auto-payment
3. Click "Tümünü Kaydet"
4. Check transaction list

**✅ Expected**:
- Toast: "3 adet gider kaydedildi. 2 ödeme otomatik oluşturuldu. ✓"
- **5 transactions total**:
  - 3 expenses
  - 2 auto-payments (for rows 1 and 3)
- Payments have "🤖 Otomatik" badge
- Row 2 has no auto-payment (normal)

---

### Test 4: Visual Indicators
1. After creating expense with auto-payment
2. Go to account detail page
3. View transaction list
4. Click on the auto-created payment

**✅ Expected**:
- Payment shows with "🤖 Otomatik" badge
- Badge tooltip: "Gider kaydıyla birlikte otomatik oluşturuldu"
- Payment description includes "(Otomatik ödeme)"
- Same date as expense
- Same amount as expense total (with tax)

---

### Test 5: Balance Verification
1. Note bank balance before test
2. Note supplier balance before test
3. Create expense: 1000 TL + 18% tax = 1180 TL
4. Check auto-payment box
5. Save
6. Check balances after

**✅ Expected Balances**:
```
Bank Account:
  Before: X
  After:  X - 1180  (decreased by payment)

Supplier:
  Before: Y
  After:  Y         (net zero: -1180 from expense, +1180 from payment)
```

---

### Test 6: No Bank Account Edge Case
1. Delete all bank accounts (if testing in clean environment)
2. Try to create expense with auto-payment
3. Check error handling

**✅ Expected**:
- Expense is still created
- Auto-payment fails gracefully
- Console shows: `[auto-payment] No bank accounts found`
- User can manually create payment later

---

### Test 7: Browser Console Check
1. Open browser console (F12)
2. Create expense with auto-payment
3. Watch console logs

**✅ Expected Logs**:
```
[form:submit] Starting submission
[form:submit] Committing batch with 1 transactions
[form:submit] Batch committed successfully
[form:submit] Creating 1 automatic payments
[auto-payment] Creating automatic payment for expense exp_XXX
[auto-payment] Payment created successfully pay_XXX
[form:submit] Resetting submission state in finally block
```

---

### Test 8: Checkbox Interaction
1. Create new Gider
2. Click checkbox "Ödeme yapıldı"
3. Verify hint appears
4. Uncheck checkbox
5. Verify hint disappears

**✅ Expected**:
- Hint message toggles with checkbox
- Smooth user experience
- Clear feedback

---

## Database Verification

### Check Expense Record
Open browser console and run:
```javascript
// Find the expense
const expenseId = "your_expense_id_here";
const expenseRef = doc(db, "islemler", expenseId);
const expenseDoc = await getDoc(expenseRef);
console.log(expenseDoc.data());
```

**Should show**:
```javascript
{
  islemTipi: "gider",
  islemCari: "supplier_id",
  tutar: 1000,
  toplamTutar: 1180,
  vergiOrani: 18,
  // ... other fields
}
```

### Check Auto-Payment Record
```javascript
// Find the payment
const paymentId = "your_payment_id_here";
const paymentRef = doc(db, "islemler", paymentId);
const paymentDoc = await getDoc(paymentRef);
console.log(paymentDoc.data());
```

**Should show**:
```javascript
{
  islemTipi: "odeme",
  kaynakCari: "bank_id",
  hedefCari: "supplier_id",
  tutar: 1180,
  source: "auto_from_expense",     // ← Important!
  linkedExpenseId: "expense_id",   // ← Links back
  aciklama: "... (Otomatik ödeme)",
  // ... other fields
}
```

---

## Report Verification

### Income/Expense Report
1. Go to Financial Summary or Reports view
2. Check expense appears in report
3. Verify payment does NOT appear in P&L

**✅ Expected**:
- Expense (direction: -1) → Affects P&L
- Payment (direction: 0) → Does NOT affect P&L
- P&L is accurate

### Cash Flow Report
1. Check bank account transactions
2. Verify payment appears as outflow

**✅ Expected**:
- Payment shows in cash flow
- Bank balance decreased correctly
- Timeline is accurate

---

## Common Issues & Solutions

### Issue: Checkbox doesn't show hint
**Check**: 
- Is it a Gider (expense)? Checkbox only for expenses
- Check browser console for errors

### Issue: Auto-payment not created
**Check**:
- Was checkbox checked before saving?
- Do you have at least one bank account?
- Check console for error messages

### Issue: Wrong payment amount
**Check**:
- Payment should use `toplamTutar` (total with tax)
- Not `tutar` (amount without tax)
- Verify tax calculation is correct

### Issue: Badge doesn't show
**Check**:
- Badge only shows for payments with `source: "auto_from_expense"`
- Check payment record in database
- Refresh the view

---

## Quick Checklist

After each test, verify:
- [ ] Expense created correctly
- [ ] Payment created if checkbox checked
- [ ] No payment if checkbox unchecked
- [ ] Correct amounts (with tax)
- [ ] Correct balances (bank decreased, supplier net zero)
- [ ] Badge appears on payment
- [ ] Success toast shows correct counts
- [ ] No console errors
- [ ] No duplicate records

---

## Performance Check

### Should Be Fast
- ✅ Checkbox interaction: Instant
- ✅ Form submission: < 2 seconds
- ✅ Auto-payment creation: < 1 second additional
- ✅ Total: Similar to normal expense creation

### Should Not
- ❌ Cause noticeable delay
- ❌ Freeze the UI
- ❌ Create duplicate payments
- ❌ Fail silently

---

## What to Report

### If Test Fails

Please report with:
1. **Which test failed** (e.g., "Multiple rows test")
2. **Steps taken** (exactly what you did)
3. **Expected vs Actual** (what should happen vs what happened)
4. **Console logs** (copy all [form:submit] and [auto-payment] logs)
5. **Screenshots** (if UI issue)
6. **Browser** (Chrome, Firefox, Safari, etc.)

### Example Good Report
```
Test: Auto-payment creation
Steps:
  1. Created expense: 1000 TL + 18% = 1180 TL
  2. Checked "Ödeme yapıldı"
  3. Clicked save
Expected: 1 expense + 1 payment created
Actual: Only expense created, no payment
Console:
  [form:submit] Starting submission
  [form:submit] Batch committed successfully
  [auto-payment] No bank accounts found
  [form:submit] Failed to create auto-payment
Browser: Chrome 120
Note: Had no bank account - need to create one first
```

---

**Estimated Testing Time**: 5-10 minutes  
**Recommended Frequency**: Test once after deployment  
**Priority**: MEDIUM - Feature enhancement, not critical bug fix

