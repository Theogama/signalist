# Bot Marketplace Implementation

## Overview

Complete bot marketplace system for Signalist with bot definitions, data models, and pluggable strategy interface.

## Components

### 1. Bot Marketplace Model
**File**: `database/models/bot-marketplace.model.ts`

**Features**:
- Complete bot metadata (name, description, risk level, markets, brokers)
- Bot configuration schema (stake, stop loss, take profit, max trades)
- Performance metrics tracking
- Strategy configuration
- Pricing support (free, one-time, subscription)
- Status flags (active, featured, premium, verified)
- Usage statistics

**Key Types**:
- `RiskLevel`: 'low' | 'medium' | 'high'
- `MarketType`: 'forex' | 'synthetic' | 'crypto' | 'commodities' | 'indices'
- `BrokerSupport`: 'exness' | 'deriv' | 'both'
- `AccountTypeSupport`: 'demo' | 'live' | 'both'

### 2. Strategy Interface
**File**: `lib/marketplace/strategy-interface.ts`

**Features**:
- `IMarketplaceStrategy` interface for pluggable strategies
- `BaseMarketplaceStrategy` abstract base class
- `StrategyRegistry` for managing strategies
- Strategy metadata for UI consumption
- Configuration validation

**Key Methods**:
- `analyze()` - Analyze market and generate signals
- `shouldEnter()` - Check if should enter position
- `shouldExit()` - Check if should exit position
- `calculatePositionSize()` - Calculate position size
- `getMetadata()` - Get strategy metadata for UI

### 3. Sample Bot Definitions
**File**: `lib/marketplace/sample-bot-definitions.ts`

**Included Bots**:
1. **Signalist SMA-3C** - Trend-following with 3-candle alignment
2. **Conservative Scalper** - Low-risk scalping strategy
3. **Trend Follower Pro** - Advanced trend-following (Premium)
4. **Breakout Hunter** - Breakout detection strategy

**Helper Functions**:
- `getBotDefinition(botId)` - Get bot by ID
- `getActiveBotDefinitions()` - Get all active bots
- `getFeaturedBotDefinitions()` - Get featured bots
- `getFreeBotDefinitions()` - Get free bots
- `getPremiumBotDefinitions()` - Get premium bots
- `getBotsByCategory(category)` - Filter by category
- `getBotsByRiskLevel(riskLevel)` - Filter by risk
- `getBotsByBroker(broker)` - Filter by broker

### 4. Marketplace Types
**File**: `lib/marketplace/types.ts`

**UI-Ready Types**:
- `BotSummary` - For listings/cards
- `BotDetail` - Full bot information
- `BotConfigurationFormData` - For form rendering
- `BotFilterOptions` - Filtering options
- `BotSearchResult` - Search results
- `BotInstallationRequest` - Installation request
- `BotInstallationResult` - Installation result

**Helper Functions**:
- `toBotSummary(doc)` - Convert to summary
- `toBotDetail(doc)` - Convert to detail

## Bot Metadata Structure

```typescript
{
  name: string;                    // Internal name
  displayName: string;             // Display name
  description: string;             // Full description
  shortDescription?: string;       // For cards/previews
  category: string;                // e.g., 'trend-following'
  tags: string[];                  // For search/filtering
  riskLevel: 'low' | 'medium' | 'high';
  supportedMarkets: MarketType[];
  supportedBrokers: 'exness' | 'deriv' | 'both';
  accountTypeSupport: 'demo' | 'live' | 'both';
  strategyName: string;            // Strategy identifier
  version: string;                 // Bot version
  author?: string;
  icon?: string;
  thumbnail?: string;
  documentationUrl?: string;
}
```

## Bot Configuration Schema

```typescript
{
  stake: {
    min: number;
    max: number;
    default: number;
    step?: number;
  };
  stopLoss: {
    enabled: boolean;
    type: 'percentage' | 'pips' | 'atr' | 'fixed';
    min?: number;
    max?: number;
    default?: number;
  };
  takeProfit: {
    enabled: boolean;
    type: 'percentage' | 'pips' | 'atr' | 'fixed' | 'risk-reward';
    min?: number;
    max?: number;
    default?: number;
    riskRewardRatio?: number;
  };
  maxTrades: {
    perDay?: number;
    perSession?: number;
    concurrent?: number;
    default?: number;
  };
  additionalParams?: Record<string, {
    type: 'number' | 'boolean' | 'string' | 'select';
    label: string;
    description?: string;
    default?: any;
    min?: number;
    max?: number;
    options?: string[];
    required?: boolean;
  }>;
}
```

## Strategy Interface

