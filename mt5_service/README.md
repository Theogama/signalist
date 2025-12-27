# MT5 Trading Service

Python backend service for MetaTrader 5 trading operations with Exness.

## Prerequisites

1. **MetaTrader 5 Terminal** must be installed and running
2. **Python 3.8+**
3. **Exness MT5 Account** (Real or Demo)

## Installation

```bash
# Install dependencies
pip install -r requirements.txt
```

## Configuration

The service runs on port 5000 by default. Set the `PORT` environment variable to change it.

## Running the Service

```bash
# Make sure MT5 terminal is running first
python main.py
```

## API Endpoints

### Health Check
- `GET /health` - Check service status

### Connection
- `POST /connect` - Connect to MT5 account
  ```json
  {
    "login": 12345678,
    "password": "your_password",
    "server": "Exness-MT5Real" // or "Exness-MT5Trial"
  }
  ```

- `POST /disconnect` - Disconnect from MT5
  ```json
  {
    "connection_id": "12345678_Exness-MT5Real"
  }
  ```

### Account
- `GET /account?connection_id=xxx` - Get account information

### Trading
- `POST /trade/buy` - Place buy order
  ```json
  {
    "connection_id": "xxx",
    "symbol": "XAUUSD",
    "volume": 0.01,
    "sl": 1950.0,
    "tp": 2050.0,
    "magic": 2025,
    "comment": "SIGNALIST Bot"
  }
  ```

- `POST /trade/sell` - Place sell order (same format as buy)

### Positions
- `GET /trades/open?connection_id=xxx&symbol=XAUUSD` - Get open positions
- `GET /trades/closed?connection_id=xxx&symbol=XAUUSD` - Get closed positions
- `POST /position/close` - Close a position
  ```json
  {
    "connection_id": "xxx",
    "ticket": 123456
  }
  ```

## Notes

- The service maintains active connections in memory
- Each connection is identified by `{login}_{server}`
- All trades use magic number 2025 by default
- All trades have comment "SIGNALIST Bot"









