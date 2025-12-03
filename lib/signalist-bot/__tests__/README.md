# Signalist Bot Test Suite

## Overview

Comprehensive test suite for the Signalist unified trading bot system.

## Test Structure

```
lib/signalist-bot/__tests__/
├── signalist-sma-3c.test.ts      # Strategy unit tests
├── bot-engine.test.ts            # Bot engine unit tests
├── adapters.test.ts              # Broker adapter tests
├── risk-sizing.test.ts           # Risk calculation tests
├── integration/
│   ├── bot-lifecycle.test.ts     # Full bot lifecycle tests
│   └── strategy-signals.test.ts  # End-to-end signal tests
└── README.md                     # This file
```

## Running Tests

### Prerequisites

Install testing dependencies:
```bash
npm install --save-dev jest ts-jest @types/jest
```

### Run All Tests
```bash
npm test
```

### Run Specific Test File
```bash
npm test -- signalist-sma-3c.test.ts
npm test -- bot-engine.test.ts
```

### Run Integration Tests
```bash
npm test -- integration
```

### Run with Coverage
```bash
npm test -- --coverage
```

## Test Categories

### Unit Tests

#### Strategy Tests (`signalist-sma-3c.test.ts`)
- ✅ 3-candle alignment detection
- ✅ SMA confirmation logic
- ✅ Spike detection
- ✅ ATR calculation
- ✅ Doji candle rejection

#### Bot Engine Tests (`bot-engine.test.ts`)
- ✅ Initialization
- ✅ Start/stop lifecycle
- ✅ Safety rule enforcement
- ✅ Settings update
- ✅ Event emission

#### Adapter Tests (`adapters.test.ts`)
- ✅ MT5 adapter connection
- ✅ Deriv adapter connection
- ✅ Account info retrieval
- ✅ Health checks
- ✅ Error handling

#### Risk Sizing Tests (`risk-sizing.test.ts`)
- ✅ Lot calculation (MT5)
- ✅ Stake calculation (Deriv)
- ✅ Edge cases
- ✅ Min/max limits

### Integration Tests

#### Bot Lifecycle Tests (`integration/bot-lifecycle.test.ts`)
- ✅ Full start-to-stop workflow
- ✅ Candle processing
- ✅ Trade placement
- ✅ Event flow
- ✅ Safety rule enforcement

#### Strategy Signals Tests (`integration/strategy-signals.test.ts`)
- ✅ End-to-end signal generation
- ✅ BUY signal detection
- ✅ SELL signal detection
- ✅ Mixed alignment rejection
- ✅ Spike detection for Boom/Crash

## Mock Data

Tests use mock adapters and data to avoid requiring:
- Live broker connections
- Real API keys
- Database connections

## Test Utilities

### MockBrokerAdapter
Located in `integration/bot-lifecycle.test.ts`, provides:
- Simulated candle streams
- Mock trade placement
- Account balance tracking
- Trade history

### Mock Data Generators
- Historical candle generation
- Tick data simulation
- Trade response mocking

## Writing New Tests

### Example Unit Test
```typescript
describe('FeatureName', () => {
  beforeEach(() => {
    // Setup
  });

  it('should do something', () => {
    // Arrange
    const input = ...;
    
    // Act
    const result = functionToTest(input);
    
    // Assert
    expect(result).toBe(expected);
  });
});
```

### Example Integration Test
```typescript
describe('Feature Integration', () => {
  it('should complete full workflow', async () => {
    // Setup components
    const adapter = new MockAdapter();
    const engine = new BotEngine(settings, adapter);
    
    // Execute workflow
    await engine.start();
    // ... trigger actions
    await engine.stop();
    
    // Verify results
    expect(...).toBe(...);
  });
});
```

## Coverage Goals

Target coverage:
- **Unit Tests**: > 80% coverage
- **Integration Tests**: Critical paths covered
- **Strategy Logic**: 100% coverage

## Continuous Integration

Tests should run:
- On every commit (pre-commit hook recommended)
- On pull requests
- Before deployment

## Troubleshooting

### Tests Failing
1. Check mock data setup
2. Verify time-based logic (use fixed timestamps)
3. Check async/await handling
4. Verify mock function implementations

### Slow Tests
- Use faster mocks
- Reduce test data size
- Run tests in parallel (Jest default)

### Flaky Tests
- Fix time-dependent tests
- Use deterministic data
- Check for race conditions

## Future Test Additions

- [ ] Backtesting integration tests
- [ ] Performance/load tests
- [ ] Error recovery tests
- [ ] Multi-broker scenarios
- [ ] Concurrent bot instances

