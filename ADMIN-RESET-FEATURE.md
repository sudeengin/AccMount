# Administrative Account Reset Feature

## Overview
This document describes the Administrative Account Reset feature that allows authorized users to manually reset account balances to zero without affecting other accounts or creating actual financial transactions.

## Feature Description

The Administrative Reset feature provides a safe way to reset a customer/vendor account balance to zero. This is useful for:
- Correcting accumulated errors in account balances
- Starting fresh with an account after reconciliation
- Administrative adjustments that don't represent actual financial events

### Key Characteristics
- **Non-Financial**: Reset transactions do not represent actual money movement
- **Transparent**: All reset actions are recorded in the transaction history
- **Traceable**: Reset transactions are clearly marked with a special badge and type
- **Safe**: Only affects the specific account being reset
- **Admin-Only**: Only authenticated users can perform resets (ready for role-based access control when implemented)

## Implementation Details

### 1. Backend/Data Layer

#### New Transaction Type
A new transaction type `administrative_reset` has been added with the following properties:
```javascript
{
  islemTipi: 'administrative_reset',
  direction: 0,  // Neutral direction (neither income nor expense)
  is_system_adjustment: true,
  tutar: Math.abs(adjustmentAmount),
  toplamTutar: Math.abs(adjustmentAmount),
  aciklama: 'Hesap manuel olarak sıfırlandı.',
  // ... other standard transaction fields
}
```

#### Utility Functions
**File:** `/src/utils/account-reset.js`

Key functions:
- `calculateAccountBalance(accountId, allTransactions)` - Calculate current balance from transaction history
- `hasBeenReset(accountId, allTransactions)` - Check if account has been reset
- `getLastResetTransaction(accountId, allTransactions)` - Get the most recent reset transaction
- `resetAccountBalance(accountId, allTransactions)` - Execute the reset operation
- `canResetAccounts()` - Check if current user has permission to reset accounts

#### Safety Features
- Validates user authentication
- Checks if balance is already zero before resetting
- Uses Firestore transactions to ensure data consistency
- Updates both transaction history and account balance atomically
- Records who performed the reset and when

### 2. Frontend UI Components

#### Reset Button
**Location:** Account detail view header (next to balance display)

**Appearance:**
- Blue-themed button with refresh/reset icon
- Only visible when user has reset permissions
- Label: "Sıfırla" (Reset)
- Tooltip: "Hesabı Sıfırla (Admin)"

**Behavior:**
- Clicking opens a confirmation modal
- Disabled during the reset operation
- Shows loading spinner while processing
- Automatically refreshes page after successful reset

#### Reset Indicator Badge
**Location:** Account detail view header (next to account name)

**Appearance:**
- Slate-colored badge with refresh icon
- Text: "Sıfırlandı" (Reset)
- Only visible for accounts that have been reset
- Tooltip: "Bu hesap manuel olarak sıfırlandı"

#### Confirmation Modal
Uses the existing confirmation modal with custom messaging:
- **Title:** "Hesabı Sıfırla"
- **Message:** Explains what the reset does and that it's not a financial transaction
- **Confirm Button:** "Evet, Sıfırla" (Yes, Reset)
- **Cancel Button:** "İptal" (Cancel)

### 3. Transaction Display

#### Transaction List
Reset transactions appear in the transaction history with:
- **Type Badge:** Gray/slate colored badge with "Sıfırlama (Admin)" label
- **Amount Display:** Shows the adjustment amount in gray/neutral color
- **Description:** "Hesap manuel olarak sıfırlandı."
- **Italic Style:** Badge text is italicized to distinguish from regular transactions

#### Transaction Filter
The transaction type filter dropdown includes:
- **New Option:** "Sıfırlama (Admin)" (administrative_reset)
- Allows filtering to show only reset transactions

### 4. CSV Export

Reset transactions are properly labeled in CSV exports:
- **İşlem Tipi (Kod):** `administrative_reset`
- **İşlem Tipi:** `Sıfırlama (Admin)`
- All standard transaction fields are included
- Description clearly indicates administrative adjustment

## Usage Guide

### How to Reset an Account Balance

1. **Navigate to Account Details**
   - Go to the "Cariler" (Accounts) view
   - Click on the account you want to reset

2. **Locate the Reset Button**
   - Look in the top-right corner of the account detail header
   - The button appears next to the balance display
   - If you don't see the button, you may not have permission to reset accounts

3. **Initiate Reset**
   - Click the "Sıfırla" (Reset) button
   - Read the confirmation message carefully

4. **Confirm Reset**
   - Click "Evet, Sıfırla" (Yes, Reset) to proceed
   - Or click "İptal" (Cancel) to abort

5. **Wait for Completion**
   - The button will show a loading spinner
   - A success message will appear
   - The page will automatically refresh

