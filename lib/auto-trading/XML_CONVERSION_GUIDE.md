# XML Bot Conversion Guide

## Overview

This guide explains how the XML bot parser converts Deriv Binary Bot XML files into TypeScript strategy modules.

## Conversion Process

### 1. XML Parsing

The `XmlBotParser` class extracts key information from XML files:

- **Symbol**: Trading instrument (e.g., R_100, BOOM1000)
- **Trade Type**: Strategy type (evenodd, callput, matchesdiffers)
- **Parameters**: Initial stake, martingale multiplier, target profit, stop loss
- **Settings**: Candle interval, duration, contract type

### 2. Strategy Type Detection

The parser automatically detects strategy types:

- **EvenOdd**: `TRADETYPE_LIST` contains "evenodd"
- **RiseFall**: `TRADETYPECAT_LIST` is "callput"
- **Digits**: `TRADETYPE_LIST` contains "matches" or "differs"
- **OverUnder**: `TRADETYPE_LIST` contains "over" or "under"

### 3. Code Generation

The `StrategyGenerator` creates TypeScript classes that:

- Extend appropriate base strategy classes
- Include extracted parameters
- Implement `analyze()` method with trading logic
- Include martingale support if detected
- Include stop loss and take profit logic

## Running the Conversion

### Convert All Bots

```bash
npm run convert-bots
```

This will:
1. Process all XML files in `freetradingbots-main/`
2. Generate TypeScript files in `lib/auto-trading/strategies/generated/`
3. Create an index file for easy imports

### Convert Specific Bot

```typescript
import { StrategyGenerator } from '@/lib/auto-trading/parsers';

const generator = new StrategyGenerator();
generator.generateFromXml(
  'freetradingbots-main/BOT - 0001 - Even_Odd -  MG with Stop X.xml',
  'lib/auto-trading/strategies/generated'
);
```

## Generated Strategy Structure

```typescript
export class BotNameStrategy extends BaseStrategy {
  constructor(config: any) {
    super('BotName', {
      // Strategy configuration
      riskPercent: 1,
      takeProfitPercent: 2,
      stopLossPercent: 1,
      parameters: {
        // Extracted from XML
        symbol: 'R_100',
        tradeType: 'evenodd',
        martingale: true,
        martingaleMultiplier: 2,
      },
    });
  }

  async analyze(marketData, historicalData) {
    // Generated trading logic
  }
}
```

## Using Generated Strategies

### Load and Register

```typescript
import { strategyRegistry } from '@/lib/auto-trading/strategies/StrategyRegistry';

// Load generated strategies
await strategyRegistry.loadGeneratedStrategies();

// List available strategies
console.log(strategyRegistry.list());

// Create strategy instance
const strategy = strategyRegistry.create('BotName', {
  riskPercent: 1,
  takeProfitPercent: 2,
  stopLossPercent: 1,
});
```

### In Trading System

```typescript
// Get market data
const marketData = await adapter.getMarketData('XAUUSD');

// Analyze with generated strategy
const signal = await strategy.analyze(marketData, historicalData);

// Execute if signal generated
if (signal) {
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

## Priority Bots

The converter prioritizes these bots:

1. `BOT - 0001 - Even_Odd -  MG with Stop X.xml`
2. `BOT - 0002 - Rise-Fall - Candle Close-Open - MG.xml`
3. `BOT - 0003 - Digits Analyzer - MG.xml`
4. `BOT - 0008 - Over Under.xml`
5. `Even Odd Bot.xml`
6. `SMART RISE AND FALL BOT(1).xml`
7. `Last Digit Bot.xml`
8. `Two consecutive Digits Bot.xml`
9. `Profit bot (1).xml`

## Customization

### Modify Generated Logic

After generation, you can customize the strategy logic:

```typescript
// Edit generated file
// lib/auto-trading/strategies/generated/BotNameStrategy.ts

async analyze(marketData: MarketData, historicalData?: MarketData[]): Promise<StrategySignal | null> {
  // Add your custom logic here
  // ...
}
```

### Add New Strategy Types

Extend `StrategyGenerator` to support new strategy types:

```typescript
private generateCustomLogic(config: ParsedBotConfig): string {
  return `
    // Your custom logic
  `;
}
```

## Troubleshooting

### Parser Errors

If a bot fails to parse:

1. Check XML file structure
2. Verify required fields exist
3. Review error message for missing elements

### Generated Code Issues

If generated code has errors:

1. Check TypeScript compilation
2. Verify base strategy imports
3. Review parameter types

### Strategy Not Working

If strategy doesn't work as expected:

1. Review original XML logic
2. Compare with generated code
3. Test with paper trading first
4. Adjust parameters as needed

## Best Practices

1. **Always test in paper trading mode first**
2. **Backtest generated strategies before live use**
3. **Review and customize generated logic**
4. **Start with priority bots**
5. **Monitor performance closely**

## Examples

See `lib/auto-trading/strategies/` for manually created examples:
- `EvenOddStrategy.ts`
- `RiseFallStrategy.ts`
- `DigitsStrategy.ts`

These serve as references for generated strategies.




