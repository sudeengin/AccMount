/**
 * Debt Transfer Recovery View
 * 
 * UI for recovering hidden debt transfer transactions
 * This ensures ALL existing borç transferi transactions are visible in İşlem Geçmişi
 */

import { 
    findAllDebtTransfers,
    analyzeDebtTransferFix,
    fixAllDebtTransfers,
    verifyBalancesAfterFix,
    completeDebtTransferVisibilityFix 
} from '../../utils/debt-transfer-visibility-fix.js';

let currentRoot = null;
let mounted = false;

const state = {
    loading: false,
    error: null,
    debtTransfers: [],
    fixSummary: null,
    balanceVerification: null,
    lastFixDate: null
};

function logError(error) {
    console.error('[recovery:error]', error);
}

/**
 * Render the recovery view
 */
function render() {
    if (!currentRoot) return;
    
    currentRoot.innerHTML = `
        <div class="p-6">
            <!-- Header -->
            <div class="mb-6">
                <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    🔍 Borç Transferi Görünürlük Kurtarma
                </h2>
                <p class="text-sm text-gray-600 dark:text-gray-400">
                    Tüm mevcut borç transferi işlemlerini İşlem Geçmişi'nde görünür hale getirin
                </p>
            </div>
            
            <!-- Info Banner -->
            <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
                <div class="flex items-start gap-3">
                    <svg class="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
                    </svg>
                    <div class="flex-1">
                        <h3 class="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-1">
                            Bu Araç Neyi Düzeltir?
                        </h3>
                        <ul class="text-xs text-blue-700 dark:text-blue-300 list-disc list-inside space-y-1">
                            <li>affectsBalance = false olan borç transferlerini affectsBalance = true yapar</li>
                            <li>isLog = true veya recordType = 'log' işaretli kayıtları gerçek işlemlere dönüştürür</li>
                            <li>Tüm borç transferlerinin İşlem Geçmişi'nde görünmesini sağlar</li>
                            <li>Bakiyelerin doğru hesaplandığını doğrular</li>
                            <li>Hiçbir veri silinmez, sadece görünürlük bayrakları düzeltilir</li>
                        </ul>
                    </div>
                </div>
            </div>
            
            <!-- Statistics -->
            <div id="recoveryStats" class="mb-6">
                ${renderStats()}
            </div>
            
            <!-- Action Buttons -->
            <div class="flex flex-wrap gap-3 mb-6">
                <button 
                    id="scanBtn" 
                    class="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    ${state.loading ? 'disabled' : ''}
                >
                    🔍 Borç Transferlerini Tara
                </button>
                <button 
                    id="previewFixBtn" 
                    class="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    ${state.loading || state.debtTransfers.length === 0 ? 'disabled' : ''}
                >
                    👁️ Önizleme (Dry Run)
                </button>
                <button 
                    id="applyFixBtn" 
                    class="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    ${state.loading || state.debtTransfers.length === 0 ? 'disabled' : ''}
                >
                    ✅ Düzeltmeyi Uygula
                </button>
                <button 
                    id="verifyBalancesBtn" 
                    class="px-4 py-2 bg-cyan-600 text-white rounded-lg font-medium hover:bg-cyan-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    ${state.loading ? 'disabled' : ''}
                >
                    📊 Bakiyeleri Doğrula
                </button>
                <button 
                    id="quickRecoverBtn" 
                    class="px-4 py-2 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    ${state.loading ? 'disabled' : ''}
                    title="Co Denim Yılmaz & Ünal ve Sezon Tekstil için hızlı kurtarma"
                >
                    ⚡ Hızlı Kurtarma (Co Denim & Sezon)
                </button>
            </div>
            
            <!-- Results Panel -->
            <div id="resultsPanel" class="space-y-4">
                ${renderResults()}
            </div>
        </div>
    `;
    
    // Attach event listeners
    attachEventListeners();
}

function renderStats() {
    if (!state.debtTransfers.length) {
        return '<div class="text-sm text-gray-500 dark:text-gray-400">Borç transferleri taramak için "Tara" butonuna tıklayın.</div>';
    }
    
    const needsFixCount = state.debtTransfers.filter(tx => {
        const updates = analyzeDebtTransferFix(tx);
        return updates !== null;
    }).length;
    
    const alreadyCorrect = state.debtTransfers.length - needsFixCount;
    
    return `
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div class="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    ${state.debtTransfers.length}
                </div>
                <div class="text-sm text-gray-600 dark:text-gray-400">Toplam Borç Transferi</div>
            </div>
            <div class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <div class="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                    ${needsFixCount}
                </div>
                <div class="text-sm text-gray-600 dark:text-gray-400">Düzeltme Gerekli</div>
            </div>
            <div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <div class="text-2xl font-bold text-green-600 dark:text-green-400">
                    ${alreadyCorrect}
                </div>
                <div class="text-sm text-gray-600 dark:text-gray-400">Zaten Doğru</div>
            </div>
        </div>
    `;
}

