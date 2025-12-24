/**
 * Bot Risk Manager Service
 * 
 * Risk enforcement module for Signalist bots.
 * Enforces trading safety rules and auto-stops bots when limits are hit.
 * 
 * Features:
 * - Stop loss enforcement
 * - Take profit enforcement
 * - Max trades enforcement
 * - Auto-stop on limit violations
 * - Market closed handling
 * - API error handling
 * - Stop reason emission
 */

import { EventEmitter } from 'events';
import { connectToDatabase } from '@/database/mongoose';
import { SignalistBotTrade } from '@/database/models/signalist-bot-trade.model';
import { DerivMarketStatusService, MarketStatus } from '@/lib/services/deriv-market-status.service';

/**
 * Stop Reason Enum
 * Reasons why a bot was automatically stopped
 */
export enum BotStopReason {
  // Risk limit violations
  STOP_LOSS_HIT = 'STOP_LOSS_HIT',
  TAKE_PROFIT_HIT = 'TAKE_PROFIT_HIT',
  MAX_TRADES_REACHED = 'MAX_TRADES_REACHED',
  DAILY_LOSS_LIMIT = 'DAILY_LOSS_LIMIT',
  MAX_DRAWDOWN = 'MAX_DRAWDOWN',
  MAX_CONSECUTIVE_LOSSES = 'MAX_CONSECUTIVE_LOSSES',
  
  // Market conditions
  MARKET_CLOSED = 'MARKET_CLOSED',
  MARKET_SUSPENDED = 'MARKET_SUSPENDED',
  
  // API/Connection issues
  API_ERROR = 'API_ERROR',
  CONNECTION_LOST = 'CONNECTION_LOST',
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  
  // Manual/System
  MANUAL_STOP = 'MANUAL_STOP',
  SYSTEM_ERROR = 'SYSTEM_ERROR',
}

/**
 * Risk Settings
 * Configuration for risk enforcement
 */
export interface BotRiskSettings {
  // Stop loss settings
  stopLossEnabled: boolean;
  stopLossAmount?: number; // Absolute amount
  stopLossPercent?: number; // Percentage of stake
  
  // Take profit settings
  takeProfitEnabled: boolean;
  takeProfitAmount?: number; // Absolute amount
  takeProfitPercent?: number; // Percentage of stake
  
  // Trade limits
  maxTradesPerDay: number;
  maxTradesPerHour?: number;
  
  // Loss limits
  maxDailyLoss: number; // Absolute amount
  maxDailyLossPercent?: number; // Percentage of starting balance
  
  // Drawdown limits
  maxDrawdownPercent?: number; // Maximum drawdown percentage
  
  // Consecutive loss limits
  maxConsecutiveLosses?: number;
  
  // Balance limits
  minBalance?: number; // Minimum balance to continue trading
}

/**
 * Risk Check Result
 * Result of a risk check operation
 */
export interface RiskCheckResult {
  allowed: boolean;
  shouldStop: boolean;
  reason?: BotStopReason;
  message?: string;
  metrics?: {
    currentLoss: number;
    currentProfit: number;
    dailyTradeCount: number;
    dailyProfitLoss: number;
    currentDrawdown: number;
    consecutiveLosses: number;
  };
}

/**
 * Bot Stop Event
 * Event emitted when a bot is stopped
 */
export interface BotStopEvent {
  botId: string;
  userId: string;
  reason: BotStopReason;
  message: string;
  timestamp: Date;
  metrics?: RiskCheckResult['metrics'];
}

/**
 * Bot Risk Manager
 * Manages risk enforcement for bot execution
 */
export class BotRiskManager extends EventEmitter {
  private riskSettings: Map<string, BotRiskSettings> = new Map();
  private dailyMetrics: Map<string, {
    tradeCount: number;
    profitLoss: number;
    startBalance: number;
    lastTradeTime: Date;
    consecutiveLosses: number;
  }> = new Map();
  private marketStatusService: DerivMarketStatusService;

  constructor() {
    super();
    this.marketStatusService = DerivMarketStatusService.getInstance();
  }

  /**
   * Initialize risk settings for a bot
   */
  initializeBot(botId: string, userId: string, settings: BotRiskSettings): void {
    const key = `${userId}-${botId}`;
    this.riskSettings.set(key, settings);
    
    // Initialize daily metrics
    this.dailyMetrics.set(key, {
      tradeCount: 0,
      profitLoss: 0,
      startBalance: 0,
      lastTradeTime: new Date(),
      consecutiveLosses: 0,
    });
  }

