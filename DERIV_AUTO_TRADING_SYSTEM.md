# Deriv Auto-Trading System

## Overview

The Deriv Auto-Trading System enables Signalist users to trade directly on Deriv via API keys without leaving the Signalist platform. The system provides fully automated trading based on Signalist signals, real-time monitoring, comprehensive analytics, and robust risk management.

## Architecture

### Core Components

1. **Encryption Service** (`lib/utils/encryption.ts`)
   - AES-256-GCM encryption for API tokens
   - Secure storage of sensitive credentials

2. **Server-Side WebSocket Client** (`lib/deriv/server-websocket-client.ts`)
   - WebSocket connection to Deriv API
   - Real-time contract and balance updates
   - Automatic reconnection handling

3. **Auto-Trading Service** (`lib/services/deriv-auto-trading.service.ts`)
   - Signal-to-trade execution engine
   - Contract lifecycle management
   - Event-driven architecture

4. **Risk Management Service** (`lib/services/risk-management.service.ts`)
   - Daily trade limits
   - Loss limits and drawdown protection
   - Consecutive loss tracking

5. **Analytics Service** (`lib/services/trading-analytics.service.ts`)
   - Performance metrics calculation
   - Win rate, ROI, profit factor
   - Equity curve generation

### Database Models

1. **DerivApiToken** (`database/models/deriv-api-token.model.ts`)
   - Encrypted token storage
   - Account information caching
   - Token validation status

2. **AutoTradingSession** (`database/models/auto-trading-session.model.ts`)
   - Session tracking
   - Performance metrics
   - Risk settings

3. **SignalistBotTrade** (existing)
   - Trade execution records
   - P/L tracking
   - Status management

## API Endpoints

### Token Management

#### `POST /api/deriv/token`
Store or update Deriv API token.

**Request Body:**
```json
{
  "token": "your-deriv-api-token",
  "accountType": "demo" | "real"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accountType": "demo",
    "accountId": "12345678",
    "balance": 10000,
    "currency": "USD",
    "isValid": true
  }
}
```

#### `GET /api/deriv/token`
Get token information (without token value).

#### `DELETE /api/deriv/token`
Remove stored API token.

#### `PUT /api/deriv/token/validate`
Validate existing token and update account info.

### Auto-Trading Control

#### `POST /api/deriv/auto-trading/start`
Start auto-trading session.

**Request Body:**
```json
{
  "strategy": "Signalist-SMA-3C",
  "riskSettings": {
    "maxTradesPerDay": 10,
    "dailyLossLimit": 100,
    "maxStakeSize": 50,
    "riskPerTrade": 10,
    "autoStopDrawdown": 20
  },
  "signalFilters": {
    "symbols": ["BOOM500", "CRASH500"],
    "sources": ["algorithm"]
  }
}
```

#### `POST /api/deriv/auto-trading/stop`
Stop auto-trading session.

#### `GET /api/deriv/auto-trading/status`
Get current auto-trading status.

### Real-Time Updates

#### `GET /api/deriv/auto-trading/live-updates`
Server-Sent Events stream for real-time trading updates.

**Event Types:**
- `status` - Initial status
- `trade_executed` - New trade opened
- `trade_update` - Trade P/L update
- `trade_closed` - Trade closed
- `balance_update` - Account balance change
- `error` - Error occurred
- `drawdown_limit` - Drawdown limit reached
- `heartbeat` - Keep-alive ping

### Analytics & Data

#### `GET /api/deriv/auto-trading/analytics`
Get comprehensive trading analytics.

**Query Parameters:**
- `startDate` - Optional start date filter
- `endDate` - Optional end date filter

**Response includes:**
- Core metrics (win rate, P/L, profit factor)
- Performance metrics (ROI, drawdown)
- Activity metrics (trades per day)
- Strategy performance by symbol
- Time-based analysis (daily/weekly/monthly)
- Equity curve

#### `GET /api/deriv/auto-trading/trades`
Get trading history.

