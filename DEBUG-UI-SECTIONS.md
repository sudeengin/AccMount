# Debug: UI Sections Not Appearing

## Quick Fix Steps

### Step 1: Hard Refresh Browser
The JavaScript files have been updated, but your browser may be caching the old versions.

**Windows/Linux:**
- Chrome/Edge: Press `Ctrl + Shift + R` or `Ctrl + F5`
- Firefox: Press `Ctrl + Shift + R`

**macOS:**
- Chrome/Safari: Press `Cmd + Shift + R`
- Firefox: Press `Cmd + Shift + R`

### Step 2: Clear Browser Cache
If hard refresh doesn't work:
1. Open Developer Tools (F12 or Cmd+Option+I)
2. Right-click the refresh button
3. Select "Empty Cache and Hard Reload"

### Step 3: Check Browser Console
1. Open Developer Tools (F12)
2. Go to Console tab
3. Look for any red errors
4. Take a screenshot if you see errors

### Step 4: Verify Files Are Loaded
In browser console, type:
```javascript
console.log(typeof getInternalAccounts)
```

If it says "undefined", the new files aren't loaded yet.

## Manual Verification

### Check if account-type.js is loaded:
1. Open browser DevTools (F12)
2. Go to Sources tab
3. Look for `src/utils/account-type.js`
4. If it's not there, the file isn't being imported properly

### Check if renderAccountList is calling the new code:
In browser console, run:
```javascript
// This should show your accounts separated by type
const accounts = [
    {id: '1', unvan: 'Motifera Hesap', tipi: 'Banka', bakiye: 10000},
    {id: '2', unvan: 'Tedarikçi ABC', tipi: 'Tedarikçi', bakiye: -5000}
];

// Test the detection
import('/src/utils/account-type.js').then(mod => {
    console.log('Motifera type:', mod.getAccountType(accounts[0]));
    console.log('Supplier type:', mod.getAccountType(accounts[1]));
});
```

Expected output:
```
Motifera type: internal
Supplier type: external
```

## Common Issues & Solutions

### Issue 1: "getInternalAccounts is not defined"
**Cause:** The import statement isn't working
**Fix:** Check that `home.view.js` has this at the top:
```javascript
import { 
    getAccountType, 
    getAccountTypeLabel, 
    isInternalAccount, 
    isExternalAccount,
    getInternalAccounts,
    getExternalAccounts
} from "../../utils/account-type.js";
```

### Issue 2: No accounts showing at all
**Cause:** Accounts not loading from Firebase
**Fix:** Check Firebase connection and authentication

### Issue 3: All accounts in one section
**Cause:** Pattern matching not working
**Fix:** Check account names in your database

## Test Pattern Detection

Run this in browser console to test if Motifera is detected:
```javascript
const testAccount = {
    unvan: 'Motifera Hesap',
    tipi: 'Banka'
};

// This will test pattern matching
console.log('Account name:', testAccount.unvan);
console.log('Matches pattern:', testAccount.unvan.toLowerCase().includes('motifera'));
```

## Restart Development Server

If you're running a development server:

1. Stop the server (Ctrl+C in terminal)
2. Clear any build cache
3. Restart the server
4. Hard refresh browser

## Still Not Working?

If sections still don't appear after all steps:

1. Check browser console for errors
2. Verify account data exists
3. Make sure you're viewing the Cariler page
4. Check that accounts are being loaded

Take screenshots of:
- Browser console (any errors)
- Network tab (check if .js files are loading)
- Current UI state
- Any error messages

Then we can debug further!