  /**
   * Update start balance for a bot
   */
  setStartBalance(botId: string, userId: string, balance: number): void {
    const key = `${userId}-${botId}`;
    const metrics = this.dailyMetrics.get(key);
    if (metrics) {
      metrics.startBalance = balance;
    }
  }

  /**
   * Check if trade is allowed and if bot should stop
   * Main risk enforcement method
   */
  async checkRisk(
    botId: string,
    userId: string,
    currentBalance: number,
    symbol: string
  ): Promise<RiskCheckResult> {
    const key = `${userId}-${botId}`;
    const settings = this.riskSettings.get(key);
    const metrics = this.dailyMetrics.get(key);

    if (!settings || !metrics) {
      return {
        allowed: false,
        shouldStop: false,
        reason: BotStopReason.SYSTEM_ERROR,
        message: 'Risk settings not initialized',
      };
    }

    // Reset daily metrics if new day
    const today = new Date().toISOString().split('T')[0];
    const lastTradeDate = metrics.lastTradeTime.toISOString().split('T')[0];
    if (today !== lastTradeDate) {
      metrics.tradeCount = 0;
      metrics.profitLoss = 0;
      metrics.consecutiveLosses = 0;
      if (metrics.startBalance === 0) {
        metrics.startBalance = currentBalance;
      }
    }

    // Check market status
    const marketCheck = await this.checkMarketStatus(symbol, userId);
    if (!marketCheck.allowed) {
      return {
        ...marketCheck,
        shouldStop: true,
      };
    }

    // Check max trades per day
    if (metrics.tradeCount >= settings.maxTradesPerDay) {
      return {
        allowed: false,
        shouldStop: true,
        reason: BotStopReason.MAX_TRADES_REACHED,
        message: `Maximum trades per day reached (${metrics.tradeCount}/${settings.maxTradesPerDay})`,
        metrics: {
          currentLoss: 0,
          currentProfit: 0,
          dailyTradeCount: metrics.tradeCount,
          dailyProfitLoss: metrics.profitLoss,
          currentDrawdown: this.calculateDrawdown(metrics.startBalance, currentBalance),
          consecutiveLosses: metrics.consecutiveLosses,
        },
      };
    }

    // Check max trades per hour
    if (settings.maxTradesPerHour) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      if (metrics.lastTradeTime > oneHourAgo) {
        // Would need to track hourly trades, for now skip
        // This is a simplified version
      }
    }

    // Check daily loss limit
    if (metrics.profitLoss <= -settings.maxDailyLoss) {
      return {
        allowed: false,
        shouldStop: true,
        reason: BotStopReason.DAILY_LOSS_LIMIT,
        message: `Daily loss limit reached (${Math.abs(metrics.profitLoss)}/${settings.maxDailyLoss})`,
        metrics: {
          currentLoss: Math.abs(metrics.profitLoss),
          currentProfit: 0,
          dailyTradeCount: metrics.tradeCount,
          dailyProfitLoss: metrics.profitLoss,
          currentDrawdown: this.calculateDrawdown(metrics.startBalance, currentBalance),
          consecutiveLosses: metrics.consecutiveLosses,
        },
      };
    }

    // Check daily loss percentage
    if (settings.maxDailyLossPercent && metrics.startBalance > 0) {
      const lossPercent = (Math.abs(metrics.profitLoss) / metrics.startBalance) * 100;
      if (lossPercent >= settings.maxDailyLossPercent) {
        return {
          allowed: false,
          shouldStop: true,
          reason: BotStopReason.DAILY_LOSS_LIMIT,
          message: `Daily loss percentage limit reached (${lossPercent.toFixed(2)}%/${settings.maxDailyLossPercent}%)`,
          metrics: {
            currentLoss: Math.abs(metrics.profitLoss),
            currentProfit: 0,
            dailyTradeCount: metrics.tradeCount,
            dailyProfitLoss: metrics.profitLoss,
            currentDrawdown: this.calculateDrawdown(metrics.startBalance, currentBalance),
            consecutiveLosses: metrics.consecutiveLosses,
          },
        };
      }
    }

    // Check max drawdown
    if (settings.maxDrawdownPercent) {
      const drawdown = this.calculateDrawdown(metrics.startBalance, currentBalance);
      if (drawdown >= settings.maxDrawdownPercent) {
        return {
          allowed: false,
          shouldStop: true,
          reason: BotStopReason.MAX_DRAWDOWN,
          message: `Maximum drawdown reached (${drawdown.toFixed(2)}%/${settings.maxDrawdownPercent}%)`,
          metrics: {
            currentLoss: Math.abs(metrics.profitLoss),
            currentProfit: 0,
            dailyTradeCount: metrics.tradeCount,
            dailyProfitLoss: metrics.profitLoss,
            currentDrawdown: drawdown,
            consecutiveLosses: metrics.consecutiveLosses,
          },
        };
      }
    }

