// KESIN ÇÖZÜM - Sezon Tekstil Balance Fix
// Bu kodu kopyala ve konsola yapıştır

(async function() {
    console.log('🔧 BAŞLIYOR: Sezon Tekstil düzeltme...\n');
    
    const { getDocs, collection, doc, updateDoc, serverTimestamp, writeBatch } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
    const { db } = await import('./src/services/firebase.js');
    
    try {
        // ADIM 1: TÜM Sezon hesaplarını listele
        console.log('📋 ADIM 1: Sezon hesaplarını arıyor...');
        const accSnap = await getDocs(collection(db, 'cariler'));
        const sezonAccounts = [];
        
        accSnap.forEach(d => {
            const data = d.data();
            const unvan = (data.unvan || '').toLowerCase();
            if (unvan.includes('sezon')) {
                sezonAccounts.push({
                    id: d.id,
                    unvan: data.unvan,
                    durum: data.durum || 'active',
                    bakiye: data.bakiye || 0
                });
            }
        });
        
        console.log(`\nBulunan Sezon hesapları: ${sezonAccounts.length}`);
        sezonAccounts.forEach(acc => {
            console.log(`  - ${acc.unvan}: durum=${acc.durum}, bakiye=₺${acc.bakiye.toLocaleString('tr-TR')}`);
        });
        
        // Aktif olanı seç
        const activeSezon = sezonAccounts.find(acc => {
            const status = (acc.durum || '').toLowerCase();
            return status !== 'deleted' && status !== 'archived';
        });
        
        if (!activeSezon) {
            alert('❌ Aktif Sezon Tekstil bulunamadı!');
            return;
        }
        
        console.log(`\n✓ SEÇILDI: ${activeSezon.unvan} (ID: ${activeSezon.id})`);
        console.log(`  Mevcut DB bakiyesi: ₺${activeSezon.bakiye.toLocaleString('tr-TR', {minimumFractionDigits:2})}`);
        
        // ADIM 2: Borç transferlerini düzelt
        console.log('\n📋 ADIM 2: Borç transferlerini düzeltiyor...');
        const txSnap = await getDocs(collection(db, 'islemler'));
        const batch = writeBatch(db);
        let fixedCount = 0;
        const allTx = [];
        
        txSnap.forEach(d => {
            const data = d.data();
            allTx.push({ id: d.id, ...data });
            
            const type = String(data.islemTipi || '').toLowerCase();
            const isDT = type === 'borç transferi' || type === 'borc transferi';
            
            if (isDT && data.affectsBalance !== true) {
                batch.update(doc(db, 'islemler', d.id), { affectsBalance: true });
                fixedCount++;
                console.log(`  ✓ Düzeltildi: ${data.aciklama || d.id}`);
            }
        });
        
        if (fixedCount > 0) {
            await batch.commit();
            console.log(`✅ ${fixedCount} borç transferi düzeltildi\n`);
        } else {
            console.log(`  ℹ️ Düzeltilecek borç transferi yok\n`);
        }
        
        // ADIM 3: Sezon'un bakiyesini yeniden hesapla
        console.log('📋 ADIM 3: Bakiye yeniden hesaplanıyor...');
        let calculatedBalance = 0;
        let txCount = 0;
        
        console.log('\nİşlemler:');
        allTx.forEach(tx => {
            if (tx.isDeleted) return;
            
            // Bu işlem Sezon ile ilgili mi?
            const isRelevant = tx.islemCari === activeSezon.id || 
                             tx.kaynakCari === activeSezon.id || 
                             tx.hedefCari === activeSezon.id;
            if (!isRelevant) return;
            
            // affectsBalance kontrolü
            const affectsBalance = tx.affectsBalance !== false;
            if (!affectsBalance) {
                console.log(`  ⊘ Atlandı (affectsBalance=false): ${tx.islemTipi} - ₺${tx.toplamTutar || tx.tutar || 0}`);
                return;
            }
            
            const amt = Math.abs(Number(tx.toplamTutar || tx.tutar || 0));
            const type = String(tx.islemTipi || '').toLowerCase();
            const isDT = type === 'borç transferi' || type === 'borc transferi';
            
            let change = 0;
            
            if (isDT) {
                if (tx.islemCari === activeSezon.id) change = 0;
                else if (tx.kaynakCari === activeSezon.id) change = -amt;
                else if (tx.hedefCari === activeSezon.id) change = amt;
            } else if (tx.islemCari === activeSezon.id) {
                if (type === 'gelir') change = amt;
                else if (type === 'gider') change = -amt;
                else if (type === 'administrative_reset') change = amt;
            } else if (tx.kaynakCari === activeSezon.id) {
                change = -amt;
            } else if (tx.hedefCari === activeSezon.id) {
                change = amt;
            }
            
            if (change !== 0) {
                calculatedBalance += change;
                txCount++;
                console.log(`  ${change > 0 ? '+' : ''}₺${change.toLocaleString('tr-TR')} - ${type}`);
            }
        });
        
        console.log(`\n📊 ÖZET:`);
        console.log(`  İşlem sayısı: ${txCount}`);
        console.log(`  DB'deki bakiye: ₺${activeSezon.bakiye.toLocaleString('tr-TR', {minimumFractionDigits:2})}`);
        console.log(`  Hesaplanan: ₺${calculatedBalance.toLocaleString('tr-TR', {minimumFractionDigits:2})}`);
        console.log(`  Fark: ₺${Math.abs(calculatedBalance - activeSezon.bakiye).toLocaleString('tr-TR', {minimumFractionDigits:2})}`);
        
        // ADIM 4: Bakiyeyi güncelle
        const diff = Math.abs(calculatedBalance - activeSezon.bakiye);
        if (diff > 0.01) {
            console.log('\n📋 ADIM 4: Bakiye güncelleniyor...');
            await updateDoc(doc(db, 'cariler', activeSezon.id), {
                bakiye: calculatedBalance,
                balanceAutoFixed: true,
                lastBalanceRecalculation: serverTimestamp()
            });
            console.log(`✅ Güncellendi: ₺${activeSezon.bakiye.toLocaleString('tr-TR')} → ₺${calculatedBalance.toLocaleString('tr-TR')}`);
        } else {
            console.log('\n✅ Bakiye zaten doğru!');
        }
        
        alert(`✅ TAMAMLANDI!\n\nHesap: ${activeSezon.unvan}\nBorç transferi düzeltildi: ${fixedCount}\nİşlem sayısı: ${txCount}\nEski bakiye: ₺${activeSezon.bakiye.toLocaleString('tr-TR')}\nYeni bakiye: ₺${calculatedBalance.toLocaleString('tr-TR')}\n\nŞimdi F5 ile sayfayı yenile!`);
        
    } catch (error) {
        console.error('❌ HATA:', error);
        alert('❌ HATA: ' + error.message);
    }
})();

