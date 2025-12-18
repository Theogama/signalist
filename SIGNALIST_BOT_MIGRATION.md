# Signalist Bot Migration Guide

## Overview

The auto-trading system has been completely replaced with a unified Signalist trading engine implementing the **Signalist-SMA-3C strategy**. This new system supports both Exness (via MT5) and Deriv (via WebSocket) brokers.

## What Changed

### Removed/Archived
- Old strategy implementations (`lib/auto-trading/strategies/*`)
- Old bot execution logic (`lib/services/bot-execution.service.ts` - archived)
- Old bot manager (`lib/services/bot-manager.service.ts` - replaced)

### Added
- **Unified Bot Engine** (`lib/signalist-bot/engine/bot-engine.ts`)
- **Strategy Implementation** (`lib/signalist-bot/strategies/signalist-sma-3c.ts`)
- **Broker Adapters**:
  - MT5 Adapter (`lib/signalist-bot/adapters/mt5-adapter.ts`)
  - Deriv Adapter (`lib/signalist-bot/adapters/deriv-adapter.ts`)
- **New Database Models**:
  - `SignalistBotSettings` - Unified bot settings
  - `SignalistBotTrade` - Trade tracking
- **New API Endpoints**:
  - `POST /api/bot/settings` - Save/update settings
  - `GET /api/bot/settings` - Get settings
  - `POST /api/bot/start` - Start bot
  - `POST /api/bot/stop` - Stop bot
  - `GET /api/bot/status` - Get status
  - `GET /api/bot/trades/open` - Get open trades
  - `GET /api/bot/trades/history` - Get trade history

## Migration Steps

### 1. Backup Current Data
```bash
# Backup MongoDB collections
mongodump --db=your_db --collection=bot_settings
mongodump --db=your_db --collection=bot_trades
```

### 2. Run Migration Script
```bash
npx ts-node scripts/migrate-to-signalist-bot.ts
```

This will:
- Copy compatible settings from old `UserBotSettings` to new `SignalistBotSettings`
- Map old settings to new format
- Set defaults for missing settings

### 3. Update Broker Credentials
Users need to configure broker credentials:
- **Exness**: MT5 login, password, server
- **Deriv**: WebSocket token

### 4. Select Instruments
Users need to select their preferred instrument for each broker.

### 5. Review Settings
Check migrated settings and update as needed:
- Risk per trade (default: 10%)
- Max daily loss (default: 0 = disabled)
- Max daily trades (default: 0 = disabled)
- Candle timeframe (default: 5m)
- SMA periods (default: 50)

## Breaking Changes

1. **Settings Structure**: Completely new settings model
2. **API Endpoints**: Old endpoints replaced with new ones
3. **Strategy Logic**: Old strategies no longer supported
4. **Broker Integration**: Different connection methods (MT5 bridge for Exness)

## Settings Mapping

| Old Setting | New Setting | Notes |
|------------|-------------|-------|
| `maxTradeSizePct` | `riskPerTrade` | Same concept, different name |
| `takeProfitPct` | Calculated via `tpMultiplier` | TP = multiplier * SL |
| `stopLossPct` | `slMethod` + `slValue` or `atrPeriod` | New ATR-based method available |
| `exchange` | `broker` | Now explicitly `exness` or `deriv` |
| N/A | `instrument` | **New** - must be selected |
| N/A | `candleTimeframe` | **New** - default 5m |
| N/A | `smaPeriod` | **New** - default 50 |
| N/A | `spikeDetectionEnabled` | **New** - for Boom/Crash |

## Incompatible Settings

These settings from the old system don't have direct equivalents and need manual review:
- Custom strategy parameters
- Session-based trading times
- Exchange-specific settings

## Rollback

To rollback to the old system:
```bash
npx ts-node scripts/rollback-signalist-bot.ts
```

**Note**: This only disables the new bot. To fully restore, you need to restore the database from backup.

## Testing After Migration

1. Verify settings were migrated correctly
2. Test broker connections (MT5 for Exness, WebSocket for Deriv)
3. Start bot in paper trading mode
4. Verify signal detection
5. Monitor trades and logs

## User Communication

Notify users about:
1. Need to reconfigure broker credentials
2. Need to select instruments
3. Review and update risk settings
4. New safety controls available
5. Strategy behavior changes

## Support

For issues:
1. Check migration logs
2. Review `lib/signalist-bot/README.md`
3. Verify database models were created
4. Check API endpoints are accessible

## Next Steps

1. Update frontend to use new API endpoints
2. Create UI for unified bot settings
3. Add real-time bot status dashboard
4. Implement WebSocket for live updates
5. Add analytics dashboard

## Files to Update

- Frontend components for bot settings
- Dashboard components for bot status
- Trade history views
- Real-time event subscriptions




