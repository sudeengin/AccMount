/**
 * Debt Transfer Visibility Fix Admin View
 * 
 * UI for fixing visibility of existing debt transfer transactions
 */

import { 
    findAllDebtTransfers,
    completeDebtTransferVisibilityFix,
    verifyBalancesAfterFix
} from '../../utils/debt-transfer-visibility-fix.js';

let state = {
    isRunning: false,
    summary: null,
    lastRun: null
};

/**
 * Render the fix view
 */
export function renderFixView(container) {
    if (!container) return;
    
    container.innerHTML = `
        <div class="max-w-4xl mx-auto px-4 py-8">
            <!-- Header -->
            <div class="mb-8">
                <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                    Borç Transferi Görünürlük Düzeltmesi
                </h1>
                <p class="text-gray-600 dark:text-gray-300">
                    Tüm borç transferi işlemlerinin İşlem Geçmişi'nde görünmesini ve bakiyeleri etkilemesini sağlar
                </p>
            </div>

            <!-- Info Box -->
            <div class="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <h3 class="text-lg font-semibold text-blue-900 dark:text-blue-200 mb-2">
                    ℹ️ Bu İşlem Ne Yapar?
                </h3>
                <ul class="list-disc list-inside text-sm text-blue-800 dark:text-blue-300 space-y-1">
                    <li>Tüm borç transferi kayıtlarını bulur</li>
                    <li><code class="bg-blue-100 dark:bg-blue-800 px-1 rounded">affectsBalance = true</code> olarak ayarlar</li>
                    <li>Log-only işaretlerini kaldırır (isLog, recordType)</li>
                    <li>Migration metadata'sını korur ama işlemleri görünür yapar</li>
                    <li>Hesap bakiyelerinin doğruluğunu kontrol eder</li>
                </ul>
            </div>

            <!-- Action Buttons -->
            <div class="mb-6 flex flex-wrap gap-4">
                <button id="btn-dry-run" 
                    class="px-6 py-3 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed">
                    🔍 Önizleme (Değişiklik Yapmadan)
                </button>
                <button id="btn-apply-fix" 
                    class="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed">
                    ✅ Düzeltmeyi Uygula
                </button>
                <button id="btn-verify-balances" 
                    class="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed">
                    🔎 Bakiyeleri Kontrol Et
                </button>
            </div>

            <!-- Status/Results Area -->
            <div id="fix-status" class="mb-6">
                <!-- Status will be rendered here -->
            </div>

            <!-- Results Details -->
            <div id="fix-results" class="space-y-4">
                <!-- Results will be rendered here -->
            </div>
        </div>
    `;

    attachEventListeners(container);
    renderInitialStatus(container);
}

/**
 * Attach event listeners
 */
function attachEventListeners(container) {
    const dryRunBtn = container.querySelector('#btn-dry-run');
    const applyBtn = container.querySelector('#btn-apply-fix');
    const verifyBtn = container.querySelector('#btn-verify-balances');

    if (dryRunBtn) {
        dryRunBtn.addEventListener('click', () => handleDryRun(container));
    }
    if (applyBtn) {
        applyBtn.addEventListener('click', () => handleApplyFix(container));
    }
    if (verifyBtn) {
        verifyBtn.addEventListener('click', () => handleVerifyBalances(container));
    }
}

/**
 * Render initial status
 */
function renderInitialStatus(container) {
    const statusEl = container.querySelector('#fix-status');
    if (!statusEl) return;

    statusEl.innerHTML = `
        <div class="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
            <p class="text-sm text-gray-600 dark:text-gray-300">
                Başlamak için yukarıdaki butonlardan birini seçin.
            </p>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">
                💡 İpucu: Önce "Önizleme" yaparak hangi değişikliklerin yapılacağını görebilirsiniz.
            </p>
        </div>
    `;
}

/**
 * Set buttons disabled state
 */
function setButtonsDisabled(container, disabled) {
    const buttons = container.querySelectorAll('button');
    buttons.forEach(btn => {
        btn.disabled = disabled;
    });
}

/**
 * Render loading status
 */
function renderLoading(container, message) {
    const statusEl = container.querySelector('#fix-status');
    if (!statusEl) return;

    statusEl.innerHTML = `
        <div class="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div class="flex items-center gap-3">
                <svg class="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p class="text-sm font-medium text-blue-900 dark:text-blue-200">${message}</p>
            </div>
        </div>
    `;
}

/**
 * Render error
 */
function renderError(container, error) {
    const statusEl = container.querySelector('#fix-status');
    if (!statusEl) return;

    statusEl.innerHTML = `
        <div class="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <h3 class="text-sm font-semibold text-red-900 dark:text-red-200 mb-2">❌ Hata Oluştu</h3>
            <p class="text-sm text-red-800 dark:text-red-300">${error.message || error}</p>
        </div>
    `;
}

/**
 * Render summary
 */
