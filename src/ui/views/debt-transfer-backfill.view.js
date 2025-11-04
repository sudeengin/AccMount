/**
 * Debt Transfer Balance Backfill View
 * 
 * Admin interface for correcting historical balance errors from debt transfers
 */

import { fetchRecentAccounts } from '../../data/accounts.repo.js';
import { fetchRecentTransactions } from '../../data/transactions.repo.js';
import {
    dryRun,
    applyBalanceCorrections,
    verifyCorrections,
    getCorrectionSummary,
    exportCorrectionReport,
    needsCorrection
} from '../../utils/debt-transfer-backfill.js';

let state = {
    accounts: [],
    transactions: [],
    analysis: null,
    isLoading: false,
    hasRun: false,
    result: null
};

/**
 * Render the backfill view
 */
export async function renderBackfillView(container) {
    container.innerHTML = `
        <div class="max-w-7xl mx-auto px-4 py-8">
            <!-- Header -->
            <div class="mb-8">
                <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                    Debt Transfer Balance Correction
                </h1>
                <p class="text-gray-600 dark:text-gray-400">
                    Fix historical account balances affected by incorrect debt transfer calculations
                </p>
            </div>

            <!-- Warning Banner -->
            <div class="mb-6 bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 p-4 rounded">
                <div class="flex">
                    <div class="flex-shrink-0">
                        <svg class="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                        </svg>
                    </div>
                    <div class="ml-3">
                        <p class="text-sm text-yellow-700 dark:text-yellow-400">
                            <strong>Admin Function:</strong> This tool recalculates all account balances from transaction history.
                            Run the analysis first to see what will be changed.
                        </p>
                    </div>
                </div>
            </div>

            <!-- Analysis Section -->
            <div id="analysis-section" class="mb-8">
                <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                    <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-4">
                        Step 1: Analyze Balances
                    </h2>
                    <p class="text-gray-600 dark:text-gray-400 mb-4">
                        Check which accounts have balance discrepancies and need correction.
                    </p>
                    <button id="btn-analyze" 
                        class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
                        🔍 Analyze Balances
                    </button>
                </div>
            </div>

            <!-- Results Display -->
            <div id="results-section" class="hidden mb-8">
                <!-- Will be populated with analysis results -->
            </div>

            <!-- Action Buttons -->
            <div id="action-section" class="hidden mb-8">
                <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                    <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-4">
                        Step 2: Apply Corrections
                    </h2>
                    <div class="flex flex-wrap gap-4">
                        <button id="btn-apply" 
                            class="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium">
                            ✅ Apply Corrections
                        </button>
                        <button id="btn-export" 
                            class="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium">
                            📥 Export Report
                        </button>
                        <button id="btn-refresh" 
                            class="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium">
                            🔄 Refresh Analysis
                        </button>
                    </div>
                </div>
            </div>

            <!-- Progress Indicator -->
            <div id="progress-section" class="hidden mb-8">
                <!-- Progress bar will be rendered here -->
            </div>

            <!-- Completion Section -->
            <div id="completion-section" class="hidden mb-8">
                <!-- Completion results will be rendered here -->
            </div>
        </div>
    `;

    // Load data and setup listeners
    await loadData();
    setupEventListeners(container);
}

/**
 * Load accounts and transactions
 */
async function loadData() {
    state.isLoading = true;
    showLoading('Loading data...');
    
    try {
        // Load all accounts and transactions
        state.accounts = await fetchRecentAccounts(10000);
        state.transactions = await fetchRecentTransactions(10000);
        
        console.log(`Loaded ${state.accounts.length} accounts and ${state.transactions.length} transactions`);
        hideLoading();
    } catch (error) {
        console.error('Failed to load data:', error);
        showError('Failed to load data: ' + error.message);
        hideLoading();
    } finally {
        state.isLoading = false;
    }
}

/**
 * Setup event listeners
 */
function setupEventListeners(container) {
    // Analyze button
    container.querySelector('#btn-analyze')?.addEventListener('click', async () => {
        await handleAnalyze(container);
    });
    
    // Apply button
    container.querySelector('#btn-apply')?.addEventListener('click', async () => {
        await handleApply(container);
    });
    
    // Export button
    container.querySelector('#btn-export')?.addEventListener('click', () => {
        handleExport();
    });
    
    // Refresh button
    container.querySelector('#btn-refresh')?.addEventListener('click', async () => {
        await handleAnalyze(container);
    });
}

/**
 * Handle analyze action
 */
