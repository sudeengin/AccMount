/**
 * Debt Transfer Migration Admin View
 * 
 * UI for managing debt transfer migrations
 */

import { fetchRecentTransactions } from '../../data/transactions.repo.js';
import { fetchRecentAccounts } from '../../data/accounts.repo.js';
import { 
    runDryRunMigration, 
    applyMigration,
    fetchTransactionsNeedingReview,
    approvePendingMigration,
    rejectPendingMigration,
    getMigrationStatistics,
    exportMigrationReport
} from '../../utils/debt-transfer-migration-service.js';
import { getTransactionsNeedingReview } from '../../utils/debt-transfer-migration.js';

let state = {
    transactions: [],
    accounts: [],
    migrationSummary: null,
    reviewTransactions: [],
    isLoading: false,
    lastMigrationDate: null
};

/**
 * Render the migration view
 */
export async function renderMigrationView(container) {
    container.innerHTML = `
        <div class="max-w-7xl mx-auto px-4 py-8">
            <!-- Header -->
            <div class="mb-8">
                <h1 class="text-3xl font-bold text-gray-900 mb-2">Debt Transfer Migration</h1>
                <p class="text-gray-600">Migrate legacy debt transfer transactions to the new three-party model</p>
            </div>

            <!-- Migration Statistics -->
            <div id="migration-stats" class="mb-8">
                <!-- Stats will be rendered here -->
            </div>

            <!-- Action Buttons -->
            <div class="mb-8 flex flex-wrap gap-4">
                <button id="btn-preview-migration" 
                    class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
                    📊 Preview Migration (Dry Run)
                </button>
                <button id="btn-apply-migration" 
                    class="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled>
                    ✅ Apply Migration
                </button>
                <button id="btn-export-report" 
                    class="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled>
                    📥 Export Report
                </button>
                <button id="btn-refresh" 
                    class="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium">
                    🔄 Refresh Data
                </button>
            </div>

            <!-- Migration Report -->
            <div id="migration-report" class="mb-8 hidden">
                <!-- Report will be rendered here -->
            </div>

            <!-- Review Queue -->
            <div id="review-queue" class="mb-8">
                <!-- Review items will be rendered here -->
            </div>

            <!-- Progress Indicator -->
            <div id="progress-indicator" class="hidden">
                <!-- Progress bar will be rendered here -->
            </div>
        </div>
    `;

    // Load initial data
    await loadData();
    
    // Setup event listeners
    setupEventListeners(container);
    
    // Render initial state
    renderStatistics(container);
    await renderReviewQueue(container);
}

/**
 * Load data from Firebase
 */
async function loadData() {
    state.isLoading = true;
    
    try {
        // Load all transactions (increased limit to ensure we get all debt transfers)
        state.transactions = await fetchRecentTransactions(10000);
        
        // Load all accounts
        state.accounts = await fetchRecentAccounts(1000);
        
        // Load transactions that need review
        state.reviewTransactions = await fetchTransactionsNeedingReview();
    } catch (error) {
        console.error('Failed to load data:', error);
        showError('Failed to load data: ' + error.message);
    } finally {
        state.isLoading = false;
    }
}

/**
 * Setup event listeners
 */
function setupEventListeners(container) {
    // Preview migration
    container.querySelector('#btn-preview-migration')?.addEventListener('click', async () => {
        await handlePreviewMigration(container);
    });
    
    // Apply migration
    container.querySelector('#btn-apply-migration')?.addEventListener('click', async () => {
        await handleApplyMigration(container);
    });
    
    // Export report
    container.querySelector('#btn-export-report')?.addEventListener('click', () => {
        handleExportReport();
    });
    
    // Refresh data
    container.querySelector('#btn-refresh')?.addEventListener('click', async () => {
        await loadData();
        renderStatistics(container);
        await renderReviewQueue(container);
        showSuccess('Data refreshed successfully');
    });
}

/**
 * Handle preview migration (dry run)
 */
async function handlePreviewMigration(container) {
    if (state.isLoading) return;
    
    state.isLoading = true;
    showProgress('Running migration preview...', 0);
    
    try {
        // Find company account (assuming first account or specific account)
        const companyAccountId = state.accounts[0]?.id || null;
        
        state.migrationSummary = await runDryRunMigration(state.transactions, {
            allAccounts: state.accounts,
            companyAccountId
        });
        
        // Render report
        renderMigrationReport(container);
        
        // Enable apply button if migration is valid
        const applyButton = container.querySelector('#btn-apply-migration');
        const exportButton = container.querySelector('#btn-export-report');
        
        if (state.migrationSummary.consistencyCheck.valid) {
            applyButton.disabled = false;
            exportButton.disabled = false;
            showSuccess('Migration preview completed successfully');
        } else {
            showError('Migration would break consistency: ' + state.migrationSummary.consistencyCheck.errors.join(', '));
        }
        
        hideProgress();
    } catch (error) {
        console.error('Preview migration failed:', error);
        showError('Preview failed: ' + error.message);
        hideProgress();
    } finally {
        state.isLoading = false;
    }
}

