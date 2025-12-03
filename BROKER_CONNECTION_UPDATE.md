# Broker Connection Update - MT5 for Exness

## Overview

Updated the broker connection system to require MT5 connection for Exness accounts. This ensures proper account information retrieval and integration with Signalist.

## Changes Made

### 1. **Quick Connect API** (`app/api/auto-trading/quick-connect/route.ts`)
- ✅ Removed API key/OAuth2 authentication for Exness
- ✅ Now requires MT5 connection (login, password, server) for Exness
- ✅ Connects to MT5 Python service to get account information
- ✅ Stores MT5 connection ID in session manager
- ✅ Deriv connection remains unchanged (uses OAuth2 token or demo mode)

### 2. **Connect Broker API** (`app/api/auto-trading/connect-broker/route.ts`)
- ✅ Removed ExnessAdapter API key authentication
- ✅ Now requires MT5 credentials (login, password, server) for Exness
- ✅ Validates server (Exness-MT5Real or Exness-MT5Trial)
- ✅ Fetches account info from MT5 service
- ✅ Deriv connection remains unchanged

### 3. **Next Steps Required**

#### Update BrokerConnectionModal Component
- Replace API key fields with MT5 fields (login, password, server) for Exness
- Show different UI based on selected broker:
  - Exness: MT5 login form
  - Deriv: API key form (existing)

#### Update Auto-Trading Store
- Handle MT5 connection state for Exness
- Store MT5 connection ID instead of adapter instance
- Update connection methods to use MT5 for Exness

#### Update Account Linking Service
- Use MT5 service endpoints for Exness account data
- Keep existing logic for Deriv

## MT5 Connection Flow for Exness

1. User provides:
   - MT5 Login ID
   - MT5 Password
   - Server (Exness-MT5Real or Exness-MT5Trial)

2. System:
   - Calls MT5 Python service `/connect` endpoint
   - Receives connection ID
   - Fetches account info from MT5 service
   - Stores connection in session manager
   - Returns account data to frontend

3. Account Information Retrieved:
   - Balance
   - Equity
   - Margin
   - Free Margin
   - Currency
   - Leverage

## Benefits

- ✅ Proper account information retrieval from Exness via MT5
- ✅ Consistent with Signalist bot requirements
- ✅ Removes dependency on non-existent Exness REST API
- ✅ Uses official MT5 connection method
- ✅ Better integration with trading operations

## Migration Notes

- Old API key connections for Exness will no longer work
- Users must reconnect using MT5 credentials
- MT5 Python service must be running for Exness connections
- Connection ID is stored in session (should be moved to database in production)