```typescript
interface IMarketplaceStrategy {
  readonly strategyId: string;
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly requiredIndicators: string[];
  readonly requiredTimeframes: string[];
  readonly supportedMarkets: MarketType[];
  
  initialize(config: StrategyConfiguration): Promise<void>;
  analyze(marketData, historicalData?): Promise<StrategyAnalysisResult>;
  shouldEnter(marketData, historicalData?): Promise<boolean>;
  shouldExit(position, marketData): Promise<boolean>;
  calculatePositionSize(balance, entryPrice, stopLoss, riskPercent): number;
  getParameters(): Record<string, any>;
  updateParameters(parameters): void;
  validateConfiguration(config): { valid: boolean; errors: string[] };
  getDefaultConfiguration(): StrategyConfiguration;
  getMetadata(): StrategyMetadata;
}
```

## Usage Examples

### Get Bot Definitions
```typescript
import { 
  getActiveBotDefinitions,
  getFeaturedBotDefinitions,
  getBotsByCategory,
  getBotsByRiskLevel
} from '@/lib/marketplace/sample-bot-definitions';

// Get all active bots
const bots = getActiveBotDefinitions();

// Get featured bots
const featured = getFeaturedBotDefinitions();

// Get bots by category
const trendBots = getBotsByCategory('trend-following');

// Get low-risk bots
const lowRiskBots = getBotsByRiskLevel('low');
```

### Use Strategy Interface
```typescript
import { StrategyRegistry, BaseMarketplaceStrategy } from '@/lib/marketplace/strategy-interface';

// Register a strategy
class MyStrategy extends BaseMarketplaceStrategy {
  readonly strategyId = 'my-strategy';
  readonly name = 'My Strategy';
  // ... implement required methods
}

StrategyRegistry.register('my-strategy', MyStrategy);

// Create strategy instance
const strategy = StrategyRegistry.create('my-strategy', config);

// Use strategy
const result = await strategy.analyze(marketData);
```

### Convert for UI
```typescript
import { toBotSummary, toBotDetail } from '@/lib/marketplace/types';
import { BotMarketplace } from '@/database/models/bot-marketplace.model';

// Get bot from database
const botDoc = await BotMarketplace.findOne({ botId: 'signalist-sma-3c' });

// Convert to UI-ready format
const summary = toBotSummary(botDoc);
const detail = toBotDetail(botDoc);
```

## Database Schema

### Indexes
- `botId` (unique)
- `metadata.category` + `isActive`
- `metadata.riskLevel` + `isActive`
- `metadata.supportedBrokers` + `isActive`
- `isFeatured` + `isActive`
- `isPremium` + `isActive`
- `metadata.tags`
- `createdAt` (descending)

### Fields
- All metadata fields indexed for filtering
- Configuration stored as nested objects
- Performance metrics optional
- Usage statistics tracked

## UI Consumption

### Bot Listing
```typescript
interface BotSummary {
  botId: string;
  displayName: string;
  shortDescription?: string;
  category: string;
  riskLevel: RiskLevel;
  icon?: string;
  thumbnail?: string;
  isFeatured: boolean;
  isPremium: boolean;
  pricing: { type: 'free' | 'one-time' | 'subscription'; amount?: number };
  performance?: { winRate?: number; profitFactor?: number };
}
```

### Bot Detail
```typescript
interface BotDetail extends BotSummary {
  description: string;
  version: string;
  author?: string;
  tags: string[];
  configuration: BotConfiguration;
  strategyConfig: StrategyConfig;
  fullPerformance?: BotPerformanceMetrics;
}
```

### Configuration Form
```typescript
interface BotConfigurationFormData {
  stake: number;
  stopLoss: { enabled: boolean; value: number };
  takeProfit: { enabled: boolean; value: number };
  maxTrades: { perDay?: number; concurrent?: number };
  additionalParams: Record<string, any>;
}
```

## Sample Bots Included

1. **Signalist SMA-3C** (Featured, Free)
   - Trend-following
   - Medium risk
   - Supports both brokers
   - 65.5% win rate

2. **Conservative Scalper** (Free)
   - Scalping
   - Low risk
   - Deriv only
   - 72.3% win rate

3. **Trend Follower Pro** (Featured, Premium)
   - Trend-following
   - High risk
   - Both brokers
   - $29.99/month

4. **Breakout Hunter** (Free)
   - Breakout trading
   - Medium risk
   - Both brokers
   - 61.5% win rate

## Next Steps

1. **API Endpoints**: Create marketplace API endpoints
2. **UI Components**: Build bot marketplace UI
3. **Strategy Loader**: Implement dynamic strategy loading
4. **Bot Installation**: Create bot installation service
5. **Analytics**: Track bot usage and performance

## Database Seeding

To seed sample bots:
```typescript
import { BotMarketplace } from '@/database/models/bot-marketplace.model';
import { sampleBotDefinitions } from '@/lib/marketplace/sample-bot-definitions';

await BotMarketplace.insertMany(sampleBotDefinitions);
```