/**
 * Handle apply migration
 */
async function handleApplyMigration(container) {
    if (state.isLoading) return;
    
    // Confirmation dialog
    const confirmed = confirm(
        'Are you sure you want to apply this migration?\n\n' +
        'This will update all debt transfer transactions in the database.\n' +
        'This action cannot be undone automatically.\n\n' +
        'Click OK to proceed or Cancel to abort.'
    );
    
    if (!confirmed) return;
    
    state.isLoading = true;
    
    try {
        const companyAccountId = state.accounts[0]?.id || null;
        
        const result = await applyMigration(
            state.transactions,
            {
                allAccounts: state.accounts,
                companyAccountId
            },
            (current, total) => {
                const percent = Math.round((current / total) * 100);
                showProgress(`Applying migration: ${current} / ${total}`, percent);
            }
        );
        
        state.migrationSummary = result.migrationSummary;
        state.lastMigrationDate = new Date();
        
        // Refresh data
        await loadData();
        
        // Update UI
        renderMigrationReport(container);
        renderStatistics(container);
        await renderReviewQueue(container);
        
        showSuccess(`Migration completed! ${result.totalUpdated} transactions updated.`);
        hideProgress();
        
        // Disable apply button
        container.querySelector('#btn-apply-migration').disabled = true;
    } catch (error) {
        console.error('Apply migration failed:', error);
        showError('Migration failed: ' + error.message);
        hideProgress();
    } finally {
        state.isLoading = false;
    }
}

/**
 * Handle export report
 */
