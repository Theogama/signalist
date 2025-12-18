# Auto-Trading System - Complete Implementation Guide

## Overview

This is a complete, production-ready auto-trading system for the SIGNALIST web app. It includes frontend UI, backend API, broker adapters (Exness & Deriv), bot management, risk management, WebSocket logging, and Docker deployment.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React/Next.js)              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Dashboard   │  │ Bot Builder  │  │ Live Logs    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ WebSocket/SSE
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend (Next.js API)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Bot Manager  │  │ Risk Manager │  │ Session Mgr  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Log Emitter  │  │ Paper Trader │  │ Bot Loader   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Broker Adapters                          │
│  ┌──────────────┐              ┌──────────────┐            │
│  │   Exness     │              │    Deriv     │            │
│  └──────────────┘              └──────────────┘            │
└─────────────────────────────────────────────────────────────┘
```

## Features

### ✅ Frontend Components

1. **AutoTradingDashboard** (`/app/autotrade`)
   - Real-time broker status and balance
   - Open/closed trades display
   - Bot status indicators (idle/running/stopping)
   - Live logs via WebSocket

2. **BrokerConnectionModal**
   - Connect to Exness or Deriv
   - Demo mode (no API keys required)
   - Live mode with API key validation

3. **InstrumentsSelector**
   - Exness: XAUUSD, US30, NAS100
   - Deriv: Boom 1000/500/300/100, Crash 1000/500/300/100

4. **BotsLibrary**
   - Loads bots from `freetradingbots-main` folder
   - Displays bot info, risk level, parameters
   - Search and filter functionality

5. **BotConfigPanel**
   - Configure risk %, TP %, SL %
   - Session times, max trades
   - Martingale settings

6. **BotBuilderUI**
   - Visual bot creation
   - Export bot configurations
   - Strategy type selection

7. **StrategyPreviewChart**
   - Visual preview of entry/exit points
   - Mock price feed visualization

8. **StartStopControls**
   - Start/Stop bot buttons
   - Status display and validation

9. **LiveLogsPanel**
   - Real-time WebSocket logs
   - Color-coded log levels
   - Trade win/loss notifications

### ✅ Backend Services

1. **Broker Adapters**
   - `ExnessAdapter`: Full Exness API integration
   - `DerivAdapter`: Deriv Boom/Crash indices support
   - Paper trading mode (default)
   - Rate limiting and error handling

2. **Bot Manager**
   - Manages active bot sessions
   - Executes trading loops
   - Integrates with risk manager
   - WebSocket logging

3. **Session Manager**
   - Tracks active bot sessions
   - Stores broker adapters per user
   - Redis support (optional, in-memory fallback)

4. **Risk Manager**
   - Max daily loss enforcement
   - Max drawdown protection
   - Max concurrent trades
   - Position sizing

5. **Log Emitter**
   - Centralized logging system
   - WebSocket/SSE streaming
   - Log types: price, signal, order, risk, trade

6. **Paper Trader**
   - Simulates trading without real money
   - Persistent demo balance (MongoDB)
   - Real-time P&L calculation

7. **Bot Loader**
   - Loads XML bots from `freetradingbots-main`
   - Parses bot configurations
   - Registers strategies

### ✅ API Endpoints

- `POST /api/auto-trading/connect-broker` - Connect to broker
- `GET /api/auto-trading/bots` - List all available bots
- `GET /api/auto-trading/instruments?broker=exness|deriv` - Get instruments
- `POST /api/auto-trading/start-bot` - Start trading bot
- `POST /api/auto-trading/stop-bot` - Stop trading bot
- `GET /api/auto-trading/live-updates` - SSE stream for logs
- `GET /api/auto-trading/account?broker=exness|deriv` - Get account balance
- `GET /api/auto-trading/positions` - Get open/closed positions

## Setup Instructions

### Prerequisites

- Node.js 20+
- MongoDB (or use Docker)
- Redis (optional, for session persistence)
- Docker & Docker Compose (for deployment)

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Create a `.env` file:

```env
# Database
MONGODB_URI=mongodb://localhost:27017/signalist

# Redis (optional)
REDIS_URL=redis://localhost:6379

# Authentication
BETTER_AUTH_SECRET=your-secret-key-here
BETTER_AUTH_URL=http://localhost:3000

# Broker API Keys (optional, for live trading)
EXNESS_API_KEY=your-exness-api-key
EXNESS_API_SECRET=your-exness-api-secret
DERIV_API_KEY=your-deriv-api-key
DERIV_API_SECRET=your-deriv-api-secret

# Market Data
FINNHUB_API_KEY=your-finnhub-api-key
```

### 3. Run Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:3000`

