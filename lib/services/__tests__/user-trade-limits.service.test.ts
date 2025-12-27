/**
 * User Trade Limits Service Tests
 * Tests for Phase 2 user trade limits implementation
 */

import { userTradeLimitsService, UserTradeLimits } from '../user-trade-limits.service';
import { connectToDatabase } from '@/database/mongoose';

// Mock the database and models
jest.mock('@/database/mongoose');
jest.mock('@/database/models/signalist-bot-trade.model', () => ({
  SignalistBotTrade: {
    find: jest.fn(),
  },
}));

import { SignalistBotTrade } from '@/database/models/signalist-bot-trade.model';

describe('UserTradeLimitsService', () => {
  const userId = 'test-user-id';

  beforeEach(() => {
    jest.clearAllMocks();
    userTradeLimitsService.setUserLimits(userId, {
      maxTradesPerDay: 10,
      maxDailyLossPercent: 20,
      maxConcurrentTrades: 3,
      enabled: true,
    });
  });

  afterEach(() => {
    // Reset limits after each test
    userTradeLimitsService.setUserLimits(userId, {
      enabled: false,
    });
  });

  describe('setUserLimits', () => {
    it('should set user limits correctly', () => {
      const limits: Partial<UserTradeLimits> = {
        maxTradesPerDay: 50,
        maxDailyLossPercent: 15,
        maxConcurrentTrades: 5,
        enabled: true,
      };

      userTradeLimitsService.setUserLimits(userId, limits);
      const userLimits = userTradeLimitsService.getUserLimits(userId);

      expect(userLimits.maxTradesPerDay).toBe(50);
      expect(userLimits.maxDailyLossPercent).toBe(15);
      expect(userLimits.maxConcurrentTrades).toBe(5);
      expect(userLimits.enabled).toBe(true);
    });

    it('should merge with existing limits', () => {
      // Set initial limits
      userTradeLimitsService.setUserLimits(userId, {
        maxTradesPerDay: 100,
        enabled: true,
      });

      // Update only maxConcurrentTrades
      userTradeLimitsService.setUserLimits(userId, {
        maxConcurrentTrades: 10,
      });

      const limits = userTradeLimitsService.getUserLimits(userId);
      expect(limits.maxTradesPerDay).toBe(100); // Should still be 100
      expect(limits.maxConcurrentTrades).toBe(10); // Should be updated
    });
  });

  describe('getUserLimits', () => {
    it('should return default limits when none set', () => {
      const newUserId = 'new-user-id';
      const limits = userTradeLimitsService.getUserLimits(newUserId);

      expect(limits.maxTradesPerDay).toBe(100); // Default
      expect(limits.maxDailyLossPercent).toBe(20); // Default
      expect(limits.maxConcurrentTrades).toBe(5); // Default
      expect(limits.enabled).toBe(true);
    });

    it('should return configured limits', () => {
      userTradeLimitsService.setUserLimits(userId, {
        maxTradesPerDay: 25,
        maxDailyLossPercent: 10,
        maxConcurrentTrades: 2,
        enabled: true,
      });

      const limits = userTradeLimitsService.getUserLimits(userId);
      expect(limits.maxTradesPerDay).toBe(25);
      expect(limits.maxDailyLossPercent).toBe(10);
      expect(limits.maxConcurrentTrades).toBe(2);
    });
  });

  describe('canExecuteTrade', () => {
    beforeEach(() => {
      // Mock database queries
      (SignalistBotTrade.find as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      });
    });

    it('should allow trade when limits are disabled', async () => {
      userTradeLimitsService.setUserLimits(userId, { enabled: false });

      const result = await userTradeLimitsService.canExecuteTrade(userId, 100);
      expect(result.allowed).toBe(true);
    });

    it('should allow trade when within limits', async () => {
      // Mock: 0 trades today, 0 concurrent trades
      (SignalistBotTrade.find as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      });

      const result = await userTradeLimitsService.canExecuteTrade(userId, 100);
      expect(result.allowed).toBe(true);
    });

    it('should block trade when daily limit exceeded', async () => {
      userTradeLimitsService.setUserLimits(userId, {
        maxTradesPerDay: 5,
        enabled: true,
      });

      // Mock: 5 trades today (at limit)
      const mockTrades = Array(5).fill({});
      (SignalistBotTrade.find as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockTrades),
      });

      const result = await userTradeLimitsService.canExecuteTrade(userId, 100);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Daily trade limit reached');
    });

    it('should block trade when concurrent limit exceeded', async () => {
      userTradeLimitsService.setUserLimits(userId, {
        maxConcurrentTrades: 2,
        enabled: true,
      });

      // Mock: 2 open trades (at limit)
      const mockOpenTrades = Array(2).fill({ status: 'OPEN' });
      (SignalistBotTrade.find as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockOpenTrades),
      });

      const result = await userTradeLimitsService.canExecuteTrade(userId, 100);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Maximum concurrent trades limit reached');
    });
  });

  describe('getUserLimitsStatus', () => {
    it('should return correct status with no trades', async () => {
      (SignalistBotTrade.find as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      });

      const status = await userTradeLimitsService.getUserLimitsStatus(userId);

      expect(status.userId).toBe(userId);
      expect(status.current.tradesToday).toBe(0);
      expect(status.current.concurrentTrades).toBe(0);
      expect(status.exceeded.tradesPerDay).toBe(false);
      expect(status.exceeded.concurrentTrades).toBe(false);
    });

    it('should calculate daily trades correctly', async () => {
      const mockTrades = Array(3).fill({});
      (SignalistBotTrade.find as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockTrades),
      });

      const status = await userTradeLimitsService.getUserLimitsStatus(userId);
      expect(status.current.tradesToday).toBe(3);
    });

    it('should flag exceeded limits correctly', async () => {
      userTradeLimitsService.setUserLimits(userId, {
        maxTradesPerDay: 5,
        enabled: true,
      });

      // Mock: 5 trades (at limit)
      const mockTrades = Array(5).fill({});
      (SignalistBotTrade.find as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockTrades),
      });

      const status = await userTradeLimitsService.getUserLimitsStatus(userId);
      expect(status.exceeded.tradesPerDay).toBe(true);
    });
  });
});