**Query Parameters:**
- `status` - Filter by status (OPEN, CLOSED, etc.)
- `limit` - Results limit (default: 50)
- `offset` - Pagination offset

#### `GET /api/deriv/auto-trading/risk-metrics`
Get current risk management metrics.

## Usage Flow

### 1. Connect Deriv Account

```typescript
// Store API token
const response = await fetch('/api/deriv/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    token: 'your-deriv-api-token',
    accountType: 'demo'
  })
});
```

### 2. Start Auto-Trading

```typescript
const response = await fetch('/api/deriv/auto-trading/start', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    strategy: 'Signalist-SMA-3C',
    riskSettings: {
      maxTradesPerDay: 10,
      dailyLossLimit: 100,
      maxStakeSize: 50,
      riskPerTrade: 10,
      autoStopDrawdown: 20
    }
  })
});
```

### 3. Listen to Live Updates

```typescript
const eventSource = new EventSource('/api/deriv/auto-trading/live-updates');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  switch (data.type) {
    case 'trade_executed':
      console.log('New trade:', data.data);
      break;
    case 'trade_update':
      console.log('Trade update:', data.data);
      break;
    case 'balance_update':
      console.log('Balance:', data.data.balance);
      break;
  }
};
```

### 4. Get Analytics

```typescript
const response = await fetch('/api/deriv/auto-trading/analytics');
const analytics = await response.json();
console.log('Win Rate:', analytics.data.winRate);
console.log('Total P/L:', analytics.data.totalProfitLoss);
```

## Risk Management

The system enforces multiple safeguards:

1. **Daily Trade Limit** - Maximum trades per day
2. **Daily Loss Limit** - Maximum loss per day
3. **Max Stake Size** - Maximum stake per trade
4. **Risk Per Trade** - Percentage of balance risked per trade
5. **Drawdown Protection** - Auto-stop on drawdown threshold
6. **Consecutive Losses** - Stop after N consecutive losses

## Security

- API tokens are encrypted at rest using AES-256-GCM
- Tokens are never exposed to the frontend
- All trades executed server-side
- Role-based access control
- Audit logging of all trading actions

## Signal-to-Trade Execution

1. Signal created in Signalist
2. Auto-trading service polls for active signals
3. Risk checks performed
4. Stake size calculated based on risk settings
5. Trade placed via Deriv WebSocket API
6. Contract subscribed for real-time updates
7. Trade saved to database
8. Signal marked as executed

## Contract Lifecycle

1. **Open** - Contract purchased, monitoring P/L
2. **Update** - Real-time P/L updates via WebSocket
3. **Close** - Contract expires or manually closed
4. **Settled** - Final P/L calculated and saved

## Error Handling

- Automatic WebSocket reconnection
- Graceful error recovery
- Error events emitted for monitoring
- Failed trades logged with error messages

## Monitoring & Logging

- All trades logged to database
- Real-time events via SSE
- Session tracking with performance metrics
- Error logging for debugging

## Performance Considerations

- WebSocket connection pooling per user
- Efficient database queries with indexes
- Polling interval optimized (5 seconds for signals)
- Real-time updates via subscriptions

## Future Enhancements

- [ ] Support for multiple strategies simultaneously
- [ ] Advanced order types (limit, stop-loss)
- [ ] Portfolio management
- [ ] Backtesting integration
- [ ] Mobile app support
- [ ] Telegram notifications
- [ ] Multi-account support

## Troubleshooting

### Token Validation Fails
- Check token is valid and not expired
- Verify token has required scopes (trade, read)
- Ensure account type matches (demo/real)

### Trades Not Executing
- Check auto-trading is started
- Verify risk limits not exceeded
- Check signal status is 'active'
- Review error logs

### WebSocket Disconnects
- Automatic reconnection enabled
- Check network connectivity
- Verify Deriv API status
- Review connection logs

## Support

For issues or questions:
1. Check error logs in console
2. Review API response errors
3. Verify token and account status
4. Check risk management metrics

