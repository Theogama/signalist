# XML Bot Parser

Parser for converting Deriv Binary Bot XML files to TypeScript strategy modules.

## Usage

### Convert XML Bots to TypeScript

```bash
npm run convert-bots
```

This will:
1. Parse all XML files in `freetradingbots-main/`
2. Extract trading logic and parameters
3. Generate TypeScript strategy files in `lib/auto-trading/strategies/generated/`
4. Create an index file for easy imports

### Programmatic Usage

```typescript
import { XmlBotParser, StrategyGenerator } from '@/lib/auto-trading/parsers';

// Parse XML file
const parser = new XmlBotParser();
const config = parser.parseXmlFile('path/to/bot.xml');

// Generate strategy
const generator = new StrategyGenerator();
const outputPath = generator.generateFromXml('path/to/bot.xml', 'output/dir');
```

## Features

- ✅ Extracts symbol, trade type, and parameters
- ✅ Detects martingale settings
- ✅ Extracts target profit and stop loss
- ✅ Generates TypeScript strategy classes
- ✅ Maps XML trade types to strategy types
- ✅ Handles Even/Odd, Rise/Fall, Digits, and more

## Generated Strategies

Strategies are generated in `lib/auto-trading/strategies/generated/` and can be imported via:

```typescript
import { strategyRegistry } from '@/lib/auto-trading/strategies/StrategyRegistry';

// Load generated strategies
await strategyRegistry.loadGeneratedStrategies();

// Use a strategy
const strategy = strategyRegistry.create('BotName', config);
```