    // Check consecutive losses
    if (settings.maxConsecutiveLosses && metrics.consecutiveLosses >= settings.maxConsecutiveLosses) {
      return {
        allowed: false,
        shouldStop: true,
        reason: BotStopReason.MAX_CONSECUTIVE_LOSSES,
        message: `Maximum consecutive losses reached (${metrics.consecutiveLosses})`,
        metrics: {
          currentLoss: Math.abs(metrics.profitLoss),
          currentProfit: 0,
          dailyTradeCount: metrics.tradeCount,
          dailyProfitLoss: metrics.profitLoss,
          currentDrawdown: this.calculateDrawdown(metrics.startBalance, currentBalance),
          consecutiveLosses: metrics.consecutiveLosses,
        },
      };
    }

    // Check minimum balance
    if (settings.minBalance && currentBalance < settings.minBalance) {
      return {
        allowed: false,
        shouldStop: true,
        reason: BotStopReason.INSUFFICIENT_BALANCE,
        message: `Insufficient balance (${currentBalance}/${settings.minBalance})`,
        metrics: {
          currentLoss: 0,
          currentProfit: 0,
          dailyTradeCount: metrics.tradeCount,
          dailyProfitLoss: metrics.profitLoss,
          currentDrawdown: this.calculateDrawdown(metrics.startBalance, currentBalance),
          consecutiveLosses: metrics.consecutiveLosses,
        },
      };
    }

