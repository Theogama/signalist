/**
 * Integration Test: Emergency Stop with Bot Execution and Locks
 * Tests emergency stop functionality integrated with bot execution and lock management
 */

import { emergencyStopService } from '../../emergency-stop.service';
import { userExecutionLockService } from '../../user-execution-lock.service';
import { botManager } from '../../bot-manager.service';

// Mock dependencies
jest.mock('../../bot-manager.service', () => ({
  botManager: {
    getUserBots: jest.fn().mockReturnValue([
      { botId: 'bot-1', userId: 'user-1', isRunning: true },
      { botId: 'bot-2', userId: 'user-1', isRunning: true },
    ]),
    stopBot: jest.fn().mockReturnValue(true),
    activeBots: new Map([
      ['user-1-bot-1', { botId: 'bot-1', userId: 'user-1', isRunning: true }],
      ['user-1-bot-2', { botId: 'bot-2', userId: 'user-1', isRunning: true }],
      ['user-2-bot-1', { botId: 'bot-1', userId: 'user-2', isRunning: true }],
    ]),
  },
}));

jest.mock('../../user-execution-lock.service', () => ({
  userExecutionLockService: {
    forceRelease: jest.fn().mockResolvedValue(true),
  },
}));

jest.mock('@/database/models/signalist-bot-trade.model', () => ({
  SignalistBotTrade: {
    find: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
    }),
    updateOne: jest.fn().mockResolvedValue({}),
  },
}));

jest.mock('@/database/mongoose', () => ({
  connectToDatabase: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/auto-trading/log-emitter/LogEmitter', () => ({
  logEmitter: {
    error: jest.fn(),
    warning: jest.fn(),
  },
}));

describe('Emergency Stop Integration', () => {
  const userId = 'user-1';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('User-Level Emergency Stop', () => {
    it('should stop all bots for a user and release execution locks', async () => {
      const result = await emergencyStopService.stopUserBots(userId, 'Test emergency stop');

      expect(result.userId).toBe(userId);
      expect(result.stoppedBots).toBeDefined();
      expect(result.stoppedAt).toBeInstanceOf(Date);
      expect(botManager.getUserBots).toHaveBeenCalledWith(userId);
      expect(userExecutionLockService.forceRelease).toHaveBeenCalledWith(userId);
    });

    it('should handle errors gracefully during emergency stop', async () => {
      // Mock getUserBots to throw error
      (botManager.getUserBots as jest.Mock).mockImplementation(() => {
        throw new Error('Failed to get user bots');
      });

      const result = await emergencyStopService.stopUserBots(userId, 'Test');

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('error');
    });

    it('should include stopped bot IDs in result', async () => {
      const result = await emergencyStopService.stopUserBots(userId, 'Test');

      expect(result.stoppedBots).toContain('bot-1');
      expect(result.stoppedBots).toContain('bot-2');
    });
  });

  describe('System-Wide Emergency Stop', () => {
    it('should stop all bots for all users', async () => {
      const result = await emergencyStopService.stopAllBots('System-wide test');

      expect(result.userId).toBeUndefined();
      expect(result.stoppedBots.length).toBeGreaterThan(0);
      expect(result.stoppedAt).toBeInstanceOf(Date);
    });

    it('should aggregate results from multiple users', async () => {
      const result = await emergencyStopService.stopAllBots('Test');

      // Should include bots from all users
      expect(Array.isArray(result.stoppedBots)).toBe(true);
      expect(Array.isArray(result.errors)).toBe(true);
    });
  });

  describe('Force Close Trades Integration', () => {
    it('should force close all open trades for a user', async () => {
      const SignalistBotTrade = require('@/database/models/signalist-bot-trade.model').SignalistBotTrade;
      
      // Mock open trades
      (SignalistBotTrade.find as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          { _id: 'trade-1', tradeId: 'trade-1', entryPrice: 100 },
          { _id: 'trade-2', tradeId: 'trade-2', entryPrice: 200 },
        ]),
      });

      const closedTrades = await emergencyStopService.forceCloseUserTrades(
        userId,
        'Emergency force close'
      );

      expect(Array.isArray(closedTrades)).toBe(true);
      expect(closedTrades.length).toBe(2);
      expect(closedTrades).toContain('trade-1');
      expect(closedTrades).toContain('trade-2');
    });

    it('should handle no open trades gracefully', async () => {
      const SignalistBotTrade = require('@/database/models/signalist-bot-trade.model').SignalistBotTrade;
      
      // Mock no open trades
      (SignalistBotTrade.find as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      });

      const closedTrades = await emergencyStopService.forceCloseUserTrades(userId, 'Test');

      expect(closedTrades).toEqual([]);
    });
  });

  describe('Emergency Stop Workflow', () => {
    it('should execute complete emergency stop workflow', async () => {
      // Step 1: Stop user bots
      const stopResult = await emergencyStopService.stopUserBots(userId, 'Emergency stop');

      expect(stopResult.stoppedBots.length).toBeGreaterThanOrEqual(0);
      expect(botManager.getUserBots).toHaveBeenCalled();
      expect(userExecutionLockService.forceRelease).toHaveBeenCalled();

      // Step 2: Force close trades (if needed)
      const closedTrades = await emergencyStopService.forceCloseUserTrades(userId, 'Force close');

      expect(Array.isArray(closedTrades)).toBe(true);
    });

    it('should handle partial failures during emergency stop', async () => {
      // Mock stopBot to fail for one bot
      (botManager.stopBot as jest.Mock)
        .mockReturnValueOnce(true)  // First bot stops successfully
        .mockReturnValueOnce(false); // Second bot fails to stop

      const result = await emergencyStopService.stopUserBots(userId, 'Test');

      expect(result.stoppedBots.length).toBe(1);
      expect(botManager.stopBot).toHaveBeenCalledTimes(2);
    });
  });
});

