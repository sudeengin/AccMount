# Fix Sezon Tekstil Balance - Instructions

## Quick Fix (Copy-Paste into Browser Console)

1. **Open your app** in the browser (index.html)
2. **Open Developer Console** (F12 or Right-click → Inspect → Console)
3. **Copy and paste** the code below and press Enter:

```javascript
// Quick fix for Sezon Tekstil balance
(async function() {
    console.log('🔧 Fixing Sezon balance...');
    
    const { getDocs, collection, writeBatch, doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
    
    // Fix debt transfers
    const txRef = collection(window.db, 'islemler');
    const txSnap = await getDocs(txRef);
    const batch = writeBatch(window.db);
    let fixed = 0;
    const allTx = [];
    
    txSnap.forEach(d => {
        const data = d.data();
        allTx.push({ id: d.id, ...data });
        const type = String(data.islemTipi || '').toLowerCase();
        if ((type === 'borç transferi' || type === 'borc transferi') && data.affectsBalance !== true) {
            batch.update(doc(window.db, 'islemler', d.id), { affectsBalance: true });
            fixed++;
        }
    });
    
    if (fixed > 0) await batch.commit();
    console.log(`✅ Fixed ${fixed} debt transfers`);
    
    // Find Sezon
    const accRef = collection(window.db, 'cariler');
    const accSnap = await getDocs(accRef);
    let sezon = null;
    accSnap.forEach(d => {
        const data = d.data();
        if ((data.unvan || '').toLowerCase().includes('sezon') && (data.unvan || '').toLowerCase().includes('tekstil')) {
            sezon = { id: d.id, ...data };
        }
    });
    
    if (!sezon) throw new Error('Sezon not found!');
    console.log(`📊 Found: ${sezon.unvan}`);
    
    // Calculate balance
    let calc = 0;
    allTx.forEach(tx => {
        if (tx.isDeleted || tx.affectsBalance === false) return;
        const amt = Math.abs(Number(tx.toplamTutar || tx.tutar || 0));
        const type = String(tx.islemTipi || '').toLowerCase();
        const isDT = type === 'borç transferi' || type === 'borc transferi';
        
        let change = 0;
        if (isDT) {
            if (tx.islemCari === sezon.id) change = 0;
            else if (tx.kaynakCari === sezon.id) change = -amt;
            else if (tx.hedefCari === sezon.id) change = amt;
        } else if (tx.islemCari === sezon.id) {
            if (type === 'gelir') change = amt;
            else if (type === 'gider') change = -amt;
            else if (type === 'administrative_reset') change = amt;
        } else if (tx.kaynakCari === sezon.id) {
            change = -amt;
        } else if (tx.hedefCari === sezon.id) {
            change = amt;
        }
        calc += change;
    });
    
    const stored = Number(sezon.bakiye || 0);
    const diff = Math.abs(calc - stored);
    
    console.log(`Database: ₺${stored.toLocaleString('tr-TR', {minimumFractionDigits:2})}`);
    console.log(`Calculated: ₺${calc.toLocaleString('tr-TR', {minimumFractionDigits:2})}`);
    console.log(`Difference: ₺${diff.toLocaleString('tr-TR', {minimumFractionDigits:2})}`);
    
    if (diff > 0.01) {
        await updateDoc(doc(window.db, 'cariler', sezon.id), {
            bakiye: calc,
            balanceAutoFixed: true,
            lastBalanceRecalculation: new Date()
        });
        console.log(`✅ Updated: ₺${stored.toLocaleString('tr-TR')} → ₺${calc.toLocaleString('tr-TR')}`);
    } else {
        console.log('✅ Balance already correct!');
    }
    
    alert('✅ Fix complete! Please refresh the page.');
})();
```

4. **Wait** for the success message
5. **Refresh the page** (F5 or Ctrl+R)
6. **Check** Sezon Tekstil - the warning should be gone!

## What This Does

1. ✅ Sets `affectsBalance = true` for all migrated debt transfers
2. ✅ Recalculates Sezon Tekstil's balance from all transactions
3. ✅ Updates the database with the correct balance
4. ✅ Marks the account as auto-fixed to prevent re-processing

## Expected Result

- **Before**: ₺369.213,06 (with ⚠️ warning)
- **After**: Correct balance without warning

## Troubleshooting

If you see any errors:
1. Make sure you're logged into Firebase
2. Make sure you're on the main app page (index.html)
3. Check that `window.db` is defined (type `window.db` in console)

If issues persist, check the detailed log output in the console.

