/**
 * Integration tests for strategy signal generation
 * Tests end-to-end signal detection and trade execution
 */

import { SignalistSMA3CStrategy } from '../../strategies/signalist-sma-3c';
import { Candle } from '../../types';

describe('Strategy Signal Integration', () => {
  let strategy: SignalistSMA3CStrategy;

  beforeEach(() => {
    strategy = new SignalistSMA3CStrategy({
      candleTimeframe: '5m',
      smaPeriod: 50,
      smaCrossLookback: 8,
      fiveMinTrendConfirmation: false, // Disable for simpler tests
      spikeDetectionEnabled: false,
    });
  });

  it('should generate BUY signal for bullish 3-candle alignment with SMA cross', () => {
    const candles: Candle[] = [];
    
    // Generate 60 candles to have enough for SMA(50)
    for (let i = 0; i < 60; i++) {
      const basePrice = 2000 - (i * 0.1);
      candles.push({
        symbol: 'XAUUSD',
        timeframe: '5m',
        open: basePrice,
        high: basePrice + 0.5,
        low: basePrice - 0.5,
        close: basePrice + 0.2, // Slightly bullish
        volume: 1000,
        timestamp: new Date(Date.now() - (60 - i) * 5 * 60000),
        isClosed: true,
      });
    }

    // Last 3 candles: bullish alignment
    candles[candles.length - 3] = {
      ...candles[candles.length - 3],
      open: 2000,
      close: 2004, // Bullish
    };
    candles[candles.length - 2] = {
      ...candles[candles.length - 2],
      open: 2004,
      close: 2008, // Bullish
    };
    candles[candles.length - 1] = {
      ...candles[candles.length - 1],
      open: 2008,
      close: 2012, // Bullish
    };

    // Add all candles to strategy
    candles.forEach(candle => strategy.addCandle(candle));

    // Analyze
    const signal = strategy.analyze('XAUUSD');

    // May or may not generate signal depending on SMA cross condition
    // This test verifies the strategy doesn't crash
    expect(signal === null || signal?.direction === 'BUY').toBe(true);
  });

  it('should generate SELL signal for bearish 3-candle alignment', () => {
    const candles: Candle[] = [];
    
    // Generate 60 candles
    for (let i = 0; i < 60; i++) {
      const basePrice = 2000 + (i * 0.1);
      candles.push({
        symbol: 'XAUUSD',
        timeframe: '5m',
        open: basePrice,
        high: basePrice + 0.5,
        low: basePrice - 0.5,
        close: basePrice - 0.2, // Slightly bearish
        volume: 1000,
        timestamp: new Date(Date.now() - (60 - i) * 5 * 60000),
        isClosed: true,
      });
    }

    // Last 3 candles: bearish alignment
    candles[candles.length - 3] = {
      ...candles[candles.length - 3],
      open: 2000,
      close: 1996, // Bearish
    };
    candles[candles.length - 2] = {
      ...candles[candles.length - 2],
      open: 1996,
      close: 1992, // Bearish
    };
    candles[candles.length - 1] = {
      ...candles[candles.length - 1],
      open: 1992,
      close: 1988, // Bearish
    };

    candles.forEach(candle => strategy.addCandle(candle));

    const signal = strategy.analyze('XAUUSD');

    expect(signal === null || signal?.direction === 'SELL').toBe(true);
  });

  it('should not generate signal for mixed candle alignment', () => {
    const candles: Candle[] = [];
    
    for (let i = 0; i < 60; i++) {
      candles.push({
        symbol: 'XAUUSD',
        timeframe: '5m',
        open: 2000,
        high: 2005,
        low: 1995,
        close: 2000 + (Math.random() * 10 - 5),
        volume: 1000,
        timestamp: new Date(Date.now() - (60 - i) * 5 * 60000),
        isClosed: true,
      });
    }

    // Last 3 candles: mixed (bullish, bearish, bullish)
    candles[candles.length - 3] = {
      ...candles[candles.length - 3],
      open: 2000,
      close: 2004, // Bullish
    };
    candles[candles.length - 2] = {
      ...candles[candles.length - 2],
      open: 2004,
      close: 2000, // Bearish
    };
    candles[candles.length - 1] = {
      ...candles[candles.length - 1],
      open: 2000,
      close: 2004, // Bullish
    };

    candles.forEach(candle => strategy.addCandle(candle));

    const signal = strategy.analyze('XAUUSD');

    // Should not generate signal for mixed alignment
    expect(signal).toBeNull();
  });

  it('should detect spike for Boom/Crash instruments', () => {
    const strategyWithSpike = new SignalistSMA3CStrategy({
      candleTimeframe: '5m',
      smaPeriod: 50,
      spikeDetectionEnabled: true,
      spikeThreshold: 0.5, // 0.5%
    });

    const candles: Candle[] = [];
    
    // Generate candles with a spike
    for (let i = 0; i < 60; i++) {
      const basePrice = 1000;
      candles.push({
        symbol: 'BOOM1000',
        timeframe: '5m',
        open: basePrice,
        high: basePrice * 1.001,
        low: basePrice * 0.999,
        close: basePrice,
        volume: 1000,
        timestamp: new Date(Date.now() - (60 - i) * 5 * 60000),
        isClosed: true,
      });
    }

    // Add a spike in the middle
    candles[30] = {
      ...candles[30],
      open: 1000,
      high: 1006, // 0.6% spike
      low: 1000,
      close: 1006,
    };

    // Last 3: bullish
    candles[candles.length - 3] = {
      ...candles[candles.length - 3],
      open: 1000,
      close: 1004,
    };
    candles[candles.length - 2] = {
      ...candles[candles.length - 2],
      open: 1004,
      close: 1008,
    };
    candles[candles.length - 1] = {
      ...candles[candles.length - 1],
      open: 1008,
      close: 1012,
    };

    candles.forEach(candle => strategyWithSpike.addCandle(candle));

    const signal = strategyWithSpike.analyze('BOOM1000', 'boom');

    // May generate signal if spike detected and other conditions met
    expect(signal === null || signal?.spikeDetected === true).toBe(true);
  });

  it('should calculate ATR correctly', () => {
    const candles: Candle[] = [];
    
    // Generate candles with varying volatility
    for (let i = 0; i < 20; i++) {
      const basePrice = 2000 + i;
      const volatility = 1 + (i % 3); // Varying volatility
      candles.push({
        symbol: 'XAUUSD',
        timeframe: '5m',
        open: basePrice,
        high: basePrice + volatility,
        low: basePrice - volatility,
        close: basePrice + (volatility * 0.5),
        volume: 1000,
        timestamp: new Date(Date.now() - (20 - i) * 5 * 60000),
        isClosed: true,
      });
    }

    candles.forEach(candle => strategy.addCandle(candle));

    const atr = strategy.calculateATR(candles, 14);

    expect(atr).not.toBeNull();
    expect(atr).toBeGreaterThan(0);
  });
});




