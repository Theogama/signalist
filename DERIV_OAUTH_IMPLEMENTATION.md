# Deriv OAuth2 Authentication Implementation

## ✅ Implementation Complete

Enhanced Deriv account connection flow with secure OAuth2 authentication supporting both Demo and Real trading accounts.

---

## 🔐 OAuth2 Authentication Flow

### 1. **Authentication Initiation** (`/api/auto-trading/deriv/auth`)

**Purpose:** Redirects users to Deriv's official OAuth authentication page

**Features:**
- Generates secure state token for CSRF protection
- Stores state in HTTP-only cookie
- Supports both Demo and Real account types
- Redirects to Deriv's official OAuth endpoint

**Parameters:**
- `account_type`: `'demo'` or `'real'` (default: `'real'`)

**Flow:**
1. User clicks "Connect Deriv" button
2. System generates OAuth state token
3. User redirected to Deriv's secure login page
4. User authenticates with Deriv credentials

---

### 2. **OAuth Callback Handler** (`/api/auto-trading/deriv/callback`)

**Purpose:** Handles the redirect from Deriv after authentication

**Features:**
- Validates OAuth state token (CSRF protection)
- Exchanges authorization code for access token
- Fetches account data (Demo and Real accounts)
- Stores tokens securely in database
- Initializes DerivAdapter with tokens
- Redirects user back to Signalist dashboard

**Error Handling:**
- Invalid state token → Redirects with error
- Token exchange failure → Redirects with error
- Account fetch failure → Falls back gracefully
- User cancellation → Redirects with cancellation message

---

### 3. **Account Synchronization Service** (`lib/services/deriv-account-sync.service.ts`)

**Purpose:** Fetches and manages Deriv account data

**Features:**
- **Fetch Accounts:** Retrieves all Deriv accounts (demo and real)
- **Account Separation:** Automatically separates demo vs real accounts
- **Balance Fetching:** Gets account balance for specific accounts
- **Instrument Listing:** Returns available trading instruments
- **Token Refresh:** Refreshes expired access tokens

**Account Detection:**
- Demo accounts: Login IDs starting with 'VR' or 'CR'
- Real accounts: Production login IDs
- Account type determined from login ID pattern and API response

---

## 🔒 Secure Token Storage

### Database Storage
- Tokens stored in `broker_credentials` collection
- Encrypted at rest (database-level encryption)
- User-specific storage (indexed by userId)
- Separate storage for demo and real accounts

### Token Fields:
- `accessToken`: OAuth access token
- `refreshToken`: OAuth refresh token (if available)
- `expiresAt`: Token expiration timestamp
- `accountType`: 'demo' or 'real'
- `accountData`: Full account information

---

## 🎨 UI Components

### BrokerConnectionModal Updates

**New OAuth Buttons:**
- **Connect Deriv (Demo)** - Initiates OAuth flow for demo account
- **Connect Deriv (Real)** - Initiates OAuth flow for real account

**Features:**
- Clear OAuth information banner
- Loading states during authentication
- Error handling and user feedback
- Automatic redirect handling

### AutoTradingDashboard Updates

**OAuth Callback Handler:**
- Monitors URL parameters for OAuth callback
- Handles success and error states
- Syncs account data on successful connection
- Updates UI with account information
- Cleans URL parameters after processing

---

## 📋 API Endpoints

### GET `/api/auto-trading/deriv/auth`
Initiates OAuth flow

**Query Parameters:**
- `account_type`: `'demo'` or `'real'`

**Response:**
- Redirects to Deriv OAuth page

---

### GET `/api/auto-trading/deriv/callback`
Handles OAuth callback

**Query Parameters:**
- `code`: Authorization code from Deriv
- `state`: State token for validation
- `error`: Error code (if authentication failed)
- `error_description`: Error description

**Response:**
- Redirects to `/autotrade` with success/error parameters

---

## 🔄 Authentication Flow Diagram

```
User → Click "Connect Deriv"
  ↓
Signalist → Generate OAuth state
  ↓
Redirect → Deriv OAuth Page
  ↓
User → Authenticate with Deriv
  ↓
Deriv → Redirect with code
  ↓
Signalist → Validate state & exchange code
  ↓
Signalist → Fetch account data
  ↓
Signalist → Store tokens securely
  ↓
Signalist → Initialize adapter
  ↓
Redirect → Signalist Dashboard (Success)
```

