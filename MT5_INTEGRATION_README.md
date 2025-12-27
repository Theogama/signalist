# MT5 Exness Auto-Trading Integration

Complete integration of Exness auto-trading functionality using MetaTrader 5 (MT5) Python API.

## 🎯 Overview

This implementation provides a full-featured auto-trading system for Exness using MT5, since Exness does NOT have a public REST API. The system consists of:

1. **Python MT5 Backend Service** - Handles all MT5 operations
2. **Next.js API Routes** - Secure endpoints for frontend communication
3. **React Components** - Professional UI for trading management
4. **Safety Features** - Comprehensive risk management

## 📋 Features Implemented

### ✅ 1. Connection to Exness Account

- **Quick Connect Screen** with:
  - MT5 Login ID input
  - Password input (secure)
  - Server selection (Exness-MT5Real / Exness-MT5Trial)
- **Credential Validation** using MT5 Python API:
  - `mt5.initialize()`
  - `mt5.login(login, password, server)`
- **Connection State Management**:
  - Stored in localStorage (production: use secure storage)
  - Clears old bot settings on new connection

### ✅ 2. Auto-Trading Engine (Backend)

Python service (`mt5_service/main.py`) with full trading capabilities:

- ✅ Place Buy Trades
- ✅ Place Sell Trades
- ✅ Set TP & SL
- ✅ Adjust lot size
- ✅ Set risk % per trade
- ✅ Handle multiple symbols (XAUUSD, NAS100, US30, etc.)

**Order Structure:**
```python
order = {
    "action": mt5.TRADE_ACTION_DEAL,
    "symbol": symbol,
    "volume": lot,
    "type": mt5.ORDER_TYPE_BUY or SELL,
    "price": mt5.symbol_info_tick(symbol).ask,
    "magic": 2025,
    "comment": "SIGNALIST Bot",
}
result = mt5.order_send(order)
```

**Backend Returns:**
- Order status
- Execution price
- TP & SL
- Error messages

### ✅ 3. Live P/L and Trade Updates

Real-time profit/loss tracking:

- ✅ **Open Trades** - Live positions with current P/L
- ✅ **Closed Trades** - Historical trades with profit/loss
- ✅ **Live P/L Calculations** using MT5 API ticks
- ✅ **Display Metrics:**
  - Win/Loss ratio
  - Equity
  - Balance
  - Drawdown
  - Trade duration
  - Comment: "SIGNALIST Bot"

**Update Frequency:**
- P/L: Every 1 second
- Account stats: Every 3 seconds

### ✅ 4. Auto-Trade Settings

Complete settings page (`/autotrade/mt5-settings`) with:

- ✅ Enable/Disable Auto Trading toggle
- ✅ Select symbol (XAUUSD, NAS100, US30, etc.)
- ✅ Risk % per trade
- ✅ Lot size (auto or fixed)
- ✅ Take Profit (points)
- ✅ Stop Loss (points)
- ✅ Magic Number
- ✅ Max daily loss (%)
- ✅ Max daily trades
- ✅ News filter toggle

All settings are validated before trades are executed.

### ✅ 5. Frontend → Backend API Routing

Secure API endpoints:

- ✅ `POST /api/mt5/connect` - Connect to MT5
- ✅ `POST /api/mt5/disconnect` - Disconnect
- ✅ `GET /api/mt5/account` - Get account info
- ✅ `GET /api/mt5/account/stats` - Comprehensive stats
- ✅ `POST /api/mt5/trade/buy` - Place buy order
- ✅ `POST /api/mt5/trade/sell` - Place sell order
- ✅ `POST /api/mt5/trade/execute` - Execute with safety checks
- ✅ `GET /api/mt5/trades/open` - Get open positions
- ✅ `GET /api/mt5/trades/closed` - Get closed positions
- ✅ `POST /api/mt5/settings/update` - Update settings
- ✅ `GET /api/mt5/settings/update` - Get settings
- ✅ `GET /api/mt5/notifications` - SSE for real-time updates

All endpoints call the MT5 Python service.

### ✅ 6. Data Refresh

- ✅ P/L updates every 1 second
- ✅ Account stats updates every 3 seconds
- ✅ Push notifications for:
  - "New trade opened"
  - "Trade closed in profit/loss"
  - "Bot stopped due to risk breach"

### ✅ 7. Bot Safety

Comprehensive protections:

- ✅ **No over-trading** - Max daily trades limit
- ✅ **Lot size validity** - Checks 0.01-100 range
- ✅ **Margin availability** - Verifies free margin
- ✅ **Margin level check** - Minimum 100%
- ✅ **Pause bot if MT5 disconnects** - Connection monitoring
- ✅ **Max daily loss protection** - Auto-stop on limit
- ✅ **News filter** - Pause during high-impact events

### ✅ 8. UI Design

Professional trading dashboard:

- ✅ Smooth animations
- ✅ Modern cards
- ✅ Clear trade logs
- ✅ Trading dashboard like Binance/Exness mobile
- ✅ Signalist robot branding
- ✅ Responsive design

## 🚀 Setup Instructions