### 4. Docker Deployment

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop services
docker-compose down
```

## Usage Guide

### 1. Connect to Broker

1. Navigate to `/autotrade`
2. Click "Quick Connect Exness" or "Quick Connect Deriv" for demo mode
3. Or click "Connect with API" to use live API keys

### 2. Select Instrument

- Choose from available instruments based on your broker
- Instruments are automatically loaded when broker connects

### 3. Select Bot

- Browse the bot library
- Search and filter bots
- Click on a bot to select it

### 4. Configure Bot

- Adjust risk percentage (default: 1%)
- Set take profit % (default: 2%)
- Set stop loss % (default: 1%)
- Configure martingale if needed
- Set max trades and session times

### 5. Start Bot

- Click "Start Bot" button
- Bot will begin trading in paper mode (default)
- Watch live logs for real-time updates

### 6. Monitor Trading

- View open trades in the dashboard
- Check closed trades history
- Monitor live logs for signals, orders, and alerts
- Track balance and equity changes

### 7. Stop Bot

- Click "Stop Bot" to safely stop trading
- All positions will be closed (if configured)

## Safety Features

### Default Paper Trading

- **All bots start in paper trading mode by default**
- No real money is used unless explicitly configured
- Demo balance persists in MongoDB

### Risk Management

- Max daily loss limit (default: 10% of balance)
- Max drawdown protection (default: 20%)
- Max concurrent positions
- Position sizing based on risk %

### API Key Security

- API keys are encrypted server-side
- Never stored in frontend
- TRADE-ONLY permissions recommended
- No withdrawal permissions

### Auto Shutdown

- Bot stops if risk limits are exceeded
- Automatic shutdown on errors
- Session cleanup on disconnect

## Bot Development

### Creating Custom Bots

1. Use the **Bot Builder UI** to create visual bot configurations
2. Export the configuration as JSON
3. Save to `freetradingbots-main` folder (optional)
4. Or use the configuration directly

### XML Bot Format

Bots in `freetradingbots-main` folder are parsed from XML:
- Even/Odd strategies
- Rise/Fall strategies
- Digits analysis
- Martingale support

### Strategy Interface

All bots implement the `IStrategy` interface:

```typescript
interface IStrategy {
  name: string;
  initialize(config: StrategyConfig): Promise<void>;
  analyze(marketData: MarketData): Promise<StrategySignal | null>;
  calculatePositionSize(balance: number, entryPrice: number, stopLoss?: number): number;
  shouldExit(position: Position, marketData: MarketData): Promise<boolean>;
}
```

## WebSocket Logging

The system streams real-time logs via Server-Sent Events (SSE):

### Log Types

- **price**: Price updates for instruments
- **signal**: Trading signals generated by bots
- **order**: Order placement and execution
- **trade**: Trade results (open/close)
- **risk**: Risk management alerts
- **system**: System messages and errors

### Frontend Integration

The `useWebSocket` hook automatically connects when a bot starts:

```typescript
const { liveLogs, wsConnected } = useAutoTradingStore();
```

## Database Models

### DemoAccount

Stores paper trading account balances:

```typescript
{
  userId: string;
  broker: 'exness' | 'deriv' | 'demo';
  balance: number;
  equity: number;
  margin: number;
  initialBalance: number;
}
```

## Production Deployment

### Environment Setup

1. Set `NODE_ENV=production`
2. Configure MongoDB connection string
3. Set up Redis (optional but recommended)
4. Configure broker API keys (if using live trading)
5. Set secure `BETTER_AUTH_SECRET`

### Docker Production

```bash
# Build production image
docker build -t signalist-autotrade .

# Run with docker-compose
docker-compose -f docker-compose.prod.yml up -d
```

### Scaling

- Use Redis for session persistence across instances
- MongoDB for demo account persistence
- Load balancer for multiple app instances
- WebSocket/SSE works with sticky sessions

## Troubleshooting

### Bot Not Starting

- Check broker connection status
- Verify instrument is selected
- Check bot configuration
- Review server logs

### No Logs Appearing

- Verify WebSocket connection in browser console
- Check `/api/auto-trading/live-updates` endpoint
- Review server logs for errors

### Balance Not Updating

- Check MongoDB connection
- Verify demo account exists
- Review paper trader logs

### Redis Connection Issues

- System automatically falls back to in-memory storage
- Check Redis URL in environment variables
- Verify Redis container is running (if using Docker)

## API Reference

### Connect Broker

```typescript
POST /api/auto-trading/connect-broker
Body: {
  broker: 'exness' | 'deriv',
  apiKey?: string,
  apiSecret?: string,
  demo?: boolean
}
```

### Start Bot

```typescript
POST /api/auto-trading/start-bot
Body: {
  botId: string,
  instrument: string,
  parameters: {
    riskPercent: number,
    takeProfitPercent: number,
    stopLossPercent: number,
    // ... other parameters
  },
  broker: 'exness' | 'deriv'
}
```

### Stop Bot

```typescript
POST /api/auto-trading/stop-bot
Body: {
  botId?: string  // Optional, stops all if not provided
}
```

## Contributing

### Adding New Brokers

1. Create adapter extending `BaseAdapter`
2. Implement required methods
3. Add to broker factory
4. Update instruments list

### Adding New Strategies

1. Implement `IStrategy` interface
2. Register in `StrategyRegistry`
3. Add to bot library

## License

This system is part of the SIGNALIST web app.

## Support

For issues or questions:
- Check server logs
- Review browser console
- Check MongoDB/Redis connections
- Verify environment variables

---

**⚠️ Important**: Always test in paper trading mode before using live API keys. The system defaults to paper trading for safety.







