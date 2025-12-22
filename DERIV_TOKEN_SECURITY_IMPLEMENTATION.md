# Deriv API Token Security Implementation

## Overview

Secure Deriv API token handling system with comprehensive validation, encryption, and permission checking.

## Security Features

### 1. **Token Encryption**
- Tokens are encrypted using AES-256-GCM before storage
- Encryption key stored in environment variables (`BETTER_AUTH_SECRET` or `ENCRYPTION_KEY`)
- Never stored in plain text
- Never returned to frontend

### 2. **Token Validation**
- Validates token authenticity via Deriv WebSocket API
- Checks account type (demo vs real)
- Validates required permissions:
  - **Trade**: Ability to execute trades
  - **Read Balance**: Ability to read account balance
  - **Read Transactions**: Ability to read transaction history

### 3. **Permission Checking**
- Tests actual API capabilities (not just scope claims)
- Validates permissions before storing token
- Returns detailed permission status

### 4. **Account Type Detection**
- Automatically detects demo vs real accounts
- Uses multiple detection methods:
  - Account ID pattern analysis
  - Balance patterns
  - API account type field

### 5. **Token Revocation**
- Soft delete: Mark token as invalid
- Hard delete: Permanently remove token
- Immediate effect on all active sessions

## Components

### 1. Token Validator Service
**File**: `lib/services/deriv-token-validator.service.ts`

**Key Methods**:
- `validateToken()` - Validate token with permission checking
- `validateAndStoreToken()` - Validate and store encrypted token
- `revokeToken()` - Revoke or delete token
- `getTokenInfo()` - Get token info (without token value)
- `revalidateStoredToken()` - Re-validate existing token

**Usage**:
```typescript
import { DerivTokenValidatorService } from '@/lib/services/deriv-token-validator.service';

// Validate token with required permissions
const result = await DerivTokenValidatorService.validateToken(
  token,
  {
    trade: true,
    readBalance: true,
    readTransactions: true
  }
);

// Validate and store
const storeResult = await DerivTokenValidatorService.validateAndStoreToken(
  userId,
  token,
  { trade: true, readBalance: true }
);
```

### 2. Encryption Utility
**File**: `lib/utils/encryption.ts`

**Features**:
- AES-256-GCM encryption
- Key derivation using scrypt
- Environment variable-based key management
- Support for key rotation

**Environment Variables**:
```env
# Primary encryption key (recommended)
BETTER_AUTH_SECRET=your-secret-key-here

# Alternative encryption key
ENCRYPTION_KEY=your-encryption-key-here
```

### 3. Database Schema
**File**: `database/models/deriv-api-token.model.ts`

**Schema Fields**:
- `userId` - Unique user identifier
- `token` - Encrypted token (never returned by default)
- `accountType` - 'demo' or 'real'
- `accountId` - Deriv account ID
- `accountBalance` - Last known balance
- `accountCurrency` - Account currency
- `isValid` - Token validation status
- `lastValidatedAt` - Last validation timestamp
- `scopes` - Token scopes/permissions
- `expiresAt` - Token expiration (if applicable)

**Indexes**:
- `userId` (unique)
- `accountType + isValid` (composite)
- `expiresAt` (TTL index)

### 4. Secure API Routes
**File**: `app/api/deriv/token/secure/route.ts`

**Endpoints**:
- `POST /api/deriv/token/secure` - Store and validate token
- `GET /api/deriv/token/secure` - Get token info (no token value)
- `DELETE /api/deriv/token/secure` - Revoke token
- `PUT /api/deriv/token/secure/validate` - Re-validate token

## Security Best Practices

### 1. **Never Expose Tokens**
- Tokens are encrypted before storage
- Token field is excluded from default queries (`select: false`)
- API responses never include token values
- Only token metadata is returned

### 2. **Server-Side Only**
- Token validation happens server-side
- Frontend never receives token values
- All token operations require authentication

### 3. **Permission Validation**
- Validates permissions before storing token
- Checks actual API capabilities
- Returns detailed permission status
- Blocks operations if permissions insufficient

