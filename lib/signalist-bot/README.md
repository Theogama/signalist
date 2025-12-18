# Signalist Unified Trading Bot

Complete replacement of the auto-trading logic with a unified trading engine implementing the **Signalist-SMA-3C strategy**.

## Overview

The Signalist unified bot supports both Exness (via MT5) and Deriv (via WebSocket) brokers with a single, consistent trading engine. The bot implements the Signalist-SMA-3C strategy with comprehensive safety controls, logging, and risk management.

## Architecture

```
lib/signalist-bot/
├── types.ts                      # Core type definitions
├── strategies/
│   └── signalist-sma-3c.ts      # Signalist-SMA-3C strategy implementation
├── adapters/
│   ├── mt5-adapter.ts           # Exness MT5 broker adapter
│   └── deriv-adapter.ts         # Deriv WebSocket broker adapter
├── engine/
│   ├── bot-engine.ts            # Main bot engine
│   └── bot-manager.ts           # Bot lifecycle manager
└── README.md                     # This file
```

## Strategy: Signalist-SMA-3C

### Entry Conditions (ALL must be TRUE)

1. **3-Candle Alignment**: Last 3 closed candles must be in the same direction (all bullish or all bearish)
   - Doji candles (very small body) block entry
   
2. **SMA Confirmation**: Price must have crossed the SMA in the same direction within the last M candles (default: 8)
   - If SMA period 2 is enabled, trend must align with longer SMA
   
3. **5-Minute Trend Confirmation**: Trade direction must align with 5-minute trend (EMA/SMA 21)
   - Only checked if timeframe != 5m
   
4. **Once-Per-Candle Rule**: Only one entry allowed per closed candle timeframe
   
5. **Spike Detection** (for Boom/Crash instruments): Requires spike event prior to entry
   - Spike = sudden price move >= threshold (default: 0.5%)
   
6. **Liquidity/Margin Checks**: Verify sufficient margin/funds
   
7. **Risk Sizing**: Calculate position size based on user's risk percentage

### Exit Conditions

- TP hit or SL hit (handled by broker)
- Reverse signal (3 candles align opposite direction) → close if minimum time in trade reached
- Max daily loss reached → force stop
- Max consecutive losses reached → force stop
- Max daily trades reached → force stop
- Manual stop by user

## Supported Instruments

### Exness (via MT5)
- XAUUSD (Gold)
- US30 (DJ30)
- NAS100 (Nasdaq 100)

### Deriv (via WebSocket)
- BOOM1000, BOOM500, BOOM variants
- CRASH1000, CRASH500, CRASH variants

## Configuration

Bot settings are stored in `SignalistBotSettings` model with the following fields:

- **Broker**: `exness` | `deriv`
- **Instrument**: Selected instrument for the broker
- **Risk per trade**: 1-50% (default: 10%, warning for >20%)
- **Max daily loss**: Percentage of starting day balance
- **Max daily trades**: Maximum trades per day
- **Candle timeframe**: `1m` | `3m` | `5m` | `15m` | `30m` | `1h` | `4h` | `1d` (default: `5m`)
- **SMA period**: Default 50
- **SMA period 2**: Optional second SMA (e.g., 200)
- **TP/SL multiplier**: TP = multiplier * SL (default: 3)
- **SL method**: `pips` | `atr` | `candle` (default: `atr`)
- **Spike detection**: Enable for Boom/Crash instruments
- **Strategy**: `Signalist-SMA-3C` (default) | `Custom`
- **Magic number**: For Exness MT5 (optional)
- **Logging level**: `debug` | `info` | `warn` | `error`

## API Endpoints

### POST `/api/bot/settings`
Save or update bot settings.

**Request Body:**
```json
{
  "broker": "exness",
  "instrument": "XAUUSD",
  "enabled": true,
  "riskPerTrade": 10,
  "maxDailyLoss": 5,
  "candleTimeframe": "5m",
  "smaPeriod": 50,
  "mt5Login": 12345678,
  "mt5Password": "password",
  "mt5Server": "Exness-MT5Real"
}
```