---

## 🛡️ Security Features

### CSRF Protection
- State token stored in HTTP-only cookie
- State validated on callback
- Prevents cross-site request forgery

### Token Security
- Tokens never exposed in URLs (except during OAuth flow)
- Stored securely in database
- HTTP-only cookies for state
- Secure flag in production

### Error Handling
- Graceful fallbacks for API failures
- User-friendly error messages
- No sensitive data in error responses
- Proper logging for debugging

---

## 📊 Account Management

### Demo vs Real Account Separation

**Demo Accounts:**
- Login IDs: VR*, CR*
- Separate token storage
- Paper trading mode enabled
- Virtual balance

**Real Accounts:**
- Production login IDs
- Separate token storage
- Live trading mode
- Real balance

### Account Data Structure

```typescript
{
  accounts: DerivAccount[];        // All accounts
  demoAccounts: DerivAccount[];    // Demo only
  realAccounts: DerivAccount[];   // Real only
  activeAccount: DerivAccount | null;  // Currently active
  accountType: 'demo' | 'real';
}
```

---

## 🔧 Configuration

### Environment Variables

```env
DERIV_APP_ID=113058                    # Deriv application ID
DERIV_OAUTH_URL=https://oauth.deriv.com/oauth2/authorize
DERIV_TOKEN_URL=https://oauth.deriv.com/oauth2/token
DERIV_API_URL=https://api.deriv.com
DERIV_REDIRECT_URI=https://yourdomain.com/api/auto-trading/deriv/callback
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

---

## ✅ Features Implemented

- [x] OAuth2 authentication flow
- [x] Redirect to Deriv's official auth page
- [x] Secure callback handling
- [x] Token exchange and storage
- [x] Account data fetching (demo and real)
- [x] Account type separation
- [x] Error handling and user feedback
- [x] CSRF protection
- [x] Secure token storage
- [x] UI components for OAuth flow
- [x] Automatic account synchronization

---

## 🚀 Usage

### For Users

1. **Connect Demo Account:**
   - Click "Connect Deriv (Demo)"
   - Authenticate with Deriv
   - Redirected back to Signalist
   - Demo account connected

2. **Connect Real Account:**
   - Click "Connect Deriv (Real)"
   - Authenticate with Deriv
   - Redirected back to Signalist
   - Real account connected

3. **Account Management:**
   - Both accounts can be connected simultaneously
   - Switch between accounts via settings
   - View account balances and details
   - Trade with selected account

### For Developers

**Initiate OAuth:**
```typescript
window.location.href = '/api/auto-trading/deriv/auth?account_type=demo';
```

**Handle Callback:**
The callback is automatically handled by the route handler. Check URL parameters in the dashboard component.

**Fetch Account Data:**
```typescript
import { DerivAccountSyncService } from '@/lib/services/deriv-account-sync.service';

const accountData = await DerivAccountSyncService.fetchAccounts(accessToken);
```

---

## 📝 Notes

- OAuth flow requires HTTPS in production
- State tokens expire after 10 minutes
- Access tokens should be refreshed before expiration
- Demo and Real accounts are stored separately
- Multiple accounts per user are supported

---

## 🔄 Future Enhancements

- [ ] Token refresh automation
- [ ] Account switching UI
- [ ] Multiple account management
- [ ] Account permissions display
- [ ] Connection status indicators
- [ ] Re-authentication prompts

---

## 🐛 Troubleshooting

### Common Issues

1. **"Invalid state" error:**
   - State token expired (10 min limit)
   - Cookie not set properly
   - Solution: Retry connection

2. **"Token exchange failed":**
   - Invalid authorization code
   - Code already used
   - Solution: Restart OAuth flow

3. **"No accounts found":**
   - User has no Deriv accounts
   - API permissions insufficient
   - Solution: Check Deriv account setup

---

## ✨ Summary

The Deriv OAuth2 implementation provides a secure, user-friendly way to connect Deriv accounts to Signalist. Users authenticate through Deriv's official page, ensuring security and compliance. The system automatically handles token management, account synchronization, and error handling, providing a seamless experience for both demo and real trading accounts.

