/**
 * Unit tests for broker adapters
 */

import { MT5Adapter } from '../adapters/mt5-adapter';
import { DerivAdapter } from '../adapters/deriv-adapter';
import { BrokerAdapterConfig } from '../types';

// Mock fetch for API calls
global.fetch = jest.fn();

describe('MT5Adapter', () => {
  let adapter: MT5Adapter;
  const config: BrokerAdapterConfig = {
    broker: 'exness',
    mt5Login: 12345678,
    mt5Password: 'test-password',
    mt5Server: 'Exness-MT5Real',
    mt5MagicNumber: 2025,
  };

  beforeEach(() => {
    adapter = new MT5Adapter();
    (fetch as jest.Mock).mockClear();
  });

  describe('Initialization', () => {
    it('should initialize with correct config', async () => {
      await adapter.initialize(config);
      expect(adapter.getBrokerType()).toBe('exness');
    });

    it('should throw error if credentials missing', async () => {
      const invalidConfig: BrokerAdapterConfig = {
        broker: 'exness',
      };

      await expect(adapter.initialize(invalidConfig)).rejects.toThrow(
        'MT5 credentials are required'
      );
    });
  });

  describe('Connection', () => {
    it('should connect successfully', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        json: async () => ({
          success: true,
          connection_id: 'test-connection-123',
        }),
      });

      await adapter.initialize(config);
      const connected = await adapter.connect();

      expect(connected).toBe(true);
      expect(adapter.isConnected()).toBe(true);
    });

    it('should handle connection failure', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        json: async () => ({
          success: false,
          error: 'Connection failed',
        }),
      });

      await adapter.initialize(config);
      
      await expect(adapter.connect()).rejects.toThrow();
    });
  });

  describe('Account Info', () => {
    it('should get account info successfully', async () => {
      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          json: async () => ({
            success: true,
            connection_id: 'test-connection-123',
          }),
        })
        .mockResolvedValueOnce({
          json: async () => ({
            success: true,
            account: {
              balance: 10000,
              equity: 10000,
              margin: 0,
              free_margin: 10000,
              margin_level: 0,
              currency: 'USD',
              leverage: 100,
            },
          }),
        });

      await adapter.initialize(config);
      await adapter.connect();

      const accountInfo = await adapter.getAccountInfo();

      expect(accountInfo.balance).toBe(10000);
      expect(accountInfo.currency).toBe('USD');
    });
  });

  describe('Position Sizing', () => {
    it('should calculate lot size from risk', async () => {
      await adapter.initialize(config);

      const lotSize = await adapter.computeLotFromRisk(
        10, // 10% risk
        10000, // balance
        2000, // entry price
        1990, // stop loss
        'XAUUSD'
      );

      expect(lotSize).toBeGreaterThan(0);
      expect(lotSize).toBeLessThanOrEqual(100); // Max lot
      expect(lotSize).toBeGreaterThanOrEqual(0.01); // Min lot
    });
  });

  describe('Health Check', () => {
    it('should return healthy status when connected', async () => {
      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          json: async () => ({
            success: true,
            connection_id: 'test-connection-123',
          }),
        })
        .mockResolvedValueOnce({
          json: async () => ({
            success: true,
            account: {
              balance: 10000,
              equity: 10000,
              margin: 0,
              free_margin: 10000,
              margin_level: 0,
              currency: 'USD',
              leverage: 100,
            },
          }),
        });

      await adapter.initialize(config);
      await adapter.connect();

      const health = await adapter.healthCheck();

      expect(health.status).toBe('healthy');
      expect(health.connected).toBe(true);
    });

    it('should return down status when not connected', async () => {
      await adapter.initialize(config);

      const health = await adapter.healthCheck();

      expect(health.status).toBe('down');
      expect(health.connected).toBe(false);
    });
  });
});

describe('DerivAdapter', () => {
  let adapter: DerivAdapter;
  const config: BrokerAdapterConfig = {
    broker: 'deriv',
    derivToken: 'test-token',
  };

  beforeEach(() => {
    adapter = new DerivAdapter();
    // Mock WebSocket
    global.WebSocket = jest.fn() as any;
  });

  describe('Initialization', () => {
    it('should initialize with correct config', async () => {
      await adapter.initialize(config);
      expect(adapter.getBrokerType()).toBe('deriv');
    });

    it('should throw error if token missing', async () => {
      const invalidConfig: BrokerAdapterConfig = {
        broker: 'deriv',
      };

      await expect(adapter.initialize(invalidConfig)).rejects.toThrow(
        'Deriv token is required'
      );
    });
  });

  describe('Position Sizing', () => {
    it('should calculate stake from risk for Deriv', async () => {
      await adapter.initialize(config);

      const stake = await adapter.computeStakeFromRisk(
        10, // 10% risk
        10000, // balance
        'BOOM1000'
      );

      expect(stake).toBeGreaterThanOrEqual(1); // Min stake
      expect(stake).toBeLessThanOrEqual(1000); // 10% of 10000
    });

    it('should throw error for computeLotFromRisk (not applicable)', async () => {
      await adapter.initialize(config);

      await expect(
        adapter.computeLotFromRisk(10, 10000, 2000, 1990, 'BOOM1000')
      ).rejects.toThrow('not applicable');
    });
  });

  describe('Health Check', () => {
    it('should return status based on connection state', async () => {
      await adapter.initialize(config);

      const health = await adapter.healthCheck();

      expect(health.broker).toBe('deriv');
      expect(['healthy', 'degraded', 'down']).toContain(health.status);
    });
  });
});




