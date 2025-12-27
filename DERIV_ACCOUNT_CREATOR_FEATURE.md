# Deriv Account Creator Feature

## Overview

The Deriv Account Creator feature has been integrated into the broker connection system, allowing users to create Deriv accounts directly from the application using the Deriv API documentation.

## Features Added

### 1. DerivAccountCreator Component
**Location:** `components/autotrade/DerivAccountCreator.tsx`

A comprehensive account creation wizard that guides users through:
- **Email Verification**: Verify email address and receive verification code
- **Account Type Selection**: Choose between Demo, Real, or Wallet accounts
- **Region Selection**: EU vs Non-EU account creation flows
- **Account Creation**: Complete account setup with proper API calls
- **Credentials Display**: Shows created account credentials (Client ID, OAuth Token)

### 2. API Routes
**Location:** `app/api/deriv/`

Created API endpoints that mirror the Deriv API structure:

- **`/api/deriv/verify-email`** - Email verification endpoint
- **`/api/deriv/create-demo-account`** - Demo account creation (USD 10,000 virtual)
- **`/api/deriv/create-real-account`** - Non-EU real account creation
- **`/api/deriv/create-real-account-eu`** - EU real account creation (Malta Invest)
- **`/api/deriv/create-wallet-account`** - Wallet account creation

### 3. Integration with BrokerConnectionModal
**Location:** `components/autotrade/BrokerConnectionModal.tsx`

The DerivAccountCreator component is now integrated into the broker connection modal:
- Appears when Deriv broker is selected
- Prominently displayed with a gradient background
- Provides seamless account creation flow
- Updated API credential fields to accept OAuth tokens from account creation

### 4. API Documentation
**Location:** `DERIV_API_DOCUMENTATION.md`

Complete professional API documentation covering:
- Email verification (`verify_email`)
- Demo trading account creation (`new_account_virtual`)
- Real trading account creation (EU: `new_account_maltainvest`, Non-EU: `new_account_real`)
- Wallet account creation (`new_account_wallet`)
- Parameter tables, request/response examples, error codes

## User Flow

1. **Select Deriv Broker**: User selects Deriv from broker options
2. **Account Creation Option**: User sees "Don't have a Deriv account?" section
3. **Create Account**: Click "Create Deriv Account" button
4. **Email Verification**: Enter email and receive verification code
5. **Enter Code**: Enter verification code from email
6. **Select Account Type**: Choose Demo, Real, or Wallet account
7. **Region Selection**: If Real/Wallet, select EU or Non-EU
8. **Account Created**: Receive credentials (Client ID, OAuth Token)
9. **Connect**: Use OAuth token as API key to connect broker

## Account Types Supported

### Demo Trading Account
- USD 10,000 virtual balance
- No KYC verification required
- Perfect for testing strategies
- No real money involved

### Real Trading Account (EU)
- Malta Invest regulation (MiFID II)
- Full compliance checks required
- Financial assessment questionnaire
- Identity verification required
- Endpoint: `new_account_maltainvest`

### Real Trading Account (Non-EU)
- Simplified compliance requirements
- Identity verification required
- Basic financial information
- Endpoint: `new_account_real`

### Wallet Account
- Separate from trading accounts
- Manage deposits and withdrawals
- Can be linked to trading accounts
- Compliance varies by region (EU vs Non-EU)
- Endpoint: `new_account_wallet`

## API Implementation Notes

### Current Implementation
The API routes currently simulate Deriv API responses. To connect to the actual Deriv API:

1. **WebSocket Connection**: Implement WebSocket connection to `wss://ws.derivws.com/websockets/v3`
2. **Authentication**: Use Deriv App ID (`113058`) for authentication
3. **Request Format**: Send requests in Deriv WebSocket message format
4. **Response Handling**: Parse WebSocket responses and return to frontend

### Example WebSocket Implementation (TODO)
```typescript
// Connect to Deriv WebSocket
const ws = new WebSocket('wss://ws.derivws.com/websockets/v3');

// Send verify_email request
ws.send(JSON.stringify({
  verify_email: email,
  type: 'account_opening',
}));

// Handle response
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // Process response
};
```

## UI Components Used

- **Dialog**: Modal for account creation flow
- **Card**: Step-by-step account creation cards
- **Tabs**: Account type selection (Demo/Real/Wallet)
- **Input**: Form inputs for email, verification code
- **Select**: Region selection (EU/Non-EU)
- **Button**: Action buttons throughout the flow

## Security Considerations

1. **Email Masking**: Email addresses are masked in UI (`u***@example.com`)
2. **Password Generation**: Secure password generation for account creation
3. **Token Handling**: OAuth tokens are displayed but should be stored securely
4. **API Keys**: API keys are never exposed in client-side code
5. **Validation**: All inputs are validated before API calls

## Future Enhancements

1. **Actual Deriv API Integration**: Connect to real Deriv WebSocket API
2. **Form Validation**: Add comprehensive form validation for real accounts
3. **Document Upload**: Support for KYC document upload
4. **Account Linking**: Auto-link created accounts to broker connection
5. **Account Status**: Track account verification status
6. **Multi-step Forms**: Enhanced forms for real account creation with all required fields

## Documentation Access

Users can access the complete API documentation by clicking "View Docs" in the account creator component. The documentation includes:
- Complete endpoint reference
- Parameter tables
- Request/response examples
- Error codes
- Compliance requirements

## Testing

To test the feature:

1. Navigate to broker connection modal
2. Select Deriv broker
3. Click "Create Deriv Account"
4. Follow the account creation flow
5. Verify credentials are displayed correctly
6. Use OAuth token to connect broker

## Files Modified/Created

### Created Files
- `components/autotrade/DerivAccountCreator.tsx`
- `app/api/deriv/verify-email/route.ts`
- `app/api/deriv/create-demo-account/route.ts`
- `app/api/deriv/create-real-account/route.ts`
- `app/api/deriv/create-real-account-eu/route.ts`
- `app/api/deriv/create-wallet-account/route.ts`
- `DERIV_API_DOCUMENTATION.md`
- `DERIV_ACCOUNT_CREATOR_FEATURE.md` (this file)

### Modified Files
- `components/autotrade/BrokerConnectionModal.tsx`

## Integration Points

The feature integrates with:
- **BrokerConnectionModal**: Main broker connection interface
- **DerivAdapter**: Existing Deriv broker adapter
- **Auto Trading Store**: Broker connection state management
- **API Routes**: Backend API endpoints for account creation

## Notes

- The API routes currently return simulated responses
- Real Deriv API integration requires WebSocket implementation
- OAuth tokens from account creation can be used as API keys
- Demo accounts don't require KYC verification
- EU accounts require more compliance information than Non-EU accounts