async function handleAnalyze(container) {
    if (state.isLoading) return;
    
    state.isLoading = true;
    showLoading('Analyzing balances...');
    
    try {
        // Run dry run analysis
        state.analysis = dryRun(state.accounts, state.transactions);
        
        console.log('Analysis complete:', state.analysis);
        
        // Render results
        renderAnalysisResults(container);
        
        // Show action buttons if corrections needed
        const actionSection = container.querySelector('#action-section');
        if (state.analysis.needsCorrection) {
            actionSection?.classList.remove('hidden');
        } else {
            actionSection?.classList.add('hidden');
        }
        
        hideLoading();
    } catch (error) {
        console.error('Analysis failed:', error);
        showError('Analysis failed: ' + error.message);
        hideLoading();
    } finally {
        state.isLoading = false;
    }
}

/**
 * Handle apply corrections action
 */
async function handleApply(container) {
    if (state.isLoading) return;
    
    // Confirmation dialog
    const confirmed = confirm(
        `Apply balance corrections to ${state.analysis?.accountsToUpdate || 0} accounts?\n\n` +
        'This will update account balances based on recalculated transaction history.\n' +
        'This operation is safe and idempotent (can be run multiple times).\n\n' +
        'Click OK to proceed or Cancel to abort.'
    );
    
    if (!confirmed) return;
    
    state.isLoading = true;
    
    try {
        // Show progress section
        const progressSection = container.querySelector('#progress-section');
        progressSection?.classList.remove('hidden');
        
        // Apply corrections with progress callback
        state.result = await applyBalanceCorrections(
            state.accounts,
            state.transactions,
            (current, total) => {
                const percent = Math.round((current / total) * 100);
                showProgress(`Correcting balances: ${current} / ${total}`, percent);
            }
        );
        
        console.log('Corrections applied:', state.result);
        
        // Reload data to verify
        await loadData();
        
        // Verify corrections
        const verification = verifyCorrections(state.accounts, state.transactions);
        
        // Render completion
        renderCompletion(container, verification);
        
        // Hide progress, show completion
        progressSection?.classList.add('hidden');
        
        state.hasRun = true;
        showSuccess(`Successfully corrected ${state.result.correctedCount} account balances!`);
        
    } catch (error) {
        console.error('Apply failed:', error);
        showError('Failed to apply corrections: ' + error.message);
    } finally {
        state.isLoading = false;
    }
}

/**
 * Handle export report action
 */
