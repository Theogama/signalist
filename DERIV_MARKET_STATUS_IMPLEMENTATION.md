# Deriv Market Status Detection Service

## Overview

Comprehensive market status detection service for Deriv that detects if markets are Open, Closed, or Suspended. Blocks trade execution when markets are not tradable and emits alerts for status changes.

## Features

### 1. **Market Status Detection**
- **Open**: Market is open and tradable
- **Closed**: Market is closed (outside trading hours or weekend)
- **Suspended**: Market is temporarily suspended
- **Unknown**: Status cannot be determined

### 2. **Detection Methods**
- **API-Based**: Uses Deriv WebSocket API to check actual market status
- **Trading Hours**: Fallback logic based on symbol trading hours
- **Fallback**: Default behavior when API is unavailable

### 3. **Trade Execution Blocking**
- Automatically blocks trade execution when market is closed
- Logs blocked trades with reason
- Prevents unnecessary API calls

### 4. **Alert System**
- Emits alerts when market status changes
- Notifies when market becomes non-tradable
- Provides detailed status information

## Components

### 1. Market Status Service
**File**: `lib/services/deriv-market-status.service.ts`

**Key Methods**:
- `getMarketStatus(symbol)` - Get market status for a symbol
- `isMarketTradable(symbol)` - Check if market is tradable (convenience method)
- `initialize(userId)` - Initialize service with user token
- `clearCache(symbol?)` - Clear status cache
- `disconnect()` - Cleanup and disconnect

**Events**:
- `market_status_alert` - Emitted when market status changes
- `market_not_tradable` - Emitted when market is not tradable

### 2. API Route
**File**: `app/api/deriv/market-status/route.ts`

**Endpoint**: `GET /api/deriv/market-status?symbol=BOOM1000`

**Response**:
```json
{
  "success": true,
  "isOpen": true,
  "status": "open",
  "symbol": "BOOM1000",
  "isTradable": true,
  "reason": null,
  "nextOpen": null,
  "checkedAt": "2024-01-01T12:00:00.000Z",
  "source": "api",
  "metadata": {
    "timezone": "UTC",
    "tradingDays": ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
  }
}
```

### 3. Bot Manager Integration
**File**: `lib/services/bot-manager.service.ts`

Automatically checks market status before executing trades:
- Blocks trade execution if market is closed
- Logs blocked trades with reason
- Fails open (allows trade) if status check fails (safety)

## Usage Examples

### Basic Usage
```typescript
import { marketStatusService } from '@/lib/services/deriv-market-status.service';

// Initialize with user ID
await marketStatusService.initialize('user-id');

// Get market status
const status = await marketStatusService.getMarketStatus('BOOM1000');
console.log('Status:', status.status); // 'open', 'closed', 'suspended', 'unknown'
console.log('Is Tradable:', status.isTradable); // true or false
```

### Check if Tradable
```typescript
const isTradable = await marketStatusService.isMarketTradable('BOOM1000');
if (isTradable) {
  // Execute trade
} else {
  // Block trade
}
```

### Listen for Alerts
```typescript
marketStatusService.on('market_status_alert', (alert) => {
  console.log('Market Status Changed:', {
    symbol: alert.symbol,
    previousStatus: alert.previousStatus,
    currentStatus: alert.currentStatus,
    message: alert.message,
    isTradable: alert.isTradable,
  });
});

marketStatusService.on('market_not_tradable', (data) => {
  console.warn('Market Not Tradable:', data);
});
```

### Block Trade Execution
```typescript
// Before executing trade
const status = await marketStatusService.getMarketStatus(symbol);

if (!status.isTradable) {
  console.error('Trade blocked:', status.reason);
  return; // Block execution
}

// Proceed with trade
```

## Market Status Enum

```typescript
enum MarketStatus {
  OPEN = 'open',
  CLOSED = 'closed',
  SUSPENDED = 'suspended',
  UNKNOWN = 'unknown',
}
```

## Market Status Result

```typescript
interface MarketStatusResult {
  status: MarketStatus;
  symbol: string;
  isTradable: boolean;
  reason?: string;
  nextOpen?: Date;
  lastChecked: Date;
  source: 'api' | 'trading-hours' | 'fallback';
  metadata?: {
    marketOpenTime?: Date;
    marketCloseTime?: Date;
    timezone?: string;
    tradingDays?: string[];
  };
}
```

## Trading Hours Configuration

### Synthetic Indices (24/7)
- BOOM1000, BOOM500, BOOM300, BOOM100
- CRASH1000, CRASH500, CRASH300, CRASH100
- Always open (24/7)

### Forex (Sunday 22:00 GMT - Friday 22:00 GMT)
- R_10, R_25, R_50, R_100
- Opens: Sunday 22:00 GMT
- Closes: Friday 22:00 GMT

## Detection Logic

### 1. API-Based Detection (Primary)
- Attempts to get a proposal (read-only, doesn't execute trade)
- Checks for specific error codes:
  - `market_closed` → Status: CLOSED
  - `suspended` → Status: SUSPENDED
  - `symbol` → Status: CLOSED (symbol not available)
- If proposal succeeds → Status: OPEN

### 2. Trading Hours Detection (Fallback)
- Uses configured trading hours for symbol
- Checks current day and time
- Calculates next open time if closed

### 3. Fallback (Last Resort)
- Returns UNKNOWN status
- Logs warning
- Defaults to non-tradable (safe)

## Caching

- Status results are cached for 1 minute
- Reduces API calls
- Improves performance
- Cache can be cleared manually

## Integration with Bot Execution

The service is automatically integrated into the bot execution flow:

```typescript
// In bot-manager.service.ts
// Before executing trade:
const isTradable = await marketStatusService.isMarketTradable(bot.instrument);

if (!isTradable) {
  // Block trade execution
  logEmitter.risk('Trade blocked: Market is not tradable', ...);
  return;
}

// Proceed with trade execution
```

## Error Handling

- API failures fall back to trading hours logic
- Trading hours failures fall back to UNKNOWN status
- Service never blocks trades on errors (fails open for safety)
- All errors are logged for debugging

## Security

- Market status checks happen server-side only
- No sensitive data exposed to frontend
- Token-based authentication required
- Rate limiting via caching

## Performance

- 1-minute cache reduces API calls
- Async initialization
- Fast trading hours fallback
- Minimal overhead on trade execution

## Testing

See `lib/services/deriv-market-status.example.ts` for comprehensive usage examples.

## API Endpoints

### GET /api/deriv/market-status
**Query Parameters**:
- `symbol` (optional): Trading symbol (default: 'BOOM1000')

**Response**:
```json
{
  "success": true,
  "isOpen": true,
  "status": "open",
  "symbol": "BOOM1000",
  "isTradable": true,
  "reason": null,
  "nextOpen": null,
  "checkedAt": "2024-01-01T12:00:00.000Z",
  "source": "api"
}
```

## Best Practices

1. **Always Check Before Trading**: Use `isMarketTradable()` before executing trades
2. **Listen for Alerts**: Subscribe to events for real-time status updates
3. **Handle Errors Gracefully**: Service fails open, but log errors for monitoring
4. **Clear Cache When Needed**: Clear cache if you need fresh status immediately
5. **Initialize Once**: Initialize service once per user session

## Future Enhancements

- Real-time WebSocket subscriptions for market status
- Historical market status data
- Market status prediction
- Custom trading hours per user
- Multi-symbol batch status checks