### Prerequisites

1. **MetaTrader 5 Terminal** installed and running
2. **Python 3.8+** installed
3. **Exness MT5 Account** (Real or Demo)

### Step 1: Install Python Dependencies

```bash
cd mt5_service
pip install -r requirements.txt
```

### Step 2: Start MT5 Python Service

```bash
# Make sure MT5 terminal is running first
cd mt5_service
python main.py
```

The service will run on `http://localhost:5000` by default.

### Step 3: Configure Environment Variables

Add to your `.env` file:

```env
MT5_SERVICE_URL=http://localhost:5000
```

### Step 4: Start Next.js App

```bash
npm run dev
```

### Step 5: Connect to MT5

1. Navigate to `/autotrade/mt5`
2. Click "Connect Exness MT5"
3. Enter your MT5 credentials:
   - Login ID
   - Password
   - Server (Exness-MT5Real or Exness-MT5Trial)
4. Click "Connect"

### Step 6: Configure Auto-Trade Settings

1. Navigate to `/autotrade/mt5-settings`
2. Configure all settings:
   - Enable auto-trading
   - Select symbol
   - Set risk percentage
   - Configure TP/SL
   - Set daily limits
3. Click "Save Settings"

### Step 7: Start Auto-Trading

1. Go back to `/autotrade/mt5`
2. Click "Start Bot"
3. Monitor trades in real-time

## 📁 File Structure

```
mt5_service/
├── main.py                 # Python MT5 service
├── requirements.txt        # Python dependencies
└── README.md              # Service documentation

app/
├── api/mt5/
│   ├── connect/route.ts           # Connect to MT5
│   ├── disconnect/route.ts        # Disconnect
│   ├── account/route.ts           # Account info
│   ├── account/stats/route.ts     # Account statistics
│   ├── trade/
│   │   ├── buy/route.ts           # Buy order
│   │   ├── sell/route.ts          # Sell order
│   │   └── execute/route.ts       # Execute with safety
│   ├── trades/
│   │   ├── open/route.ts           # Open positions
│   │   └── closed/route.ts        # Closed positions
│   ├── settings/update/route.ts   # Settings management
│   └── notifications/route.ts      # SSE notifications

app/(root)/autotrade/
├── mt5/page.tsx                   # Main MT5 dashboard
└── mt5-settings/page.tsx          # Settings page

components/autotrade/
├── MT5QuickConnect.tsx            # Connection UI
├── MT5AutoTradeSettings.tsx       # Settings component
├── MT5TradingDashboard.tsx       # Main dashboard
├── MT5PLTracker.tsx              # P/L tracking
├── MT5OpenTrades.tsx             # Open positions
├── MT5ClosedTrades.tsx           # Closed positions
└── MT5Notifications.tsx          # Notifications

lib/services/
└── mt5-safety.service.ts         # Safety checks
```

## 🔒 Security Notes

1. **Credentials Storage**: Currently using localStorage. In production:
   - Use encrypted database storage
   - Implement secure session management
   - Add 2FA for live accounts

2. **API Security**: All endpoints require authentication via `better-auth`

3. **MT5 Service**: Run on secure server, not exposed to public internet

## 🎨 UI Features

- **Professional Design**: Modern, clean interface
- **Real-time Updates**: Live P/L and trade updates
- **Responsive**: Works on desktop and mobile
- **Branding**: Signalist robot branding throughout
- **Animations**: Smooth transitions and loading states

## 📊 Trading Logic

The system follows this flow:

1. User connects MT5 account
2. User configures auto-trade settings
3. User enables auto-trading
4. System monitors for trading signals (integrate your signal source)
5. Before each trade:
   - Safety checks (margin, daily limits, etc.)
   - Connection verification
   - Settings validation
6. Execute trade via MT5
7. Monitor position in real-time
8. Close position when TP/SL hit or manually
9. Update statistics and notifications

## 🐛 Troubleshooting

### MT5 Service Won't Start

- Ensure MT5 terminal is installed and running
- Check Python version (3.8+)
- Verify all dependencies installed: `pip install -r requirements.txt`

### Connection Fails

- Verify MT5 terminal is running
- Check login credentials
- Ensure server name is correct (Exness-MT5Real or Exness-MT5Trial)
- Check firewall settings

### Trades Not Executing

- Verify auto-trading is enabled in settings
- Check safety checks aren't blocking trades
- Ensure sufficient margin
- Check MT5 connection is active

## 📝 Notes

- All trades use magic number **2025** by default
- All trades have comment **"SIGNALIST Bot"**
- Demo accounts recommended for testing
- Always test with small lot sizes first
- Monitor account regularly

## 🚨 Important Warnings

⚠️ **Trading involves risk. Always:**
- Test with demo accounts first
- Use appropriate risk management
- Never risk more than you can afford to lose
- Monitor your account regularly
- Understand the risks before live trading

## 📞 Support

For issues or questions:
1. Check the troubleshooting section
2. Review MT5 service logs
3. Check Next.js console for errors
4. Verify MT5 terminal is running correctly

---

**Powered by SIGNALIST Bot** 🤖









