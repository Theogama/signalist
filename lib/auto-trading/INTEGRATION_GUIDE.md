# Integration Guide

This guide shows you how to integrate the enhanced trading bot features into your existing codebase.

## Quick Start

### 1. Strategies Already Updated ✅

The following strategies have been automatically upgraded to use `EnhancedBaseStrategy`:
- `RiseFallStrategy` - Now includes SMC, confirmations, and filters
- `EvenOddStrategy` - Now includes enhanced filters and confirmations

### 2. Bot Manager Already Updated ✅

The bot manager service has been updated to:
- Use `EnhancedRiskManager` instead of `RiskManager`
- Use `executeOrderSafely()` for smart order execution
- Track positions for breakeven/trailing stops
- Update stop losses automatically
- Enhanced logging

### 3. Configuration Examples

#### Basic Configuration (Paper Trading)

```typescript
const parameters = {
  // Basic settings
  riskPercent: 1, // 1% risk per trade
  takeProfitPercent: 2, // 2% take profit
  stopLossPercent: 1, // 1% stop loss
  maxTrades: 3, // Max 3 concurrent positions
  initialBalance: 10000, // Starting balance
  
  // Enhanced risk management
  useATRForSL: true, // Use ATR for dynamic stop loss
  atrMultiplier: 2, // 2x ATR for stop distance
  enableBreakeven: true, // Enable breakeven automation
  breakevenTriggerRR: 1, // Move to breakeven at 1:1 RR
  enableTrailingStop: true, // Enable trailing stop
  trailingStopATRMultiplier: 1.5, // 1.5x ATR trailing distance
  
  // Daily limits
  maxDailyTrades: 10, // Max 10 trades per day
  maxDailyLoss: 5, // 5% daily loss limit
  maxDailyProfit: 10, // 10% profit target (auto-shutoff)
  maxTradesPerSession: 3, // Max 3 trades per session
  
  // Strategy enhancements
  useSMC: true, // Use Smart Money Concepts
  useEMA: true, // EMA confirmation
  useRSI: true, // RSI confirmation
  useVolume: true, // Volume confirmation
  useFVG: true, // Fair Value Gap confirmation
  useSessionFilter: false, // Allow all sessions
  useNewsFilter: true, // Block trading around news
  useConsolidationFilter: true, // Avoid consolidation
};
```

#### Conservative Configuration

```typescript
const conservativeConfig = {
  riskPercent: 0.5, // Lower risk
  takeProfitPercent: 3, // Higher reward
  stopLossPercent: 0.5, // Tighter stops
  maxTrades: 1, // One position at a time
  
  // Strict risk management
  useATRForSL: true,
  atrMultiplier: 1.5, // Tighter stops
  enableBreakeven: true,
  breakevenTriggerRR: 0.5, // Move to breakeven earlier
  enableTrailingStop: true,
  trailingStopATRMultiplier: 1, // Tighter trailing
  
  // Strict limits
  maxDailyTrades: 5,
  maxDailyLoss: 3, // Very conservative
  maxDailyProfit: 5,
  maxTradesPerSession: 1,
  
  // More filters
  useSMC: true,
  requireBOS: true, // Require Break of Structure
  useEMA: true,
  useRSI: true,
  useVolume: true,
  useSessionFilter: true,
  allowedSessions: ['London', 'New York'], // Only trade during these sessions
  useNewsFilter: true,
  useConsolidationFilter: true,
};
```

#### Aggressive Configuration

```typescript
const aggressiveConfig = {
  riskPercent: 2, // Higher risk
  takeProfitPercent: 3, // Higher reward
  stopLossPercent: 1.5,
  maxTrades: 5, // More concurrent positions
  
  // Aggressive risk management
  useATRForSL: true,
  atrMultiplier: 2.5, // Wider stops
  enableBreakeven: true,
  breakevenTriggerRR: 1.5, // Move to breakeven later
  enableTrailingStop: true,
  trailingStopATRMultiplier: 2, // Wider trailing
  
  // Higher limits
  maxDailyTrades: 20,
  maxDailyLoss: 10,
  maxDailyProfit: 20,
  maxTradesPerSession: 5,
  
  // Fewer filters for more signals
  useSMC: true,
  requireBOS: false, // Don't require BOS
  useEMA: true,
  useRSI: false, // Less restrictive
  useVolume: false,
  useSessionFilter: false, // Trade all sessions
  useNewsFilter: true, // Still avoid news
  useConsolidationFilter: false, // Trade during consolidation
};
```

## API Usage

### Starting a Bot with Enhanced Features