function handleExport() {
    if (!state.accounts || !state.transactions) {
        showError('No data to export');
        return;
    }
    
    try {
        const blob = exportCorrectionReport(state.accounts, state.transactions);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `debt-transfer-correction-report-${new Date().toISOString().split('T')[0]}.txt`;
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
 * Render analysis results
 */
function renderAnalysisResults(container) {
    const resultsSection = container.querySelector('#results-section');
    if (!resultsSection || !state.analysis) return;
    
    resultsSection.classList.remove('hidden');
    
    const { needsCorrection, corrections, statistics, accountsToUpdate } = state.analysis;
    
    if (!needsCorrection) {
        resultsSection.innerHTML = `
            <div class="bg-green-50 dark:bg-green-900/20 border-l-4 border-green-400 p-6 rounded">
                <div class="flex items-center">
                    <svg class="h-6 w-6 text-green-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                        <h3 class="text-lg font-bold text-green-800 dark:text-green-400">
                            ✓ All Balances Correct
                        </h3>
                        <p class="text-green-700 dark:text-green-300 mt-1">
                            No corrections needed. All account balances are accurate.
                        </p>
                        <p class="text-sm text-green-600 dark:text-green-400 mt-2">
                            Analyzed ${state.accounts.length} accounts and ${statistics.active} active debt transfers.
                        </p>
                    </div>
                </div>
            </div>
        `;
        return;
    }
    
    const summary = getCorrectionSummary(state.accounts, state.transactions);
    
    resultsSection.innerHTML = `
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Analysis Results
            </h2>
            
            <!-- Summary Stats -->
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div class="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
                    <div class="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                        ${accountsToUpdate}
                    </div>
                    <div class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Accounts Need Correction
                    </div>
                </div>
                <div class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div class="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        ${state.accounts.length}
                    </div>
                    <div class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Total Accounts
                    </div>
                </div>
                <div class="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
                    <div class="text-2xl font-bold text-purple-600 dark:text-purple-400">
                        ${statistics.active}
                    </div>
                    <div class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Active Debt Transfers
                    </div>
                </div>
                <div class="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
                    <div class="text-2xl font-bold text-red-600 dark:text-red-400">
                        ${formatCurrency(summary.maxDifference)}
                    </div>
                    <div class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Max Difference
                    </div>
                </div>
            </div>
            
            <!-- Corrections Table -->
            <div class="mb-4">
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                    Accounts Requiring Correction
                </h3>
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead class="bg-gray-50 dark:bg-gray-900">
                            <tr>
                                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Account</th>
                                <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Current</th>
                                <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Correct</th>
                                <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Difference</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                            ${corrections.slice(0, 20).map(c => `
                                <tr class="hover:bg-gray-50 dark:hover:bg-gray-700">
                                    <td class="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">${c.accountName}</td>
                                    <td class="px-4 py-3 text-sm text-right ${getBalanceClass(c.currentBalance)}">${formatCurrency(c.currentBalance)}</td>
                                    <td class="px-4 py-3 text-sm text-right ${getBalanceClass(c.calculatedBalance)}">${formatCurrency(c.calculatedBalance)}</td>
                                    <td class="px-4 py-3 text-sm text-right font-semibold ${getDifferenceClass(c.difference)}">${formatCurrency(c.difference)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    ${corrections.length > 20 ? `
                        <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">
                            Showing 20 of ${corrections.length} accounts. Export report for full list.
                        </p>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
}

/**
 * Render completion results
 */
function renderCompletion(container, verification) {
    const completionSection = container.querySelector('#completion-section');
    if (!completionSection) return;
    
    completionSection.classList.remove('hidden');
    
    const isSuccess = verification.success;
    
    completionSection.innerHTML = `
        <div class="bg-${isSuccess ? 'green' : 'yellow'}-50 dark:bg-${isSuccess ? 'green' : 'yellow'}-900/20 border-l-4 border-${isSuccess ? 'green' : 'yellow'}-400 p-6 rounded">
            <div class="flex items-start">
                <svg class="h-6 w-6 text-${isSuccess ? 'green' : 'yellow'}-400 mr-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${isSuccess ? 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' : 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'}" />
                </svg>
                <div class="flex-1">
                    <h3 class="text-lg font-bold text-${isSuccess ? 'green' : 'yellow'}-800 dark:text-${isSuccess ? 'green' : 'yellow'}-400">
                        ${isSuccess ? '✓ Corrections Applied Successfully' : '⚠ Corrections Applied with Warnings'}
                    </h3>
                    <p class="text-${isSuccess ? 'green' : 'yellow'}-700 dark:text-${isSuccess ? 'green' : 'yellow'}-300 mt-2">
                        ${verification.message}
                    </p>
                    
                    ${state.result ? `
                        <div class="mt-4 space-y-2 text-sm text-${isSuccess ? 'green' : 'yellow'}-600 dark:text-${isSuccess ? 'green' : 'yellow'}-400">
                            <div>✓ Corrected: ${state.result.correctedCount} accounts</div>
                            <div>✓ Skipped: ${state.result.skippedCount} accounts (already correct)</div>
                            ${!isSuccess ? `<div>⚠ Remaining Issues: ${verification.remainingIssues}</div>` : ''}
                        </div>
                    ` : ''}
                    
                    ${!isSuccess ? `
                        <button class="mt-4 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-sm font-medium"
                            onclick="location.reload()">
                            🔄 Reload and Retry
                        </button>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
}

/**
 * Show progress indicator
 */
function showProgress(message, percent) {
    const progressSection = document.querySelector('#progress-section');
    if (!progressSection) return;
    
    progressSection.classList.remove('hidden');
    progressSection.innerHTML = `
        <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div class="text-blue-800 dark:text-blue-400 font-medium mb-2">${message}</div>
            <div class="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2">
                <div class="bg-blue-600 dark:bg-blue-400 h-2 rounded-full transition-all duration-300" style="width: ${percent}%"></div>
            </div>
        </div>
    `;
}

/**
 * Show loading indicator
 */
function showLoading(message) {
    showProgress(message, 50);
}

/**
 * Hide loading indicator
 */
function hideLoading() {
    const progressSection = document.querySelector('#progress-section');
    if (progressSection) {
        progressSection.classList.add('hidden');
    }
}

/**
 * Show success message
 */
function showSuccess(message) {
    alert('✓ ' + message);
}

/**
 * Show error message
 */
function showError(message) {
    alert('✗ ' + message);
}

/**
 * Get CSS class for balance display
 */
function getBalanceClass(balance) {
    if (balance > 0) return 'text-green-600 dark:text-green-400';
    if (balance < 0) return 'text-red-600 dark:text-red-400';
    return 'text-gray-600 dark:text-gray-400';
}

/**
 * Get CSS class for difference display
 */
function getDifferenceClass(difference) {
    if (Math.abs(difference) < 0.01) return 'text-gray-600 dark:text-gray-400';
    if (difference > 0) return 'text-green-600 dark:text-green-400';
    return 'text-red-600 dark:text-red-400';
}

/**
 * Format currency
 */
function formatCurrency(value) {
    const numeric = Number(value) || 0;
    return numeric.toLocaleString('tr-TR', {
        style: 'currency',
        currency: 'TRY',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