function renderSummary(container, summary, isDryRun) {
    const statusEl = container.querySelector('#fix-status');
    const resultsEl = container.querySelector('#fix-results');
    if (!statusEl || !resultsEl) return;

    const txSummary = summary.transactions || {};
    const mode = isDryRun ? 'Önizleme' : 'Uygulama';
    const icon = isDryRun ? '🔍' : '✅';

    statusEl.innerHTML = `
        <div class="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <h3 class="text-sm font-semibold text-green-900 dark:text-green-200 mb-2">
                ${icon} ${mode} Tamamlandı (${summary.duration})
            </h3>
            <div class="grid grid-cols-3 gap-4 mt-3">
                <div class="text-center">
                    <div class="text-2xl font-bold text-green-600">${txSummary.total || 0}</div>
                    <div class="text-xs text-green-700 dark:text-green-300">Toplam Borç Transferi</div>
                </div>
                <div class="text-center">
                    <div class="text-2xl font-bold text-blue-600">${txSummary.fixed || 0}</div>
                    <div class="text-xs text-blue-700 dark:text-blue-300">${isDryRun ? 'Düzeltilecek' : 'Düzeltildi'}</div>
                </div>
                <div class="text-center">
                    <div class="text-2xl font-bold text-gray-600">${txSummary.alreadyCorrect || 0}</div>
                    <div class="text-xs text-gray-700 dark:text-gray-300">Zaten Doğru</div>
                </div>
            </div>
        </div>
    `;

    // Render changes details
    if (txSummary.changes && txSummary.changes.length > 0) {
        const changesHtml = txSummary.changes.slice(0, 10).map(change => `
            <div class="p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded">
                <div class="text-xs font-mono text-gray-500 dark:text-gray-400 mb-1">${change.id}</div>
                <div class="text-sm font-semibold text-gray-900 dark:text-white mb-1">${change.type}</div>
                <div class="text-xs text-gray-600 dark:text-gray-300">
                    Değişiklikler: ${change.updates.join(', ')}
                </div>
            </div>
        `).join('');

        const showingText = txSummary.changes.length > 10 
            ? `<p class="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">İlk 10 değişiklik gösteriliyor (toplam ${txSummary.changes.length})</p>`
            : '';

        resultsEl.innerHTML = `
            <div>
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                    ${isDryRun ? 'Yapılacak' : 'Yapılan'} Değişiklikler
                </h3>
                <div class="space-y-2">
                    ${changesHtml}
                    ${showingText}
                </div>
            </div>
        `;
    } else {
        resultsEl.innerHTML = `
            <div class="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-center">
                <p class="text-sm text-gray-600 dark:text-gray-300">
                    Tüm borç transferi kayıtları zaten doğru durumda! 🎉
                </p>
            </div>
        `;
    }

    // Render balance verification if available
    if (summary.balances && summary.balances.length > 0) {
        const balancesHtml = summary.balances.map(mismatch => `
            <div class="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
                <div class="text-sm font-semibold text-gray-900 dark:text-white">${mismatch.accountName}</div>
                <div class="text-xs text-gray-600 dark:text-gray-300 mt-1">
                    Veritabanı: ${mismatch.storedBalance.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                    • Hesaplanan: ${mismatch.calculatedBalance.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                    • Fark: ${mismatch.difference.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                </div>
            </div>
        `).join('');

        resultsEl.innerHTML += `
            <div class="mt-6">
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                    ⚠️ Bakiye Uyumsuzlukları (${summary.balances.length})
                </h3>
                <div class="space-y-2">
                    ${balancesHtml}
                </div>
                <p class="text-xs text-yellow-700 dark:text-yellow-300 mt-3">
                    Bu hesapların bakiyeleri manuel olarak kontrol edilmelidir.
                </p>
            </div>
        `;
    }
}

/**
 * Handle dry run
 */
async function handleDryRun(container) {
    if (state.isRunning) return;

    try {
        state.isRunning = true;
        setButtonsDisabled(container, true);
        renderLoading(container, 'Borç transferi kayıtları analiz ediliyor...');

        const summary = await completeDebtTransferVisibilityFix(true);
        
        state.summary = summary;
        state.lastRun = new Date();
        renderSummary(container, summary, true);
    } catch (error) {
        console.error('[Fix View] Dry run error:', error);
        renderError(container, error);
    } finally {
        state.isRunning = false;
        setButtonsDisabled(container, false);
    }
}

/**
 * Handle apply fix
 */
async function handleApplyFix(container) {
    if (state.isRunning) return;

    // Confirm before applying
    if (!confirm('Tüm borç transferi kayıtları düzeltilecek. Devam etmek istediğinize emin misiniz?')) {
        return;
    }

    try {
        state.isRunning = true;
        setButtonsDisabled(container, true);
        renderLoading(container, 'Borç transferi kayıtları düzeltiliyor... (Bu işlem birkaç dakika sürebilir)');

        const summary = await completeDebtTransferVisibilityFix(false);
        
        state.summary = summary;
        state.lastRun = new Date();
        renderSummary(container, summary, false);
        
        // Show success message
        if (summary.transactions && summary.transactions.fixed > 0) {
            alert(`✅ Başarılı!\n\n${summary.transactions.fixed} borç transferi kaydı düzeltildi.\nArtık tüm borç transferleri İşlem Geçmişi'nde görünecek.`);
        }
    } catch (error) {
        console.error('[Fix View] Apply fix error:', error);
        renderError(container, error);
    } finally {
        state.isRunning = false;
        setButtonsDisabled(container, false);
    }
}

/**
 * Handle verify balances
 */
async function handleVerifyBalances(container) {
    if (state.isRunning) return;

    try {
        state.isRunning = true;
        setButtonsDisabled(container, true);
        renderLoading(container, 'Hesap bakiyeleri kontrol ediliyor...');

        const mismatches = await verifyBalancesAfterFix();
        
        const summary = {
            mode: 'VERIFY',
            duration: '0s',
            transactions: { total: 0, fixed: 0, alreadyCorrect: 0 },
            balances: mismatches,
            timestamp: new Date().toISOString()
        };
        
        renderSummary(container, summary, false);
    } catch (error) {
        console.error('[Fix View] Verify balances error:', error);
        renderError(container, error);
    } finally {
        state.isRunning = false;
        setButtonsDisabled(container, false);
    }
}

export default {
    render: renderFixView
};

