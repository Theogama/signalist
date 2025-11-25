# Enhanced Backtesting Guide

## Overview

The enhanced backtester provides comprehensive performance analysis, forward testing mode, and detailed reporting capabilities.

## Features

### 1. Comprehensive Performance Metrics

**Basic Metrics:**
- Win rate
- Total profit/loss
- Average profit/loss
- Profit factor
- Max drawdown

**Advanced Metrics:**
- **Sharpe Ratio**: Risk-adjusted return measure
- **Sortino Ratio**: Downside risk-adjusted return
- **Calmar Ratio**: Return vs max drawdown
- **Recovery Factor**: Profit recovery from drawdown
- **Expectancy**: Expected value per trade
- **Average Risk/Reward**: Average RR ratio

**Trade Analysis:**
- Best and worst trades
- Largest win and loss
- Consecutive wins/losses
- Average win/loss duration
- Trade distribution by hour, day, month

### 2. Monthly Performance Breakdown

Detailed monthly analysis showing:
- Monthly P/L
- Monthly win rate
- Monthly drawdown
- Performance rating (Excellent, Good, Average, Poor, Very Poor)

### 3. Equity & Drawdown Curves

- **Equity Curve**: Balance and equity over time
- **Drawdown Curve**: Drawdown tracking with peak balance

### 4. Forward Testing Mode

Test strategies with slow tick replay:
- Configurable speed (real-time, 2x, 0.5x, etc.)
- Real-time callbacks for ticks and trades
- Error handling

### 5. Performance Reports

Automated report generation with:
- Executive summary
- Key metrics breakdown
- Monthly performance analysis
- Recommendations
- Warnings

## Usage

### Basic Backtest

```typescript
import { EnhancedBacktester } from '@/lib/auto-trading/backtester/EnhancedBacktester';
import { RiseFallStrategy } from '@/lib/auto-trading/strategies/RiseFallStrategy';

const strategy = new RiseFallStrategy({
  riskPercent: 1,
  useATRForSL: true,
  enableBreakeven: true,
});

const riskLimits = {
  maxRiskPerTrade: 1,
  maxDailyLoss: 5,
  maxDrawdown: 20,
  maxConcurrentPositions: 3,
  useATRForSL: true,
  enableBreakeven: true,
};

const backtester = new EnhancedBacktester(riskLimits);

const result = await backtester.backtest(
  strategy,
  historicalData,
  10000, // initial balance
  strategyConfig
);

console.log('Win Rate:', result.winRate);
console.log('Sharpe Ratio:', result.sharpeRatio);
console.log('Max Drawdown:', result.maxDrawdownPercent);
```

### Forward Testing Mode

```typescript
const forwardTestConfig = {
  enabled: true,
  speedMultiplier: 2, // 2x speed
  onTick: (data) => {
    console.log('Tick:', {
      timestamp: data.timestamp,
      balance: data.balance,
      equity: data.equity,
      openPositions: data.openPositions,
      currentPnl: data.currentPnl,
    });
  },
  onTrade: (trade) => {
    console.log('Trade closed:', {
      symbol: trade.symbol,
      side: trade.side,
      profitLoss: trade.profitLoss,
      duration: trade.duration,
    });
  },
  onError: (error) => {
    console.error('Forward test error:', error);
  },
};

const backtester = new EnhancedBacktester(riskLimits, forwardTestConfig);
const result = await backtester.backtest(strategy, historicalData, 10000, strategyConfig);
```

### Generate Performance Report

```typescript
import { PerformanceReportGenerator } from '@/lib/auto-trading/backtester/PerformanceReport';

const result = await backtester.backtest(strategy, historicalData, 10000, strategyConfig);

// Generate report
const report = PerformanceReportGenerator.generateReport(result);

console.log('Summary:', report.summary);
console.log('Metrics:', report.metrics);
console.log('Recommendations:', report.recommendations);
console.log('Warnings:', report.warnings);

// Generate markdown report
const markdown = PerformanceReportGenerator.generateMarkdownReport(result);
console.log(markdown);
```

