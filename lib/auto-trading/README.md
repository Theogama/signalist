# Auto-Trading Module

Comprehensive auto-trading system for Signalist supporting Exness and Deriv brokers.

## Features

- **Multi-Broker Support**: Exness (XAUUSD, US30, NAS100) and Deriv (Boom/Crash indices)
- **Strategy Library**: Even/Odd, Rise/Fall, Digits, and more
- **Risk Management**: Per-trade limits, daily limits, max drawdown protection
- **Backtesting**: Test strategies on historical data
- **Paper Trading**: Simulate trades without real money
- **Real-time Execution**: Live trading with proper error handling

## Architecture

```
lib/auto-trading/
├── adapters/          # Broker adapters (Exness, Deriv)
├── strategies/        # Trading strategies
├── risk-manager/      # Risk management
├── backtester/        # Backtesting engine
├── paper-trader/      # Paper trading simulator
├── types.ts          # Type definitions
└── interfaces.ts     # Core interfaces
```

## Quick Start

### 1. Environment Setup

Create a `.env` file:

```env
# Exness API (Trade-only permissions!)
EXNESS_API_KEY=your_exness_api_key
EXNESS_API_SECRET=your_exness_api_secret
EXNESS_BASE_URL=https://api.exness.com

# Deriv API (Trade-only permissions!)
DERIV_API_KEY=your_deriv_api_key
DERIV_API_SECRET=your_deriv_api_secret
DERIV_BASE_URL=https://api.deriv.com

# Paper trading mode (default: true)
PAPER_TRADING=true
```

### 2. Initialize Adapter

```typescript
import { ExnessAdapter } from '@/lib/auto-trading/adapters/ExnessAdapter';

const adapter = new ExnessAdapter();
await adapter.initialize({
  apiKey: process.env.EXNESS_API_KEY!,
  apiSecret: process.env.EXNESS_API_SECRET!,
  environment: 'demo', // or 'live'
});

// Check connection
const health = await adapter.healthCheck();
console.log(health);
```

### 3. Use a Strategy

```typescript
import { EvenOddStrategy } from '@/lib/auto-trading/strategies/EvenOddStrategy';

const strategy = new EvenOddStrategy({
  riskPercent: 1,
  takeProfitPercent: 2,
  stopLossPercent: 1,
  maxConcurrentTrades: 1,
  martingale: false,
});

await strategy.initialize({
  name: 'EvenOdd',
  enabled: true,
  riskPercent: 1,
  takeProfitPercent: 2,
  stopLossPercent: 1,
  maxConcurrentTrades: 1,
});

// Get market data
const marketData = await adapter.getMarketData('XAUUSD');
const signal = await strategy.analyze(marketData, historicalData);
```

### 4. Execute Trade

```typescript
import { RiskManager } from '@/lib/auto-trading/risk-manager/RiskManager';

const riskManager = new RiskManager({
  maxRiskPerTrade: 1,
  maxDailyLoss: 10,
  maxDrawdown: 20,
  maxConcurrentPositions: 3,
  maxPositionSize: 10,
});

// Check if trade is allowed
const canTrade = await riskManager.canTrade(signal, balance, openPositions);

if (canTrade) {
  const order = await adapter.placeOrder({
    symbol: signal.symbol,
    side: signal.side,
    type: 'MARKET',
    quantity: signal.quantity || 1,
    price: signal.entryPrice,
    stopLoss: signal.stopLoss,
    takeProfit: signal.takeProfit,
  });
}
```

## Strategies

### Even/Odd Strategy
Trades based on last digit analysis (even/odd).

```typescript
const strategy = new EvenOddStrategy({
  riskPercent: 1,
  martingale: false,
  martingaleMultiplier: 2,
  maxConsecutiveLosses: 5,
});
```

### Rise/Fall Strategy
Trades based on candle close/open analysis.

```typescript
const strategy = new RiseFallStrategy({
  riskPercent: 1,
  lookbackPeriod: 5,
});
```

### Digits Strategy
Analyzes last digits and predicts matches/differs.

```typescript
const strategy = new DigitsStrategy({
  riskPercent: 1,
  lookbackPeriod: 10,
  digitThreshold: 3,
});
```

## Backtesting

```typescript
import { Backtester } from '@/lib/auto-trading/backtester/Backtester';

const backtester = new Backtester({
  maxRiskPerTrade: 1,
  maxDailyLoss: 10,
  maxDrawdown: 20,
  maxConcurrentPositions: 3,
  maxPositionSize: 10,
});

const result = await backtester.backtest(
  strategy,
  historicalData,
  10000, // initial balance
  strategyConfig
);

console.log(`Win Rate: ${result.winRate}%`);
console.log(`Total P/L: $${result.totalProfitLoss}`);
console.log(`Max Drawdown: ${result.maxDrawdownPercent}%`);
```

## Paper Trading

```typescript
import { PaperTrader } from '@/lib/auto-trading/paper-trader/PaperTrader';

const trader = new PaperTrader(10000); // $10,000 starting balance

// Execute paper trade
const order = await trader.executeTrade(signal, marketData);

// Update positions
trader.updatePositions(marketData);

// Get balance
const balance = trader.getBalance();
const history = trader.getHistory();
```

## API Endpoints

### GET `/api/auto-trading/strategies`
List available strategies.

### POST `/api/auto-trading/backtest`
Run backtest on historical data.

```json
{
  "strategyName": "EvenOdd",
  "historicalData": [...],
  "initialBalance": 10000,
  "config": {
    "riskPercent": 1,
    "takeProfitPercent": 2,
    "stopLossPercent": 1
  }
}
```

### POST `/api/auto-trading/paper-trade`
Execute paper trade or get status.

### GET `/api/auto-trading/health?broker=exness`
Check broker adapter health.

## Safety Guidelines

⚠️ **CRITICAL SAFETY RULES:**

1. **API Keys**: Use API keys with **TRADE-ONLY** permissions. NEVER use keys with withdrawal permissions.

2. **Paper Trading First**: Always start in paper trading mode (`PAPER_TRADING=true`).

3. **Risk Limits**: Set conservative risk limits:
   - Max risk per trade: 1-2%
   - Max daily loss: 5-10%
   - Max drawdown: 15-20%

4. **Testing**: Backtest strategies thoroughly before live trading.

5. **Monitoring**: Monitor trades closely, especially in the first days.

6. **Stop Loss**: Always use stop loss orders.

7. **Position Sizing**: Never risk more than you can afford to lose.

## Supported Symbols

### Exness
- `XAUUSD` (Gold)
- `US30` (Dow Jones 30)
- `NAS100` (Nasdaq 100)

### Deriv
- `BOOM1000`, `BOOM500`, `BOOM300`, `BOOM100`
- `CRASH1000`, `CRASH500`, `CRASH300`, `CRASH100`

## Rate Limiting

Adapters automatically handle rate limiting:
- Exness: 60 requests/minute, 10 requests/second
- Deriv: 60 requests/minute, 10 requests/second

## Error Handling

All adapters include comprehensive error handling:
- Network errors with retry logic
- Invalid order requests
- Insufficient balance
- Rate limit exceeded

## Logging

Enable detailed logging:

```typescript
// Adapter logs all operations
const adapter = new ExnessAdapter();
// Logs: authentication, orders, positions, errors
```

## Testing

Run unit tests:

```bash
npm test
```

## Deployment

See main README for Docker deployment instructions.

## Support

For issues or questions, check:
- API documentation
- Strategy examples
- Backtest results

## License

MIT











