/**
 * User Trade Limits Service
 * Enforces global per-user trade limits across all bots
 */

import { connectToDatabase } from '@/database/mongoose';
import { SignalistBotTrade } from '@/database/models/signalist-bot-trade.model';
import { logEmitter } from '@/lib/auto-trading/log-emitter/LogEmitter';
import { distributedLockService } from './distributed-lock.service';

export interface UserTradeLimits {
  maxTradesPerDay?: number;
  maxDailyLoss?: number; // Absolute amount or percentage of balance
  maxDailyLossPercent?: number; // Percentage of balance
  maxConcurrentTrades?: number;
  enabled: boolean;
}

export interface UserTradeLimitsStatus {
  userId: string;
  limits: UserTradeLimits;
  current: {
    tradesToday: number;
    lossToday: number;
    concurrentTrades: number;
    dailyBalance: number; // Starting balance for the day
  };
  exceeded: {
    tradesPerDay: boolean;
    dailyLoss: boolean;
    concurrentTrades: boolean;
  };
}

const DEFAULT_LIMITS: UserTradeLimits = {
  maxTradesPerDay: 100, // Default: 100 trades per day
  maxDailyLossPercent: 20, // Default: 20% of balance
  maxConcurrentTrades: 5, // Default: 5 concurrent trades
  enabled: true,
};

class UserTradeLimitsService {
  private userLimits: Map<string, UserTradeLimits> = new Map();
  private dailyCache: Map<string, {
    tradesToday: number;
    lossToday: number;
    dailyBalance: number;
    lastUpdate: Date;
  }> = new Map();

  /**
   * Set trade limits for a user
   */
  setUserLimits(userId: string, limits: Partial<UserTradeLimits>): void {
    const currentLimits = this.userLimits.get(userId) || { ...DEFAULT_LIMITS };
    this.userLimits.set(userId, {
      ...currentLimits,
      ...limits,
      enabled: limits.enabled !== undefined ? limits.enabled : currentLimits.enabled !== false,
    });
  }

  /**
   * Get trade limits for a user
   */
  getUserLimits(userId: string): UserTradeLimits {
    return this.userLimits.get(userId) || { ...DEFAULT_LIMITS };
  }

  /**
   * Check if user can execute a trade
   * 
   * @param userId - User ID
   * @param tradeAmount - Trade amount (for loss calculation)
   * @returns Promise<{ allowed: boolean; reason?: string }>
   */
  async canExecuteTrade(
    userId: string,
    tradeAmount: number = 0
  ): Promise<{ allowed: boolean; reason?: string }> {
    const limits = this.getUserLimits(userId);

    if (!limits.enabled) {
      return { allowed: true }; // Limits disabled
    }

    // Acquire lock to prevent race conditions
    const lockKey = `user-trade-limits:${userId}`;
    const lockAcquired = await distributedLockService.acquireLock(lockKey, {
      ttl: 5000,
      maxRetries: 3,
    });

    if (!lockAcquired) {
      // If we can't get lock, be conservative and block
      return { allowed: false, reason: 'Unable to verify trade limits (lock contention)' };
    }

    try {
      const status = await this.getUserLimitsStatus(userId);

      // Check concurrent trades limit
      if (limits.maxConcurrentTrades !== undefined) {
        if (status.current.concurrentTrades >= limits.maxConcurrentTrades) {
          await distributedLockService.releaseLock(lockKey);
          return {
            allowed: false,
            reason: `Maximum concurrent trades limit reached (${status.current.concurrentTrades}/${limits.maxConcurrentTrades})`,
          };
        }
      }

      // Check daily trades limit
      if (limits.maxTradesPerDay !== undefined) {
        if (status.current.tradesToday >= limits.maxTradesPerDay) {
          await distributedLockService.releaseLock(lockKey);
          return {
            allowed: false,
            reason: `Daily trade limit reached (${status.current.tradesToday}/${limits.maxTradesPerDay})`,
          };
        }
      }

      // Check daily loss limit (if we have daily balance)
      if (limits.maxDailyLossPercent !== undefined && status.current.dailyBalance > 0) {
        const maxLossAmount = (status.current.dailyBalance * limits.maxDailyLossPercent) / 100;
        if (Math.abs(status.current.lossToday) >= maxLossAmount) {
          await distributedLockService.releaseLock(lockKey);
          return {
            allowed: false,
            reason: `Daily loss limit reached (${status.current.lossToday.toFixed(2)}/${maxLossAmount.toFixed(2)})`,
          };
        }
      }

      if (limits.maxDailyLoss !== undefined) {
        if (Math.abs(status.current.lossToday) >= limits.maxDailyLoss) {
          await distributedLockService.releaseLock(lockKey);
          return {
            allowed: false,
            reason: `Daily loss limit reached (${status.current.lossToday.toFixed(2)}/${limits.maxDailyLoss})`,
          };
        }
      }

      return { allowed: true };
    } finally {
      await distributedLockService.releaseLock(lockKey);
    }
  }

  /**
   * Get current trade limits status for a user
   */
  async getUserLimitsStatus(userId: string): Promise<UserTradeLimitsStatus> {
    const limits = this.getUserLimits(userId);
    
    await connectToDatabase();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get today's trades
    const tradesToday = await SignalistBotTrade.find({
      userId,
      entryTimestamp: { $gte: today, $lt: tomorrow },
    }).lean();

    // Calculate daily loss (only from closed trades)
    const closedTradesToday = tradesToday.filter(t => 
      t.status !== 'OPEN' && t.realizedPnl !== undefined
    );
    const lossToday = closedTradesToday.reduce((sum, t) => sum + (t.realizedPnl || 0), 0);

    // Get concurrent open trades
    const concurrentTrades = tradesToday.filter(t => t.status === 'OPEN').length;

    // Get daily starting balance (from first trade of the day, or use a default)
    // In production, you'd want to track daily starting balance separately
    const firstTrade = tradesToday[0];
    const dailyBalance = firstTrade ? (firstTrade.entryPrice * (firstTrade.lotOrStake || 1)) * 10 : 10000; // Estimate

    const current = {
      tradesToday: tradesToday.length,
      lossToday,
      concurrentTrades,
      dailyBalance,
    };

    const exceeded = {
      tradesPerDay: limits.maxTradesPerDay !== undefined 
        ? current.tradesToday >= limits.maxTradesPerDay 
        : false,
      dailyLoss: (limits.maxDailyLossPercent !== undefined && dailyBalance > 0)
        ? Math.abs(current.lossToday) >= (dailyBalance * limits.maxDailyLossPercent) / 100
        : (limits.maxDailyLoss !== undefined)
        ? Math.abs(current.lossToday) >= limits.maxDailyLoss
        : false,
      concurrentTrades: limits.maxConcurrentTrades !== undefined
        ? current.concurrentTrades >= limits.maxConcurrentTrades
        : false,
    };

    return {
      userId,
      limits,
      current,
      exceeded,
    };
  }

  /**
   * Record a trade execution (for tracking)
   * This is called after a trade is executed
   */
  async recordTrade(userId: string, tradeId: string): Promise<void> {
    // Trade is already recorded in database, this is just for cache invalidation
    // Clear cache for this user so it refreshes on next check
    this.dailyCache.delete(userId);
  }

  /**
   * Reset daily limits (for testing/admin)
   */
  async resetDailyLimits(userId: string): Promise<void> {
    this.dailyCache.delete(userId);
  }

  /**
   * Get all users with limits configured
   */
  getUsersWithLimits(): string[] {
    return Array.from(this.userLimits.keys());
  }
}

// Export singleton instance
export const userTradeLimitsService = new UserTradeLimitsService();