function renderResults() {
    if (state.loading) {
        return `
            <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 text-center">
                <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p class="text-gray-600 dark:text-gray-400">Yükleniyor...</p>
            </div>
        `;
    }
    
    if (state.error) {
        return `
            <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <div class="flex items-start gap-3">
                    <svg class="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
                    </svg>
                    <div>
                        <h3 class="text-sm font-semibold text-red-800 dark:text-red-200 mb-1">Hata</h3>
                        <p class="text-xs text-red-700 dark:text-red-300">${state.error}</p>
                    </div>
                </div>
            </div>
        `;
    }
    
    if (state.fixSummary) {
        return renderFixSummary();
    }
    
    if (state.balanceVerification) {
        return renderBalanceVerification();
    }
    
    return '';
}

function renderFixSummary() {
    if (!state.fixSummary) return '';
    
    const { transactions: tx, balances, mode } = state.fixSummary;
    
    return `
        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-4">
                ${mode === 'DRY_RUN' ? '📋 Önizleme Sonuçları' : '✅ Düzeltme Tamamlandı'}
            </h3>
            
            <div class="space-y-4">
                <!-- Transaction Summary -->
                <div class="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                    <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">İşlem Özeti</h4>
                    <div class="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <span class="text-gray-600 dark:text-gray-400">Toplam Borç Transferi:</span>
                            <span class="ml-2 font-bold text-gray-900 dark:text-white">${tx.total}</span>
                        </div>
                        <div>
                            <span class="text-gray-600 dark:text-gray-400">${mode === 'DRY_RUN' ? 'Düzeltilecek:' : 'Düzeltildi:'}</span>
                            <span class="ml-2 font-bold text-green-600 dark:text-green-400">${tx.fixed}</span>
                        </div>
                        <div>
                            <span class="text-gray-600 dark:text-gray-400">Zaten Doğru:</span>
                            <span class="ml-2 font-bold text-blue-600 dark:text-blue-400">${tx.alreadyCorrect}</span>
                        </div>
                        <div>
                            <span class="text-gray-600 dark:text-gray-400">Hatalar:</span>
                            <span class="ml-2 font-bold ${tx.errors.length > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}">${tx.errors.length}</span>
                        </div>
                    </div>
                </div>
                
                <!-- Changes List -->
                ${tx.changes && tx.changes.length > 0 ? `
                    <div class="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                        <h4 class="text-sm font-semibold text-purple-700 dark:text-purple-300 mb-2">
                            Değişiklikler (İlk 10)
                        </h4>
                        <div class="space-y-2 text-xs">
                            ${tx.changes.slice(0, 10).map(change => `
                                <div class="flex items-start gap-2">
                                    <span class="text-purple-600 dark:text-purple-400">•</span>
                                    <div class="flex-1">
                                        <div class="font-mono text-purple-900 dark:text-purple-100">${change.id.substring(0, 8)}...</div>
                                        <div class="text-purple-700 dark:text-purple-300">
                                            ${change.updates.join(', ')}
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                            ${tx.changes.length > 10 ? `
                                <div class="text-purple-600 dark:text-purple-400 text-center pt-2">
                                    ... ve ${tx.changes.length - 10} tane daha
                                </div>
                            ` : ''}
                        </div>
                    </div>
                ` : ''}
                
                <!-- Balance Verification -->
                ${balances && balances.length > 0 ? `
                    <div class="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
                        <h4 class="text-sm font-semibold text-yellow-700 dark:text-yellow-300 mb-2">
                            ⚠️ Bakiye Uyumsuzlukları Bulundu
                        </h4>
                        <div class="space-y-2 text-xs">
                            ${balances.slice(0, 5).map(mismatch => `
                                <div class="bg-white dark:bg-gray-800 rounded p-2">
                                    <div class="font-semibold text-gray-900 dark:text-white">${mismatch.accountName}</div>
                                    <div class="text-gray-600 dark:text-gray-400">
                                        Veritabanı: ₺${mismatch.storedBalance.toLocaleString('tr-TR')} • 
                                        Hesaplanan: ₺${mismatch.calculatedBalance.toLocaleString('tr-TR')} • 
                                        Fark: ₺${mismatch.difference.toLocaleString('tr-TR')}
                                    </div>
                                </div>
                            `).join('')}
                            ${balances.length > 5 ? `
                                <div class="text-yellow-600 dark:text-yellow-400 text-center pt-2">
                                    ... ve ${balances.length - 5} hesap daha
                                </div>
                            ` : ''}
                        </div>
                    </div>
                ` : balances ? `
                    <div class="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                        <div class="flex items-center gap-2 text-green-700 dark:text-green-300">
                            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                            </svg>
                            <span class="text-sm font-semibold">Tüm Bakiyeler Doğru!</span>
                        </div>
                    </div>
                ` : ''}
                
                ${mode === 'DRY_RUN' ? `
                    <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                        <p class="text-sm text-blue-800 dark:text-blue-200">
                            💡 Bu sadece bir önizleme. Değişiklikleri uygulamak için "Düzeltmeyi Uygula" butonuna tıklayın.
                        </p>
                    </div>
                ` : `
                    <div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                        <p class="text-sm text-green-800 dark:text-green-200">
                            ✨ Tüm borç transferi kayıtları artık İşlem Geçmişi'nde görünecek! Sayfayı yenilemek için F5'e basın.
                        </p>
                    </div>
                `}
            </div>
        </div>
    `;
}

function renderBalanceVerification() {
    if (!state.balanceVerification) return '';
    
    const mismatches = state.balanceVerification;
    
    return `
        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-4">
                📊 Bakiye Doğrulama Sonuçları
            </h3>
            
            ${mismatches.length === 0 ? `
                <div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                    <div class="flex items-center gap-3">
                        <svg class="w-8 h-8 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                        </svg>
                        <div>
                            <h4 class="text-sm font-semibold text-green-800 dark:text-green-200">
                                🎉 Mükemmel! Tüm bakiyeler doğru!
                            </h4>
                            <p class="text-xs text-green-700 dark:text-green-300 mt-1">
                                Hiçbir hesapta bakiye uyumsuzluğu bulunamadı.
                            </p>
                        </div>
                    </div>
                </div>
            ` : `
                <div class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
                    <p class="text-sm text-yellow-800 dark:text-yellow-200">
                        ⚠️ ${mismatches.length} hesapta bakiye uyumsuzluğu bulundu
                    </p>
                </div>
                
                <div class="space-y-3">
                    ${mismatches.map((mismatch, index) => `
                        <div class="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                            <div class="flex items-start justify-between mb-2">
                                <h4 class="font-semibold text-gray-900 dark:text-white">
                                    ${index + 1}. ${mismatch.accountName}
                                </h4>
                                <span class="text-xs font-mono text-gray-500 dark:text-gray-400">
                                    ${mismatch.accountId.substring(0, 8)}...
                                </span>
                            </div>
                            <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                <div>
                                    <div class="text-xs text-gray-500 dark:text-gray-400">Veritabanı</div>
                                    <div class="font-semibold text-gray-900 dark:text-white">
                                        ₺${mismatch.storedBalance.toLocaleString('tr-TR')}
                                    </div>
                                </div>
                                <div>
                                    <div class="text-xs text-gray-500 dark:text-gray-400">Hesaplanan</div>
                                    <div class="font-semibold text-gray-900 dark:text-white">
                                        ₺${mismatch.calculatedBalance.toLocaleString('tr-TR')}
                                    </div>
                                </div>
                                <div>
                                    <div class="text-xs text-gray-500 dark:text-gray-400">Fark</div>
                                    <div class="font-semibold text-red-600 dark:text-red-400">
                                        ₺${mismatch.difference.toLocaleString('tr-TR')}
                                    </div>
                                </div>
                                <div>
                                    <div class="text-xs text-gray-500 dark:text-gray-400">İşlem Sayısı</div>
                                    <div class="font-semibold text-gray-900 dark:text-white">
                                        ${mismatch.transactionCount}
                                    </div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `}
        </div>
    `;
}

async function handleScan() {
    state.loading = true;
    state.error = null;
    state.fixSummary = null;
    state.balanceVerification = null;
    render();
    
    try {
        state.debtTransfers = await findAllDebtTransfers();
        console.log(`[Recovery] Borç ${state.debtTransfers.length} borç transferi bulundu`);
        state.loading = false;
        render();
    } catch (error) {
        logError(error);
        state.error = error.message || 'Tarama sırasında bir hata oluştu';
        state.loading = false;
        render();
    }
}

async function handlePreviewFix() {
    state.loading = true;
    state.error = null;
    state.fixSummary = null;
    render();
    
    try {
        const summary = await completeDebtTransferVisibilityFix(true); // dry run
        state.fixSummary = summary;
        state.loading = false;
        render();
    } catch (error) {
        logError(error);
        state.error = error.message || 'Önizleme sırasında bir hata oluştu';
        state.loading = false;
        render();
    }
}

async function handleApplyFix() {
    const confirmed = confirm(
        '⚠️ DİKKAT!\n\n' +
        'Tüm borç transferi kayıtlarını güncellemek üzeresiniz.\n\n' +
        'Bu işlem:\n' +
        '• affectsBalance bayrağını true olarak ayarlayacak\n' +
        '• Sistem log bayraklarını kaldıracak\n' +
        '• Tüm borç transferlerini görünür hale getirecek\n\n' +
        'Devam etmek istediğinize emin misiniz?'
    );
    
    if (!confirmed) return;
    
    state.loading = true;
    state.error = null;
    state.fixSummary = null;
    render();
    
    try {
        const summary = await completeDebtTransferVisibilityFix(false); // live run
        state.fixSummary = summary;
        state.lastFixDate = new Date();
        state.loading = false;
        render();
        
        // Optionally reload data
        setTimeout(() => {
            if (confirm('Düzeltme tamamlandı! Değişiklikleri görmek için sayfayı yenilemek ister misiniz?')) {
                window.location.reload();
            }
        }, 1000);
    } catch (error) {
        logError(error);
        state.error = error.message || 'Düzeltme sırasında bir hata oluştu';
        state.loading = false;
        render();
    }
}

async function handleVerifyBalances() {
    state.loading = true;
    state.error = null;
    state.balanceVerification = null;
    state.fixSummary = null;
    render();
    
    try {
        const mismatches = await verifyBalancesAfterFix();
        state.balanceVerification = mismatches;
        state.loading = false;
        render();
    } catch (error) {
        logError(error);
        state.error = error.message || 'Bakiye doğrulama sırasında bir hata oluştu';
        state.loading = false;
        render();
    }
}

async function handleQuickRecover() {
    const confirmed = confirm(
        '⚡ Hızlı Kurtarma\n\n' +
        'Bu işlem özellikle şu hesaplar için borç transferlerini kontrol edecek:\n' +
        '• Co Denim Yılmaz & Ünal\n' +
        '• Sezon Tekstil\n\n' +
        'Eksik görünen tüm borç transferleri (₺114,000 transferi dahil) geri yüklenecek.\n\n' +
        'Devam etmek istiyor musunuz?'
    );
    
    if (!confirmed) return;
    
    // Run the full fix which will recover all transfers
    await handleApplyFix();
}

function attachEventListeners() {
    const scanBtn = currentRoot?.querySelector('#scanBtn');
    const previewFixBtn = currentRoot?.querySelector('#previewFixBtn');
    const applyFixBtn = currentRoot?.querySelector('#applyFixBtn');
    const verifyBalancesBtn = currentRoot?.querySelector('#verifyBalancesBtn');
    const quickRecoverBtn = currentRoot?.querySelector('#quickRecoverBtn');
    
    if (scanBtn) scanBtn.addEventListener('click', handleScan);
    if (previewFixBtn) previewFixBtn.addEventListener('click', handlePreviewFix);
    if (applyFixBtn) applyFixBtn.addEventListener('click', handleApplyFix);
    if (verifyBalancesBtn) verifyBalancesBtn.addEventListener('click', handleVerifyBalances);
    if (quickRecoverBtn) quickRecoverBtn.addEventListener('click', handleQuickRecover);
}

function mount(container) {
    if (!container) {
        logError(new Error('Debt transfer recovery view mount called without container'));
        return;
    }
    
    currentRoot = container;
    mounted = true;
    
    render();
    
    // Auto-scan on mount
    setTimeout(() => {
        handleScan();
    }, 500);
}

function unmount() {
    mounted = false;
    currentRoot = null;
    state.loading = false;
    state.error = null;
    state.debtTransfers = [];
    state.fixSummary = null;
    state.balanceVerification = null;
}

export default {
    mount,
    unmount,
    isMounted: () => mounted
};

