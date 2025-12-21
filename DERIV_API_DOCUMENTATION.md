# Deriv API Documentation: Account and Wallet Creation

## Table of Contents

1. [Email Verification](#email-verification)
2. [Demo Trading Account Creation](#demo-trading-account-creation)
3. [Real Trading Account Creation](#real-trading-account-creation)
4. [Wallet Account Creation](#wallet-account-creation)

---

## Email Verification

### Endpoint: `verify_email`

#### Description

Verifies a user's email address by sending a verification code. This is a required step before creating trading or wallet accounts. The verification code is sent to the provided email address and must be confirmed before proceeding with account creation.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `verify_email` | string | Yes | Email address to verify. Must be a valid email format. |
| `type` | string | Yes | Verification type. Use `"account_opening"` for account creation flows. |

#### Request Example

```json
{
  "verify_email": "user@example.com",
  "type": "account_opening"
}
```

#### Expected Response

**Success Response:**
```json
{
  "verify_email": {
    "new_token": "abc123def456",
    "sent_to": "u***@example.com"
  },
  "echo_req": {
    "verify_email": "user@example.com",
    "type": "account_opening"
  },
  "msg_type": "verify_email"
}
```

**Error Response:**
```json
{
  "error": {
    "code": "InputValidationFailed",
    "message": "Email address is invalid"
  },
  "echo_req": {
    "verify_email": "invalid-email",
    "type": "account_opening"
  },
  "msg_type": "verify_email"
}
```

#### Expected Behavior

- Sends a verification code to the specified email address
- Returns a masked email address in the response (`sent_to` field)
- The verification code must be used in subsequent account creation requests
- Verification codes expire after a set time period (typically 10 minutes)
- Each verification code can only be used once

#### Notes

- Email verification is mandatory before creating any account type
- The `new_token` returned may be required for subsequent API calls
- Ensure the email address is accessible and not blocked by spam filters

---

## Demo Trading Account Creation

### Endpoint: `new_account_virtual`

#### Description

Creates a virtual (demo) trading account with a default balance of USD 10,000. Demo accounts allow users to practice trading without risking real funds. These accounts use virtual currency and simulate real market conditions.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `new_account_virtual` | integer | Yes | Must be `1` to create a virtual account. |
| `email` | string | Yes | Verified email address. Must match the email used in `verify_email`. |
| `verification_code` | string | Yes | Verification code received via email from `verify_email` call. |
| `client_password` | string | Yes | Password for the account. Minimum 8 characters, must contain uppercase, lowercase, and numbers. |
| `residence` | string | Yes | ISO 3166-1 alpha-2 country code (e.g., `"US"`, `"GB"`, `"DE"`). |
| `account_opening_reason` | string | No | Reason for opening account. Options: `"Speculation"`, `"Income Earning"`, `"Hedging"`, `"Learn to Trade"`. |
| `currency` | string | No | Account currency. Default: `"USD"`. Supported: `USD`, `EUR`, `GBP`, `AUD`. |

#### Request Example

```json
{
  "new_account_virtual": 1,
  "email": "user@example.com",
  "verification_code": "123456",
  "client_password": "SecurePass123",
  "residence": "US",
  "account_opening_reason": "Learn to Trade",
  "currency": "USD"
}
```

#### Expected Response

**Success Response:**
```json
{
  "new_account_virtual": {
    "client_id": "CR12345678",
    "oauth_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "email": "user@example.com",
    "currency": "USD",
    "balance": 10000.00,
    "account_type": "virtual",
    "landing_company": "virtual"
  },
  "echo_req": {
    "new_account_virtual": 1,
    "email": "user@example.com",
    "verification_code": "123456",
    "client_password": "SecurePass123",
    "residence": "US",
    "account_opening_reason": "Learn to Trade",
    "currency": "USD"
  },
  "msg_type": "new_account_virtual"
}
```

#### Expected Behavior

- Creates a virtual trading account with USD 10,000 virtual balance
- Returns `client_id` for account identification
- Returns `oauth_token` for authenticated API requests
- Account is immediately available for trading
- Virtual balance cannot be withdrawn or converted to real funds
- Account expires after 30 days of inactivity (configurable)

#### Notes

- Virtual accounts do not require KYC verification
- All trading is simulated with virtual funds
- Market prices reflect real-time data
- No financial risk assessment required

---

## Real Trading Account Creation

### EU Users: `new_account_maltainvest`

#### Description

Creates a real trading account for EU residents under Malta Investment Services (Malta Invest) regulation. This endpoint requires full compliance checks, financial assessment, and regulatory documentation as per EU MiFID II requirements.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `new_account_maltainvest` | integer | Yes | Must be `1` to create a Malta Invest account. |
| `email` | string | Yes | Verified email address. |
| `verification_code` | string | Yes | Email verification code. |
| `client_password` | string | Yes | Account password. Minimum 8 characters, must contain uppercase, lowercase, and numbers. |
| `residence` | string | Yes | ISO 3166-1 alpha-2 country code. Must be an EU country (e.g., `"DE"`, `"FR"`, `"IT"`, `"ES"`). |
| `account_opening_reason` | string | Yes | Reason for account opening. Required for EU compliance. |
| `currency` | string | Yes | Account currency. Supported: `USD`, `EUR`, `GBP`. |
| `date_of_birth` | string | Yes | Date of birth in YYYY-MM-DD format. Must be 18+ years. |
| `first_name` | string | Yes | Legal first name as per government-issued ID. |
| `last_name` | string | Yes | Legal last name as per government-issued ID. |
| `phone` | string | Yes | Phone number with country code (e.g., `"+491234567890"`). |
| `address_line_1` | string | Yes | Primary address line. |
| `address_city` | string | Yes | City name. |
| `address_postcode` | string | Yes | Postal/ZIP code. |
| `address_state` | string | No | State/province (if applicable). |
| `tax_residence` | string | Yes | Tax residence country code (ISO 3166-1 alpha-2). |
| `tax_identification_number` | string | No | Tax ID number (if applicable). |
| `employment_status` | string | Yes | Employment status. Options: `"Employed"`, `"Self-Employed"`, `"Unemployed"`, `"Retired"`, `"Student"`. |
| `employment_industry` | string | Yes | Industry sector. |
| `annual_income` | string | Yes | Annual income range. Options: `"0-25000"`, `"25000-50000"`, `"50000-100000"`, `"100000-500000"`, `"500000+"`. |
| `estimated_worth` | string | Yes | Estimated net worth range. |
| `source_of_wealth` | string | Yes | Source of wealth. Options: `"Salary"`, `"Savings"`, `"Investment"`, `"Business"`, `"Inheritance"`, `"Other"`. |
| `trading_experience` | string | Yes | Trading experience level. Options: `"No Experience"`, `"Less than 1 year"`, `"1-2 years"`, `"2-5 years"`, `"5+ years"`. |
| `trading_experience_cfd` | string | Yes | CFD trading experience. Same options as `trading_experience`. |
| `trading_experience_forex` | string | Yes | Forex trading experience. Same options as `trading_experience`. |
| `trading_experience_other_instruments` | string | Yes | Other instruments trading experience. Same options as `trading_experience`. |
| `risk_tolerance` | string | Yes | Risk tolerance. Options: `"Low"`, `"Medium"`, `"High"`. |
| `accept_risk` | integer | Yes | Risk acceptance. Must be `1` to acknowledge risks. |
| `accept_terms` | integer | Yes | Terms acceptance. Must be `1` to accept terms and conditions. |

#### Request Example

```json
{
  "new_account_maltainvest": 1,
  "email": "user@example.com",
  "verification_code": "123456",
  "client_password": "SecurePass123",
  "residence": "DE",
  "account_opening_reason": "Speculation",
  "currency": "EUR",
  "date_of_birth": "1990-01-15",
  "first_name": "John",
  "last_name": "Doe",
  "phone": "+491234567890",
  "address_line_1": "123 Main Street",
  "address_city": "Berlin",
  "address_postcode": "10115",
  "address_state": "",
  "tax_residence": "DE",
  "tax_identification_number": "DE123456789",
  "employment_status": "Employed",
  "employment_industry": "Technology",
  "annual_income": "50000-100000",
  "estimated_worth": "100000-500000",
  "source_of_wealth": "Salary",
  "trading_experience": "2-5 years",
  "trading_experience_cfd": "1-2 years",
  "trading_experience_forex": "2-5 years",
  "trading_experience_other_instruments": "Less than 1 year",
  "risk_tolerance": "Medium",
  "accept_risk": 1,
  "accept_terms": 1
}
```

#### Expected Response

**Success Response:**
```json
{
  "new_account_maltainvest": {
    "client_id": "CR12345678",
    "oauth_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "email": "user@example.com",
    "currency": "EUR",
    "landing_company": "maltainvest",
    "account_type": "real",
    "account_status": "pending_verification",
    "verification_required": true
  },
  "echo_req": {
    "new_account_maltainvest": 1,
    "email": "user@example.com",
    "verification_code": "123456",
    "client_password": "SecurePass123",
    "residence": "DE",
    "currency": "EUR"
  },
  "msg_type": "new_account_maltainvest"
}
```

#### Expected Behavior

- Creates a real trading account under Malta Invest regulation
- Account status is `pending_verification` until KYC documents are submitted
- Requires identity verification (passport/ID) and proof of address
- Financial assessment is performed based on provided information
- Account may be restricted until verification is complete
- Full compliance with EU MiFID II regulations

#### Compliance Requirements

- Identity verification (passport or national ID)
- Proof of address (utility bill or bank statement, max 3 months old)
- Financial assessment questionnaire
- Risk warnings acknowledgment
- Terms and conditions acceptance

---

### Non-EU Users: `new_account_real`

#### Description

Creates a real trading account for non-EU residents. This endpoint follows simplified compliance requirements compared to EU accounts, but still requires identity verification and basic financial information.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `new_account_real` | integer | Yes | Must be `1` to create a real account. |
| `email` | string | Yes | Verified email address. |
| `verification_code` | string | Yes | Email verification code. |
| `client_password` | string | Yes | Account password. Minimum 8 characters. |
| `residence` | string | Yes | ISO 3166-1 alpha-2 country code. Must be a non-EU country (e.g., `"US"`, `"GB"`, `"AU"`, `"CA"`). |
| `account_opening_reason` | string | Yes | Reason for account opening. |
| `currency` | string | Yes | Account currency. Supported: `USD`, `EUR`, `GBP`, `AUD`, `JPY`. |
| `date_of_birth` | string | Yes | Date of birth in YYYY-MM-DD format. Must be 18+ years. |
| `first_name` | string | Yes | Legal first name. |
| `last_name` | string | Yes | Legal last name. |
| `phone` | string | Yes | Phone number with country code. |
| `address_line_1` | string | Yes | Primary address line. |
| `address_city` | string | Yes | City name. |
| `address_postcode` | string | Yes | Postal/ZIP code. |
| `address_state` | string | No | State/province (if applicable). |
| `tax_residence` | string | Yes | Tax residence country code. |
| `tax_identification_number` | string | No | Tax ID number (if applicable). |
| `accept_risk` | integer | Yes | Risk acceptance. Must be `1`. |
| `accept_terms` | integer | Yes | Terms acceptance. Must be `1`. |

#### Request Example

```json
{
  "new_account_real": 1,
  "email": "user@example.com",
  "verification_code": "123456",
  "client_password": "SecurePass123",
  "residence": "US",
  "account_opening_reason": "Speculation",
  "currency": "USD",
  "date_of_birth": "1985-05-20",
  "first_name": "Jane",
  "last_name": "Smith",
  "phone": "+15551234567",
  "address_line_1": "456 Oak Avenue",
  "address_city": "New York",
  "address_postcode": "10001",
  "address_state": "NY",
  "tax_residence": "US",
  "tax_identification_number": "123-45-6789",
  "accept_risk": 1,
  "accept_terms": 1
}
```

#### Expected Response

**Success Response:**
```json
{
  "new_account_real": {
    "client_id": "CR87654321",
    "oauth_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "email": "user@example.com",
    "currency": "USD",
    "landing_company": "svg",
    "account_type": "real",
    "account_status": "pending_verification",
    "verification_required": true
  },
  "echo_req": {
    "new_account_real": 1,
    "email": "user@example.com",
    "verification_code": "123456",
    "client_password": "SecurePass123",
    "residence": "US",
    "currency": "USD"
  },
  "msg_type": "new_account_real"
}
```

#### Expected Behavior

- Creates a real trading account for non-EU residents
- Account status is `pending_verification` until identity documents are submitted
- Simplified compliance compared to EU accounts
- Requires identity verification (passport/ID)
- Account may be restricted until verification is complete

#### Compliance Requirements

- Identity verification (passport or national ID)
- Proof of address (utility bill or bank statement)
- Risk warnings acknowledgment
- Terms and conditions acceptance

---

## Wallet Account Creation

### Demo Wallet: `new_account_virtual`

#### Description

Creates a virtual wallet account with USD 10,000 virtual balance. Demo wallets allow users to practice wallet operations, deposits, and withdrawals without real funds. This uses the same endpoint as demo trading accounts but is configured for wallet-only operations.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `new_account_virtual` | integer | Yes | Must be `1` to create a virtual account. |
| `email` | string | Yes | Verified email address. |
| `verification_code` | string | Yes | Email verification code. |
| `client_password` | string | Yes | Account password. |
| `residence` | string | Yes | ISO 3166-1 alpha-2 country code. |
| `account_type` | string | No | Account type. Use `"wallet"` for wallet-only account. Default: `"trading"`. |
| `currency` | string | No | Wallet currency. Default: `"USD"`. |

#### Request Example

```json
{
  "new_account_virtual": 1,
  "email": "user@example.com",
  "verification_code": "123456",
  "client_password": "SecurePass123",
  "residence": "US",
  "account_type": "wallet",
  "currency": "USD"
}
```

#### Expected Response

**Success Response:**
```json
{
  "new_account_virtual": {
    "client_id": "CR12345678",
    "oauth_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "email": "user@example.com",
    "currency": "USD",
    "balance": 10000.00,
    "account_type": "wallet",
    "landing_company": "virtual"
  },
  "echo_req": {
    "new_account_virtual": 1,
    "email": "user@example.com",
    "verification_code": "123456",
    "client_password": "SecurePass123",
    "residence": "US",
    "account_type": "wallet",
    "currency": "USD"
  },
  "msg_type": "new_account_virtual"
}
```

#### Expected Behavior

- Creates a virtual wallet with USD 10,000 virtual balance
- Wallet is immediately available for virtual transactions
- Virtual funds cannot be withdrawn or converted to real funds
- No KYC verification required

---

### Real Wallet: `new_account_wallet`

#### Description

Creates a real wallet account for making deposits, withdrawals, and managing funds. Wallet accounts are separate from trading accounts and can be linked to trading accounts for fund transfers. Compliance requirements differ based on user residence (EU vs Non-EU).

#### EU Residents: Malta Invest Compliance

For EU residents, wallet creation follows Malta Invest regulations with full compliance checks.

##### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `new_account_wallet` | integer | Yes | Must be `1` to create a wallet account. |
| `email` | string | Yes | Verified email address. |
| `verification_code` | string | Yes | Email verification code. |
| `client_password` | string | Yes | Account password. |
| `residence` | string | Yes | ISO 3166-1 alpha-2 country code. Must be an EU country. |
| `currency` | string | Yes | Wallet currency. Supported: `USD`, `EUR`, `GBP`. |
| `date_of_birth` | string | Yes | Date of birth in YYYY-MM-DD format. |
| `first_name` | string | Yes | Legal first name. |
| `last_name` | string | Yes | Legal last name. |
| `phone` | string | Yes | Phone number with country code. |
| `address_line_1` | string | Yes | Primary address line. |
| `address_city` | string | Yes | City name. |
| `address_postcode` | string | Yes | Postal/ZIP code. |
| `tax_residence` | string | Yes | Tax residence country code. |
| `accept_risk` | integer | Yes | Risk acceptance. Must be `1`. |
| `accept_terms` | integer | Yes | Terms acceptance. Must be `1`. |

##### Request Example

```json
{
  "new_account_wallet": 1,
  "email": "user@example.com",
  "verification_code": "123456",
  "client_password": "SecurePass123",
  "residence": "FR",
  "currency": "EUR",
  "date_of_birth": "1992-03-10",
  "first_name": "Marie",
  "last_name": "Dubois",
  "phone": "+33123456789",
  "address_line_1": "789 Rue de la Paix",
  "address_city": "Paris",
  "address_postcode": "75001",
  "tax_residence": "FR",
  "accept_risk": 1,
  "accept_terms": 1
}
```

##### Expected Response

```json
{
  "new_account_wallet": {
    "client_id": "CR98765432",
    "oauth_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "email": "user@example.com",
    "currency": "EUR",
    "balance": 0.00,
    "account_type": "wallet",
    "landing_company": "maltainvest",
    "account_status": "pending_verification",
    "verification_required": true
  },
  "echo_req": {
    "new_account_wallet": 1,
    "email": "user@example.com",
    "verification_code": "123456",
    "client_password": "SecurePass123",
    "residence": "FR",
    "currency": "EUR"
  },
  "msg_type": "new_account_wallet"
}
```

---

#### Non-EU Residents: Simplified Compliance

For non-EU residents, wallet creation follows simplified compliance requirements.

##### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `new_account_wallet` | integer | Yes | Must be `1` to create a wallet account. |
| `email` | string | Yes | Verified email address. |
| `verification_code` | string | Yes | Email verification code. |
| `client_password` | string | Yes | Account password. |
| `residence` | string | Yes | ISO 3166-1 alpha-2 country code. Must be a non-EU country. |
| `currency` | string | Yes | Wallet currency. Supported: `USD`, `EUR`, `GBP`, `AUD`, `JPY`. |
| `date_of_birth` | string | Yes | Date of birth in YYYY-MM-DD format. |
| `first_name` | string | Yes | Legal first name. |
| `last_name` | string | Yes | Legal last name. |
| `phone` | string | Yes | Phone number with country code. |
| `address_line_1` | string | Yes | Primary address line. |
| `address_city` | string | Yes | City name. |
| `address_postcode` | string | Yes | Postal/ZIP code. |
| `tax_residence` | string | Yes | Tax residence country code. |
| `accept_risk` | integer | Yes | Risk acceptance. Must be `1`. |
| `accept_terms` | integer | Yes | Terms acceptance. Must be `1`. |

##### Request Example

```json
{
  "new_account_wallet": 1,
  "email": "user@example.com",
  "verification_code": "123456",
  "client_password": "SecurePass123",
  "residence": "AU",
  "currency": "AUD",
  "date_of_birth": "1988-07-25",
  "first_name": "David",
  "last_name": "Wilson",
  "phone": "+61234567890",
  "address_line_1": "321 Collins Street",
  "address_city": "Melbourne",
  "address_postcode": "3000",
  "tax_residence": "AU",
  "accept_risk": 1,
  "accept_terms": 1
}
```

##### Expected Response

```json
{
  "new_account_wallet": {
    "client_id": "CR11223344",
    "oauth_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "email": "user@example.com",
    "currency": "AUD",
    "balance": 0.00,
    "account_type": "wallet",
    "landing_company": "svg",
    "account_status": "pending_verification",
    "verification_required": true
  },
  "echo_req": {
    "new_account_wallet": 1,
    "email": "user@example.com",
    "verification_code": "123456",
    "client_password": "SecurePass123",
    "residence": "AU",
    "currency": "AUD"
  },
  "msg_type": "new_account_wallet"
}
```

#### Expected Behavior

- Creates a real wallet account with zero balance
- Account status is `pending_verification` until identity documents are submitted
- Wallet can be funded via deposit methods once verified
- Can be linked to trading accounts for fund transfers
- EU accounts require full compliance documentation
- Non-EU accounts require simplified compliance documentation

#### Compliance Requirements

**EU Residents:**
- Identity verification (passport or national ID)
- Proof of address (utility bill or bank statement)
- Tax identification number (if applicable)
- Financial assessment questionnaire
- Risk warnings acknowledgment

**Non-EU Residents:**
- Identity verification (passport or national ID)
- Proof of address (utility bill or bank statement)
- Risk warnings acknowledgment

---

## Common Error Codes

| Error Code | Description | Solution |
|------------|-------------|----------|
| `InputValidationFailed` | Invalid input parameter | Check parameter format and required fields |
| `EmailVerificationFailed` | Email verification code invalid or expired | Request new verification code |
| `DuplicateEmail` | Email already registered | Use different email or login to existing account |
| `InvalidResidence` | Invalid or unsupported country code | Use valid ISO 3166-1 alpha-2 country code |
| `AgeRestriction` | User is under 18 years old | Account creation requires user to be 18+ |
| `ComplianceCheckFailed` | Compliance verification failed | Submit required documents and information |
| `TermsNotAccepted` | Terms and conditions not accepted | Set `accept_terms` to `1` |

---

## WebSocket Usage

All endpoints are accessible via WebSocket connection. Connect to the Deriv WebSocket API and send requests in the following format:

```json
{
  "msg_type": "verify_email",
  "verify_email": "user@example.com",
  "type": "account_opening"
}
```

Responses will include an `echo_req` field containing the original request parameters.

---

## Date Format

All dates must be provided in **YYYY-MM-DD** format (ISO 8601 date format).

Examples:
- `1990-01-15` (January 15, 1990)
- `1985-12-31` (December 31, 1985)

---

## Country Codes

Use **ISO 3166-1 alpha-2** country codes for all `residence` and `tax_residence` parameters.

Examples:
- `US` - United States
- `GB` - United Kingdom
- `DE` - Germany
- `FR` - France
- `AU` - Australia
- `CA` - Canada
- `JP` - Japan

---

## Account Status Values

| Status | Description |
|--------|-------------|
| `pending_verification` | Account created but verification documents not yet submitted or approved |
| `verified` | Account verified and fully operational |
| `suspended` | Account temporarily suspended (contact support) |
| `closed` | Account closed |

---

## Notes

- All API requests must include proper authentication tokens where required
- Rate limits apply to all endpoints (check API documentation for current limits)
- Virtual accounts expire after 30 days of inactivity
- Real accounts require ongoing compliance with regulatory requirements
- Currency conversion fees may apply for multi-currency operations
- Account linking between wallet and trading accounts is supported via separate API endpoints





