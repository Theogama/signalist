# Auto-Trading Frontend Components

Complete frontend UI implementation for the auto-trading feature in Signalist.

## Components Overview

### Main Dashboard
- **AutoTradingDashboard** (`AutoTradingDashboard.tsx`)
  - Main dashboard page showing all auto-trading features
  - Displays broker status, balance, trades, and bot controls
  - Integrates all sub-components

### Broker Management
- **BrokerConnectionModal** (`BrokerConnectionModal.tsx`)
  - Modal for connecting to Exness or Deriv
  - API key/secret input with validation
  - Secure credential handling

### Instrument Selection
- **InstrumentsSelector** (`InstrumentsSelector.tsx`)
  - Displays all supported instruments
  - Exness: XAUUSD, US30, NAS100
  - Deriv: BOOM1000/500/300/100, CRASH1000/500/300/100
  - Grouped by category

### Bot Management
- **BotsLibrary** (`BotsLibrary.tsx`)
  - Displays all available trading bots
  - Search functionality
  - Bot selection with preview
  - Shows bot parameters

- **BotConfigPanel** (`BotConfigPanel.tsx`)
  - Configures bot parameters
  - Risk management settings
  - Trading settings
  - Martingale configuration
  - Session times
  - Locks during bot execution

- **BotBuilderUI** (`BotBuilderUI.tsx`)
  - Visual bot builder interface
  - Similar to money8gg.com bot builder
  - Tabbed interface for basic/conditions/advanced
  - Save and test functionality

### Strategy & Controls
- **StrategyPreviewChart** (`StrategyPreviewChart.tsx`)
  - Visual preview of trading strategy
  - Shows entry/exit points
  - Displays TP/SL levels
  - Mock chart data (replace with real backtest data)

- **StartStopControls** (`StartStopControls.tsx`)
  - Start/stop bot buttons
  - Status display
  - Uptime tracking
  - Validation messages

### Live Data
- **LiveLogsPanel** (`LiveLogsPanel.tsx`)
  - Real-time bot activity logs
  - Color-coded by log level
  - Auto-scroll to latest
  - Clear logs button
  - WebSocket connection indicator

- **TradesTable** (`TradesTable.tsx`)
  - Displays open and closed trades
  - Shows P/L, entry/exit prices
  - Status badges
  - Responsive table

## State Management

### Zustand Store (`lib/stores/autoTradingStore.ts`)

**State:**
- `connectedBroker`: Currently connected broker (exness/deriv/null)
- `selectedInstrument`: Selected trading instrument
- `selectedBot`: Selected bot configuration
- `botParams`: Bot parameters
- `botStatus`: Current bot status (idle/running/stopping/error)
- `liveLogs`: Real-time log entries
- `openTrades`: Currently open positions
- `closedTrades`: Closed trade history
- `balance`, `equity`, `margin`: Account metrics

**Actions:**
- `connectBroker()`: Connect to broker
- `disconnectBroker()`: Disconnect broker
- `setSelectedInstrument()`: Select instrument
- `setSelectedBot()`: Select bot
- `updateBotParams()`: Update bot configuration
- `startBot()`: Start trading bot
- `stopBot()`: Stop trading bot
- `addLog()`: Add log entry
- `addTrade()`: Add new trade
- `updateTrade()`: Update trade status
- `setBalance()`: Update account balance

## API Endpoints

### POST `/api/auto-trading/connect-broker`
Connect to Exness or Deriv broker.

**Request:**
```json
{
  "broker": "exness",
  "apiKey": "your_api_key",
  "apiSecret": "your_api_secret"
}
```

### POST `/api/auto-trading/start-bot`
Start the trading bot.

**Request:**
```json
{
  "botId": "bot-1",
  "instrument": "XAUUSD",
  "parameters": {
    "riskPercent": 1,
    "takeProfitPercent": 2,
    "stopLossPercent": 1
  }
}
```

### POST `/api/auto-trading/stop-bot`
Stop the trading bot.

### GET `/api/auto-trading/bots`
List all available bots.

### GET `/api/auto-trading/instruments?broker=exness`
List instruments for a broker.

### WebSocket `/api/auto-trading/live-logs`
Real-time updates (implementation pending).

## Usage

### Access the Dashboard
Navigate to `/autotrade` to access the auto-trading dashboard.

### Workflow
1. **Connect Broker**: Click "Connect Broker" and enter API credentials
2. **Select Instrument**: Choose trading instrument (XAUUSD, BOOM500, etc.)
3. **Select Bot**: Choose a bot from the library
4. **Configure**: Adjust bot parameters
5. **Preview**: Review strategy preview
6. **Start**: Click "Start Bot" to begin trading
7. **Monitor**: Watch live logs and trades
8. **Stop**: Click "Stop Bot" when done

## Styling

All components use:
- **Tailwind CSS** for styling
- **Shadcn UI** components (Card, Button, Input, etc.)
- **Lucide Icons** for icons
- Consistent dark theme matching Signalist design

## Props & Interfaces

All components are fully typed with TypeScript interfaces defined in:
- `lib/stores/autoTradingStore.ts` - Store types
- Component files - Component-specific props

## Future Enhancements

- [ ] Real WebSocket implementation
- [ ] Real-time chart updates
- [ ] Advanced bot builder with drag-and-drop
- [ ] Strategy backtesting UI
- [ ] Performance analytics dashboard
- [ ] Trade history export
- [ ] Mobile responsive improvements












