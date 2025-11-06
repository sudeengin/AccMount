/**
 * Migration View (ARCHIVED - READ ONLY)
 * 
 * This module has been archived and is now read-only.
 * All debt transfers are handled automatically in the new system.
 * 
 * This view allows administrators to view historical migration records only.
 * All migration actions have been disabled.
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
        listEl.innerHTML = '<div class="text-center py-8 text-gray-500">📦 Görüntülenecek geçmiş migration kaydı bulunamadı.</div>';
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
                        <!-- ARCHIVED: Checkbox removed in read-only mode -->
                        <div class="w-4 h-4"></div>
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
    
    // ARCHIVED: Checkbox listeners removed (module is read-only)
}

/**
 * Handle checkbox change (ARCHIVED - DISABLED)
 */
function handleCheckboxChange(event) {
    // Module archived - checkboxes are disabled
    event.preventDefault();
    alert('⚠️ Bu modül arşivlenmiştir.\n\nSeçim işlemleri devre dışı bırakılmıştır.');
    return;
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
 * Select all ready transactions (ARCHIVED - READ ONLY)
 */
function selectAllReady() {
    alert('⚠️ Bu modül arşivlenmiştir.\n\nSeçim işlemleri devre dışı bırakılmıştır.\nBu sayfa yalnızca geçmiş kayıtları görüntülemek içindir.');
    return;
}

/**
 * Clear selection (ARCHIVED - READ ONLY)
 */
function clearSelection() {
    alert('⚠️ Bu modül arşivlenmiştir.\n\nSeçim işlemleri devre dışı bırakılmıştır.\nBu sayfa yalnızca geçmiş kayıtları görüntülemek içindir.');
    return;
}

/**
 * Analyze transactions (ARCHIVED - READ ONLY)
 */
async function analyzeTransactions() {
    alert('⚠️ Bu modül arşivlenmiştir.\n\nMigration işlemleri devre dışı bırakılmıştır.\nTüm borç transferleri yeni sistemde otomatik olarak işlenmektedir.');
    return;
}

/**
 * Show preview of what will change (ARCHIVED - READ ONLY)
 */
function showPreview() {
    alert('⚠️ Bu modül arşivlenmiştir.\n\nÖnizleme işlemi devre dışı bırakılmıştır.\nTüm borç transferleri yeni sistemde otomatik olarak işlenmektedir.');
    return;
}

/**
 * Execute migration for selected transactions (ARCHIVED - READ ONLY)
 */
async function executeMigration() {
    alert('⚠️ Bu modül arşivlenmiştir.\n\nMigration işlemleri devre dışı bırakılmıştır.\nTüm borç transferleri yeni sistemde otomatik olarak işlenmektedir.');
    return;
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
                    📦 Migrasyon Arşivi (Salt-Okunur)
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
            <!-- Archive Banner -->
            <div class="mb-6 bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-500 dark:border-blue-600 rounded-lg p-4">
                <div class="flex items-start gap-3">
                    <svg class="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z"/>
                        <path fill-rule="evenodd" d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" clip-rule="evenodd"/>
                    </svg>
                    <div class="flex-1">
                        <h3 class="text-lg font-bold text-blue-800 dark:text-blue-200 mb-2">📦 Arşivlenmiş Modül</h3>
                        <p class="text-sm text-blue-700 dark:text-blue-300 font-medium">
                            Bu modül artık arşivlenmiştir. Tüm borç transferleri yeni sistemde otomatik olarak işlenmektedir.
                        </p>
                        <p class="text-xs text-blue-600 dark:text-blue-400 mt-2">
                            Bu sayfa yalnızca geçmiş migration kayıtlarını görüntülemek için kullanılabilir. Migration işlemleri devre dışı bırakılmıştır.
                        </p>
                    </div>
                </div>
            </div>
            
            <div class="mb-6">
                <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">Borç Transferi Yönetimi</h2>
                <p class="text-sm text-gray-600 dark:text-gray-400">
                    Geçmiş migration kayıtlarını görüntüleyin.
                </p>
            </div>
            
            ${renderTabs()}
            
            <div id="migrationContent" class="${state.activeTab === 'migration' ? '' : 'hidden'}">
            <div class="mb-6">
                <h3 class="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">Migrasyon Kayıtları (Salt-Okunur)</h3>
                <p class="text-sm text-gray-600 dark:text-gray-400">
                    Geçmiş migration kayıtlarını görüntüleyin. Bu modül artık aktif değildir.
                </p>
            </div>
            
            <div id="migrationStats"></div>
            
            <div class="bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-6">
                <div class="flex items-start gap-3">
                    <svg class="w-5 h-5 text-gray-600 dark:text-gray-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
                    </svg>
                    <div class="flex-1">
                        <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">Arşiv Görünümü</h3>
                        <ul class="text-xs text-gray-700 dark:text-gray-300 list-disc list-inside space-y-1">
                            <li>Bu modül salt-okunur moddadır</li>
                            <li>Yalnızca geçmiş migration kayıtlarını görüntüleyebilirsiniz</li>
                            <li>Tüm migration işlemleri yeni sistemde otomatik olarak yapılmaktadır</li>
                            <li>Firestore verisi değiştirilmeyecektir</li>
                        </ul>
                    </div>
                </div>
            </div>
            
            <!-- ARCHIVED: Migration buttons disabled -->
            <div class="mb-6 p-4 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg">
                <p class="text-sm text-gray-600 dark:text-gray-400 text-center">
                    ℹ️ Migration işlemleri devre dışı bırakılmıştır. Bu sayfa yalnızca görüntüleme içindir.
                </p>
            </div>
            
            <div id="migrationList" class="space-y-4">
                <div class="text-center py-8 text-gray-500">
                    📦 Bu modül arşivlenmiştir.<br>
                    Geçmiş migration kayıtlarını görüntülemek için veri yüklenecektir.
                </div>
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
    
    // ARCHIVED: Event listeners for migration buttons removed (module is read-only)
    // No interactive buttons in archived mode
    
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

