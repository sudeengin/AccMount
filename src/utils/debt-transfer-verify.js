/**
 * Debt Transfer Balance Verification Utility
 * Run this in console to verify all balance calculations are consistent
 */

import { calculateDebtTransferImpact } from './debt-transfer.js';
import { calculateAccountBalance } from './account-reset.js';

/**
 * Verify debt transfer balance consistency
 * @param {Object} transaction - Debt transfer transaction
 * @param {Array} allTransactions - All transactions for balance calculation
 * @returns {Object} Verification result
 */
export function verifyDebtTransferBalances(transaction, allTransactions = []) {
    const amount = Math.abs(Number(transaction.toplamTutar || transaction.tutar || 0));
    
    // Get impacts from core calculation
    const debtorImpact = calculateDebtTransferImpact(transaction, transaction.islemCari);
    const lenderImpact = calculateDebtTransferImpact(transaction, transaction.kaynakCari);
    const settledImpact = calculateDebtTransferImpact(transaction, transaction.hedefCari);
    
    // Verify canonical rules
    const checks = {
        debtorIsZero: Math.abs(debtorImpact) < 0.01,
        lenderIsPositive: Math.abs(lenderImpact - amount) < 0.01,
        settledIsNegative: Math.abs(settledImpact + amount) < 0.01,
        sumIsZero: Math.abs(debtorImpact + lenderImpact + settledImpact) < 0.01
    };
    
    const allCorrect = Object.values(checks).every(v => v);
    
    return {
        success: allCorrect,
        transaction: transaction.id || 'new',
        amount,
        impacts: {
            debtor: debtorImpact,
            lender: lenderImpact,
            settled: settledImpact
        },
        checks,
        expected: {
            debtor: 0,
            lender: amount,
            settled: -amount
        }
    };
}

/**
 * Test debt transfer with sample data
 */
export function runVerificationTest() {
    const testTransaction = {
        islemTipi: 'borç transferi',
        islemCari: 'debtor-1',
        kaynakCari: 'lender-1',
        hedefCari: 'settled-1',
        toplamTutar: 200,
        tutar: 200
    };
    
    const result = verifyDebtTransferBalances(testTransaction);
    
    console.log('═══════════════════════════════════════════════════════');
    console.log('  DEBT TRANSFER BALANCE VERIFICATION');
    console.log('═══════════════════════════════════════════════════════');
    console.log('Status:', result.success ? '✅ PASS' : '❌ FAIL');
    console.log('Amount:', result.amount);
    console.log('\nCalculated Impacts:');
    console.log('  Debtor:  ', result.impacts.debtor);
    console.log('  Lender:  ', result.impacts.lender);
    console.log('  Settled: ', result.impacts.settled);
    console.log('\nExpected:');
    console.log('  Debtor:  ', result.expected.debtor);
    console.log('  Lender:  ', result.expected.lender);
    console.log('  Settled: ', result.expected.settled);
    console.log('\nChecks:');
    console.log('  Debtor is 0:       ', result.checks.debtorIsZero ? '✅' : '❌');
    console.log('  Lender is +amount: ', result.checks.lenderIsPositive ? '✅' : '❌');
    console.log('  Settled is -amount:', result.checks.settledIsNegative ? '✅' : '❌');
    console.log('  Sum is 0:          ', result.checks.sumIsZero ? '✅' : '❌');
    console.log('═══════════════════════════════════════════════════════');
    
    return result;
}

