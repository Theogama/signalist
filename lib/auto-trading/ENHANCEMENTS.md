# Auto-Trading Module Enhancements

## Recent Additions

### 1. Strategy Loader (`StrategyLoader.ts`)
Automatically loads and registers strategies from generated files.

**Features:**
- Scans `generated/` directory for strategy files
- Dynamically imports and registers strategies
- Provides error reporting for failed loads
- Checks if generated strategies exist

**Usage:**
```typescript
import { strategyLoader } from '@/lib/auto-trading/strategies/StrategyLoader';

// Load all generated strategies
const result = await strategyLoader.loadAll();
console.log(`Loaded ${result.loaded} strategies`);
if (result.errors.length > 0) {
  console.error('Errors:', result.errors);
}
```

### 2. Strategy Helper Utilities (`utils/strategy-helpers.ts`)
Common utility functions for strategy development.

**Functions:**
- `calculatePositionSize()` - Calculate position size based on risk
- `calculateStopLoss()` - Calculate stop loss price
- `calculateTakeProfit()` - Calculate take profit price
- `getLastDigit()` - Extract last digit from price
- `isEvenDigit()` - Check if price digit is even
- `analyzeDigitPattern()` - Analyze digit patterns in historical data
- `calculateTrend()` - Calculate price trend and momentum
- `validateSignal()` - Validate trading signals
- `formatStrategyName()` - Format strategy names for display

**Usage:**
```typescript
import { calculatePositionSize, analyzeDigitPattern } from '@/lib/auto-trading/utils/strategy-helpers';

const positionSize = calculatePositionSize(10000, 1, 2000, 1980);
const pattern = analyzeDigitPattern(historicalData, 10);
```

### 3. Enhanced Strategies API
The `/api/auto-trading/strategies` endpoint now:
- Automatically loads generated strategies
- Returns both base and generated strategies
- Includes metadata about strategy counts

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "name": "EvenOdd",
      "description": "...",
      "parameters": {...}
    },
    {
      "name": "Bot0001EvenOddMgWithStopX",
      "description": "Generated strategy: Bot0001EvenOddMgWithStopX",
      "generated": true
    }
  ],
  "total": 15,
  "generated": 12
}
```

### 4. Strategy List Endpoint (`/api/auto-trading/strategies/list`)
New endpoint to list all available strategies.

**Usage:**
```bash
GET /api/auto-trading/strategies/list
```

**Response:**
```json
{
  "success": true,
  "data": {
    "registered": ["EvenOdd", "RiseFall", "Digits", "Bot0001..."],
    "available": ["Bot0001...", "Bot0002..."],
    "total": 15,
    "generated": 12
  }
}
```

## Complete Workflow

### 1. Convert XML Bots
```bash
npm run convert-bots
```

### 2. Strategies Auto-Load
When API endpoints are called, generated strategies are automatically loaded.

### 3. Use Strategies
```typescript
import { strategyRegistry } from '@/lib/auto-trading/strategies/StrategyRegistry';

// Strategy is already registered after conversion
const strategy = strategyRegistry.create('Bot0001EvenOddMgWithStopX', {
  riskPercent: 1,
  takeProfitPercent: 2,
  stopLossPercent: 1,
});
```

## File Structure

```
lib/auto-trading/
├── strategies/
│   ├── StrategyRegistry.ts      # Strategy management
│   ├── StrategyLoader.ts         # Auto-load generated strategies
│   ├── generated/                # Generated from XML
│   │   ├── index.ts
│   │   └── [strategy files].ts
│   └── [base strategies].ts
├── utils/
│   └── strategy-helpers.ts       # Common utilities
└── parsers/
    ├── XmlBotParser.ts
    └── StrategyGenerator.ts
```

## Next Steps

1. **Run Conversion**: Execute `npm run convert-bots` to generate strategies
2. **Test Strategies**: Use paper trading to test generated strategies
3. **Customize**: Edit generated strategies as needed
4. **Backtest**: Run backtests on generated strategies
5. **Deploy**: Use in production with proper risk management

## Benefits

✅ **Automatic Loading**: No manual registration needed
✅ **Type Safety**: Full TypeScript support
✅ **Error Handling**: Graceful handling of missing strategies
✅ **Extensibility**: Easy to add new strategies
✅ **Utilities**: Common functions for strategy development





