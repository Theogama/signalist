/**
 * Trade Reconciliation Service Tests
 * Tests for Phase 2 trade reconciliation implementation
 */

import { tradeReconciliationService } from '../trade-reconciliation.service';
import { SignalistBotTrade } from '@/database/models/signalist-bot-trade.model';
import { DerivApiToken } from '@/database/models/deriv-api-token.model';
import { DerivServerWebSocketClient } from '@/lib/deriv/server-websocket-client';

// Mock dependencies
jest.mock('@/database/mongoose');
jest.mock('@/database/models/signalist-bot-trade.model');
jest.mock('@/database/models/deriv-api-token.model');
jest.mock('@/lib/deriv/server-websocket-client');
jest.mock('@/lib/utils/encryption', () => ({
  decrypt: jest.fn((token: string) => `decrypted-${token}`),
}));
jest.mock('@/lib/services/trade-logging.service', () => ({
  tradeLoggingService: {
    updateTradeResult: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('@/lib/auto-trading/log-emitter/LogEmitter', () => ({
  logEmitter: {
    warning: jest.fn(),
    error: jest.fn(),
  },
}));

describe('TradeReconciliationService', () => {
  const userId = 'test-user-id';
  const brokerTradeId = 'broker-trade-123';
  const tradeId = 'trade-123';

  beforeEach(() => {
    jest.clearAllMocks();
    // Stop reconciliation if running
    if (tradeReconciliationService.getStatus().isRunning) {
      tradeReconciliationService.stop();
    }
  });

  afterEach(() => {
    // Stop reconciliation after each test
    tradeReconciliationService.stop();
  });

  describe('start', () => {
    it('should start periodic reconciliation', () => {
      const intervalMs = 10000; // 10 seconds for testing
      
      tradeReconciliationService.start(intervalMs);
      
      const status = tradeReconciliationService.getStatus();
      expect(status.isRunning).toBe(true);
      expect(status.intervalMs).toBe(intervalMs);
      
      tradeReconciliationService.stop();
    });

    it('should use default interval if not provided', () => {
      tradeReconciliationService.start();
      
      const status = tradeReconciliationService.getStatus();
      expect(status.isRunning).toBe(true);
      expect(status.intervalMs).toBeGreaterThan(0);
      
      tradeReconciliationService.stop();
    });

    it('should not start if already running', () => {
      tradeReconciliationService.start(10000);
      const firstStatus = tradeReconciliationService.getStatus();
      
      tradeReconciliationService.start(20000); // Try to start again with different interval
      const secondStatus = tradeReconciliationService.getStatus();
      
      // Should still be running with original interval
      expect(firstStatus.isRunning).toBe(true);
      expect(secondStatus.isRunning).toBe(true);
      
      tradeReconciliationService.stop();
    });
  });

  describe('stop', () => {
    it('should stop periodic reconciliation', () => {
      tradeReconciliationService.start(10000);
      expect(tradeReconciliationService.getStatus().isRunning).toBe(true);
      
      tradeReconciliationService.stop();
      expect(tradeReconciliationService.getStatus().isRunning).toBe(false);
    });

    it('should handle stop when not running', () => {
      // Should not throw when stopping if not running
      expect(() => tradeReconciliationService.stop()).not.toThrow();
    });
  });

  describe('getStatus', () => {
    it('should return correct status when not running', () => {
      const status = tradeReconciliationService.getStatus();
      
      expect(status.isRunning).toBe(false);
      expect(status.intervalMs).toBeGreaterThan(0);
    });

    it('should return correct status when running', () => {
      const intervalMs = 15000;
      tradeReconciliationService.start(intervalMs);
      
      const status = tradeReconciliationService.getStatus();
      
      expect(status.isRunning).toBe(true);
      expect(status.intervalMs).toBe(intervalMs);
      
      tradeReconciliationService.stop();
    });
  });

  describe('reconcileUser', () => {
    it('should return result with no trades when user has no open trades', async () => {
      (SignalistBotTrade.find as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      });

      const result = await tradeReconciliationService.reconcileUser(userId);

      expect(result.userId).toBe(userId);
      expect(result.checked).toBe(0);
      expect(result.closed).toBe(0);
      expect(result.errors).toBe(0);
      expect(result.details).toEqual([]);
    });

    it('should handle reconciliation errors gracefully', async () => {
      (SignalistBotTrade.find as jest.Mock).mockReturnValue({
        lean: jest.fn().mockRejectedValue(new Error('Database error')),
      });

      // Should not throw
      await expect(
        tradeReconciliationService.reconcileUser(userId)
      ).resolves.toMatchObject({
        userId,
        errors: expect.any(Number),
      });
    });
  });

  describe('reconcileAll', () => {
    it('should reconcile all users with open trades', async () => {
      // Mock empty trades
      (SignalistBotTrade.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      });

      const result = await tradeReconciliationService.reconcileAll();

      expect(result.totalUsers).toBe(0);
      expect(result.totalTradesChecked).toBe(0);
      expect(result.totalTradesClosed).toBe(0);
      expect(result.totalErrors).toBe(0);
      expect(result.results).toEqual([]);
    });

    it('should handle errors gracefully', async () => {
      (SignalistBotTrade.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockRejectedValue(new Error('Database error')),
      });

      // Should not throw
      await expect(
        tradeReconciliationService.reconcileAll()
      ).resolves.toMatchObject({
        totalUsers: expect.any(Number),
        totalTradesChecked: expect.any(Number),
      });
    });
  });
});