```typescript
import { botManager } from '@/lib/services/bot-manager.service';
import { strategyRegistry } from '@/lib/auto-trading/strategies/StrategyRegistry';
import { ExnessAdapter } from '@/lib/auto-trading/adapters/ExnessAdapter';

// Get strategy
const strategy = strategyRegistry.create('RiseFall', {
  riskPercent: 1,
  takeProfitPercent: 2,
  stopLossPercent: 1,
  // Enhanced config
  useSMC: true,
  useATRForSL: true,
  enableBreakeven: true,
  enableTrailingStop: true,
  // ... other parameters
});

// Create adapter (optional for paper trading)
const adapter = new ExnessAdapter();

// Start bot
const botKey = await botManager.startBot(
  'bot-123',
  'user-456',
  strategy,
  adapter, // null for paper trading
  'XAUUSD',
  {
    riskPercent: 1,
    useATRForSL: true,
    enableBreakeven: true,
    enableTrailingStop: true,
    // ... other parameters
  },
  true // paper trading
);
```

### Monitoring Bot Performance

```typescript
import { logEmitter } from '@/lib/auto-trading/log-emitter/LogEmitter';

// Subscribe to logs
const unsubscribe = logEmitter.subscribe('user-456', (log) => {
  console.log(`[${log.level}] ${log.message}`, log.data);
  
  // Handle different log types
  switch (log.type) {
    case 'signal':
      console.log('Signal generated:', log.data);
      break;
    case 'order':
      console.log('Order executed:', log.data);
      break;
    case 'risk':
      console.log('Risk alert:', log.data);
      break;
    case 'trade':
      console.log('Trade closed:', log.data);
      break;
  }
});

// Get recent logs
const recentLogs = logEmitter.getLogs('user-456', 50);
```

### Getting Risk Metrics

```typescript
const bot = botManager.getActiveBot('user-456', 'bot-123');
if (bot) {
  const metrics = bot.riskManager.getRiskMetrics();
  console.log('Daily P/L:', metrics.dailyPnl);
  console.log('Daily Trades:', metrics.dailyTrades);
  console.log('Max Drawdown:', metrics.maxDrawdown);
  console.log('Is Shut Off:', metrics.isShutOff);
}
```

## Testing in Paper Trading Mode

### 1. Start Paper Trading Bot

```typescript
// In your API route or component
const botKey = await botManager.startBot(
  botId,
  userId,
  strategy,
  null, // No adapter = paper trading
  'XAUUSD',
  {
    initialBalance: 10000,
    riskPercent: 1,
    useATRForSL: true,
    enableBreakeven: true,
    enableTrailingStop: true,
  },
  true // paper trading mode
);
```

### 2. Monitor Logs

All logs are automatically sent to WebSocket. Check your frontend logs panel to see:
- Signal generation with details
- Order execution with slippage/latency
- Risk calculations
- Position updates
- Exit reasons

### 3. Verify Features

- **Dynamic SL/TP**: Check logs for "Risk Calculation" - should show ATR-based stops
- **Breakeven**: Watch for "stop loss updated" messages when profit reaches 1:1 RR
- **Trailing Stop**: Watch for stop loss updates as price moves favorably
- **Daily Limits**: Bot should shut off when daily profit/loss limits reached

## Migration Checklist

- [x] Strategies updated to use EnhancedBaseStrategy
- [x] Bot manager updated to use EnhancedRiskManager
- [x] Smart execution integrated
- [x] Position tracking for breakeven/trailing stops
- [x] Enhanced logging
- [ ] Test in paper trading mode
- [ ] Configure risk parameters
- [ ] Monitor performance
- [ ] Adjust parameters based on results

## Common Issues & Solutions

### Issue: "Strategy not found"
**Solution**: Make sure strategies are registered in StrategyRegistry

### Issue: "Order execution failed"
**Solution**: Check spread, latency, and broker connection. Use paper trading to test.

### Issue: "Breakeven not triggering"
**Solution**: Verify `enableBreakeven: true` and `breakevenTriggerRR` is set correctly.

### Issue: "Trailing stop not working"
**Solution**: Ensure `enableTrailingStop: true` and position is tracked with `riskManager.trackPosition()`.

## Next Steps

1. **Test in Paper Trading**: Start with paper trading mode to validate all features
2. **Monitor Performance**: Watch logs and metrics to understand bot behavior
3. **Adjust Parameters**: Fine-tune risk parameters based on results
4. **Gradual Rollout**: Start with small position sizes, gradually increase
5. **Backtest**: Use backtesting to validate strategy before live trading

## Support

For issues or questions:
- Check `ENHANCEMENTS_SUMMARY.md` for detailed feature documentation
- Review code comments in utility files
- Test in paper trading mode first