    // All checks passed
    return {
      allowed: true,
      shouldStop: false,
      metrics: {
        currentLoss: metrics.profitLoss < 0 ? Math.abs(metrics.profitLoss) : 0,
        currentProfit: metrics.profitLoss > 0 ? metrics.profitLoss : 0,
        dailyTradeCount: metrics.tradeCount,
        dailyProfitLoss: metrics.profitLoss,
        currentDrawdown: this.calculateDrawdown(metrics.startBalance, currentBalance),
        consecutiveLosses: metrics.consecutiveLosses,
      },
    };
  }

  /**
   * Check if trade result violates stop loss or take profit
   */
  checkTradeResult(
    botId: string,
    userId: string,
    profitLoss: number,
    stake: number
  ): RiskCheckResult {
    const key = `${userId}-${botId}`;
    const settings = this.riskSettings.get(key);
    const metrics = this.dailyMetrics.get(key);

    if (!settings || !metrics) {
      return {
        allowed: true,
        shouldStop: false,
      };
    }

    // Check stop loss
    if (settings.stopLossEnabled && profitLoss < 0) {
      const lossAmount = Math.abs(profitLoss);
      const lossPercent = (lossAmount / stake) * 100;

      if (settings.stopLossAmount && lossAmount >= settings.stopLossAmount) {
        return {
          allowed: false,
          shouldStop: true,
          reason: BotStopReason.STOP_LOSS_HIT,
          message: `Stop loss hit (${lossAmount}/${settings.stopLossAmount})`,
        };
      }

      if (settings.stopLossPercent && lossPercent >= settings.stopLossPercent) {
        return {
          allowed: false,
          shouldStop: true,
          reason: BotStopReason.STOP_LOSS_HIT,
          message: `Stop loss percentage hit (${lossPercent.toFixed(2)}%/${settings.stopLossPercent}%)`,
        };
      }
    }

    // Check take profit
    if (settings.takeProfitEnabled && profitLoss > 0) {
      const profitAmount = profitLoss;
      const profitPercent = (profitAmount / stake) * 100;

      if (settings.takeProfitAmount && profitAmount >= settings.takeProfitAmount) {
        return {
          allowed: false,
          shouldStop: false, // Don't stop on take profit, just log
          reason: BotStopReason.TAKE_PROFIT_HIT,
          message: `Take profit hit (${profitAmount}/${settings.takeProfitAmount})`,
        };
      }

      if (settings.takeProfitPercent && profitPercent >= settings.takeProfitPercent) {
        return {
          allowed: false,
          shouldStop: false, // Don't stop on take profit, just log
          reason: BotStopReason.TAKE_PROFIT_HIT,
          message: `Take profit percentage hit (${profitPercent.toFixed(2)}%/${settings.takeProfitPercent}%)`,
        };
      }
    }

    return {
      allowed: true,
      shouldStop: false,
    };
  }

  /**
   * Record trade result
   * Updates daily metrics and consecutive losses
   */
  recordTradeResult(
    botId: string,
    userId: string,
    profitLoss: number,
    stake: number
  ): void {
    const key = `${userId}-${botId}`;
    const metrics = this.dailyMetrics.get(key);

    if (!metrics) {
      return;
    }

    // Update daily metrics
    metrics.tradeCount++;
    metrics.profitLoss += profitLoss;
    metrics.lastTradeTime = new Date();

    // Update consecutive losses
    if (profitLoss < 0) {
      metrics.consecutiveLosses++;
    } else {
      metrics.consecutiveLosses = 0; // Reset on win
    }
  }

  /**
   * Check market status
   */
  private async checkMarketStatus(
    symbol: string,
    userId: string
  ): Promise<RiskCheckResult> {
    try {
      await this.marketStatusService.initialize(userId);
      const status = await this.marketStatusService.getMarketStatus(symbol);

      if (!status.isTradable) {
        return {
          allowed: false,
          shouldStop: true,
          reason: status.status === MarketStatus.CLOSED
            ? BotStopReason.MARKET_CLOSED
            : BotStopReason.MARKET_SUSPENDED,
          message: status.reason || `Market is ${status.status}`,
        };
      }

      return {
        allowed: true,
        shouldStop: false,
      };
    } catch (error: any) {
      // On error, allow trading but log warning
      console.warn('[BotRiskManager] Market status check failed:', error);
      return {
        allowed: true,
        shouldStop: false,
      };
    }
  }

  /**
   * Calculate drawdown percentage
   */
  private calculateDrawdown(startBalance: number, currentBalance: number): number {
    if (startBalance <= 0) {
      return 0;
    }
    const drawdown = ((startBalance - currentBalance) / startBalance) * 100;
    return Math.max(0, drawdown);
  }

  /**
   * Handle API error
   * Returns risk check result indicating bot should stop
   */
  handleApiError(
    botId: string,
    userId: string,
    error: Error,
    errorType: 'API_ERROR' | 'CONNECTION_LOST' = 'API_ERROR'
  ): RiskCheckResult {
    const key = `${userId}-${botId}`;
    const metrics = this.dailyMetrics.get(key);

    return {
      allowed: false,
      shouldStop: true,
      reason: errorType === 'API_ERROR' ? BotStopReason.API_ERROR : BotStopReason.CONNECTION_LOST,
      message: error.message || 'API error occurred',
      metrics: metrics ? {
        currentLoss: 0,
        currentProfit: 0,
        dailyTradeCount: metrics.tradeCount,
        dailyProfitLoss: metrics.profitLoss,
        currentDrawdown: 0,
        consecutiveLosses: metrics.consecutiveLosses,
      } : undefined,
    };
  }

  /**
   * Emit stop event
   */
  emitStopEvent(
    botId: string,
    userId: string,
    reason: BotStopReason,
    message: string,
    metrics?: RiskCheckResult['metrics']
  ): void {
    const event: BotStopEvent = {
      botId,
      userId,
      reason,
      message,
      timestamp: new Date(),
      metrics,
    };

    this.emit('bot_stopped', event);
    this.emit(`bot_stopped:${reason}`, event);
  }

  /**
   * Get current metrics for a bot
   */
  getMetrics(botId: string, userId: string): RiskCheckResult['metrics'] | null {
    const key = `${userId}-${botId}`;
    const metrics = this.dailyMetrics.get(key);
    const settings = this.riskSettings.get(key);

    if (!metrics || !settings) {
      return null;
    }

    return {
      currentLoss: metrics.profitLoss < 0 ? Math.abs(metrics.profitLoss) : 0,
      currentProfit: metrics.profitLoss > 0 ? metrics.profitLoss : 0,
      dailyTradeCount: metrics.tradeCount,
      dailyProfitLoss: metrics.profitLoss,
      currentDrawdown: this.calculateDrawdown(metrics.startBalance, 0), // Would need current balance
      consecutiveLosses: metrics.consecutiveLosses,
    };
  }

  /**
   * Clear bot data
   */
  clearBot(botId: string, userId: string): void {
    const key = `${userId}-${botId}`;
    this.riskSettings.delete(key);
    this.dailyMetrics.delete(key);
  }

  /**
   * Reset daily metrics (for testing or manual reset)
   */
  resetDailyMetrics(botId: string, userId: string): void {
    const key = `${userId}-${botId}`;
    const metrics = this.dailyMetrics.get(key);
    if (metrics) {
      metrics.tradeCount = 0;
      metrics.profitLoss = 0;
      metrics.consecutiveLosses = 0;
      metrics.lastTradeTime = new Date();
    }
  }
}

// Singleton instance
export const botRiskManager = new BotRiskManager();

