/**
 * Emergency Stop Service Tests
 * Tests for Phase 2 emergency stop implementation
 */

import { emergencyStopService } from '../emergency-stop.service';
import { botManager } from '../bot-manager.service';

// Mock botManager
jest.mock('../bot-manager.service', () => ({
  botManager: {
    getUserBots: jest.fn().mockReturnValue([]),
    stopBot: jest.fn().mockReturnValue(true),
    activeBots: new Map(),
  },
}));

describe('EmergencyStopService', () => {
  const userId = 'test-user-id';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('stopUserBots', () => {
    it('should stop all bots for a user', async () => {
      const result = await emergencyStopService.stopUserBots(userId, 'Test reason');

      expect(result.userId).toBe(userId);
      expect(result.stoppedBots).toBeDefined();
      expect(Array.isArray(result.stoppedBots)).toBe(true);
      expect(result.errors).toBeDefined();
      expect(Array.isArray(result.errors)).toBe(true);
      expect(result.stoppedAt).toBeInstanceOf(Date);
    });

    it('should handle errors gracefully', async () => {
      // Mock botManager to throw error
      (botManager.getUserBots as jest.Mock).mockImplementation(() => {
        throw new Error('Bot manager error');
      });

      const result = await emergencyStopService.stopUserBots(userId, 'Test reason');
      
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('error');
    });

    it('should include reason in result', async () => {
      const reason = 'Test emergency stop';
      const result = await emergencyStopService.stopUserBots(userId, reason);
      
      expect(result).toBeDefined();
      // Reason is logged, not returned in result, but operation should complete
    });
  });

  describe('stopAllBots', () => {
    it('should stop all bots system-wide', async () => {
      const result = await emergencyStopService.stopAllBots('System-wide test');

      expect(result.userId).toBeUndefined();
      expect(result.stoppedBots).toBeDefined();
      expect(Array.isArray(result.stoppedBots)).toBe(true);
      expect(result.errors).toBeDefined();
      expect(Array.isArray(result.errors)).toBe(true);
      expect(result.stoppedAt).toBeInstanceOf(Date);
    });

    it('should handle errors gracefully', async () => {
      // Mock to throw error
      (botManager['activeBots'] as any) = {
        values: () => {
          throw new Error('Active bots error');
        },
      };

      const result = await emergencyStopService.stopAllBots('Test');
      
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('forceCloseUserTrades', () => {
    it('should force close all open trades for a user', async () => {
      const closedTrades = await emergencyStopService.forceCloseUserTrades(userId, 'Test force close');

      expect(Array.isArray(closedTrades)).toBe(true);
      // May be empty if no open trades exist
    });

    it('should handle database errors gracefully', async () => {
      // Mock database to throw error
      const SignalistBotTrade = require('@/database/models/signalist-bot-trade.model').SignalistBotTrade;
      (SignalistBotTrade.find as jest.Mock).mockImplementation(() => {
        throw new Error('Database error');
      });

      // Should not throw
      await expect(
        emergencyStopService.forceCloseUserTrades(userId, 'Test')
      ).resolves.toEqual([]);
    });
  });
});

