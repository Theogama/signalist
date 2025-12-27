/**
 * Integration Test: Trade Reconciliation Service
 * Tests trade reconciliation workflow and integration with Deriv API
 */

import { tradeReconciliationService } from '../../trade-reconciliation.service';
import { SignalistBotTrade } from '@/database/models/signalist-bot-trade.model';
import { DerivApiToken } from '@/database/models/deriv-api-token.model';
import { DerivServerWebSocketClient } from '@/lib/deriv/server-websocket-client';

// Mock dependencies
jest.mock('@/database/mongoose', () => ({
  connectToDatabase: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/database/models/signalist-bot-trade.model', () => ({
  SignalistBotTrade: {
    find: jest.fn(),
  },
}));

jest.mock('@/database/models/deriv-api-token.model', () => ({
  DerivApiToken: {
    findOne: jest.fn(),
  },
}));

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

describe('Trade Reconciliation Integration', () => {
  const userId = 'test-user-reconciliation';

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Stop reconciliation if running
    if (tradeReconciliationService.getStatus().isRunning) {
      tradeReconciliationService.stop();
    }
  });

  afterEach(() => {
    tradeReconciliationService.stop();
  });

  describe('Reconciliation Service Lifecycle', () => {
    it('should start and stop reconciliation service', () => {
      // Start
      tradeReconciliationService.start(10000);
      expect(tradeReconciliationService.getStatus().isRunning).toBe(true);

      // Stop
      tradeReconciliationService.stop();
      expect(tradeReconciliationService.getStatus().isRunning).toBe(false);
    });

    it('should return correct status information', () => {
      const intervalMs = 15000;
      tradeReconciliationService.start(intervalMs);

      const status = tradeReconciliationService.getStatus();
      expect(status.isRunning).toBe(true);
      expect(status.intervalMs).toBe(intervalMs);

      tradeReconciliationService.stop();
    });
  });

  describe('User-Level Reconciliation', () => {
    it('should reconcile trades for a user with no open trades', async () => {
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

  describe('All-Users Reconciliation', () => {
    it('should reconcile trades for all users', async () => {
      // Mock no open trades
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

    it('should handle errors during all-users reconciliation', async () => {
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

  describe('Periodic Reconciliation', () => {
    it('should run reconciliation periodically when started', (done) => {
      let callCount = 0;
      const originalReconcileAll = tradeReconciliationService.reconcileAll.bind(tradeReconciliationService);
      
      // Mock reconcileAll to track calls
      tradeReconciliationService.reconcileAll = jest.fn().mockImplementation(async () => {
        callCount++;
        if (callCount >= 2) {
          tradeReconciliationService.stop();
          done();
        }
        return originalReconcileAll();
      });

      // Mock database to return empty results
      (SignalistBotTrade.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      });

      // Start with short interval for testing (500ms)
      tradeReconciliationService.start(500);

      // Note: This test relies on the interval firing, which may be flaky
      // In a real scenario, we'd use jest.useFakeTimers() for better control
    }, 10000); // Extended timeout for this test
  });
});

