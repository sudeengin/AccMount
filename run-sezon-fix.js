// Standalone Sezon Balance Fix
// Copy and paste this entire code into the browser console

(async function() {
    console.log('🔧 Starting Sezon balance fix...');
    
    // Import Firebase functions dynamically
    const { getDocs, collection, writeBatch, doc, updateDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
    const { db } = await import('./src/services/firebase.js');
    
    try {
        // Step 1: Fix debt transfers
        console.log('\n📋 Fixing debt transfers...');
        const txRef = collection(db, 'islemler');
        const txSnap = await getDocs(txRef);
        const batch = writeBatch(db);
        let fixed = 0;
        const allTx = [];
        
        txSnap.forEach(d => {
            const data = d.data();
            allTx.push({ id: d.id, ...data });
            const type = String(data.islemTipi || '').toLowerCase();
            if ((type === 'borç transferi' || type === 'borc transferi') && data.affectsBalance !== true) {
                batch.update(doc(db, 'islemler', d.id), { affectsBalance: true });
                fixed++;
                console.log(`  ✓ Fixing: ${data.aciklama || d.id} (₺${data.toplamTutar || data.tutar || 0})`);
            }
        });
        
        if (fixed > 0) {
            await batch.commit();
            console.log(`✅ Fixed ${fixed} debt transfer(s)`);
        } else {
            console.log('  ℹ️ No debt transfers needed fixing');
        }
        
        // Step 2: Find Sezon
        console.log('\n📋 Finding Sezon Tekstil...');
        const accRef = collection(db, 'cariler');
        const accSnap = await getDocs(accRef);
        let sezon = null;
        
        accSnap.forEach(d => {
            const data = d.data();
            const unvan = (data.unvan || '').toLowerCase();
            if (unvan.includes('sezon') && unvan.includes('tekstil')) {
                sezon = { id: d.id, ...data };
            }
        });
        
        if (!sezon) throw new Error('Sezon Tekstil not found!');
        console.log(`  ✓ Found: ${sezon.unvan} (ID: ${sezon.id})`);
        
        // Step 3: Calculate balance
        console.log('\n📋 Calculating balance...');
        let calc = 0;
        let txCount = 0;
        
        allTx.forEach(tx => {
            if (tx.isDeleted) return;
            
            // Check if affects balance (after our fix, all debt transfers should)
            const affectsBalance = tx.affectsBalance !== false;
            if (!affectsBalance) return;
            
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
            
            if (change !== 0) {
                calc += change;
                txCount++;
                console.log(`  ${change > 0 ? '+' : ''}₺${change.toLocaleString('tr-TR')} - ${type}`);
            }
        });
        
        const stored = Number(sezon.bakiye || 0);
        const diff = Math.abs(calc - stored);
        
        console.log('\n📊 SUMMARY:');
        console.log(`  Transactions counted: ${txCount}`);
        console.log(`  Database balance: ₺${stored.toLocaleString('tr-TR', {minimumFractionDigits:2, maximumFractionDigits:2})}`);
        console.log(`  Calculated balance: ₺${calc.toLocaleString('tr-TR', {minimumFractionDigits:2, maximumFractionDigits:2})}`);
        console.log(`  Difference: ₺${diff.toLocaleString('tr-TR', {minimumFractionDigits:2, maximumFractionDigits:2})}`);
        
        // Step 4: Update if needed
        if (diff > 0.01) {
            console.log('\n📋 Updating database...');
            await updateDoc(doc(db, 'cariler', sezon.id), {
                bakiye: calc,
                balanceAutoFixed: true,
                lastBalanceRecalculation: serverTimestamp()
            });
            console.log(`✅ Balance updated from ₺${stored.toLocaleString('tr-TR')} to ₺${calc.toLocaleString('tr-TR')}`);
        } else {
            console.log('\n✅ Balance is already correct!');
        }
        
        console.log('\n✨ Fix completed successfully!');
        console.log('🔄 Please REFRESH the page (F5) to see the updated balance.');
        
        alert('✅ Fix complete!\n\nDebt transfers fixed: ' + fixed + '\nOld balance: ₺' + stored.toLocaleString('tr-TR') + '\nNew balance: ₺' + calc.toLocaleString('tr-TR') + '\n\nPlease REFRESH the page now.');
        
    } catch (error) {
        console.error('❌ ERROR:', error);
        alert('❌ Error: ' + error.message + '\n\nCheck console for details.');
        throw error;
    }
})();

