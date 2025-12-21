/**
 * Unit tests for ExnessAdapter
 */

import { ExnessAdapter } from '../adapters/ExnessAdapter';
import { BrokerConfig } from '../types';

describe('ExnessAdapter', () => {
  let adapter: ExnessAdapter;
  let config: BrokerConfig;

  beforeEach(() => {
    adapter = new ExnessAdapter();
    config = {
      apiKey: 'test_key',
      apiSecret: 'test_secret',
      environment: 'demo',
    };
  });

  describe('initialize', () => {
    it('should initialize adapter with config', async () => {
      await adapter.initialize(config);
      expect(adapter.isPaperTrading()).toBe(true);
    });
  });

  describe('mapSymbol', () => {
    it('should map XAUUSD correctly', async () => {
      await adapter.initialize(config);
      const mapped = adapter.mapSymbol('XAUUSD');
      expect(mapped).toBe('XAUUSD');
    });

    it('should map US30 correctly', async () => {
      await adapter.initialize(config);
      const mapped = adapter.mapSymbol('US30');
      expect(mapped).toBe('US30');
    });
  });

  describe('getBalance', () => {
    it('should return mock balance in paper trading mode', async () => {
      await adapter.initialize(config);
      const balance = await adapter.getBalance();
      expect(balance.balance).toBe(10000);
      expect(balance.currency).toBe('USD');
    });
  });

  describe('getMarketData', () => {
    it('should return market data in paper trading mode', async () => {
      await adapter.initialize(config);
      const data = await adapter.getMarketData('XAUUSD');
      expect(data.symbol).toBe('XAUUSD');
      expect(data.bid).toBeGreaterThan(0);
      expect(data.ask).toBeGreaterThan(0);
    });
  });

  describe('placeOrder', () => {
    it('should place paper trade order', async () => {
      await adapter.initialize(config);
      const order = await adapter.placeOrder({
        symbol: 'XAUUSD',
        side: 'BUY',
        type: 'MARKET',
        quantity: 0.01,
      });

      expect(order.orderId).toContain('PAPER-EXNESS');
      expect(order.status).toBe('FILLED');
      expect(order.symbol).toBe('XAUUSD');
    });
  });
});











