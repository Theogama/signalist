# Deriv Token Decryption Fix

## Issue
Error: "Failed to decrypt value" when initializing DerivMarketStatusService.

## Root Cause
The `DerivApiToken` model has the `token` field defined with `select: false`, which means it's excluded from queries by default for security. However, several services were querying for tokens without explicitly selecting the token field using `.select('+token')`.

When `tokenDoc.token` was `undefined`, the `decrypt()` function failed trying to decrypt `undefined`, causing the error.

## Solution
Added `.select('+token')` to all `DerivApiToken.findOne()` queries that need to decrypt the token.

## Files Fixed

### 1. lib/services/deriv-market-status.service.ts
- Added `.select('+token')` to the query
- Added null check for `tokenDoc.token`
- Added try-catch around decrypt to handle errors gracefully

### 2. lib/services/deriv-auto-trading.service.ts
- Added `.select('+token')` to the query
- Added null check for `tokenDoc.token`

### 3. lib/services/bot-execution-engine.service.ts
- Added `.select('+token')` to the query
- Added null check for `tokenDoc.token`

### 4. lib/services/trade-reconciliation.service.ts
- Added `.select('+token')` to the query
- Added null check for `tokenDoc.token`

### 5. lib/services/deriv-token-validator.service.ts
- Fixed duplicate query issue
- Added `.select('+token')` to the query
- Added null check for `tokenDoc.token`

## Pattern

### Before (Broken):
```typescript
const tokenDoc = await DerivApiToken.findOne({ userId, isValid: true });
// tokenDoc.token is undefined because of select: false
const token = await decrypt(tokenDoc.token); // ❌ Fails
```

### After (Fixed):
```typescript
const tokenDoc = await DerivApiToken.findOne({ userId, isValid: true }).select('+token');
if (!tokenDoc || !tokenDoc.token) {
  // Handle missing token
}
const token = await decrypt(tokenDoc.token); // ✅ Works
```

## Impact
- ✅ No more "Failed to decrypt value" errors
- ✅ Services can properly decrypt tokens when needed
- ✅ Better error handling when tokens are missing
- ✅ Consistent pattern across all services

## Testing
- Verify DerivMarketStatusService initializes without errors
- Verify all services that decrypt tokens work correctly
- Verify error handling when tokens are missing

