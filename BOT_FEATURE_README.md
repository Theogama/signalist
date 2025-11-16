# Auto-Trade Bot Feature

## Overview
The Auto-Trade Bot feature allows users to automatically execute trades based on signals. The bot supports paper trading (simulated) and live trading modes with configurable risk management parameters.

## Database Schema

### `user_bot_settings` Collection
- `userId` (String, unique, indexed): User identifier
- `enabled` (Boolean): Whether auto-trading is enabled
- `maxTradeSizePct` (Number, 0.1-100): Maximum trade size as percentage of account balance
- `stopLossPct` (Number, 0.1-50): Stop loss percentage
- `takeProfitPct` (Number, 0.1-100): Take profit percentage
- `trailingStop` (Boolean): Enable trailing stop loss
- `exchange` (String, enum): Exchange name ('binance', 'coinbase', 'kraken')
- `apiKey` (String, encrypted): Exchange API key (not returned by default)
- `apiSecret` (String, encrypted): Exchange API secret (not returned by default)
- `paperMode` (Boolean): Paper trading mode (simulated trades)
- `updatedAt` (Date): Last update timestamp
- `createdAt` (Date): Creation timestamp

### `bot_trades` Collection
- `tradeId` (String, UUID, unique, indexed): Unique trade identifier
- `signalId` (String, indexed): Reference to the signal that triggered this trade
- `userId` (String, indexed): User identifier
- `symbol` (String): Trading pair (e.g., 'BTCUSDT')
- `action` (String, enum): 'BUY' or 'SELL'
- `entryPrice` (Number): Entry price
- `exitPrice` (Number, optional): Exit price when trade is closed
- `quantity` (Number): Amount of asset traded
- `status` (String, enum, indexed): 'PENDING', 'FILLED', 'CLOSED', 'CANCELLED', 'FAILED'
- `profitLoss` (Number, optional): Profit/loss in quote currency
- `profitLossPct` (Number, optional): Profit/loss percentage
- `stopLossPrice` (Number, optional): Stop loss price level
- `takeProfitPrice` (Number, optional): Take profit price level
- `trailingStopEnabled` (Boolean): Whether trailing stop was enabled
- `exchange` (String): Exchange where trade was executed
- `exchangeOrderId` (String, optional): Order ID from exchange
- `errorMessage` (String, optional): Error message if trade failed
- `createdAt` (Date, indexed): Creation timestamp
- `filledAt` (Date, optional): When order was filled
- `closedAt` (Date, optional): When trade was closed

## API Endpoints

### POST `/api/bot/execute`
Executes a bot trade based on a signal.

**Request Body:**
```json
{
  "signalId": "signal-uuid"
}
```

**Response:**
```json
{
  "success": true,
  "tradeId": "trade-uuid",
  "message": "Order placed successfully"
}
```

**Error Responses:**
- `401`: Unauthorized
- `400`: Bad request (bot not enabled, missing credentials, price deviation too large, etc.)
- `404`: Signal not found
- `500`: Internal server error

## Frontend Pages

### `/settings/bot`
Bot settings configuration page where users can:
- Enable/disable auto-trading
- Configure trading parameters (max trade size, stop loss, take profit)
- Set up exchange API credentials
- Toggle paper trading mode
- Enable trailing stop

### `/dashboard/bot-trades`
Bot trades dashboard showing:
- Table of all bot trades with filtering and sorting
- Trade details (entry/exit prices, P/L, status)
- Status filtering (All, Pending, Filled, Closed, Cancelled, Failed)
- Sortable columns (Trade ID, Symbol, Entry Price, P/L, Status, Date)

## Components

### `ExecuteBotButton`
Button component to execute bot trades from signal lists.

**Usage:**
```tsx
import ExecuteBotButton from '@/components/ExecuteBotButton';
import { getBotSettings } from '@/lib/actions/bot.actions';

// In your signal list component
const settings = await getBotSettings();
const isBotEnabled = settings.success && settings.data?.enabled;

<ExecuteBotButton 
  signalId={signal.id} 
  isBotEnabled={isBotEnabled} 
/>
```

## Integration Example

To add the Execute Bot button to your signal list:

```tsx
import ExecuteBotButton from '@/components/ExecuteBotButton';
import { getBotSettings } from '@/lib/actions/bot.actions';

export default async function SignalList() {
  const signals = await getSignals();
  const botSettings = await getBotSettings();
  const isBotEnabled = botSettings.success && botSettings.data?.enabled;

  return (
    <div>
      {signals.map(signal => (
        <div key={signal.id}>
          <h3>{signal.symbol}</h3>
          <p>Price: ${signal.price}</p>
          <ExecuteBotButton 
            signalId={signal.id} 
            isBotEnabled={isBotEnabled} 
          />
        </div>
      ))}
    </div>
  );
}
```

## Error Handling

The bot includes comprehensive error handling:
- Validates user authentication
- Checks if bot is enabled
- Validates exchange API credentials
- Verifies signal exists
- Checks account balance
- Validates price deviation (aborts if >5% from signal price)
- Handles exchange API errors gracefully

## Security

- API keys are stored encrypted and not returned in API responses by default
- User authentication required for all bot operations
- Paper mode enabled by default for safety
- Price deviation checks prevent execution at unfavorable prices

## TODO / Future Enhancements

The codebase includes TODO comments for:
1. **Back-testing mode**: Test strategies against historical data
2. **Paper-trade mode**: Already implemented, but can be enhanced
3. **Multi-exchange support**: Currently supports Binance, Coinbase, Kraken (placeholders)
4. **Actual exchange SDK integration**: Currently uses placeholders
5. **Signal model integration**: Replace placeholder signal fetching with actual model
6. **Real-time price monitoring**: For stop-loss and take-profit execution
7. **Trailing stop implementation**: Logic for dynamic stop-loss adjustment

## Installation

After adding the feature, install dependencies:

```bash
npm install @radix-ui/react-switch
```

The `uuid` package is not needed as we use Node's built-in `crypto.randomUUID()`.

## Testing

1. Enable paper trading mode in bot settings
2. Configure trading parameters
3. Execute a test trade from a signal
4. Verify trade appears in bot trades dashboard
5. Check trade status and details


