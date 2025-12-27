# Real-Time Market Data Streaming - Implementation

## 🎯 Overview

Complete real-time market data streaming service for Deriv symbols using Server-Sent Events (SSE). Provides low-latency updates for charts and trading interfaces.

---

## ✅ IMPLEMENTED COMPONENTS

### 1. Server-Side Streaming API ✅

**File**: `app/api/deriv/market-data/stream/route.ts`

**Features**:
- ✅ Server-Sent Events (SSE) streaming
- ✅ Real-time tick data streaming
- ✅ Real-time OHLC data streaming
- ✅ Automatic reconnection handling
- ✅ Heartbeat mechanism (30s intervals)
- ✅ Graceful disconnect handling
- ✅ User authentication required

**Endpoint**: `GET /api/deriv/market-data/stream`

**Query Parameters**:
- `symbol` - Symbol to stream (e.g., BOOM500)
- `type` - Data type: `ticks` or `ohlc` (default: ticks)
- `granularity` - Granularity in seconds for OHLC (default: 60)

**Response Format**:
```
data: {"type":"connected","symbol":"BOOM500"}

data: {"type":"tick","data":{"symbol":"BOOM500","quote":1000.5,"timestamp":1234567890,"id":"tick-123"}}

data: {"type":"ohlc","data":{"symbol":"BOOM500","open":1000.0,"high":1001.0,"low":999.5,"close":1000.5,"epoch":1234567890,"granularity":60}}

data: {"type":"heartbeat","timestamp":1234567890}
```

---

### 2. React Hook for Market Data ✅

**File**: `lib/hooks/useDerivMarketData.ts`

**Features**:
- ✅ Easy-to-use React hook
- ✅ Automatic connection management
- ✅ Automatic reconnection with exponential backoff
- ✅ Callback support for tick/OHLC updates
- ✅ Connection status tracking
- ✅ Error handling
- ✅ Cleanup on unmount

**Usage**:
```tsx
import { useDerivMarketData } from '@/lib/hooks/useDerivMarketData';

function MyComponent() {
  const { tick, ohlc, isConnected, error, reconnect, disconnect } = useDerivMarketData({
    symbol: 'BOOM500',
    type: 'ticks', // or 'ohlc'
    granularity: 60, // for OHLC
    enabled: true,
    onTick: (tickData) => {
      console.log('New tick:', tickData.quote);
    },
    onOHLC: (ohlcData) => {
      console.log('New candle:', ohlcData);
    },
    onError: (error) => {
      console.error('Stream error:', error);
    },
    onConnect: () => {
      console.log('Connected to stream');
    },
    onDisconnect: () => {
      console.log('Disconnected from stream');
    },
  });

  return (
    <div>
      {isConnected ? (
        <div>Live: {tick?.quote || ohlc?.close}</div>
      ) : (
        <div>Connecting...</div>
      )}
    </div>
  );
}
```

---

### 3. Live Chart Component ✅

**File**: `components/deriv/LiveChart.tsx`

**Features**:
- ✅ Real-time chart updates
- ✅ Automatic data fetching (historical + live)
- ✅ Tick data for short timeframes
- ✅ OHLC data for longer timeframes
- ✅ Connection status indicator
- ✅ Price change indicators
- ✅ Canvas-based rendering for performance

**Usage**:
```tsx
import LiveChart from '@/components/deriv/LiveChart';

<LiveChart
  symbol="BOOM500"
  timeframe="1m"
  height={500}
  showConnectionStatus={true}
/>
```

**Props**:
- `symbol` - Symbol to display
- `timeframe` - Chart timeframe (default: '1m')
- `height` - Chart height in pixels (default: 400)
- `className` - Additional CSS classes
- `showConnectionStatus` - Show connection badge (default: true)

---

## 🔄 DATA FLOW

```
┌─────────────────────────────────────────────────────────┐
│              Frontend Component                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │  useDerivMarketData Hook                          │  │
│  │  - Manages EventSource connection                 │  │
│  │  - Handles reconnection                           │  │
│  │  - Updates state on new data                      │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              SSE Stream (EventSource)                    │
│  GET /api/deriv/market-data/stream                      │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              API Route (Server-Side)                    │
│  - Authenticates user                                   │
│  - Gets Deriv token                                     │
│  - Creates DerivMarketDataService                       │
│  - Subscribes to tick/OHLC data                        │
│  - Streams data via SSE                                 │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              DerivMarketDataService                     │
│  - Connects to Deriv WebSocket                          │
│  - Subscribes to market data                            │
│  - Emits events for each update                         │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              Deriv WebSocket API                        │
│  - Real-time market data                                │
│  - Tick updates                                         │
│  - OHLC candle updates                                  │
└─────────────────────────────────────────────────────────┘
```

