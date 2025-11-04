/**
 * Transaction Direction Validation Utility
 * 
 * This utility provides functions to validate and test the transaction direction
 * implementation. Can be used in browser console for manual testing.
 */

import { 
    getTransactionDirection, 
    getDirectionLabel, 
    ensureTransactionDirection,
    hasValidDirection
} from './transaction-direction.js';

/**
 * Test all transaction types
 */
export function testAllTransactionTypes() {
    const testCases = [
        { type: 'gelir', expectedDirection: +1, expectedLabel: 'Gelir' },
        { type: 'tahsilat', expectedDirection: +1, expectedLabel: 'Gelir' },
        { type: 'gider', expectedDirection: -1, expectedLabel: 'Gider' },
        { type: 'ödeme', expectedDirection: -1, expectedLabel: 'Gider' },
        { type: 'odeme', expectedDirection: -1, expectedLabel: 'Gider' },
        { type: 'transfer', expectedDirection: -1, expectedLabel: 'Gider' },
        { type: 'borç transferi', expectedDirection: -1, expectedLabel: 'Gider' },
    ];

    console.group('🧪 Transaction Direction Tests');
    let passed = 0;
    let failed = 0;

    testCases.forEach(({ type, expectedDirection, expectedLabel }) => {
        const actualDirection = getTransactionDirection(type);
        const actualLabel = getDirectionLabel(actualDirection);
        
        const isCorrect = actualDirection === expectedDirection && actualLabel === expectedLabel;
        
        if (isCorrect) {
            console.log(`✅ ${type}: ${actualDirection} (${actualLabel})`);
            passed++;
        } else {
            console.error(`❌ ${type}: Expected ${expectedDirection} (${expectedLabel}), got ${actualDirection} (${actualLabel})`);
            failed++;
        }
    });

    console.groupEnd();
    console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
    
    return { passed, failed, total: testCases.length };
}

/**
 * Test backward compatibility with legacy transactions
 */
export function testBackwardCompatibility() {
    console.group('🔄 Backward Compatibility Tests');
    
    // Test transaction without direction field
    const legacyTransaction = {
        islemTipi: 'gelir',
        tutar: 1000,
        aciklama: 'Test gelir'
    };
    
    const enhanced = ensureTransactionDirection(legacyTransaction);
    console.log('Legacy transaction:', legacyTransaction);
    console.log('Enhanced transaction:', enhanced);
    
    const hasDirection = hasValidDirection(enhanced);
    console.log(`Has valid direction: ${hasDirection ? '✅ Yes' : '❌ No'}`);
    
    // Test transaction with existing direction
    const modernTransaction = {
        islemTipi: 'gider',
        tutar: 500,
        direction: -1
    };
    
    const unchanged = ensureTransactionDirection(modernTransaction);
    console.log('\nModern transaction:', modernTransaction);
    console.log('After ensure:', unchanged);
    console.log(`Direction preserved: ${unchanged.direction === -1 ? '✅ Yes' : '❌ No'}`);
    
    console.groupEnd();
}

/**
 * Test edge cases and error handling
 */
export function testEdgeCases() {
    console.group('⚠️  Edge Case Tests');
    
    const edgeCases = [
        { input: null, expected: 0, description: 'null input' },
        { input: '', expected: 0, description: 'empty string' },
        { input: 'unknown_type', expected: 0, description: 'unknown type' },
        { input: 'GELIR', expected: +1, description: 'uppercase GELIR' },
        { input: 'Gider', expected: -1, description: 'mixed case Gider' },
        { input: '  gelir  ', expected: +1, description: 'gelir with whitespace' },
    ];

    edgeCases.forEach(({ input, expected, description }) => {
        const result = getTransactionDirection(input);
        const isCorrect = result === expected;
        
        if (isCorrect) {
            console.log(`✅ ${description}: ${result}`);
        } else {
            console.error(`❌ ${description}: Expected ${expected}, got ${result}`);
        }
    });
    
    console.groupEnd();
}

/**
 * Validate a batch of transactions
 * @param {Array} transactions - Array of transaction objects
 * @returns {Object} Validation results
 */
export function validateTransactionBatch(transactions) {
    if (!Array.isArray(transactions)) {
        console.error('❌ Input must be an array of transactions');
        return null;
    }

    console.group(`📋 Validating ${transactions.length} transactions`);
    
    const results = {
        total: transactions.length,
        withDirection: 0,
        withoutDirection: 0,
        incomeCount: 0,
        expenseCount: 0,
        unknownCount: 0,
        errors: []
    };

    transactions.forEach((tx, index) => {
        try {
            const enhanced = ensureTransactionDirection(tx);
            
            if (hasValidDirection(tx)) {
                results.withDirection++;
            } else {
                results.withoutDirection++;
            }
            
            if (enhanced.direction === +1) results.incomeCount++;
            else if (enhanced.direction === -1) results.expenseCount++;
            else results.unknownCount++;
            
        } catch (error) {
            results.errors.push({ index, error: error.message, transaction: tx });
        }
    });

    console.log(`✅ With direction: ${results.withDirection}`);
    console.log(`⚠️  Without direction: ${results.withoutDirection}`);
    console.log(`📈 Income (+1): ${results.incomeCount}`);
    console.log(`📉 Expense (-1): ${results.expenseCount}`);
    console.log(`❓ Unknown (0): ${results.unknownCount}`);
    
    if (results.errors.length > 0) {
        console.error(`❌ Errors: ${results.errors.length}`);
        console.table(results.errors);
    }
    
    console.groupEnd();
    
    return results;
}

/**
 * Run all validation tests
 */
export function runAllTests() {
    console.log('🚀 Running Transaction Direction Validation Tests\n');
    
    const typeTestResults = testAllTransactionTypes();
    console.log('\n');
    
    testBackwardCompatibility();
    console.log('\n');
    
    testEdgeCases();
    console.log('\n');
    
    const allPassed = typeTestResults.failed === 0;
    
    console.log('\n' + '='.repeat(50));
    if (allPassed) {
        console.log('✅ All tests passed! Transaction direction implementation is working correctly.');
    } else {
        console.error('❌ Some tests failed. Please review the errors above.');
    }
    console.log('='.repeat(50));
    
    return allPassed;
}

// Make functions available in browser console
if (typeof window !== 'undefined') {
    window.validateTransactionDirection = {
        testAll: runAllTests,
        testTypes: testAllTransactionTypes,
        testBackwardCompatibility,
        testEdgeCases,
        validateBatch: validateTransactionBatch
    };
    
    console.log('💡 Transaction direction validation utilities loaded!');
    console.log('Usage in console:');
    console.log('  window.validateTransactionDirection.testAll()');
    console.log('  window.validateTransactionDirection.testTypes()');
    console.log('  window.validateTransactionDirection.testBackwardCompatibility()');
    console.log('  window.validateTransactionDirection.validateBatch(transactions)');
}

