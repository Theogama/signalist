# Signalist Auto-Trading Module

Complete auto-trading system supporting **Exness** and **Deriv** brokers with strategy library, risk management, backtesting, and paper trading.

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- MongoDB (for trade history)
- API keys from Exness and/or Deriv (with **TRADE-ONLY** permissions)

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys
```

### Environment Variables

```env
# Exness API (Trade-only permissions!)
EXNESS_API_KEY=your_exness_api_key
EXNESS_API_SECRET=your_exness_api_secret
EXNESS_BASE_URL=https://api.exness.com

# Deriv API (Trade-only permissions!)
DERIV_API_KEY=your_deriv_api_key
DERIV_API_SECRET=your_deriv_api_secret
DERIV_BASE_URL=https://api.deriv.com

# Paper trading mode (ALWAYS start with true!)
PAPER_TRADING=true

# Database
MONGODB_URI=mongodb://localhost:27017/signalist
```

## 📋 Features

### ✅ Completed

- [x] **Broker Adapters**: ExnessAdapter and DerivAdapter with full API support
- [x] **Strategy Library**: Even/Odd, Rise/Fall, Digits strategies
- [x] **Risk Management**: Per-trade limits, daily limits, max drawdown
- [x] **Backtesting**: Historical data testing with performance metrics
- [x] **Paper Trading**: Simulated execution with logging
- [x] **API Endpoints**: REST API for strategies, backtesting, paper trading
- [x] **Health Checks**: Broker connection monitoring
- [x] **Docker Support**: Dockerfile and docker-compose for deployment
- [x] **Unit Tests**: Tests for adapters and risk manager

### 🔄 In Progress

- [ ] XML bot parser (convert freetradingbots XML to TypeScript)
- [ ] WebSocket real-time updates
- [ ] Advanced alerting (webhooks, email)

## 📁 Project Structure

```
lib/auto-trading/
├── adapters/
│   ├── BaseAdapter.ts          # Base adapter class
│   ├── ExnessAdapter.ts         # Exness broker adapter
│   └── DerivAdapter.ts          # Deriv broker adapter
├── strategies/
│   ├── BaseStrategy.ts          # Base strategy class
│   ├── EvenOddStrategy.ts       # Even/Odd strategy
│   ├── RiseFallStrategy.ts      # Rise/Fall strategy
│   └── DigitsStrategy.ts         # Digits strategy
├── risk-manager/
│   └── RiskManager.ts            # Risk management
├── backtester/
│   └── Backtester.ts             # Backtesting engine
├── paper-trader/
│   └── PaperTrader.ts            # Paper trading simulator
├── types.ts                      # Type definitions
├── interfaces.ts                 # Core interfaces
└── README.md                     # Detailed documentation

app/api/auto-trading/
├── strategies/route.ts           # Strategy management API
├── backtest/route.ts             # Backtesting API
├── paper-trade/route.ts          # Paper trading API
└── health/route.ts                # Health check API
```

## 🎯 Supported Instruments

### Exness
- **XAUUSD** (Gold)
- **US30** (Dow Jones 30)
- **NAS100** (Nasdaq 100)

### Deriv
- **BOOM1000**, **BOOM500**, **BOOM300**, **BOOM100**
- **CRASH1000**, **CRASH500**, **CRASH300**, **CRASH100**

## 📖 Usage Examples

### 1. Initialize Broker Adapter

```typescript
import { ExnessAdapter } from '@/lib/auto-trading/adapters/ExnessAdapter';

const adapter = new ExnessAdapter();
await adapter.initialize({
  apiKey: process.env.EXNESS_API_KEY!,
  apiSecret: process.env.EXNESS_API_SECRET!,
  environment: 'demo', // Start with 'demo'!
});

// Check health
const health = await adapter.healthCheck();
console.log(health);
```

### 2. Use a Strategy

```typescript
import { EvenOddStrategy } from '@/lib/auto-trading/strategies/EvenOddStrategy';

const strategy = new EvenOddStrategy({
  riskPercent: 1,
  takeProfitPercent: 2,
  stopLossPercent: 1,
  martingale: false,
});

const marketData = await adapter.getMarketData('XAUUSD');
const signal = await strategy.analyze(marketData, historicalData);
```

### 3. Execute Trade with Risk Management

```typescript
import { RiskManager } from '@/lib/auto-trading/risk-manager/RiskManager';

const riskManager = new RiskManager({
  maxRiskPerTrade: 1,
  maxDailyLoss: 10,
  maxDrawdown: 20,
  maxConcurrentPositions: 3,
  maxPositionSize: 10,
});

const balance = await adapter.getBalance();
const openPositions = await adapter.getOpenPositions();

