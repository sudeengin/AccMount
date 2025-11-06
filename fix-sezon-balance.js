/**
 * Fix Sezon Tekstil Balance Issue
 * 
 * This script:
 * 1. Sets affectsBalance = true for all migrated debt transfers
 * 2. Recalculates Sezon Tekstil's balance from transactions
 * 3. Updates the database with the correct balance
 * 
 * Run this in the browser console while on the main app page.
 */

(async function fixSezonBalance() {
    console.log('🔧 Starting Sezon Tekstil balance fix...');
    
    try {
        // Import Firebase functions from the window (already loaded in your app)
        const { getDocs, collection, writeBatch, doc, query, where, updateDoc } = window;
        const db = window.db;
        
        if (!db) {
            throw new Error('Firebase database not found. Make sure you run this on the main app page.');
        }
        
        // Step 1: Fix all debt transfers with affectsBalance issue
        console.log('\n📋 Step 1: Fixing debt transfer affectsBalance flags...');
        const transactionsRef = collection(db, 'islemler');
        const allTransactionsSnapshot = await getDocs(transactionsRef);
        
        const batch = writeBatch(db);
        let fixedDebtTransfers = 0;
        const allTransactions = [];
        
        allTransactionsSnapshot.forEach(docSnap => {
            const data = docSnap.data();
            const transaction = { id: docSnap.id, ...data };
            allTransactions.push(transaction);
            
            const type = String(data.islemTipi || '').toLowerCase().trim();
            const isDebtTransfer = type === 'borç transferi' || type === 'borc transferi' || type === 'debt_transfer';
            
            if (isDebtTransfer && data.affectsBalance !== true) {
                const txRef = doc(db, 'islemler', docSnap.id);
                batch.update(txRef, { affectsBalance: true });
                fixedDebtTransfers++;
                console.log(`  ✓ Fixed debt transfer: ${data.aciklama || docSnap.id} (₺${data.toplamTutar || data.tutar || 0})`);
            }
        });
        
        if (fixedDebtTransfers > 0) {
            await batch.commit();
            console.log(`✅ Fixed ${fixedDebtTransfers} debt transfer transaction(s)`);
        } else {
            console.log('  ℹ️ No debt transfers needed fixing');
        }
        
        // Step 2: Find Sezon Tekstil account
        console.log('\n📋 Step 2: Finding Sezon Tekstil account...');
        const accountsRef = collection(db, 'cariler');
        const accountsSnapshot = await getDocs(accountsRef);
        
        let sezonAccount = null;
        accountsSnapshot.forEach(docSnap => {
            const data = docSnap.data();
            const unvan = (data.unvan || '').toLowerCase();
            if (unvan.includes('sezon') && unvan.includes('tekstil')) {
                sezonAccount = { id: docSnap.id, ...data };
            }
        });
        
        if (!sezonAccount) {
            throw new Error('Sezon Tekstil account not found!');
        }
        
        console.log(`  ✓ Found: ${sezonAccount.unvan} (ID: ${sezonAccount.id})`);
        
        // Step 3: Calculate correct balance for Sezon Tekstil
        console.log('\n📋 Step 3: Calculating correct balance from transactions...');
        const sezonId = sezonAccount.id;
        let calculatedBalance = 0;
        const relevantTransactions = [];
        
        allTransactions.forEach(tx => {
            // Skip deleted transactions
            if (tx.isDeleted) return;
            
            // Check if transaction involves Sezon
            const isRelevant = tx.islemCari === sezonId || 
                             tx.kaynakCari === sezonId || 
                             tx.hedefCari === sezonId;
            
            if (!isRelevant) return;
            
            // Only include transactions that affect balance
            const affectsBalance = tx.affectsBalance !== false;
            if (!affectsBalance) return;
            
            relevantTransactions.push(tx);
            
            // Calculate net change using the same logic as getCariNetChange
            const amount = Math.abs(Number(tx.toplamTutar || tx.tutar || 0));
            const type = String(tx.islemTipi || '').toLowerCase().trim();
            const isDebtTransfer = type === 'borç transferi' || type === 'borc transferi' || type === 'debt_transfer';
            
            let change = 0;
            
            if (isDebtTransfer) {
                // Debt transfer logic
                if (tx.islemCari === sezonId) {
                    change = 0; // Debtor
                } else if (tx.kaynakCari === sezonId) {
                    change = -amount; // New creditor (lender)
                } else if (tx.hedefCari === sezonId) {
                    change = +amount; // Old creditor (settled)
                }
            } else if (tx.islemCari === sezonId) {
                // Income/Expense
                if (type === 'gelir') {
                    change = amount;
                } else if (type === 'gider') {
                    change = -amount;
                } else if (type === 'administrative_reset') {
                    change = amount;
                }
            } else if (tx.kaynakCari === sezonId) {
                // Outgoing transfer
                change = -amount;
            } else if (tx.hedefCari === sezonId) {
                // Incoming transfer
                change = amount;
            }
            
            calculatedBalance += change;
            
            if (change !== 0) {
                console.log(`  ${change > 0 ? '+' : ''}₺${change.toLocaleString('tr-TR')} - ${tx.islemTipi} - ${tx.aciklama || 'No description'}`);
            }
        });
        
        const storedBalance = Number(sezonAccount.bakiye || 0);
        const balanceDiff = calculatedBalance - storedBalance;
        
        console.log('\n📊 Balance Summary:');
        console.log(`  Database balance: ₺${storedBalance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`);
        console.log(`  Calculated balance: ₺${calculatedBalance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`);
        console.log(`  Difference: ₺${Math.abs(balanceDiff).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`);
        console.log(`  Transactions analyzed: ${relevantTransactions.length}`);
        
        // Step 4: Update balance if there's a mismatch
        if (Math.abs(balanceDiff) > 0.01) {
            console.log('\n📋 Step 4: Updating balance in database...');
            
            const accountRef = doc(db, 'cariler', sezonId);
            await updateDoc(accountRef, {
                bakiye: calculatedBalance,
                balanceAutoFixed: true,
                lastBalanceRecalculation: new Date(),
                autoFixReason: 'migration_debt_transfer_fix'
            });
            
            console.log(`✅ Balance updated: ₺${storedBalance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} → ₺${calculatedBalance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`);
        } else {
            console.log('\n✅ Balance is already correct, no update needed!');
        }
        
        console.log('\n✨ All fixes completed successfully!');
        console.log('🔄 Please refresh the page to see the updated balance.');
        
        return {
            success: true,
            debtTransfersFixed: fixedDebtTransfers,
            account: sezonAccount.unvan,
            oldBalance: storedBalance,
            newBalance: calculatedBalance,
            difference: balanceDiff
        };
        
    } catch (error) {
        console.error('❌ Error:', error);
        throw error;
    }
})();

