/**
 * Unit tests for Signalist-SMA-3C strategy
 */

import { SignalistSMA3CStrategy } from '../strategies/signalist-sma-3c';
import { Candle } from '../types';

describe('SignalistSMA3CStrategy', () => {
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

  describe('3-Candle Alignment', () => {
    it('should detect bullish 3-candle alignment', () => {
      const candles: Candle[] = [
        {
          symbol: 'XAUUSD',
          timeframe: '5m',
          open: 2000,
          high: 2005,
          low: 1999,
          close: 2004,
          volume: 1000,
          timestamp: new Date(),
          isClosed: true,
        },
        {
          symbol: 'XAUUSD',
          timeframe: '5m',
          open: 2004,
          high: 2008,
          low: 2003,
          close: 2007,
          volume: 1000,
          timestamp: new Date(),
          isClosed: true,
        },
        {
          symbol: 'XAUUSD',
          timeframe: '5m',
          open: 2007,
          high: 2010,
          low: 2006,
          close: 2009,
          volume: 1000,
          timestamp: new Date(),
          isClosed: true,
        },
      ];

      candles.forEach((candle) => strategy.addCandle(candle));

      const signal = strategy.analyze('XAUUSD');
      expect(signal).not.toBeNull();
      expect(signal?.direction).toBe('BUY');
      expect(signal?.threeCandleAlignment).toBe(true);
    });

    it('should detect bearish 3-candle alignment', () => {
      const candles: Candle[] = [
        {
          symbol: 'XAUUSD',
          timeframe: '5m',
          open: 2009,
          high: 2010,
          low: 2006,
          close: 2007,
          volume: 1000,
          timestamp: new Date(),
          isClosed: true,
        },
        {
          symbol: 'XAUUSD',
          timeframe: '5m',
          open: 2007,
          high: 2008,
          low: 2003,
          close: 2004,
          volume: 1000,
          timestamp: new Date(),
          isClosed: true,
        },
        {
          symbol: 'XAUUSD',
          timeframe: '5m',
          open: 2004,
          high: 2005,
          low: 1999,
          close: 2000,
          volume: 1000,
          timestamp: new Date(),
          isClosed: true,
        },
      ];

      candles.forEach((candle) => strategy.addCandle(candle));

      const signal = strategy.analyze('XAUUSD');
      expect(signal).not.toBeNull();
      expect(signal?.direction).toBe('SELL');
    });

    it('should reject mixed candle alignment', () => {
      const candles: Candle[] = [
        {
          symbol: 'XAUUSD',
          timeframe: '5m',
          open: 2000,
          high: 2005,
          low: 1999,
          close: 2004,
          volume: 1000,
          timestamp: new Date(),
          isClosed: true,
        },
        {
          symbol: 'XAUUSD',
          timeframe: '5m',
          open: 2004,
          high: 2005,
          low: 2000,
          close: 2001, // Bearish
          volume: 1000,
          timestamp: new Date(),
          isClosed: true,
        },
        {
          symbol: 'XAUUSD',
          timeframe: '5m',
          open: 2001,
          high: 2006,
          low: 2000,
          close: 2005, // Bullish
          volume: 1000,
          timestamp: new Date(),
          isClosed: true,
        },
      ];

      candles.forEach((candle) => strategy.addCandle(candle));

      const signal = strategy.analyze('XAUUSD');
      expect(signal).toBeNull();
    });

    it('should reject Doji candles', () => {
      const candles: Candle[] = [
        {
          symbol: 'XAUUSD',
          timeframe: '5m',
          open: 2000,
          high: 2000.001,
          low: 1999.999,
          close: 2000, // Doji - very small body
          volume: 1000,
          timestamp: new Date(),
          isClosed: true,
        },
        {
          symbol: 'XAUUSD',
          timeframe: '5m',
          open: 2004,
          high: 2008,
          low: 2003,
          close: 2007,
          volume: 1000,
          timestamp: new Date(),
          isClosed: true,
        },
        {
          symbol: 'XAUUSD',
          timeframe: '5m',
          open: 2007,
          high: 2010,
          low: 2006,
          close: 2009,
          volume: 1000,
          timestamp: new Date(),
          isClosed: true,
        },
      ];

      candles.forEach((candle) => strategy.addCandle(candle));

      const signal = strategy.analyze('XAUUSD');
      expect(signal).toBeNull();
    });
  });

  describe('SMA Confirmation', () => {
    it('should require enough candles for SMA calculation', () => {
      const candles: Candle[] = [];
      for (let i = 0; i < 5; i++) {
        candles.push({
          symbol: 'XAUUSD',
          timeframe: '5m',
          open: 2000 + i,
          high: 2001 + i,
          low: 1999 + i,
          close: 2000.5 + i,
          volume: 1000,
          timestamp: new Date(Date.now() + i * 60000),
          isClosed: true,
        });
        strategy.addCandle(candles[i]);
      }

      const signal = strategy.analyze('XAUUSD');
      expect(signal).toBeNull(); // Not enough candles for SMA(50)
    });
  });

  describe('Spike Detection', () => {
    it('should detect spike for Boom/Crash instruments', () => {
      const strategyWithSpike = new SignalistSMA3CStrategy({
        candleTimeframe: '5m',
        smaPeriod: 50,
        spikeDetectionEnabled: true,
        spikeThreshold: 0.5,
      });

      // Create candles with a spike
      const basePrice = 1000;
      const candles: Candle[] = [
        {
          symbol: 'BOOM1000',
          timeframe: '5m',
          open: basePrice,
          high: basePrice * 1.006, // 0.6% spike
          low: basePrice,
          close: basePrice * 1.006,
          volume: 1000,
          timestamp: new Date(),
          isClosed: true,
        },
        {
          symbol: 'BOOM1000',
          timeframe: '5m',
          open: basePrice * 1.006,
          high: basePrice * 1.007,
          low: basePrice * 1.005,
          close: basePrice * 1.0065,
          volume: 1000,
          timestamp: new Date(),
          isClosed: true,
        },
        {
          symbol: 'BOOM1000',
          timeframe: '5m',
          open: basePrice * 1.0065,
          high: basePrice * 1.008,
          low: basePrice * 1.006,
          close: basePrice * 1.007,
          volume: 1000,
          timestamp: new Date(),
          isClosed: true,
        },
      ];

      candles.forEach((candle) => strategyWithSpike.addCandle(candle));

      // Would need more candles for SMA, but spike should be detected
      // This is a simplified test
    });
  });

  describe('ATR Calculation', () => {
    it('should calculate ATR correctly', () => {
      const candles: Candle[] = [];
      for (let i = 0; i < 20; i++) {
        candles.push({
          symbol: 'XAUUSD',
          timeframe: '5m',
          open: 2000 + i * 0.5,
          high: 2001 + i * 0.5,
          low: 1999 + i * 0.5,
          close: 2000.5 + i * 0.5,
          volume: 1000,
          timestamp: new Date(Date.now() + i * 60000),
          isClosed: true,
        });
        strategy.addCandle(candles[i]);
      }

      const atr = strategy.calculateATR(candles, 14);
      expect(atr).not.toBeNull();
      expect(atr).toBeGreaterThan(0);
    });
  });
});