if (await riskManager.canTrade(signal, balance.balance, openPositions)) {
  const order = await adapter.placeOrder({
    symbol: signal.symbol,
    side: signal.side,
    type: 'MARKET',
    quantity: signal.quantity || 1,
    stopLoss: signal.stopLoss,
    takeProfit: signal.takeProfit,
  });
}
```

### 4. Backtest Strategy

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

## 🔌 API Endpoints

### GET `/api/auto-trading/strategies`
List available strategies.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "name": "EvenOdd",
      "description": "Trades based on even/odd last digit analysis",
      "parameters": {...}
    }
  ]
}
```

### POST `/api/auto-trading/backtest`
Run backtest on historical data.

**Request:**
```json
{
  "strategyName": "EvenOdd",
  "historicalData": [
    {
      "symbol": "XAUUSD",
      "price": 2000,
      "timestamp": "2024-01-01T00:00:00Z"
    }
  ],
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

**Request:**
```json
{
  "action": "execute",
  "signal": {
    "symbol": "XAUUSD",
    "side": "BUY",
    "entryPrice": 2000,
    "quantity": 0.01
  },
  "marketData": {...}
}
```

### GET `/api/auto-trading/health?broker=exness`
Check broker adapter health.

## 🐳 Docker Deployment

### Build and Run

```bash
# Build
docker-compose build

# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Deploy Script

```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh production
```

## 🧪 Testing

```bash
# Run unit tests
npm test

# Run specific test file
npm test -- ExnessAdapter.test.ts
```

## ⚠️ Safety Guidelines

### CRITICAL RULES

1. **API Keys**: Use API keys with **TRADE-ONLY** permissions. NEVER use keys with withdrawal permissions.

2. **Paper Trading First**: Always start with `PAPER_TRADING=true`. Test thoroughly before live trading.

3. **Risk Limits**: Set conservative limits:
   - Max risk per trade: **1-2%**
   - Max daily loss: **5-10%**
   - Max drawdown: **15-20%**

4. **Backtesting**: Always backtest strategies on historical data before live trading.

5. **Monitoring**: Monitor trades closely, especially in the first days.

6. **Stop Loss**: Always use stop loss orders.

7. **Position Sizing**: Never risk more than you can afford to lose.

## 📊 Proof of Concept

### XAUUSD on Exness

```typescript
// Initialize Exness adapter
const adapter = new ExnessAdapter();
await adapter.initialize({
  apiKey: process.env.EXNESS_API_KEY!,
  apiSecret: process.env.EXNESS_API_SECRET!,
  environment: 'demo',
});

// Use EvenOdd strategy
const strategy = new EvenOddStrategy({
  riskPercent: 1,
  takeProfitPercent: 2,
  stopLossPercent: 1,
});

// Get market data
const marketData = await adapter.getMarketData('XAUUSD');

// Analyze and generate signal
const signal = await strategy.analyze(marketData, historicalData);

// Execute paper trade
if (signal) {
  const order = await adapter.placeOrder({
    symbol: 'XAUUSD',
    side: signal.side,
    type: 'MARKET',
    quantity: signal.quantity || 0.01,
    stopLoss: signal.stopLoss,
    takeProfit: signal.takeProfit,
  });
}
```

### BOOM500 on Deriv

```typescript
// Initialize Deriv adapter
const adapter = new DerivAdapter();
await adapter.initialize({
  apiKey: process.env.DERIV_API_KEY!,
  apiSecret: process.env.DERIV_API_SECRET!,
  environment: 'demo',
});

// Use Digits strategy
const strategy = new DigitsStrategy({
  riskPercent: 1,
  lookbackPeriod: 10,
  digitThreshold: 3,
});

// Get market data
const marketData = await adapter.getMarketData('BOOM500');

// Analyze and generate signal
const signal = await strategy.analyze(marketData, historicalData);

// Execute paper trade
if (signal) {
  const order = await adapter.placeOrder({
    symbol: 'BOOM500',
    side: signal.side,
    type: 'MARKET',
    quantity: signal.quantity || 1,
    stopLoss: signal.stopLoss,
    takeProfit: signal.takeProfit,
  });
}
```

## 🔄 Next Steps

1. **XML Parser**: Convert freetradingbots XML files to TypeScript strategies
2. **WebSocket**: Real-time market data and trade updates
3. **Alerting**: Webhook and email notifications for critical events
4. **Advanced Strategies**: More strategies from freetradingbots repo
5. **Metrics Dashboard**: Real-time performance metrics

## 📝 License

MIT

## 🤝 Contributing

Contributions welcome! Please read the contributing guidelines first.

## 📞 Support

For issues or questions:
- Check the [detailed README](lib/auto-trading/README.md)
- Review API documentation
- Check example strategies

---

**⚠️ DISCLAIMER**: Trading involves risk. Always test in paper trading mode first. Use at your own risk.












