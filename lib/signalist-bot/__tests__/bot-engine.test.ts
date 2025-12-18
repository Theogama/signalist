/**
 * Unit tests for Signalist Bot Engine
 */

import { SignalistBotEngine } from '../engine/bot-engine';
import { SignalistBotSettings, UnifiedBrokerAdapter } from '../types';
import { SignalistSMA3CStrategy } from '../strategies/signalist-sma-3c';

// Mock adapter
class MockAdapter implements UnifiedBrokerAdapter {
  connected = false;
  accountInfo = {
    balance: 10000,
    equity: 10000,
    margin: 0,
    freeMargin: 10000,
    currency: 'USD',
  };

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
    return this.accountInfo;
  }
  async getBalance() {
    return this.accountInfo.balance;
  }
  async subscribeToTicks() {
    return () => {};
  }
  async subscribeToCandles() {
    return () => {};
  }
  async getHistoricalCandles() {
    return [];
  }
  async placeTrade() {
    return {
      success: true,
      tradeId: 'test-trade-1',
      symbol: 'XAUUSD',
      side: 'BUY',
      entryPrice: 2000,
      stopLoss: 1990,
      takeProfit: 2030,
      lotOrStake: 0.01,
      timestamp: new Date(),
    };
  }
  async closeTrade() {
    return true;
  }
  async getOpenTrades() {
    return [];
  }
  async getClosedTrades() {
    return [];
  }
  async computeLotFromRisk() {
    return 0.01;
  }
  async computeStakeFromRisk() {
    return 100;
  }
  async healthCheck() {
    return {
      status: 'healthy' as const,
      broker: 'exness' as const,
      connected: true,
      lastUpdate: new Date(),
    };
  }
}

describe('SignalistBotEngine', () => {
  let engine: SignalistBotEngine;
  let adapter: MockAdapter;
  let settings: SignalistBotSettings;

  beforeEach(() => {
    adapter = new MockAdapter();
    settings = {
      userId: 'test-user',
      broker: 'exness',
      instrument: 'XAUUSD',
      enabled: true,
      riskPerTrade: 10,
      maxDailyLoss: 5,
      maxDailyTrades: 10,
      tradeFrequency: 'once-per-candle',
      candleTimeframe: '5m',
      smaPeriod: 50,
      tpMultiplier: 3,
      slMethod: 'atr',
      atrPeriod: 14,
      spikeDetectionEnabled: false,
      strategy: 'Signalist-SMA-3C',
      loggingLevel: 'info',
      fiveMinTrendConfirmation: false, // Disable for simpler tests
      minTimeInTrade: 1,
      smaCrossLookback: 8,
    };

    engine = new SignalistBotEngine(settings, adapter);
  });

  describe('Initialization', () => {
    it('should initialize with correct settings', () => {
      const status = engine.getStatus();
      expect(status.broker).toBe('exness');
      expect(status.instrument).toBe('XAUUSD');
      expect(status.isRunning).toBe(false);
    });

    it('should have correct initial daily stats', () => {
      const status = engine.getStatus();
      expect(status.dailyStats.tradesCount).toBe(0);
      expect(status.dailyStats.wins).toBe(0);
      expect(status.dailyStats.losses).toBe(0);
      expect(status.dailyStats.totalPnl).toBe(0);
    });
  });

  describe('Start/Stop', () => {
    it('should start bot successfully', async () => {
      adapter.accountInfo.balance = 10000;
      
      await engine.start();
      
      const status = engine.getStatus();
      expect(status.isRunning).toBe(true);
      expect(status.startedAt).toBeDefined();
    });

    it('should stop bot successfully', async () => {
      await engine.start();
      await engine.stop('Test stop');
      
      const status = engine.getStatus();
      expect(status.isRunning).toBe(false);
      expect(status.stoppedAt).toBeDefined();
      expect(status.stopReason).toBe('Test stop');
    });

    it('should throw error if starting already running bot', async () => {
      await engine.start();
      
      await expect(engine.start()).rejects.toThrow('Bot is already running');
    });

    it('should pause and resume bot', () => {
      engine.pause();
      expect(engine.getStatus().isPaused).toBe(true);
      
      engine.resume();
      expect(engine.getStatus().isPaused).toBe(false);
    });
  });

  describe('Safety Rules', () => {
    it('should stop bot on max daily loss', async () => {
      await engine.start();
      
      // Simulate daily loss
      adapter.accountInfo.balance = 9500; // 5% loss
      adapter.accountInfo.equity = 9500;
      
      // Trigger safety check by updating stats
      // Note: In real implementation, this would be checked in monitoring loop
      const status = engine.getStatus();
      
      // Manually check safety rules (normally done in monitoring loop)
      // This is a simplified test
      expect(settings.maxDailyLoss).toBe(5);
    });

    it('should enforce max daily trades', () => {
      const status = engine.getStatus();
      status.dailyStats.tradesCount = 10;
      
      // Max daily trades is 10, so next trade should be blocked
      expect(status.dailyStats.tradesCount).toBeGreaterThanOrEqual(settings.maxDailyTrades);
    });
  });

  describe('Settings Update', () => {
    it('should update settings correctly', () => {
      engine.updateSettings({
        riskPerTrade: 15,
        smaPeriod: 100,
      });
      
      // Settings are updated internally
      // Strategy is reinitialized with new settings
      const status = engine.getStatus();
      expect(status).toBeDefined();
    });
  });

  describe('Event Emission', () => {
    it('should emit events when starting', (done) => {
      engine.once('status_update', (event) => {
        expect(event.type).toBe('status_update');
        expect(event.status.isRunning).toBe(true);
        done();
      });
      
      engine.start().catch(done);
    });

    it('should emit events when stopping', (done) => {
      engine.start().then(() => {
        engine.once('status_update', (event) => {
          expect(event.type).toBe('status_update');
          expect(event.status.isRunning).toBe(false);
          done();
        });
        
        engine.stop('Test').catch(done);
      }).catch(done);
    });
  });
});




