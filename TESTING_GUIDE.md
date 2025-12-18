# Signalist Bot Testing Guide

## Test Suite Overview

Comprehensive test suite covering all aspects of the Signalist unified trading bot system.

## Setup

### Install Dependencies

```bash
npm install --save-dev jest ts-jest @types/jest
```

Or add to `package.json`:
```json
{
  "devDependencies": {
    "jest": "^29.7.0",
    "ts-jest": "^29.1.1",
    "@types/jest": "^29.5.11"
  }
}
```

## Running Tests

### All Tests
```bash
npm test
```

### Watch Mode (for development)
```bash
npm run test:watch
```

### Coverage Report
```bash
npm run test:coverage
```

### Signalist Bot Tests Only
```bash
npm run test:signalist
```

### Specific Test File
```bash
npm test -- signalist-sma-3c.test.ts
npm test -- bot-engine.test.ts
npm test -- adapters.test.ts
npm test -- risk-sizing.test.ts
```

### Integration Tests
```bash
npm test -- integration
```

## Test Files

### Unit Tests

1. **`signalist-sma-3c.test.ts`** - Strategy logic
   - 3-candle alignment detection
   - SMA confirmation
   - Spike detection
   - ATR calculation
   - Doji rejection

2. **`bot-engine.test.ts`** - Bot engine
   - Initialization
   - Start/stop lifecycle
   - Safety rules
   - Settings updates
   - Event emission

3. **`adapters.test.ts`** - Broker adapters
   - MT5 adapter connection
   - Deriv adapter connection
   - Account operations
   - Health checks

4. **`risk-sizing.test.ts`** - Risk calculations
   - Lot size calculation (MT5)
   - Stake calculation (Deriv)
   - Edge cases
   - Min/max limits

### Integration Tests

1. **`integration/bot-lifecycle.test.ts`** - Full bot workflow
   - Start to stop cycle
   - Candle processing
   - Trade placement
   - Event flow

2. **`integration/strategy-signals.test.ts`** - End-to-end signals
   - BUY signal generation
   - SELL signal generation
   - Mixed alignment rejection
   - Spike detection

## Test Coverage

### Current Coverage Goals

- **Strategy Logic**: >90%
- **Bot Engine**: >80%
- **Adapters**: >70%
- **Integration Tests**: Critical paths

### View Coverage Report

After running `npm run test:coverage`:
- HTML report: `coverage/index.html`
- Text report: Console output
- LCOV report: `coverage/lcov.info`

## Mock Data

Tests use mock adapters and data to avoid:
- Live broker connections
- Real API keys
- Database connections
- Network calls

### MockBrokerAdapter

Located in `integration/bot-lifecycle.test.ts`, provides:
- Simulated candle streams
- Mock trade execution
- Account balance tracking
- Trade history management

## Writing New Tests

### Unit Test Template

```typescript
import { Component } from '../component';

describe('Component', () => {
  let component: Component;

  beforeEach(() => {
    component = new Component();
  });

  it('should do something', () => {
    // Arrange
    const input = 'test';
    
    // Act
    const result = component.method(input);
    
    // Assert
    expect(result).toBe('expected');
  });
});
```

### Integration Test Template

```typescript
describe('Feature Integration', () => {
  it('should complete workflow', async () => {
    // Setup
    const adapter = new MockAdapter();
    const engine = new BotEngine(settings, adapter);
    
    // Execute
    await engine.start();
    // ... trigger actions
    await engine.stop();
    
    // Verify
    expect(engine.getStatus().isRunning).toBe(false);
  });
});
```

## Test Best Practices

### 1. Arrange-Act-Assert Pattern
```typescript
it('should calculate correctly', () => {
  // Arrange - Set up test data
  const input = { value: 10 };
  
  // Act - Execute the code
  const result = calculator.multiply(input.value, 2);
  
  // Assert - Verify results
  expect(result).toBe(20);
});
```

### 2. Use Descriptive Test Names
```typescript
// Good
it('should reject Doji candles in 3-candle alignment check')

// Bad
it('should work correctly')
```

### 3. Test Edge Cases
- Minimum values
- Maximum values
- Zero/null values
- Boundary conditions

### 4. Mock External Dependencies
- API calls
- Database operations
- File system
- Network requests

### 5. Clean Up After Tests
```typescript
afterEach(() => {
  // Cleanup code
  jest.clearAllMocks();
});
```

## Troubleshooting

### Tests Failing

1. **Check Mock Setup**
   - Verify mock functions are properly configured
   - Check return values match expected types

2. **Time-Based Tests**
   - Use fixed timestamps
   - Mock `Date.now()` if needed

3. **Async Tests**
   - Use `async/await` or `.then()`
   - Set appropriate timeouts

4. **Mock Functions**
   - Verify `jest.fn()` is used correctly
   - Check mock implementations

### Slow Tests

1. Reduce test data size
2. Use faster mocks
3. Run tests in parallel (Jest default)
4. Skip slow tests in watch mode

### Flaky Tests

1. Fix time-dependent logic
2. Use deterministic data
3. Check for race conditions
4. Increase timeouts if needed

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '20'
      - run: npm install
      - run: npm test
      - run: npm run test:coverage
```

## Coverage Thresholds

Set in `jest.config.js`:
```javascript
coverageThresholds: {
  global: {
    branches: 80,
    functions: 80,
    lines: 80,
    statements: 80,
  },
},
```

## Next Steps

1. **Add More Tests**
   - Error handling scenarios
   - Network failure cases
   - Concurrent operations

2. **Performance Tests**
   - Load testing
   - Stress testing
   - Memory leak detection

3. **E2E Tests**
   - Full user workflows
   - API endpoint testing
   - Database integration

## Resources

- [Jest Documentation](https://jestjs.io/)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- Test files in `lib/signalist-bot/__tests__/`




