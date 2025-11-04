/**
 * Admin Console Utilities
 * 
 * Utilities that can be accessed via browser console for administrative tasks
 */

import { completeDebtTransferVisibilityFix, verifyBalancesAfterFix } from './debt-transfer-visibility-fix.js';

/**
 * Fix debt transfer visibility
 * Run from console: window.adminUtils.fixDebtTransferVisibility()
 */
export async function fixDebtTransferVisibility(dryRun = true) {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║   Borç Transferi Görünürlük Düzeltmesi                        ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('');
    
    if (dryRun) {
        console.log('⚠️  DRY RUN MODE - Hiçbir değişiklik yapılmayacak');
        console.log('Gerçek değişiklik yapmak için: window.adminUtils.fixDebtTransferVisibility(false)');
    } else {
        console.log('🔥 LIVE MODE - Değişiklikler veritabanına kaydedilecek!');
        const confirmed = confirm(
            '⚠️ DİKKAT!\n\n' +
            'Bu işlem tüm borç transferi kayıtlarını güncelleyecek.\n\n' +
            'Devam etmek istediğinize emin misiniz?'
        );
        
        if (!confirmed) {
            console.log('❌ İşlem iptal edildi');
            return;
        }
    }
    
    console.log('');
    console.log('⏳ İşlem başlıyor...');
    console.log('');
    
    try {
        const summary = await completeDebtTransferVisibilityFix(dryRun);
        
        console.log('');
        console.log('✅ İşlem tamamlandı!');
        console.log('');
        console.log('─────────────────────────────────────────────────────────────');
        console.log('📊 ÖZET:');
        console.log('─────────────────────────────────────────────────────────────');
        console.log(`Mod: ${summary.mode}`);
        console.log(`Süre: ${summary.duration}`);
        console.log(`Zaman: ${summary.timestamp}`);
        console.log('');
        
        if (summary.transactions) {
            const tx = summary.transactions;
            console.log('📝 İŞLEMLER:');
            console.log(`  • Toplam Borç Transferi: ${tx.total}`);
            console.log(`  • ${dryRun ? 'Düzeltilecek' : 'Düzeltildi'}: ${tx.fixed}`);
            console.log(`  • Zaten Doğru: ${tx.alreadyCorrect}`);
            console.log(`  • Hatalar: ${tx.errors.length}`);
            console.log('');
            
            if (tx.changes && tx.changes.length > 0) {
                console.log(`  Değişiklikler (ilk 5):`);
                tx.changes.slice(0, 5).forEach(change => {
                    console.log(`    - ${change.id}: ${change.updates.join(', ')}`);
                });
                if (tx.changes.length > 5) {
                    console.log(`    ... ve ${tx.changes.length - 5} tane daha`);
                }
                console.log('');
            }
        }
        
        if (summary.balances && summary.balances.length > 0) {
            console.log('⚠️  BAKİYE UYUMSUZLUKLARI:');
            summary.balances.forEach(mismatch => {
                console.log(`  • ${mismatch.accountName}:`);
                console.log(`    Veritabanı: ₺${mismatch.storedBalance.toLocaleString('tr-TR')}`);
                console.log(`    Hesaplanan: ₺${mismatch.calculatedBalance.toLocaleString('tr-TR')}`);
                console.log(`    Fark: ₺${mismatch.difference.toLocaleString('tr-TR')}`);
            });
            console.log('');
        }
        
        console.log('─────────────────────────────────────────────────────────────');
        
        if (dryRun) {
            console.log('');
            console.log('💡 Değişiklikleri uygulamak için:');
            console.log('   window.adminUtils.fixDebtTransferVisibility(false)');
        } else {
            console.log('');
            console.log('✨ Tüm borç transferi kayıtları artık İşlem Geçmişi\'nde görünecek!');
            console.log('');
            console.log('🔄 Sayfayı yenilemek için: location.reload()');
        }
        
        return summary;
    } catch (error) {
        console.error('');
        console.error('❌ HATA:', error);
        console.error('');
        throw error;
    }
}

/**
 * Verify balances
 * Run from console: window.adminUtils.verifyBalances()
 */
export async function verifyBalances() {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║   Bakiye Doğrulama                                             ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('⏳ Tüm hesaplar kontrol ediliyor...');
    console.log('');
    
    try {
        const mismatches = await verifyBalancesAfterFix();
        
        console.log('');
        console.log('✅ Kontrol tamamlandı!');
        console.log('');
        
        if (mismatches.length === 0) {
            console.log('🎉 Tüm bakiyeler doğru! Hiçbir uyumsuzluk bulunamadı.');
        } else {
            console.log(`⚠️  ${mismatches.length} hesapta bakiye uyumsuzluğu bulundu:`);
            console.log('');
            
            mismatches.forEach((mismatch, index) => {
                console.log(`${index + 1}. ${mismatch.accountName} (${mismatch.accountId}):`);
                console.log(`   Veritabanı: ₺${mismatch.storedBalance.toLocaleString('tr-TR')}`);
                console.log(`   Hesaplanan: ₺${mismatch.calculatedBalance.toLocaleString('tr-TR')}`);
                console.log(`   Fark: ₺${mismatch.difference.toLocaleString('tr-TR')}`);
                console.log(`   İşlem Sayısı: ${mismatch.transactionCount}`);
                console.log('');
            });
        }
        
        return mismatches;
    } catch (error) {
        console.error('');
        console.error('❌ HATA:', error);
        console.error('');
        throw error;
    }
}

/**
 * Show help
 */
export function help() {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║   Admin Console Utilities - Yardım                            ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('Kullanılabilir komutlar:');
    console.log('');
    console.log('1. Borç Transferi Görünürlük Düzeltmesi:');
    console.log('   window.adminUtils.fixDebtTransferVisibility()      // Önizleme (dry run)');
    console.log('   window.adminUtils.fixDebtTransferVisibility(false) // Gerçek uygulama');
    console.log('');
    console.log('2. Bakiye Doğrulama:');
    console.log('   window.adminUtils.verifyBalances()');
    console.log('');
    console.log('3. Yardım:');
    console.log('   window.adminUtils.help()');
    console.log('');
    console.log('─────────────────────────────────────────────────────────────');
}

// Export all utilities
export default {
    fixDebtTransferVisibility,
    verifyBalances,
    help
};

