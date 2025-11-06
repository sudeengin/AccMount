// Fix ALL Accounts - Comprehensive Balance Fix
// Fixes debt transfers and recalculates all account balances

(async function() {
    console.log('🔧 Starting comprehensive balance fix for ALL accounts...');
    
    const { getDocs, collection, writeBatch, doc, updateDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
    const { db } = await import('./src/services/firebase.js');
    
    try {
        // Step 1: Fix all debt transfers
        console.log('\n📋 Step 1: Fixing debt transfers...');
        const txRef = collection(db, 'islemler');
        const txSnap = await getDocs(txRef);
        const batch = writeBatch(db);
        let fixedDebtTransfers = 0;
        const allTx = [];
        
        txSnap.forEach(d => {
            const data = d.data();
            allTx.push({ id: d.id, ...data });
            const type = String(data.islemTipi || '').toLowerCase();
            if ((type === 'borç transferi' || type === 'borc transferi') && data.affectsBalance !== true) {
                batch.update(doc(db, 'islemler', d.id), { affectsBalance: true });
                fixedDebtTransfers++;
                console.log(`  ✓ Fixed: ${data.aciklama || d.id}`);
            }
        });
        
        if (fixedDebtTransfers > 0) {
            await batch.commit();
            console.log(`✅ Fixed ${fixedDebtTransfers} debt transfer(s)`);
        } else {
            console.log('  ℹ️ No debt transfers needed fixing');
        }
        
        // Step 2: Get all active accounts
        console.log('\n📋 Step 2: Loading all active accounts...');
        const accRef = collection(db, 'cariler');
        const accSnap = await getDocs(accRef);
        const allAccounts = [];
        
        accSnap.forEach(d => {
            const data = d.data();
            const status = (data.durum || '').toLowerCase();
            const isActive = status !== 'deleted' && status !== 'archived';
            if (isActive) {
                allAccounts.push({ id: d.id, ...data });
            }
        });
        
        console.log(`  Found ${allAccounts.length} active account(s)`);
        
        // Step 3: Calculate and fix balances for all accounts
        console.log('\n📋 Step 3: Recalculating balances for all accounts...');
        const balanceUpdates = [];
        let accountsWithMismatch = 0;
        let totalDifference = 0;
        
        allAccounts.forEach(account => {
            const accountId = account.id;
            let calculatedBalance = 0;
            
            // Calculate balance from transactions
            allTx.forEach(tx => {
                if (tx.isDeleted) return;
                
                // Check if transaction involves this account
                const isRelevant = tx.islemCari === accountId || 
                                 tx.kaynakCari === accountId || 
                                 tx.hedefCari === accountId;
                if (!isRelevant) return;
                
                // Check if affects balance
                const affectsBalance = tx.affectsBalance !== false;
                if (!affectsBalance) return;
                
                const amt = Math.abs(Number(tx.toplamTutar || tx.tutar || 0));
                const type = String(tx.islemTipi || '').toLowerCase();
                const isDT = type === 'borç transferi' || type === 'borc transferi';
                
                let change = 0;
                if (isDT) {
                    if (tx.islemCari === accountId) change = 0;
                    else if (tx.kaynakCari === accountId) change = -amt;
                    else if (tx.hedefCari === accountId) change = amt;
                } else if (tx.islemCari === accountId) {
                    if (type === 'gelir') change = amt;
                    else if (type === 'gider') change = -amt;
                    else if (type === 'administrative_reset') change = amt;
                } else if (tx.kaynakCari === accountId) {
                    change = -amt;
                } else if (tx.hedefCari === accountId) {
                    change = amt;
                }
                
                calculatedBalance += change;
            });
            
            const storedBalance = Number(account.bakiye || 0);
            const diff = Math.abs(calculatedBalance - storedBalance);
            
            if (diff > 0.01) {
                accountsWithMismatch++;
                totalDifference += diff;
                balanceUpdates.push({
                    id: accountId,
                    name: account.unvan,
                    oldBalance: storedBalance,
                    newBalance: calculatedBalance,
                    difference: diff
                });
                
                console.log(`  ⚠️ ${account.unvan}:`);
                console.log(`     DB: ₺${storedBalance.toLocaleString('tr-TR', {minimumFractionDigits:2})}`);
                console.log(`     Calculated: ₺${calculatedBalance.toLocaleString('tr-TR', {minimumFractionDigits:2})}`);
                console.log(`     Diff: ₺${diff.toLocaleString('tr-TR', {minimumFractionDigits:2})}`);
            }
        });
        
        console.log(`\n  Found ${accountsWithMismatch} account(s) with balance mismatch`);
        console.log(`  Total difference: ₺${totalDifference.toLocaleString('tr-TR', {minimumFractionDigits:2})}`);
        
        // Step 4: Update all accounts with mismatches
        if (balanceUpdates.length > 0) {
            console.log('\n📋 Step 4: Updating balances in database...');
            
            // Firestore batch limit is 500, so we'll batch them
            const batchSize = 400;
            for (let i = 0; i < balanceUpdates.length; i += batchSize) {
                const batchUpdates = balanceUpdates.slice(i, i + batchSize);
                const updateBatch = writeBatch(db);
                
                batchUpdates.forEach(update => {
                    const accDocRef = doc(db, 'cariler', update.id);
                    updateBatch.update(accDocRef, {
                        bakiye: update.newBalance,
                        balanceAutoFixed: true,
                        lastBalanceRecalculation: serverTimestamp(),
                        autoFixReason: 'comprehensive_migration_fix'
                    });
                });
                
                await updateBatch.commit();
                console.log(`  ✓ Updated batch ${Math.floor(i / batchSize) + 1} (${batchUpdates.length} accounts)`);
            }
            
            console.log(`✅ Updated ${balanceUpdates.length} account balance(s)`);
        } else {
            console.log('\n✅ All balances are already correct!');
        }
        
        // Summary
        console.log('\n═══════════════════════════════════════');
        console.log('📊 FIX SUMMARY');
        console.log('═══════════════════════════════════════');
        console.log(`Debt transfers fixed: ${fixedDebtTransfers}`);
        console.log(`Accounts checked: ${allAccounts.length}`);
        console.log(`Accounts updated: ${balanceUpdates.length}`);
        console.log(`Total difference corrected: ₺${totalDifference.toLocaleString('tr-TR', {minimumFractionDigits:2})}`);
        console.log('═══════════════════════════════════════');
        
        if (balanceUpdates.length > 0) {
            console.log('\n📋 Updated accounts:');
            balanceUpdates.forEach(update => {
                console.log(`  • ${update.name}: ₺${update.oldBalance.toLocaleString('tr-TR')} → ₺${update.newBalance.toLocaleString('tr-TR')}`);
            });
        }
        
        console.log('\n✨ All fixes completed successfully!');
        console.log('🔄 Please REFRESH the page to see the updated balances.');
        
        const alertMsg = `✅ TÜM HESAPLAR DÜZELTİLDİ!\n\n` +
            `Borç transferleri düzeltildi: ${fixedDebtTransfers}\n` +
            `Kontrol edilen hesap: ${allAccounts.length}\n` +
            `Güncellenen hesap: ${balanceUpdates.length}\n` +
            `Toplam düzeltilen fark: ₺${totalDifference.toLocaleString('tr-TR')}\n\n` +
            `Sayfayı YENİLEYİN (F5)!`;
        
        alert(alertMsg);
        
        return {
            success: true,
            debtTransfersFixed: fixedDebtTransfers,
            accountsChecked: allAccounts.length,
            accountsUpdated: balanceUpdates.length,
            totalDifference,
            updates: balanceUpdates
        };
        
    } catch (error) {
        console.error('❌ ERROR:', error);
        alert('❌ Hata: ' + error.message);
        throw error;
    }
})();

