/**
 * Migration View
 * 
 * Admin interface for reviewing and migrating old debt transfer transactions
 * to the new three-party model, and recovering hidden debt transfers.
 */

import { 
    needsMigration, 
    analyzeForMigration, 
    batchAnalyze, 
    getMigrationStatistics,
    calculateBalanceCorrections,
    validateMigrationConsistency,
    MIGRATION_STATUS 
} from '../../utils/debt-transfer-migration.js';
import debtTransferRecoveryView from './debt-transfer-recovery.view.js';

let currentRoot = null;
let currentDeps = {};
let mounted = false;

const state = {
    transactions: [],
    accounts: [],
    analysisResults: [],
    selectedForMigration: new Set(),
    loading: false,
    error: null,
    stats: null,
    previewMode: false,
    previewData: null,
    activeTab: 'migration' // 'migration' or 'recovery'
};

function logError(error) {
    console.error('[migration:error]', error);
}

/**
 * Render migration statistics
 */
function renderStats() {
    const statsEl = currentRoot?.querySelector('#migrationStats');
    if (!statsEl || !state.stats) return;
    
    const { total, ready, needsReview, highConfidence, mediumConfidence, lowConfidence } = state.stats;
    
    statsEl.innerHTML = `
        <div class="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div class="text-2xl font-bold text-blue-600 dark:text-blue-400">${total}</div>
                <div class="text-sm text-gray-600 dark:text-gray-400">Toplam Tespit Edilen</div>
            </div>
            <div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <div class="text-2xl font-bold text-green-600 dark:text-green-400">${ready}</div>
                <div class="text-sm text-gray-600 dark:text-gray-400">Otomatik Hazır</div>
            </div>
            <div class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <div class="text-2xl font-bold text-yellow-600 dark:text-yellow-400">${needsReview}</div>
                <div class="text-sm text-gray-600 dark:text-gray-400">İnceleme Gerekli</div>
            </div>
            <div class="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4">
                <div class="text-2xl font-bold text-emerald-600 dark:text-emerald-400">${highConfidence}</div>
                <div class="text-sm text-gray-600 dark:text-gray-400">Yüksek Güven</div>
            </div>
            <div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <div class="text-2xl font-bold text-amber-600 dark:text-amber-400">${mediumConfidence}</div>
                <div class="text-sm text-gray-600 dark:text-gray-400">Orta Güven</div>
            </div>
            <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <div class="text-2xl font-bold text-red-600 dark:text-red-400">${lowConfidence}</div>
                <div class="text-sm text-gray-600 dark:text-gray-400">Düşük Güven</div>
            </div>
        </div>
    `;
}

/**
 * Render migration list
 */