### 4. **Token Revocation**
- Immediate revocation support
- Soft delete (mark invalid) or hard delete (remove)
- Prevents further use of revoked tokens

### 5. **Environment Variables**
- Encryption keys stored in environment variables
- Never hardcoded in source code
- Supports key rotation

## Usage Examples

### Store Token with Permission Validation
```typescript
// POST /api/deriv/token/secure
const response = await fetch('/api/deriv/token/secure', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    token: 'user-provided-token',
    requiredPermissions: {
      trade: true,
      readBalance: true,
      readTransactions: true
    }
  })
});

const result = await response.json();
// Returns: { success: true, data: { accountType, accountId, ... }, validation: { permissions, ... } }
// NEVER includes token value
```

### Get Token Info (No Token Value)
```typescript
// GET /api/deriv/token/secure
const response = await fetch('/api/deriv/token/secure');
const result = await response.json();
// Returns: { success: true, data: { accountType, accountId, balance, isValid, scopes, ... } }
// Token value is NEVER included
```

### Revoke Token
```typescript
// DELETE /api/deriv/token/secure?permanent=true
const response = await fetch('/api/deriv/token/secure?permanent=true', {
  method: 'DELETE'
});
// Permanently deletes token
```

### Re-validate Token
```typescript
// PUT /api/deriv/token/secure/validate
const response = await fetch('/api/deriv/token/secure/validate', {
  method: 'PUT'
});
// Re-validates token and updates status
```

## Validation Result Structure

```typescript
interface TokenValidationResult {
  isValid: boolean;
  accountType: 'demo' | 'real';
  accountId?: string;
  accountBalance?: number;
  accountCurrency?: string;
  scopes: string[];
  permissions: {
    canTrade: boolean;
    canReadBalance: boolean;
    canReadTransactions: boolean;
  };
  errors: string[];
  warnings: string[];
}
```

## Error Handling

### Common Errors
- `Token is required` - Token not provided
- `Invalid token format` - Token format invalid
- `Token validation failed` - Token authentication failed
- `Token does not have trading permission` - Missing required permission
- `Connection timeout` - API connection timeout

### Warnings
- `Token may not have trading permission` - Permission uncertain
- `Token may not have balance read permission` - Permission uncertain

## Security Checklist

- [x] Tokens encrypted before storage
- [x] Encryption keys in environment variables
- [x] Token values never returned to frontend
- [x] Permission validation before storage
- [x] Account type detection
- [x] Token revocation support
- [x] Server-side validation only
- [x] Authentication required for all operations
- [x] Token field excluded from default queries
- [x] Comprehensive error handling

## Environment Setup

```env
# Required: Encryption key
BETTER_AUTH_SECRET=your-strong-secret-key-min-32-chars

# Optional: Alternative encryption key
ENCRYPTION_KEY=your-encryption-key

# Optional: Deriv App ID
DERIV_APP_ID=113058
```

## Migration from Old System

If migrating from the old token system:

1. Existing tokens will be re-validated on next use
2. New tokens use the secure validator
3. Old tokens remain encrypted and functional
4. Gradual migration supported

## Production Recommendations

1. **Strong Encryption Key**: Use a strong, randomly generated key (min 32 characters)
2. **Key Rotation**: Implement key rotation strategy
3. **Token Expiration**: Set token expiration if supported by Deriv
4. **Regular Re-validation**: Re-validate tokens periodically
5. **Audit Logging**: Log all token operations
6. **Rate Limiting**: Implement rate limiting on token endpoints
7. **HTTPS Only**: Ensure all token operations use HTTPS

## Testing

Test token validation:
```typescript
import { DerivTokenValidatorService } from '@/lib/services/deriv-token-validator.service';

const result = await DerivTokenValidatorService.validateToken(
  'test-token',
  { trade: true, readBalance: true }
);

console.log('Valid:', result.isValid);
console.log('Permissions:', result.permissions);
console.log('Errors:', result.errors);
```

## Support

For security issues or questions:
1. Review this documentation
2. Check error messages in validation results
3. Verify environment variables are set
4. Ensure token has required permissions on Deriv platform