6. **Verify Reset**
   - Check that the account balance is now zero
   - Look for the "Sıfırlandı" badge next to the account name
   - View the transaction history to see the reset record

### Viewing Reset History

1. **In Transaction List**
   - Reset transactions appear with a gray "Sıfırlama (Admin)" badge
   - The amount shows the adjustment made
   - Date and description are included

2. **Filtering Reset Transactions**
   - Use the "İşlem Tipi" filter dropdown
   - Select "Sıfırlama (Admin)"
   - Only reset transactions will be displayed

3. **In CSV Exports**
   - Export the account's transactions to CSV
   - Reset transactions are labeled "Sıfırlama (Admin)"
   - All details are preserved in the export

## Technical Notes

### Balance Calculation
The reset transaction is included in balance calculations:
```javascript
if (tx.islemTipi === 'administrative_reset') {
    balance += adjustmentAmount;  // adjustmentAmount is negative of current balance
}
```

### Data Model
Reset transactions follow the standard transaction schema with these additions:
- `is_system_adjustment`: true
- `adjusted_by`: User ID who performed the reset
- `adjustment_amount`: The amount added to reach zero
- `lastResetAt`: Timestamp (on account record)
- `lastResetBy`: User ID (on account record)

### Future Enhancements
When user roles are implemented:
1. Update `canResetAccounts()` to check for admin role
2. Add role-based UI visibility controls
3. Add audit logging for reset operations
4. Consider adding reset approval workflow for high-value accounts

## Security Considerations

### Current Implementation
- All authenticated users can reset accounts
- Operations are logged with user ID
- Changes are atomic and transaction-safe
- No way to accidentally lose transaction history

### Recommended Role-Based Access
When user roles are implemented, restrict reset capability to:
- System administrators
- Account managers
- Senior financial staff

### Audit Trail
All reset operations are permanently recorded:
- In the transaction history
- With user ID of who performed reset
- With timestamp of when reset occurred
- With the exact adjustment amount

## Testing Checklist

- [ ] Reset button appears for authenticated users
- [ ] Reset button is hidden for non-authenticated users
- [ ] Clicking reset shows confirmation modal
- [ ] Canceling confirmation closes modal without changes
- [ ] Confirming reset creates administrative_reset transaction
- [ ] Account balance becomes zero after reset
- [ ] Reset badge appears after successful reset
- [ ] Reset transaction appears in transaction list
- [ ] Reset transaction has correct styling (gray badge, italic)
- [ ] Filter can isolate reset transactions
- [ ] CSV export includes reset transactions with proper labels
- [ ] Reset of already-zero account shows appropriate error
- [ ] Multiple resets on same account all appear in history
- [ ] Page refresh after reset shows correct data
- [ ] Balance calculation includes reset transactions correctly

## Troubleshooting

### Reset Button Not Visible
- Check that you are authenticated
- Ensure you're viewing an account detail page
- Verify the `canResetAccounts()` function returns true

### Reset Operation Fails
- Check browser console for error messages
- Verify account balance is not already zero
- Ensure Firebase permissions allow transaction creation
- Check network connectivity

### Reset Transaction Not Appearing
- Refresh the page
- Check transaction filters (ensure "Tümü" is selected)
- Verify the transaction was created in Firebase console

### Balance Not Zero After Reset
- Check if page was refreshed after reset
- Verify the reset transaction amount is correct
- Check for conflicting transactions created simultaneously

## File Changes Summary

### New Files
- `/src/utils/account-reset.js` - Reset utility functions

### Modified Files
- `/src/utils/transaction-direction.js` - Added administrative_reset type support
- `/src/utils/csv-export.js` - Added transaction type labels
- `/index.html` - Added UI components, event handlers, and imports

### Changes by Component

**Transaction Direction Utility:**
- Added `administrative_reset` to TRANSACTION_DIRECTION_MAP
- Updated `getTransactionTypeLabel()` to return "Sıfırlama (Admin)"
- Updated `getTransactionTypeBadgeClass()` with gray styling
- Updated `getTransactionTypeColorClass()` with slate color

**CSV Export:**
- Added import for `getTransactionTypeLabel`
- Added `islemTipiLabel` to processed transactions
- Updated field mapping to include human-readable type
- Updated ordered fields to use label instead of code

**Main UI (index.html):**
- Added reset button to account detail header
- Added reset indicator badge to account detail header
- Added imports for account-reset utility
- Added reset button event handler
- Updated `showCariDetay()` to show/hide reset button and badge
- Added administrative_reset to transaction type filter

## Support

For questions or issues with the Administrative Reset feature:
1. Check this documentation first
2. Review the browser console for error messages
3. Check the Firebase console for data integrity
4. Refer to the acceptance criteria in the original specification

---

**Version:** 1.0  
**Last Updated:** November 4, 2025  
**Author:** AI Assistant  