---

## 📊 USAGE EXAMPLES

### Example 1: Basic Tick Streaming

```tsx
import { useDerivMarketData } from '@/lib/hooks/useDerivMarketData';

function TickDisplay() {
  const { tick, isConnected } = useDerivMarketData({
    symbol: 'BOOM500',
    type: 'ticks',
    enabled: true,
  });

  return (
    <div>
      <div>Status: {isConnected ? 'Connected' : 'Disconnected'}</div>
      {tick && (
        <div>
          <div>Price: {tick.quote}</div>
          <div>Time: {new Date(tick.timestamp).toLocaleTimeString()}</div>
        </div>
      )}
    </div>
  );
}
```

### Example 2: OHLC Streaming for Charts

```tsx
import { useDerivMarketData } from '@/lib/hooks/useDerivMarketData';
import { useState } from 'react';

function ChartComponent() {
  const [candles, setCandles] = useState([]);

  const { ohlc, isConnected } = useDerivMarketData({
    symbol: 'BOOM500',
    type: 'ohlc',
    granularity: 60, // 1 minute candles
    enabled: true,
    onOHLC: (data) => {
      setCandles(prev => {
        const updated = [...prev, {
          time: data.epoch * 1000,
          open: data.open,
          high: data.high,
          low: data.low,
          close: data.close,
        }];
        // Keep only last 100 candles
        return updated.slice(-100);
      });
    },
  });

  return (
    <div>
      <div>Status: {isConnected ? 'Live' : 'Offline'}</div>
      <div>Candles: {candles.length}</div>
      {/* Render chart with candles */}
    </div>
  );
}
```

### Example 3: Using LiveChart Component

```tsx
import LiveChart from '@/components/deriv/LiveChart';

function TradingPage() {
  return (
    <div>
      <LiveChart
        symbol="BOOM500"
        timeframe="1m"
        height={500}
        showConnectionStatus={true}
      />
    </div>
  );
}
```

---

## 🔧 CONFIGURATION

### Reconnection Settings

The hook automatically handles reconnection with exponential backoff:
- Max attempts: 5
- Initial delay: 1 second
- Max delay: 30 seconds
- Backoff formula: `min(1000 * 2^attempt, 30000)`

### Heartbeat Interval

Server sends heartbeat every 30 seconds to keep connection alive.

### Data Types

**Ticks** (`type: 'ticks'`):
- Best for: Real-time price updates, short timeframes
- Updates: Every price tick
- Data: `{ symbol, quote, timestamp, id }`

**OHLC** (`type: 'ohlc'`):
- Best for: Candlestick charts, longer timeframes
- Updates: When candle closes
- Data: `{ symbol, open, high, low, close, epoch, granularity }`

---

## 🚨 ERROR HANDLING

### Connection Errors

The hook automatically:
- Attempts reconnection on error
- Limits reconnection attempts
- Emits error events to callbacks
- Updates connection status

### Error Callbacks

```tsx
const { error } = useDerivMarketData({
  symbol: 'BOOM500',
  onError: (err) => {
    console.error('Stream error:', err);
    // Handle error (show notification, etc.)
  },
});
```

---

## 📈 PERFORMANCE CONSIDERATIONS

1. **SSE vs WebSocket**: SSE is simpler and works well for one-way streaming
2. **Automatic Cleanup**: Hook cleans up on unmount
3. **Reconnection Logic**: Prevents infinite reconnection loops
4. **Data Batching**: Consider batching updates if needed
5. **Memory Management**: LiveChart keeps only last 100 candles

---

## 🔐 SECURITY

- ✅ User authentication required
- ✅ Token validation on server
- ✅ No tokens exposed to client
- ✅ Secure token decryption server-side only

---

## 📝 NOTES

- SSE is one-way (server → client)
- For bidirectional communication, consider WebSocket
- Connection automatically closes on component unmount
- Multiple components can subscribe to same symbol
- Server manages one connection per user per symbol

---

## 🎉 COMPLETION STATUS

| Component | Status | Completion |
|-----------|--------|-----------|
| SSE API Route | ✅ Complete | 100% |
| React Hook | ✅ Complete | 100% |
| Live Chart Component | ✅ Complete | 100% |
| Error Handling | ✅ Complete | 100% |
| Reconnection Logic | ✅ Complete | 100% |

**Overall Streaming Service**: **100% Complete** 🎊

---

**Last Updated**: December 2024
**Version**: 1.0.0
**Status**: Production Ready


