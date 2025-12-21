# Deprecated Bot Settings

## Overview

The old bot settings system (`UserBotSettings` model) has been **deprecated** in favor of the new unified **Auto-Trade Settings Panel**.

## Old vs New Settings

### Old Settings (`UserBotSettings`)
```typescript
{
  maxTradeSizePct: number,
  stopLossPct: number,
  takeProfitPct: number,
  trailingStop: boolean,
  exchange: string,
  paperMode: boolean
}
```

### New Settings (`AutoTradeSettings`)
```typescript
{
  riskPercent: number,
  lotSize?: number,
  maxTrades: number,
  takeProfitPercent: number,
  stopLossPercent: number,
  tradingSessionEnabled: boolean,
  sessionStart?: string,
  sessionEnd?: string,
  martingale?: boolean,
  martingaleMultiplier?: number,
  maxDailyLoss?: number,
  maxDailyProfit?: number,
  broker: 'exness' | 'deriv' | null
}
```

## Migration

### Field Mapping

| Old Field | New Field | Notes |
|-----------|-----------|-------|
| `maxTradeSizePct` | `riskPercent` | Same concept, different name |
| `stopLossPct` | `stopLossPercent` | Same value, renamed |
| `takeProfitPct` | `takeProfitPercent` | Same value, renamed |
| `trailingStop` | *(not in new settings)* | Feature can be added later |
| `paperMode` | `broker` + adapter mode | Handled differently |

### Components to Update

1. **Settings Pages:**
   - Old: `app/(root)/settings/bot/page.tsx`
   - New: Use `AutoTradeSettingsPanel` component

2. **API Endpoints:**
   - Old: Uses `UserBotSettings` model
   - New: Uses `/api/auto-trading/settings`

3. **Store/State:**
   - Old: Various bot settings stores
   - New: `useAutoTradingStore` with unified settings

## Deprecation Plan

### Phase 1: Parallel Support (Current)
- ✅ New settings system is active
- Old settings still exist for backward compatibility
- Both can coexist

### Phase 2: Migration (Recommended)
- Create migration utility to convert old → new settings
- Prompt users to migrate when accessing auto-trade
- Auto-migrate on first use

### Phase 3: Removal (Future)
- Remove old `UserBotSettings` model
- Remove old settings pages/endpoints
- Update all references to use new system

## Files to Keep/Remove

### Keep (for now):
- `database/models/bot-settings.model.ts` - For backward compatibility

### Remove (eventually):
- Old bot settings pages
- Old bot settings API endpoints (if unused)
- Old settings actions/stores

### Already Using New System:
- ✅ `components/autotrade/AutoTradeSettingsPanel.tsx`
- ✅ `app/api/auto-trading/settings/route.ts`
- ✅ `lib/services/settings-sync.service.ts`
- ✅ All auto-trade components

## Recommendation

For now, **keep the old settings model** but:
1. Don't create new features using old settings
2. All new development should use `AutoTradeSettings`
3. When user accesses auto-trade, migrate old settings to new format
4. Eventually deprecate and remove old system

## Status

✅ **New unified settings system is fully operational**
⏸️ **Old settings system is deprecated but still present**
📋 **Migration path is documented**