## API Usage

### POST `/api/auto-trading/backtest`

**Request:**
```json
{
  "strategyName": "RiseFall",
  "historicalData": [
    {
      "symbol": "XAUUSD",
      "price": 2000,
      "high": 2005,
      "low": 1995,
      "volume": 1000,
      "timestamp": "2024-01-01T00:00:00Z"
    }
  ],
  "initialBalance": 10000,
  "config": {
    "riskPercent": 1,
    "takeProfitPercent": 2,
    "stopLossPercent": 1,
    "useATRForSL": true,
    "enableBreakeven": true,
    "enableTrailingStop": true
  },
  "forwardTest": {
    "enabled": false,
    "speedMultiplier": 1
  },
  "generateReport": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "strategyName": "RiseFall",
    "totalTrades": 150,
    "winRate": 55.5,
    "totalProfitLoss": 2500,
    "sharpeRatio": 1.8,
    "maxDrawdownPercent": 8.5,
    "monthlyBreakdown": [...],
    "equityCurve": [...],
    "drawdownCurve": [...],
    "tradeDistribution": {...},
    "riskMetrics": {...}
  },
  "report": {
    "summary": {...},
    "metrics": {...},
    "recommendations": [...],
    "warnings": [...]
  },
  "markdownReport": "# Backtest Performance Report\n\n..."
}
```

## Performance Metrics Explained

### Sharpe Ratio
Measures risk-adjusted return. Higher is better.
- < 1: Poor
- 1-2: Good
- > 2: Excellent

### Sortino Ratio
Similar to Sharpe but only considers downside volatility.
- Better for strategies with asymmetric returns

### Calmar Ratio
Return divided by max drawdown.
- Higher is better
- Shows recovery capability

### Recovery Factor
Total profit divided by max drawdown.
- Shows how well strategy recovers from losses
- > 1 is good

### Expectancy
Expected value per trade.
- Positive = profitable strategy
- Formula: (Win Rate × Avg Win) - (Loss Rate × Avg Loss)

## Monthly Breakdown

Each month includes:
- Start/end balance
- Total P/L and percentage
- Number of trades
- Win rate
- Average P/L per trade
- Max drawdown for the month
- Performance rating

## Trade Distribution

Analyzes trades by:
- **Hour of day**: Best/worst trading hours
- **Day of week**: Best/worst trading days
- **Month**: Seasonal patterns

## Recommendations

Automated recommendations based on:
- Win rate analysis
- Profit factor
- Drawdown levels
- Sharpe ratio
- Consecutive losses
- Monthly consistency

## Warnings

Automatic warnings for:
- Unprofitable strategies
- High drawdown (>30%)
- Very low win rate (<30%)
- Profit factor < 1
- High consecutive losses (>10)
- Low statistical significance (<30 trades)

## Best Practices

1. **Minimum Trades**: Aim for at least 30-50 trades for statistical significance
2. **Multiple Time Periods**: Test across different market conditions
3. **Forward Testing**: Use forward testing to validate before live trading
4. **Review Reports**: Always review recommendations and warnings
5. **Compare Metrics**: Compare Sharpe, Sortino, and Calmar ratios
6. **Monthly Analysis**: Check monthly breakdown for consistency
7. **Trade Distribution**: Identify best trading times

## Example Workflow

1. **Backtest** on historical data
2. **Review** performance metrics
3. **Generate** performance report
4. **Analyze** recommendations and warnings
5. **Forward Test** with slow replay
6. **Paper Trade** to validate
7. **Live Trade** with small position sizes

## Integration with Enhanced Features

The enhanced backtester automatically uses:
- ✅ Enhanced risk management (breakeven, trailing stops)
- ✅ Dynamic SL/TP based on ATR
- ✅ All enhanced strategy features
- ✅ Comprehensive logging

All enhancements are fully integrated and work seamlessly with backtesting.