function renderMigrationList() {
    const listEl = currentRoot?.querySelector('#migrationList');
    if (!listEl) return;
    
    if (state.loading) {
        listEl.innerHTML = '<div class="text-center py-8 text-gray-500">Yükleniyor...</div>';
        return;
    }
    
    if (state.error) {
        listEl.innerHTML = `<div class="text-center py-8 text-red-500">${state.error}</div>`;
        return;
    }
    
    if (!state.analysisResults.length) {
        listEl.innerHTML = '<div class="text-center py-8 text-gray-500">Migrasyon gerektiren işlem bulunamadı.</div>';
        return;
    }
    
    const html = state.analysisResults.map((item, index) => {
        const { transaction, analysis } = item;
        const { status, confidence, proposed, issues, suggestions } = analysis;
        
        const isSelected = state.selectedForMigration.has(transaction.id);
        
        // Status badge
        let statusBadge = '';
        if (status === MIGRATION_STATUS.READY) {
            statusBadge = '<span class="px-2 py-1 bg-green-500/20 text-green-400 border border-green-500/30 rounded text-xs font-semibold">Hazır</span>';
        } else if (status === MIGRATION_STATUS.NEEDS_REVIEW) {
            statusBadge = '<span class="px-2 py-1 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded text-xs font-semibold">İnceleme Gerekli</span>';
        } else {
            statusBadge = '<span class="px-2 py-1 bg-gray-500/20 text-gray-400 border border-gray-500/30 rounded text-xs font-semibold">Atlandı</span>';
        }
        
        // Confidence badge
        let confidenceBadge = '';
        if (confidence === 'high') {
            confidenceBadge = '<span class="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs">Yüksek Güven</span>';
        } else if (confidence === 'medium') {
            confidenceBadge = '<span class="px-2 py-1 bg-amber-500/20 text-amber-400 text-xs">Orta Güven</span>';
        } else {
            confidenceBadge = '<span class="px-2 py-1 bg-red-500/20 text-red-400 text-xs">Düşük Güven</span>';
        }
        
        const amount = Math.abs(Number(transaction.toplamTutar || transaction.tutar || 0)).toLocaleString('tr-TR', {
            style: 'currency',
            currency: 'TRY'
        });
        
        const date = transaction.tarih?.toDate?.() || new Date(transaction.tarih);
        const dateStr = date.toLocaleDateString('tr-TR');
        
        const getAccountName = (accountId) => {
            const account = state.accounts.find(a => a.id === accountId);
            return account?.unvan || accountId || 'Bilinmeyen';
        };
        
        return `
            <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500' : 'bg-white dark:bg-gray-800'}">
                <div class="flex items-start justify-between mb-3">
                    <div class="flex items-center gap-3">
                        <input 
                            type="checkbox" 
                            class="migration-checkbox w-4 h-4" 
                            data-transaction-id="${transaction.id}"
                            ${isSelected ? 'checked' : ''}
                            ${status !== MIGRATION_STATUS.READY && status !== MIGRATION_STATUS.NEEDS_REVIEW ? 'disabled' : ''}
                        />
                        <div>
                            <div class="flex items-center gap-2 mb-1">
                                ${statusBadge}
                                ${confidenceBadge}
                            </div>
                            <div class="text-sm text-gray-600 dark:text-gray-400">${dateStr} • ${amount}</div>
                        </div>
                    </div>
                </div>
                
                <div class="grid md:grid-cols-2 gap-4 mb-3">
                    <div class="bg-gray-50 dark:bg-gray-900 rounded p-3">
                        <div class="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">ESKİ YAPI (2 Taraf)</div>
                        <div class="text-sm">
                            <div class="mb-1"><strong>Kaynak:</strong> ${getAccountName(transaction.kaynakCari)}</div>
                            <div><strong>Hedef:</strong> ${getAccountName(transaction.hedefCari)}</div>
                        </div>
                    </div>
                    
                    ${proposed ? `
                        <div class="bg-purple-50 dark:bg-purple-900/20 rounded p-3">
                            <div class="text-xs font-semibold text-purple-600 dark:text-purple-400 mb-2">YENİ YAPI (3 Taraf)</div>
                            <div class="text-sm">
                                <div class="mb-1"><strong>Borçlu:</strong> ${proposed.islemCari ? getAccountName(proposed.islemCari) : '<span class="text-yellow-600">❓ Bilinmiyor</span>'}</div>
                                <div class="mb-1"><strong>Borç Veren (Yeni Alacaklı):</strong> ${proposed.kaynakCari ? getAccountName(proposed.kaynakCari) : '<span class="text-yellow-600">❓ Bilinmiyor</span>'}</div>
                                <div><strong>Borcu Kapanan (Eski Alacaklı):</strong> ${proposed.hedefCari ? getAccountName(proposed.hedefCari) : '<span class="text-yellow-600">❓ Bilinmiyor</span>'}</div>
                            </div>
                            <div class="mt-2 text-xs text-purple-600 dark:text-purple-400 italic">
                                💰 ${proposed.kaynakCari ? getAccountName(proposed.kaynakCari) : '?'} → ${proposed.islemCari ? getAccountName(proposed.islemCari) : '?'} → ${proposed.hedefCari ? getAccountName(proposed.hedefCari) : '?'}
                            </div>
                        </div>
                    ` : `
                        <div class="bg-red-50 dark:bg-red-900/20 rounded p-3">
                            <div class="text-xs font-semibold text-red-600 dark:text-red-400 mb-2">DÖNÜŞÜM YAPILAMADI</div>
                            <div class="text-sm text-red-600 dark:text-red-400">Üç taraflı yapı belirlenemedi</div>
                        </div>
                    `}
                </div>
                
                ${issues.length > 0 ? `
                    <div class="mb-2">
                        <div class="text-xs font-semibold text-red-600 dark:text-red-400 mb-1">SORUNLAR:</div>
                        <ul class="text-xs text-red-600 dark:text-red-400 list-disc list-inside">
                            ${issues.map(issue => `<li>${issue}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
                
                ${suggestions.length > 0 ? `
                    <div>
                        <div class="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1">ÖNERİLER:</div>
                        <ul class="text-xs text-blue-600 dark:text-blue-400 list-disc list-inside">
                            ${suggestions.map(suggestion => `<li>${suggestion}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
                
                ${transaction.aciklama ? `
                    <div class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        <strong>Açıklama:</strong> ${transaction.aciklama}
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
    
    listEl.innerHTML = html;
    
    // Attach checkbox listeners
    listEl.querySelectorAll('.migration-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', handleCheckboxChange);
    });
}

/**
 * Handle checkbox change
 */
function handleCheckboxChange(event) {
    const transactionId = event.target.dataset.transactionId;
    
    if (event.target.checked) {
        state.selectedForMigration.add(transactionId);
    } else {
        state.selectedForMigration.delete(transactionId);
    }
    
    updateActionButtons();
}

/**
 * Update action button states
 */
function updateActionButtons() {
    const migrateBtn = currentRoot?.querySelector('#migrateBatchBtn');
    const previewBtn = currentRoot?.querySelector('#previewBtn');
    const selectAllBtn = currentRoot?.querySelector('#selectAllReadyBtn');
    
    if (migrateBtn) {
        migrateBtn.disabled = state.selectedForMigration.size === 0;
        migrateBtn.textContent = `Seçilenleri Migrate Et (${state.selectedForMigration.size})`;
    }
    
    if (previewBtn) {
        previewBtn.disabled = state.selectedForMigration.size === 0;
    }
    
    if (selectAllBtn) {
        const readyCount = state.analysisResults.filter(item => 
            item.analysis.status === MIGRATION_STATUS.READY
        ).length;
        selectAllBtn.textContent = `Hazır Olanları Seç (${readyCount})`;
    }
}

/**
 * Select all ready transactions
 */
function selectAllReady() {
    state.selectedForMigration.clear();
    
    state.analysisResults.forEach(item => {
        if (item.analysis.status === MIGRATION_STATUS.READY) {
            state.selectedForMigration.add(item.transaction.id);
        }
    });
    
    renderMigrationList();
    updateActionButtons();
}

/**
 * Clear selection
 */
function clearSelection() {
    state.selectedForMigration.clear();
    renderMigrationList();
    updateActionButtons();
}

/**
 * Analyze transactions
 */
async function analyzeTransactions() {
    if (!currentDeps.getAccount) {
        state.error = 'getAccount function not provided';
        return;
    }
    
    state.loading = true;
    state.error = null;
    renderMigrationList();
    
    try {
        // Batch analyze
        state.analysisResults = batchAnalyze(
            state.transactions,
            currentDeps.getAccount,
            state.accounts
        );
        
        // Get statistics
        state.stats = getMigrationStatistics(state.analysisResults);
        
        state.loading = false;
        renderStats();
        renderMigrationList();
        updateActionButtons();
        
    } catch (error) {
        logError(error);
        state.error = 'Analiz sırasında bir hata oluştu.';
        state.loading = false;
        renderMigrationList();
    }
}

/**
 * Show preview of what will change
 */
function showPreview() {
    const selected = state.analysisResults.filter(item => 
        state.selectedForMigration.has(item.transaction.id)
    );
    
    if (!selected.length) {
        alert('Lütfen önizlemek için işlemleri seçin.');
        return;
    }
    
    // Calculate balance changes - SINGLE-SIDED ownership transfer
    const balanceChanges = new Map();
    const accountNames = new Map();
    
    selected.forEach(item => {
        const { transaction, analysis } = item;
        const { proposed } = analysis;
        
        if (!proposed) return;
        
        const amount = Math.abs(Number(proposed.toplamTutar || proposed.tutar || 0));
        
        // Store account names for display
        const storeAccountName = (accountId) => {
            if (accountId && !accountNames.has(accountId)) {
                const acc = state.accounts.find(a => a.id === accountId);
                accountNames.set(accountId, acc?.unvan || accountId);
            }
        };
        
        // For debt transfer migration: Only calculate NET ownership change
        // Old creditor (kaynakCari in proposed) loses the debt
        // New creditor (hedefCari in proposed) gains the debt
        // Debtor (islemCari) is unchanged
        
        if (proposed.kaynakCari) {
            // Old creditor's balance DECREASES (they no longer own this debt)
            balanceChanges.set(proposed.kaynakCari, (balanceChanges.get(proposed.kaynakCari) || 0) - amount);
            storeAccountName(proposed.kaynakCari);
        }
        
        if (proposed.hedefCari) {
            // New creditor's balance INCREASES (they now own this debt)
            balanceChanges.set(proposed.hedefCari, (balanceChanges.get(proposed.hedefCari) || 0) + amount);
            storeAccountName(proposed.hedefCari);
        }
        
        // Debtor (islemCari) is not included - their total liability remains unchanged
        if (proposed.islemCari) {
            storeAccountName(proposed.islemCari);
        }
    });
    
    // Build preview message
    let previewMsg = `ÖNIZLEME - ${selected.length} İşlem Migrate Edilecek\n\n`;
    previewMsg += `BAKIYE DEĞİŞİKLİKLERİ:\n`;
    previewMsg += `═══════════════════════\n\n`;
    
    const sortedChanges = Array.from(balanceChanges.entries())
        .filter(([_, delta]) => Math.abs(delta) > 0.01)
        .sort((a, b) => accountNames.get(a[0]).localeCompare(accountNames.get(b[0])));
    
    if (sortedChanges.length === 0) {
        previewMsg += `✅ Hiçbir hesapta net bakiye değişikliği olmayacak\n`;
    } else {
        sortedChanges.forEach(([accountId, delta]) => {
            const name = accountNames.get(accountId);
            const sign = delta > 0 ? '+' : '';
            const formatted = delta.toLocaleString('tr-TR', {
                style: 'currency',
                currency: 'TRY'
            });
            previewMsg += `${name}: ${sign}${formatted}\n`;
        });
        
        // Calculate and show net system-wide change
        const netChange = sortedChanges.reduce((sum, [_, delta]) => sum + delta, 0);
        previewMsg += `\n`;
        previewMsg += `─────────────────────────\n`;
        previewMsg += `Sistem Geneli Net Değişim: ${netChange.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}\n`;
    }
    
    previewMsg += `\n═══════════════════════\n`;
    previewMsg += `\n💡 ÖNEMLI BİLGİ:\n`;
    previewMsg += `Bu değişiklik yalnızca borç sahipliğini yeniden tanımlar.\n`;
    previewMsg += `Nakit hareketi yaratmaz. Sistem geneli net değişim ₺0 olmalıdır.\n`;
    previewMsg += `\n⚠️ BU SADECE BİR ÖNİZLEMEDİR\n`;
    previewMsg += `Gerçek değişiklik yapmak için "Migrate Et" butonunu kullanın.\n`;
    
    alert(previewMsg);
}

/**
 * Execute migration for selected transactions
 */
async function executeMigration() {
    if (!currentDeps.onMigrate || typeof currentDeps.onMigrate !== 'function') {
        alert('Migration function not available');
        return;
    }
    
    const selected = state.analysisResults.filter(item => 
        state.selectedForMigration.has(item.transaction.id)
    );
    
    if (!selected.length) {
        alert('Lütfen migrate edilecek işlemleri seçin.');
        return;
    }
    
    // Validate consistency
    const validation = validateMigrationConsistency(
        state.transactions,
        selected,
        currentDeps.getAccount
    );
    
    if (!validation.valid) {
        const proceed = confirm(
            `UYARI: Migrasyon tutarsızlıkları tespit edildi:\n\n${validation.errors.join('\n')}\n\nDevam etmek istediğinizden emin misiniz?`
        );
        
        if (!proceed) return;
    }
    
    // Show final confirmation with summary
    const confirmMsg = `⚠️ VERİ DEĞİŞİKLİĞİ UYARISI ⚠️\n\n` +
                      `${selected.length} işlemi migrate etmek üzeresiniz.\n\n` +
                      `Bu işlem:\n` +
                      `✓ Eski iki taraflı yapıyı üç taraflı yapıya dönüştürür\n` +
                      `✓ Bakiye düzeltmeleri yapar\n` +
                      `✓ Gelir/gider toplamlarını KORUR (değiştirmez)\n\n` +
                      `⚠️ BU İŞLEM GERİ ALINAMAZ!\n\n` +
                      `Önce "Önizleme" butonuna basarak değişiklikleri kontrol ettiniz mi?\n\n` +
                      `Devam etmek istiyor musunuz?`;
    
    if (!confirm(confirmMsg)) return;
    
    try {
        await currentDeps.onMigrate(selected);
        alert(`${selected.length} işlem başarıyla migrate edildi!\n\nSayfa otomatik olarak yenilenecek.`);
        
        // Reload page to get fresh data from Firestore
        setTimeout(() => {
            window.location.reload();
        }, 1500);
        
    } catch (error) {
        logError(error);
        alert(`Migration hatası: ${error.message}`);
    }
}

function renderTabs() {
    const migrationClass = state.activeTab === 'migration'
        ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300';
    
    const recoveryClass = state.activeTab === 'recovery'
        ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300';
    
    return `
        <div class="border-b border-gray-200 dark:border-gray-700 mb-6">
            <nav class="-mb-px flex space-x-8">
                <button 
                    id="migrationTab" 
                    class="whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${migrationClass}"
                >
                    🔄 Migrasyon (Eski→Yeni)
                </button>
                <button 
                    id="recoveryTab" 
                    class="whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${recoveryClass}"
                >
                    🔍 Görünürlük Kurtarma
                </button>
            </nav>
        </div>
    `;
}

/**
 * Mount the view
 */
function mount(container, deps = {}) {
    if (!container) {
        logError(new Error('Migration view mount called without container'));
        return;
    }
    
    currentRoot = container;
    currentDeps = deps;
    mounted = true;
    
    // Render initial HTML with tabs
    container.innerHTML = `
        <div class="p-6">
            <div class="mb-6">
                <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">Borç Transferi Yönetimi</h2>
                <p class="text-sm text-gray-600 dark:text-gray-400">
                    Eski transferleri migrate edin veya gizli borç transferlerini kurtarın.
                </p>
            </div>
            
            ${renderTabs()}
            
            <div id="migrationContent" class="${state.activeTab === 'migration' ? '' : 'hidden'}">
            <div class="mb-6">
                <h3 class="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">Migrasyon (Eski→Yeni)</h3>
                <p class="text-sm text-gray-600 dark:text-gray-400">
                    Eski iki taraflı "transfer" işlemlerini yeni üç taraflı borç transferi modeline dönüştürün.
                </p>
            </div>
            
            <div id="migrationStats"></div>
            
            <div class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
                <div class="flex items-start gap-3">
                    <svg class="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                    </svg>
                    <div class="flex-1">
                        <h3 class="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-1">Önemli Bilgiler</h3>
                        <ul class="text-xs text-yellow-700 dark:text-yellow-300 list-disc list-inside space-y-1">
                            <li>Bu işlem geri alınamaz - önceki verilerin yedeğini aldığınızdan emin olun</li>
                            <li>Gelir/Gider ve nakit akışı toplamları değişmeyecektir</li>
                            <li>Bakiyeler üç taraflı modele göre yeniden hesaplanacaktır</li>
                            <li>İnceleme gerektiren kayıtları manuel olarak kontrol edin</li>
                        </ul>
                    </div>
                </div>
            </div>
            
            <div class="flex gap-3 mb-6">
                <button id="analyzeBtn" class="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition">
                    🔍 Analiz Et
                </button>
                <button id="selectAllReadyBtn" class="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition" disabled>
                    Hazır Olanları Seç (0)
                </button>
                <button id="clearSelectionBtn" class="px-4 py-2 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700 transition">
                    Seçimi Temizle
                </button>
                <button id="previewBtn" class="px-4 py-2 bg-cyan-600 text-white rounded-lg font-medium hover:bg-cyan-700 transition" disabled>
                    👁️ Önizleme
                </button>
                <button id="migrateBatchBtn" class="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition" disabled>
                    Seçilenleri Migrate Et (0)
                </button>
            </div>
            
            <div id="migrationList" class="space-y-4">
                <div class="text-center py-8 text-gray-500">Analiz etmek için "Analiz Et" butonuna tıklayın.</div>
            </div>
            </div>
            
            <div id="recoveryContent" class="${state.activeTab === 'recovery' ? '' : 'hidden'}">
                <!-- Recovery view will be mounted here -->
            </div>
        </div>
    `;
    
    // Attach tab event listeners
    const migrationTab = container.querySelector('#migrationTab');
    const recoveryTab = container.querySelector('#recoveryTab');
    
    if (migrationTab) {
        migrationTab.addEventListener('click', () => {
            state.activeTab = 'migration';
            renderTabContent();
        });
    }
    
    if (recoveryTab) {
        recoveryTab.addEventListener('click', () => {
            state.activeTab = 'recovery';
            renderTabContent();
        });
    }
    
    // Attach event listeners for migration tab
    const analyzeBtn = container.querySelector('#analyzeBtn');
    const selectAllReadyBtn = container.querySelector('#selectAllReadyBtn');
    const clearSelectionBtn = container.querySelector('#clearSelectionBtn');
    const previewBtn = container.querySelector('#previewBtn');
    const migrateBatchBtn = container.querySelector('#migrateBatchBtn');
    
    if (analyzeBtn) analyzeBtn.addEventListener('click', analyzeTransactions);
    if (selectAllReadyBtn) selectAllReadyBtn.addEventListener('click', selectAllReady);
    if (clearSelectionBtn) clearSelectionBtn.addEventListener('click', clearSelection);
    if (previewBtn) previewBtn.addEventListener('click', showPreview);
    if (migrateBatchBtn) migrateBatchBtn.addEventListener('click', executeMigration);
    
    // Load data if available
    if (deps.transactions && deps.accounts) {
        state.transactions = deps.transactions;
        state.accounts = deps.accounts;
    }
    
    // Mount recovery view if needed
    renderTabContent();
}

function renderTabContent() {
    if (!currentRoot) return;
    
    const migrationContent = currentRoot.querySelector('#migrationContent');
    const recoveryContent = currentRoot.querySelector('#recoveryContent');
    const migrationTab = currentRoot.querySelector('#migrationTab');
    const recoveryTab = currentRoot.querySelector('#recoveryTab');
    
    if (state.activeTab === 'migration') {
        if (migrationContent) migrationContent.classList.remove('hidden');
        if (recoveryContent) recoveryContent.classList.add('hidden');
        if (migrationTab) {
            migrationTab.className = migrationTab.className.replace(/border-transparent.*?(?=whitespace|$)/, 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400 ');
        }
        if (recoveryTab) {
            recoveryTab.className = recoveryTab.className.replace(/border-indigo-600.*?(?=whitespace|$)/, 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300 ');
        }
        
        // Unmount recovery view
        if (debtTransferRecoveryView.isMounted()) {
            debtTransferRecoveryView.unmount();
        }
    } else {
        if (migrationContent) migrationContent.classList.add('hidden');
        if (recoveryContent) recoveryContent.classList.remove('hidden');
        if (migrationTab) {
            migrationTab.className = migrationTab.className.replace(/border-indigo-600.*?(?=whitespace|$)/, 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300 ');
        }
        if (recoveryTab) {
            recoveryTab.className = recoveryTab.className.replace(/border-transparent.*?(?=whitespace|$)/, 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400 ');
        }
        
        // Mount recovery view
        if (!debtTransferRecoveryView.isMounted() && recoveryContent) {
            debtTransferRecoveryView.mount(recoveryContent);
        }
    }
}

/**
 * Unmount the view
 */
function unmount() {
    // Unmount recovery view if mounted
    if (debtTransferRecoveryView.isMounted()) {
        debtTransferRecoveryView.unmount();
    }
    
    mounted = false;
    currentRoot = null;
    currentDeps = {};
    state.transactions = [];
    state.accounts = [];
    state.analysisResults = [];
    state.selectedForMigration.clear();
    state.loading = false;
    state.error = null;
    state.stats = null;
    state.activeTab = 'migration';
}

/**
 * Set transactions and accounts data
 */
function setData({ transactions = [], accounts = [] }) {
    state.transactions = transactions;
    state.accounts = accounts;
}

export default {
    mount,
    unmount,
    isMounted: () => mounted,
    setData
};

