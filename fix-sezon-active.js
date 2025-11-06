// Fixed Sezon Balance Fix - Only Active Accounts
// Copy and paste this entire code into the browser console

(async function() {
    console.log('🔧 Starting Sezon balance fix (ACTIVE accounts only)...');
    
    const { getDocs, collection, writeBatch, doc, updateDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
    const { db } = await import('./src/services/firebase.js');
    
    try {
        // Step 1: Fix debt transfers
        console.log('\n📋 Step 1: Fixing debt transfers...');
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
                console.log(`  ✓ Fixed: ${data.aciklama || d.id} (₺${data.toplamTutar || data.tutar || 0})`);
            }
        });
        
        if (fixed > 0) {
            await batch.commit();
            console.log(`✅ Fixed ${fixed} debt transfer(s)`);
        } else {
            console.log('  ℹ️ No debt transfers needed fixing');
        }
        
        // Step 2: Find ACTIVE Sezon Tekstil
        console.log('\n📋 Step 2: Finding ACTIVE Sezon Tekstil account...');
        const accRef = collection(db, 'cariler');
        const accSnap = await getDocs(accRef);
        const sezonAccounts = [];
        
        accSnap.forEach(d => {
            const data = d.data();
            const unvan = (data.unvan || '').toLowerCase();
            if (unvan.includes('sezon') && unvan.includes('tekstil')) {
                sezonAccounts.push({ id: d.id, ...data });
            }
        });
        
        console.log(`  Found ${sezonAccounts.length} Sezon Tekstil account(s) total`);
        
        // Filter for active accounts only
        const activeSezon = sezonAccounts.filter(acc => {
            const status = (acc.durum || '').toLowerCase();
            const isActive = status !== 'deleted' && status !== 'archived';
            console.log(`  - ${acc.unvan}: status="${acc.durum || 'none'}", bakiye=₺${(acc.bakiye || 0).toLocaleString('tr-TR')}, active=${isActive}`);
            return isActive;
        });
        
        if (activeSezon.length === 0) {
            throw new Error('No ACTIVE Sezon Tekstil account found!');
        }
        
        if (activeSezon.length > 1) {
            console.warn(`⚠️ Multiple active Sezon accounts found! Using the one with highest balance.`);
        }
        
        // Pick the active account with the highest balance (most likely the real one)
        const sezon = activeSezon.sort((a, b) => Math.abs(b.bakiye || 0) - Math.abs(a.bakiye || 0))[0];
        
        console.log(`  ✓ Selected ACTIVE account: ${sezon.unvan}`);
        console.log(`    - ID: ${sezon.id}`);
        console.log(`    - Status: ${sezon.durum || 'active (not set)'}`);
        console.log(`    - Current balance in DB: ₺${(sezon.bakiye || 0).toLocaleString('tr-TR', {minimumFractionDigits:2})}`);
        
        // Step 3: Calculate balance
        console.log('\n📋 Step 3: Calculating correct balance from transactions...');
        let calc = 0;
        let txCount = 0;
        
        allTx.forEach(tx => {
            if (tx.isDeleted) return;
            
            // Check if transaction involves this specific Sezon account
            const isRelevant = tx.islemCari === sezon.id || 
                             tx.kaynakCari === sezon.id || 
                             tx.hedefCari === sezon.id;
            if (!isRelevant) return;
            
            // Check if affects balance
            const affectsBalance = tx.affectsBalance !== false;
            if (!affectsBalance) {
                console.log(`  ⊘ Skipping (affectsBalance=false): ${tx.islemTipi} - ₺${tx.toplamTutar || tx.tutar || 0}`);
                return;
            }
            
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
                console.log(`  ${change > 0 ? '+' : ''}₺${change.toLocaleString('tr-TR')} - ${type} - ${tx.aciklama || 'No description'}`);
            }
        });
        
        const stored = Number(sezon.bakiye || 0);
        const diff = Math.abs(calc - stored);
        
        console.log('\n📊 BALANCE SUMMARY:');
        console.log(`  Account: ${sezon.unvan} (${sezon.id})`);
        console.log(`  Transactions counted: ${txCount}`);
        console.log(`  Database balance: ₺${stored.toLocaleString('tr-TR', {minimumFractionDigits:2, maximumFractionDigits:2})}`);
        console.log(`  Calculated balance: ₺${calc.toLocaleString('tr-TR', {minimumFractionDigits:2, maximumFractionDigits:2})}`);
        console.log(`  Difference: ₺${diff.toLocaleString('tr-TR', {minimumFractionDigits:2, maximumFractionDigits:2})}`);
        
        // Step 4: Update if needed
        if (diff > 0.01) {
            console.log('\n📋 Step 4: Updating balance in database...');
            await updateDoc(doc(db, 'cariler', sezon.id), {
                bakiye: calc,
                balanceAutoFixed: true,
                lastBalanceRecalculation: serverTimestamp(),
                autoFixReason: 'migration_debt_transfer_fix'
            });
            console.log(`✅ Balance updated: ₺${stored.toLocaleString('tr-TR')} → ₺${calc.toLocaleString('tr-TR')}`);
        } else {
            console.log('\n✅ Balance is already correct, no update needed!');
        }
        
        console.log('\n✨ Fix completed successfully!');
        console.log('🔄 Please REFRESH the page (F5) to see the updated balance.');
        
        const alertMsg = `✅ FIX COMPLETE!\n\n` +
            `Account: ${sezon.unvan}\n` +
            `Debt transfers fixed: ${fixed}\n` +
            `Transactions counted: ${txCount}\n` +
            `Old balance: ₺${stored.toLocaleString('tr-TR')}\n` +
            `New balance: ₺${calc.toLocaleString('tr-TR')}\n` +
            `Difference: ₺${diff.toLocaleString('tr-TR')}\n\n` +
            `Please REFRESH the page now!`;
        
        alert(alertMsg);
        
        return {
            success: true,
            account: sezon.unvan,
            accountId: sezon.id,
            debtTransfersFixed: fixed,
            transactionsCount: txCount,
            oldBalance: stored,
            newBalance: calc,
            difference: diff
        };
        
    } catch (error) {
        console.error('❌ ERROR:', error);
        alert('❌ Error: ' + error.message + '\n\nCheck console for details.');
        throw error;
    }
})();

