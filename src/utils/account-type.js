/**
 * Account Type Utility
 * 
 * Distinguishes between internal (bank/cash accounts) and external (supplier/customer) accounts
 * to ensure accurate financial reporting.
 * 
 * Internal accounts: System-owned accounts (banks, cash, company accounts)
 * External accounts: Suppliers, customers, staff, vendors
 */

/**
 * Internal account keywords and patterns
 * Used to identify bank and cash accounts
 */
const INTERNAL_ACCOUNT_PATTERNS = [
    // Turkish variations
    'motifera',
    'motfera', 
    'mutufera',
    'banka',
    'bank',
    'kasa',
    'cash',
    'nakit',
    'hesap',
    'account',
    'şirket hesabı',
    'company account',
    'işletme hesabı',
    // Bank name patterns
    'ziraat',
    'vakıfbank',
    'garanti',
    'akbank',
    'yapı kredi',
    'iş bankası',
    'halkbank',
    'denizbank',
    'teb',
    'finansbank',
    'qnb',
    'ing',
    // Account type indicators
    'vadesiz',
    'checking',
    'tasarruf',
    'savings',
    'mevduat',
    'deposit'
];

/**
 * External account type keywords
 * Used to identify supplier/customer accounts
 */
const EXTERNAL_ACCOUNT_TYPES = [
    'tedarikçi',
    'supplier',
    'müşteri',
    'customer',
    'client',
    'personel',
    'staff',
    'çalışan',
    'employee',
    'vendor'
];

/**
 * Determine if an account is internal (bank/cash) or external (supplier/customer)
 * @param {Object} account - Account object with unvan, tipi, etc.
 * @returns {"internal" | "external"} Account type
 */
export function getAccountType(account) {
    if (!account) return "external";
    
    // Check if accountType field is explicitly set
    if (account.accountType === "internal" || account.accountType === "external") {
        return account.accountType;
    }
    
    // Check account name (unvan) for internal patterns
    const unvan = String(account.unvan || "").toLowerCase().trim();
    if (unvan) {
        // Check if matches any internal pattern
        const matchesInternal = INTERNAL_ACCOUNT_PATTERNS.some(pattern => 
            unvan.includes(pattern.toLowerCase())
        );
        
        if (matchesInternal) {
            return "internal";
        }
    }
    
    // Check account type (tipi) field
    const tipi = String(account.tipi || "").toLowerCase().trim();
    if (tipi) {
        // Check if explicitly marked as external type
        const matchesExternal = EXTERNAL_ACCOUNT_TYPES.some(type => 
            tipi.includes(type.toLowerCase())
        );
        
        if (matchesExternal) {
            return "external";
        }
        
        // Check if marked as internal type
        const matchesInternal = INTERNAL_ACCOUNT_PATTERNS.some(pattern => 
            tipi.includes(pattern.toLowerCase())
        );
        
        if (matchesInternal) {
            return "internal";
        }
    }
    
    // Default to external (conservative approach - most accounts are suppliers/customers)
    return "external";
}

/**
 * Check if account is an internal bank/cash account
 * @param {Object} account - Account object
 * @returns {boolean} True if internal account
 */
export function isInternalAccount(account) {
    return getAccountType(account) === "internal";
}

/**
 * Check if account is an external supplier/customer account
 * @param {Object} account - Account object
 * @returns {boolean} True if external account
 */
export function isExternalAccount(account) {
    return getAccountType(account) === "external";
}

/**
 * Check if transaction involves any internal accounts
 * @param {Object} transaction - Transaction object
 * @param {Function} getAccount - Function to get account by ID
 * @returns {boolean} True if transaction involves internal account
 */
export function transactionInvolvesInternalAccount(transaction, getAccount) {
    if (!transaction || typeof getAccount !== 'function') return false;
    
    const accountIds = [
        transaction.islemCari,
        transaction.kaynakCari,
        transaction.hedefCari
    ].filter(Boolean);
    
    for (const accountId of accountIds) {
        const account = getAccount(accountId);
        if (account && isInternalAccount(account)) {
            return true;
        }
    }
    
    return false;
}

/**
 * Filter accounts by type
 * @param {Array} accounts - Array of account objects
 * @param {"internal" | "external"} type - Type to filter
 * @returns {Array} Filtered accounts
 */
export function filterAccountsByType(accounts, type) {
    if (!Array.isArray(accounts)) return [];
    
    return accounts.filter(account => {
        const accountType = getAccountType(account);
        return accountType === type;
    });
}

/**
 * Get internal accounts (banks, cash)
 * @param {Array} accounts - Array of account objects
 * @returns {Array} Internal accounts
 */
export function getInternalAccounts(accounts) {
    return filterAccountsByType(accounts, "internal");
}

/**
 * Get external accounts (suppliers, customers)
 * @param {Array} accounts - Array of account objects
 * @returns {Array} External accounts
 */
export function getExternalAccounts(accounts) {
    return filterAccountsByType(accounts, "external");
}

/**
 * Get human-readable label for account type
 * @param {"internal" | "external"} type - Account type
 * @returns {string} Turkish label
 */
export function getAccountTypeLabel(type) {
    switch (type) {
        case "internal":
            return "Banka/Kasa";
        case "external":
            return "Cari";
        default:
            return "Bilinmeyen";
    }
}

/**
 * Enrich account object with accountType field
 * @param {Object} account - Account object
 * @returns {Object} Account with accountType field
 */
export function enrichAccountWithType(account) {
    if (!account) return account;
    
    return {
        ...account,
        accountType: getAccountType(account)
    };
}

/**
 * Enrich array of accounts with accountType field
 * @param {Array} accounts - Array of account objects
 * @returns {Array} Accounts with accountType field
 */
export function enrichAccountsWithType(accounts) {
    if (!Array.isArray(accounts)) return [];
    
    return accounts.map(enrichAccountWithType);
}