function handleExportReport() {
    if (!state.migrationSummary) {
        showError('No migration report to export');
        return;
    }
    
    try {
        const blob = exportMigrationReport(state.migrationSummary);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `debt-transfer-migration-report-${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showSuccess('Report exported successfully');
    } catch (error) {
        console.error('Export failed:', error);
        showError('Export failed: ' + error.message);
    }
}

/**
 * Render migration statistics
 */
function renderStatistics(container) {
    const stats = getMigrationStatistics(state.transactions);
    const statsContainer = container.querySelector('#migration-stats');
    
    if (!statsContainer) return;
    
    const percentMigrated = stats.total > 0 ? Math.round((stats.migrated / stats.total) * 100) : 0;
    
    statsContainer.innerHTML = `
        <div class="bg-white rounded-lg shadow-md p-6">
            <h2 class="text-xl font-bold text-gray-900 mb-4">Migration Status</h2>
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div class="bg-blue-50 p-4 rounded-lg">
                    <div class="text-3xl font-bold text-blue-600">${stats.total}</div>
                    <div class="text-sm text-gray-600 mt-1">Total Debt Transfers</div>
                </div>
                <div class="bg-green-50 p-4 rounded-lg">
                    <div class="text-3xl font-bold text-green-600">${stats.migrated}</div>
                    <div class="text-sm text-gray-600 mt-1">Migrated (${percentMigrated}%)</div>
                </div>
                <div class="bg-yellow-50 p-4 rounded-lg">
                    <div class="text-3xl font-bold text-yellow-600">${stats.needsReview}</div>
                    <div class="text-sm text-gray-600 mt-1">Needs Review</div>
                </div>
                <div class="bg-gray-50 p-4 rounded-lg">
                    <div class="text-3xl font-bold text-gray-600">${stats.pending}</div>
                    <div class="text-sm text-gray-600 mt-1">Pending</div>
                </div>
            </div>
            ${state.lastMigrationDate ? `
                <div class="mt-4 text-sm text-gray-500">
                    Last migration: ${state.lastMigrationDate.toLocaleString('tr-TR')}
                </div>
            ` : ''}
        </div>
    `;
}

/**
 * Render migration report
 */
function renderMigrationReport(container) {
    const reportContainer = container.querySelector('#migration-report');
    
    if (!reportContainer || !state.migrationSummary) return;
    
    reportContainer.classList.remove('hidden');
    
    const consistencyStatus = state.migrationSummary.consistencyCheck.valid
        ? '<span class="text-green-600">✓ Passed</span>'
        : '<span class="text-red-600">✗ Failed</span>';
    
    reportContainer.innerHTML = `
        <div class="bg-white rounded-lg shadow-md p-6">
            <h2 class="text-xl font-bold text-gray-900 mb-4">Migration Report</h2>
            
            <!-- Summary -->
            <div class="mb-6">
                <h3 class="text-lg font-semibold text-gray-800 mb-2">Summary</h3>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                        <span class="text-gray-600">Completed:</span>
                        <span class="ml-2 font-semibold text-green-600">${state.migrationSummary.completed}</span>
                    </div>
                    <div>
                        <span class="text-gray-600">Needs Review:</span>
                        <span class="ml-2 font-semibold text-yellow-600">${state.migrationSummary.needsReview}</span>
                    </div>
                    <div>
                        <span class="text-gray-600">Failed:</span>
                        <span class="ml-2 font-semibold text-red-600">${state.migrationSummary.failed}</span>
                    </div>
                    <div>
                        <span class="text-gray-600">Skipped:</span>
                        <span class="ml-2 font-semibold text-gray-600">${state.migrationSummary.skipped}</span>
                    </div>
                </div>
            </div>
            
            <!-- Consistency Check -->
            <div class="mb-6">
                <h3 class="text-lg font-semibold text-gray-800 mb-2">Consistency Check</h3>
                <div class="text-sm">
                    <div class="mb-2">
                        <span class="text-gray-600">Status:</span>
                        <span class="ml-2 font-semibold">${consistencyStatus}</span>
                    </div>
                    ${!state.migrationSummary.consistencyCheck.valid ? `
                        <div class="bg-red-50 border border-red-200 rounded p-3 mt-2">
                            <div class="text-red-800 font-semibold mb-1">Errors:</div>
                            <ul class="list-disc list-inside text-red-700">
                                ${state.migrationSummary.consistencyCheck.errors.map(err => 
                                    `<li>${err}</li>`
                                ).join('')}
                            </ul>
                        </div>
                    ` : `
                        <div class="bg-green-50 border border-green-200 rounded p-3 mt-2">
                            <div class="text-green-800">✓ Migration preserves financial totals (P&L and cashflow)</div>
                        </div>
                    `}
                </div>
            </div>
            
            <!-- Full Report -->
            <details class="mt-4">
                <summary class="cursor-pointer text-blue-600 hover:text-blue-800 font-medium">
                    View Full Report
                </summary>
                <pre class="mt-2 p-4 bg-gray-50 rounded border border-gray-200 text-xs overflow-x-auto">${state.migrationSummary.report}</pre>
            </details>
        </div>
    `;
}

/**
 * Render review queue
 */
async function renderReviewQueue(container) {
    const queueContainer = container.querySelector('#review-queue');
    
    if (!queueContainer) return;
    
    if (state.reviewTransactions.length === 0) {
        queueContainer.innerHTML = `
            <div class="bg-white rounded-lg shadow-md p-6">
                <h2 class="text-xl font-bold text-gray-900 mb-4">Review Queue</h2>
                <p class="text-gray-500">No transactions need review</p>
            </div>
        `;
        return;
    }
    
    queueContainer.innerHTML = `
        <div class="bg-white rounded-lg shadow-md p-6">
            <h2 class="text-xl font-bold text-gray-900 mb-4">Review Queue (${state.reviewTransactions.length})</h2>
            <div class="space-y-4">
                ${state.reviewTransactions.map((tx, index) => renderReviewItem(tx, index)).join('')}
            </div>
        </div>
    `;
    
    // Setup review item event listeners
    state.reviewTransactions.forEach((tx, index) => {
        setupReviewItemListeners(container, tx, index);
    });
}

/**
 * Render a single review item
 */
function renderReviewItem(transaction, index) {
    const amount = Math.abs(Number(transaction.toplamTutar || transaction.tutar || 0));
    const formattedAmount = amount.toLocaleString('tr-TR', {
        style: 'currency',
        currency: 'TRY'
    });
    
    const getAccountName = (accountId) => {
        const account = state.accounts.find(a => a.id === accountId);
        return account?.unvan || accountId || 'Unknown';
    };
    
    const debtor = transaction.debtor || transaction.islemCari;
    const fromCreditor = transaction.fromCreditor || transaction.kaynakCari;
    const toCreditor = transaction.toCreditor || transaction.hedefCari;
    
    return `
        <div class="border border-yellow-200 bg-yellow-50 rounded-lg p-4" id="review-item-${index}">
            <div class="flex items-start justify-between mb-3">
                <div>
                    <div class="font-semibold text-gray-900">
                        ${transaction.aciklama || 'Debt Transfer'}
                    </div>
                    <div class="text-sm text-gray-500 mt-1">
                        ${formattedAmount} • ${transaction.tarih?.toDate?.()?.toLocaleDateString('tr-TR') || 'No date'}
                    </div>
                </div>
                <div class="text-yellow-600 text-sm font-medium">
                    ⚠ Needs Review
                </div>
            </div>
            
            <div class="bg-white rounded p-3 mb-3">
                <div class="text-sm space-y-2">
                    <div>
                        <span class="text-gray-600">Debtor (Company):</span>
                        <span class="ml-2 font-medium">${getAccountName(debtor)}</span>
                    </div>
                    <div>
                        <span class="text-gray-600">From Creditor:</span>
                        <span class="ml-2 font-medium">${getAccountName(fromCreditor)}</span>
                    </div>
                    <div>
                        <span class="text-gray-600">To Creditor:</span>
                        <span class="ml-2 font-medium">${getAccountName(toCreditor)}</span>
                    </div>
                </div>
            </div>
            
            ${transaction.migrationReason ? `
                <div class="text-xs text-gray-600 mb-3">
                    <span class="font-semibold">Migration Note:</span> ${transaction.migrationReason}
                </div>
            ` : ''}
            
            ${transaction.migrationConfidence ? `
                <div class="text-xs text-gray-600 mb-3">
                    <span class="font-semibold">Confidence:</span> ${transaction.migrationConfidence}%
                </div>
            ` : ''}
            
            <div class="flex gap-2">
                <button class="btn-approve px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm">
                    ✓ Approve
                </button>
                <button class="btn-reject px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm">
                    ✗ Reject
                </button>
                <button class="btn-edit px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
                    ✎ Edit
                </button>
            </div>
        </div>
    `;
}

/**
 * Setup event listeners for a review item
 */
function setupReviewItemListeners(container, transaction, index) {
    const item = container.querySelector(`#review-item-${index}`);
    if (!item) return;
    
    // Approve button
    item.querySelector('.btn-approve')?.addEventListener('click', async () => {
        await handleApproveReview(container, transaction);
    });
    
    // Reject button
    item.querySelector('.btn-reject')?.addEventListener('click', async () => {
        await handleRejectReview(container, transaction);
    });
    
    // Edit button
    item.querySelector('.btn-edit')?.addEventListener('click', () => {
        handleEditReview(transaction);
    });
}

/**
 * Handle approve review
 */
async function handleApproveReview(container, transaction) {
    try {
        await approvePendingMigration(transaction.id, {
            debtor: transaction.debtor || transaction.islemCari,
            fromCreditor: transaction.fromCreditor || transaction.kaynakCari,
            toCreditor: transaction.toCreditor || transaction.hedefCari
        });
        
        showSuccess('Transaction approved');
        await loadData();
        await renderReviewQueue(container);
        renderStatistics(container);
    } catch (error) {
        console.error('Approve failed:', error);
        showError('Approve failed: ' + error.message);
    }
}

/**
 * Handle reject review
 */
async function handleRejectReview(container, transaction) {
    const reason = prompt('Please provide a reason for rejection:');
    if (!reason) return;
    
    try {
        await rejectPendingMigration(transaction.id, reason);
        
        showSuccess('Transaction rejected');
        await loadData();
        await renderReviewQueue(container);
        renderStatistics(container);
    } catch (error) {
        console.error('Reject failed:', error);
        showError('Reject failed: ' + error.message);
    }
}

/**
 * Handle edit review
 */
function handleEditReview(transaction) {
    // This would open a modal or inline editor
    // For now, just show an alert
    alert('Edit functionality would open a modal to manually adjust the three-party structure.\n\nTransaction ID: ' + transaction.id);
}

/**
 * Show progress indicator
 */
function showProgress(message, percent) {
    const indicator = document.querySelector('#progress-indicator');
    if (!indicator) return;
    
    indicator.classList.remove('hidden');
    indicator.innerHTML = `
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div class="text-blue-800 font-medium mb-2">${message}</div>
            <div class="w-full bg-blue-200 rounded-full h-2">
                <div class="bg-blue-600 h-2 rounded-full transition-all duration-300" style="width: ${percent}%"></div>
            </div>
        </div>
    `;
}

/**
 * Hide progress indicator
 */
function hideProgress() {
    const indicator = document.querySelector('#progress-indicator');
    if (indicator) {
        indicator.classList.add('hidden');
    }
}

/**
 * Show success message
 */
function showSuccess(message) {
    // Simple implementation - could be replaced with a toast library
    alert('✓ ' + message);
}

/**
 * Show error message
 */
function showError(message) {
    // Simple implementation - could be replaced with a toast library
    alert('✗ ' + message);
}

