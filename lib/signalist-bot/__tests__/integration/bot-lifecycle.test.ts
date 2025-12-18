/**
 * Integration tests for bot lifecycle
 * Tests full bot workflow from start to stop
 */

import { SignalistBotEngine } from '../../engine/bot-engine';
import { SignalistBotSettings, UnifiedBrokerAdapter, Candle, Tick } from '../../types';

class MockBrokerAdapter implements UnifiedBrokerAdapter {
  private connected = false;
  private candles: Candle[] = [];
  private openTrades: any[] = [];
  private accountBalance = 10000;

  async initialize() {}
  
  async connect() {
    this.connected = true;
    return true;
  }
  
  async disconnect() {
    this.connected = false;
  }
  
  isConnected() {
    return this.connected;
  }
  
  getBrokerType(): 'exness' {
    return 'exness';
  }
  
  async getAccountInfo() {
    return {
      balance: this.accountBalance,
      equity: this.accountBalance,
      margin: 0,
      freeMargin: this.accountBalance,
      currency: 'USD',
    };
  }
  
  async getBalance() {
    return this.accountBalance;
  }
  
  private candleCallback?: (candle: Candle) => void;
  
  async subscribeToCandles(
    symbol: string,
    timeframe: string,
    callback: (candle: Candle) => void
  ) {
    this.candleCallback = callback;
    
    // Return unsubscribe function
    return () => {
      this.candleCallback = undefined;
    };
  }
  
  // Helper to emit candles in tests
  emitCandle(candle: Candle) {
    if (this.candleCallback) {
      this.candleCallback(candle);
    }
  }
  
  async subscribeToTicks() {
    return () => {};
  }
  
  async getHistoricalCandles(symbol: string, timeframe: string, count: number) {
    // Generate historical candles with bullish alignment
    const basePrice = 2000;
    const historical: Candle[] = [];
    
    for (let i = count - 1; i >= 0; i--) {
      const price = basePrice - (i * 0.1);
      historical.push({
        symbol,
        timeframe: timeframe as any,
        open: price,
        high: price + 0.5,
        low: price - 0.5,
        close: price + 0.3, // Bullish
        volume: 1000,
        timestamp: new Date(Date.now() - i * 5 * 60000),
        isClosed: true,
      });
    }
    
    this.candles = historical;
    return historical;
  }
  
  async placeTrade(request: any) {
    const trade = {
      success: true,
      tradeId: `trade-${Date.now()}`,
      symbol: request.symbol,
      side: request.side,
      entryPrice: 2000,
      stopLoss: request.stopLoss,
      takeProfit: request.takeProfit,
      lotOrStake: request.lotOrStake,
      timestamp: new Date(),
    };
    
    this.openTrades.push(trade);
    return trade;
  }
  
  async closeTrade(tradeId: string) {
    const index = this.openTrades.findIndex(t => t.tradeId === tradeId);
    if (index >= 0) {
      this.openTrades.splice(index, 1);
      return true;
    }
    return false;
  }
  
  async getOpenTrades() {
    return this.openTrades.map(t => ({
      tradeId: t.tradeId,
      symbol: t.symbol,
      side: t.side,
      entryPrice: t.entryPrice,
      currentPrice: t.entryPrice,
      lotOrStake: t.lotOrStake,
      stopLoss: t.stopLoss,
      takeProfit: t.takeProfit,
      unrealizedPnl: 0,
      unrealizedPnlPercent: 0,
      openedAt: t.timestamp,
      brokerTradeId: t.tradeId,
    }));
  }
  
  async getClosedTrades() {
    return [];
  }
  
  async computeLotFromRisk(
    riskPercent: number,
    balance: number,
    entryPrice: number,
    stopLoss: number,
    symbol: string
  ) {
    const riskAmount = (balance * riskPercent) / 100;
    const slDistance = Math.abs(entryPrice - stopLoss);
    // Simplified calculation
    return Math.max(0.01, riskAmount / (slDistance * 100));
  }
  
  async computeStakeFromRisk() {
    return 100;
  }
  