### GET `/api/bot/settings`
Get bot settings (optionally filtered by broker/instrument).

### POST `/api/bot/start`
Start the trading bot.

**Request Body:**
```json
{
  "broker": "exness",
  "instrument": "XAUUSD"
}
```

### POST `/api/bot/stop`
Stop the trading bot.

**Request Body:**
```json
{
  "reason": "Manual stop"
}
```

### GET `/api/bot/status`
Get current bot status and health.

### GET `/api/bot/trades/open`
Get open trades.

### GET `/api/bot/trades/history`
Get closed trades history.

## Usage Example

```typescript
import { botManager } from '@/lib/signalist-bot/engine/bot-manager';
import { SignalistBotSettings } from '@/database/models/signalist-bot-settings.model';

// Load settings
const settings = await SignalistBotSettings.findOne({ userId, broker: 'exness', instrument: 'XAUUSD' });

// Start bot
await botManager.startBot(settings.toObject());

// Monitor events
botManager.on('trade_opened', (event) => {
  console.log('Trade opened:', event.data);
});

botManager.on('trade_closed', (event) => {
  console.log('Trade closed:', event.data);
});

// Stop bot
await botManager.stopBot(userId, 'Manual stop');
```

## Safety Controls

1. **Max Daily Loss**: Stops bot if daily loss exceeds threshold
2. **Max Daily Trades**: Limits number of trades per day
3. **Max Consecutive Losses**: Stops bot after N consecutive losses
4. **Max Drawdown**: Force stop if drawdown exceeds threshold
5. **Margin/Funds Check**: Verifies sufficient margin before placing trades
6. **Once-Per-Candle Rule**: Prevents over-trading

## Risk Management

- Position sizing based on risk percentage
- ATR-based stop loss calculation
- Configurable TP/SL multiplier
- Automatic position sizing for both brokers (lots for Exness, stake for Deriv)

## Logging

Every decision is logged with:
- Tick/candle data
- Indicator state
- Signal reason
- Order attempted
- Order result

Logs include:
- Entry signals with reasons
- Trade opened/closed events
- Stop triggered events
- Errors

## Migration

### From Old System

Run the migration script:
```bash
npx ts-node scripts/migrate-to-signalist-bot.ts
```

This will:
- Copy compatible settings from old `UserBotSettings` to new `SignalistBotSettings`
- Set defaults for missing settings
- Flag settings that need manual review (broker credentials, instrument selection)

### Rollback

To rollback (disable Signalist bot):
```bash
npx ts-node scripts/rollback-signalist-bot.ts
```

**Note**: This only disables the bot, it doesn't restore old settings. Restore from backup if needed.

## Testing

### Unit Tests

```bash
npm test -- signalist-bot
```

Tests cover:
- 3-candle alignment detection
- SMA crossing detection
- Spike detection for Boom/Crash
- Risk sizing computations

### Integration Tests

```bash
npm test -- signalist-bot --integration
```

Tests simulate:
- Tick/candle streams
- MT5 responses
- Deriv WebSocket responses
- Order placement scenarios

## Troubleshooting

### Bot won't start
- Check broker credentials are correct
- Verify MT5 service is running (for Exness)
- Check instrument is supported by broker

### No trades being placed
- Verify auto-trade is enabled
- Check safety rules (daily loss, max trades)
- Review signal conditions (may not be met)
- Check logs for signal detection

### Trades closing immediately
- Check reverse signal logic
- Verify minimum time in trade setting
- Review exit conditions

## Performance Considerations

- Candle subscriptions use polling (30s interval) for MT5 (can be optimized)
- Historical candles cached for strategy analysis
- Processed candles tracked to prevent duplicate processing
- Bot manager maintains single instance per user

## Future Enhancements

- Real-time WebSocket candle streaming for MT5
- Multiple instrument support per bot instance
- Custom strategy support
- Advanced analytics dashboard
- Backtesting integration

## Support

For issues or questions:
1. Check logs for error messages
2. Review bot status via `/api/bot/status`
3. Verify settings configuration
4. Check broker connection health




