# Live Auto Trading with Demo Balance

## Overview

This implementation adds comprehensive live auto trading capabilities with persistent demo balance management. The system now supports:

- **Persistent Demo Accounts**: Demo balance stored in database, persists across sessions
- **Real-Time Market Data**: Integration with live market data service for actual price feeds
- **Live Trading Updates**: Server-Sent Events (SSE) for real-time balance and position updates
- **Position Tracking**: Real-time P&L calculation and position management
- **Multi-Broker Support**: Works with Exness, Deriv, and generic demo accounts

## Key Features

### 1. Persistent Demo Account (`database/models/demo-account.model.ts`)

- Stores user demo trading account information in MongoDB
- Tracks balance, equity, margin, and trading statistics
- Supports multiple brokers per user (exness, deriv, demo)
- Automatically creates account on first use

**Fields:**
- `userId`: Unique user identifier
- `broker`: Broker type (exness, deriv, demo)
- `balance`: Current account balance
- `equity`: Current equity (balance + unrealized P&L)
- `margin`: Used margin
- `freeMargin`: Available margin
- `totalProfitLoss`: Total realized P&L
- `totalTrades`, `winningTrades`, `losingTrades`: Trading statistics

### 2. Enhanced PaperTrader (`lib/auto-trading/paper-trader/PaperTrader.ts`)

**New Features:**
- Database-backed balance persistence
- Automatic account initialization
- Real-time P&L calculation with current market prices
- Position tracking with unrealized P&L
- Account statistics tracking

**Key Methods:**
- `initialize()`: Loads or creates demo account from database
- `executeTrade()`: Executes trade and saves to database
- `updatePositions()`: Updates positions with real market data and calculates P&L
- `saveAccount()`: Persists account state to database

### 3. Real-Time Market Data Integration (`lib/services/bot-manager.service.ts`)

**Enhancements:**
- Uses real market data service instead of mock data
- Falls back to mock data if real data unavailable
- Integrates with existing market data service for live prices
- Supports all instrument types (stocks, forex, indices, etc.)

### 4. API Endpoints

#### `/api/auto-trading/account` (GET/POST)
- **GET**: Fetch demo account balance and statistics
- **POST**: Reset demo account with new initial balance
- Supports broker-specific accounts

#### `/api/auto-trading/positions` (GET)
- Get all open positions across active bots
- Returns aggregated balance and equity
- Real-time position data

#### `/api/auto-trading/live-updates` (GET - SSE)
- Server-Sent Events stream for real-time updates
- Sends balance, positions, and trade updates every 2 seconds
- Automatically reconnects on disconnect

### 5. Enhanced WebSocket Hook (`lib/hooks/useWebSocket.ts`)

**Upgrade:**
- Changed from mock polling to Server-Sent Events (SSE)
- Real-time balance updates
- Position updates
- Trade notifications
- Automatic reconnection

## Usage

### Starting a Bot with Demo Balance

```typescript
// Bot automatically uses demo balance when started
const response = await fetch('/api/auto-trading/start-bot', {
  method: 'POST',
  body: JSON.stringify({
    botId: 'registered-0',
    instrument: 'XAUUSD',
    parameters: {
      riskPercent: 1,
      takeProfitPercent: 2,
      stopLossPercent: 1,
      broker: 'exness', // or 'deriv' or 'demo'
      initialBalance: 10000, // Optional, defaults to 10000
    },
    broker: 'exness',
  }),
});
```

### Fetching Account Balance

```typescript
const response = await fetch('/api/auto-trading/account?broker=exness');
const { data } = await response.json();
console.log('Balance:', data.balance);
console.log('Equity:', data.equity);
console.log('Total P&L:', data.totalProfitLoss);
```

### Resetting Demo Account

```typescript
const response = await fetch('/api/auto-trading/account', {
  method: 'POST',
  body: JSON.stringify({
    action: 'reset',
    broker: 'exness',
    initialBalance: 10000,
  }),
});
```

### Listening to Live Updates

The `useWebSocket` hook automatically connects when a bot is running:

```typescript
import { useWebSocket } from '@/lib/hooks/useWebSocket';

function TradingDashboard() {
  useWebSocket(); // Automatically connects and updates store
  
  const { balance, equity, margin, openTrades } = useAutoTradingStore();
  
  // Balance and positions update automatically via SSE
}
```

## Database Schema

### DemoAccount Collection

```typescript
{
  userId: string;           // Unique user ID
  broker: 'exness' | 'deriv' | 'demo';
  balance: number;          // Current balance
  equity: number;           // Current equity
  margin: number;          // Used margin
  freeMargin: number;      // Available margin
  currency: string;         // Default: 'USD'
  initialBalance: number;   // Starting balance
  totalProfitLoss: number;  // Total realized P&L
  totalTrades: number;      // Total trades executed
  winningTrades: number;    // Winning trades count
  losingTrades: number;     // Losing trades count
  createdAt: Date;
  updatedAt: Date;
}
```

## Real-Time Updates Flow

1. **Bot Starts**: Bot manager begins trading loop
2. **Market Data**: Fetches real market data every 5 seconds
3. **Trade Execution**: Executes trades via PaperTrader
4. **Position Updates**: Updates positions with current prices
5. **Database Save**: Saves account state to database
6. **SSE Broadcast**: Live updates endpoint sends updates to connected clients
7. **UI Update**: Frontend receives updates and refreshes display

## Benefits

1. **Persistent Balance**: Demo balance survives server restarts
2. **Real Market Data**: Uses actual market prices for more realistic trading
3. **Live Updates**: Real-time balance and position updates without polling
4. **Multi-Broker**: Support for multiple brokers with separate accounts
5. **Statistics**: Track trading performance over time
6. **Scalable**: Database-backed solution scales to many users

## Future Enhancements

- [ ] WebSocket support for bidirectional communication
- [ ] Historical trade analysis and reporting
- [ ] Account reset scheduling
- [ ] Multi-currency support
- [ ] Advanced position management (partial closes, trailing stops)
- [ ] Performance analytics dashboard

## Testing

To test the live auto trading:

1. Start a bot with demo mode
2. Monitor balance updates in real-time
3. Check database for persistent balance
4. Verify positions update with market prices
5. Test account reset functionality

## Notes

- Demo balance is separate per broker type
- Initial balance defaults to $10,000 if not specified
- Market data falls back to mock data if real data unavailable
- SSE connection automatically reconnects on failure
- All trades are logged to database for historical analysis