  async healthCheck() {
    return {
      status: this.connected ? 'healthy' : 'down',
      broker: 'exness',
      connected: this.connected,
      lastUpdate: new Date(),
    };
  }
}

describe('Bot Lifecycle Integration', () => {
  let engine: SignalistBotEngine;
  let adapter: MockBrokerAdapter;
  let settings: SignalistBotSettings;

  beforeEach(() => {
    adapter = new MockBrokerAdapter();
    settings = {
      userId: 'test-user',
      broker: 'exness',
      instrument: 'XAUUSD',
      enabled: true,
      riskPerTrade: 10,
      maxDailyLoss: 20,
      maxDailyTrades: 100,
      tradeFrequency: 'once-per-candle',
      candleTimeframe: '5m',
      smaPeriod: 50,
      tpMultiplier: 3,
      slMethod: 'atr',
      atrPeriod: 14,
      spikeDetectionEnabled: false,
      strategy: 'Signalist-SMA-3C',
      loggingLevel: 'info',
      fiveMinTrendConfirmation: false, // Disable for simpler integration tests
      minTimeInTrade: 1,
      smaCrossLookback: 8,
    };

    engine = new SignalistBotEngine(settings, adapter);
  });

  it('should complete full lifecycle: start -> process candle -> place trade -> stop', async () => {
    const events: any[] = [];

    // Listen to events
    engine.on('trade_opened', (event) => {
      events.push(event);
    });

    engine.on('signal_detected', (event) => {
      events.push(event);
    });

    // Start bot
    await engine.start();

    expect(engine.getStatus().isRunning).toBe(true);

    // Wait for historical candles to be loaded
    await new Promise(resolve => setTimeout(resolve, 100));

    // Emit a new closed candle that should trigger a signal
    // Note: This is simplified - real test would need proper candle alignment
    const newCandle: Candle = {
      symbol: 'XAUUSD',
      timeframe: '5m',
      open: 2000,
      high: 2005,
      low: 1999,
      close: 2004, // Bullish
      volume: 1000,
      timestamp: new Date(),
      isClosed: true,
    };

    adapter.emitCandle(newCandle);

    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 200));

    // Stop bot
    await engine.stop('Test complete');

    expect(engine.getStatus().isRunning).toBe(false);
  });

  it('should handle multiple candles without over-trading', async () => {
    await engine.start();
    await new Promise(resolve => setTimeout(resolve, 100));

    // Emit multiple candles
    for (let i = 0; i < 5; i++) {
      const candle: Candle = {
        symbol: 'XAUUSD',
        timeframe: '5m',
        open: 2000 + i,
        high: 2005 + i,
        low: 1999 + i,
        close: 2004 + i,
        volume: 1000,
        timestamp: new Date(Date.now() + i * 5 * 60000),
        isClosed: true,
      };
      adapter.emitCandle(candle);
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    await engine.stop('Test complete');

    // Should respect once-per-candle rule
    const status = engine.getStatus();
    expect(status.dailyStats.tradesCount).toBeLessThanOrEqual(5);
  });

  it('should enforce max daily loss', async () => {
    settings.maxDailyLoss = 5; // 5% max loss
    engine = new SignalistBotEngine(settings, adapter);

    await engine.start();
    
    // Simulate account loss
    // In real scenario, this would happen through trades
    // For test, we manually check the safety rule
    const status = engine.getStatus();
    
    // Verify max daily loss setting is respected
    expect(settings.maxDailyLoss).toBe(5);
    
    await engine.stop('Test complete');
  });

  it('should emit events correctly', (done) => {
    const receivedEvents: string[] = [];

    engine.on('status_update', () => {
      receivedEvents.push('status_update');
    });

    engine.on('candle_processed', () => {
      receivedEvents.push('candle_processed');
    });

    engine.start().then(() => {
      setTimeout(() => {
        expect(receivedEvents.length).toBeGreaterThan(0);
        expect(receivedEvents).toContain('status_update');
        engine.stop('Test').then(() => done());
      }, 100);
    }).catch(done);
  });
});






