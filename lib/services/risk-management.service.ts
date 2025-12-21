/**
 * Risk Management Service
 * Enforces platform-level safeguards for auto-trading
 */

import { connectToDatabase } from '@/database/mongoose';
import { SignalistBotTrade } from '@/database/models/signalist-bot-trade.model';
import { AutoTradingSession } from '@/database/models/auto-trading-session.model';

export interface RiskSettings {
  maxTradesPerDay: number;
  dailyLossLimit: number;
  maxStakeSize: number;
  riskPerTrade: number; // Percentage
  autoStopDrawdown?: number; // Percentage
  maxConsecutiveLosses?: number;
}

export interface RiskCheckResult {
  allowed: boolean;
  reason?: string;
  metrics?: {
    dailyTradeCount: number;
    dailyProfitLoss: number;
    currentDrawdown: number;
    consecutiveLosses: number;
  };
}

export class RiskManagementService {
  /**
   * Check if a trade can be executed (comprehensive validation)
   */
  async canExecuteTrade(
    sessionId: string,
    signal: any,
    balance: number
  ): Promise<RiskCheckResult> {
    await connectToDatabase();
    
    const session = await AutoTradingSession.findOne({ sessionId });
    if (!session) {
      return {
        allowed: false,
        reason: 'Session not found',
      };
    }

    const riskSettings: RiskSettings = {
      maxTradesPerDay: session.riskSettings.maxTradesPerDay,
      dailyLossLimit: session.riskSettings.dailyLossLimit,
      maxStakeSize: session.riskSettings.maxStakeSize,
      riskPerTrade: session.riskSettings.riskPerTrade || 1,
      autoStopDrawdown: session.riskSettings.autoStopDrawdown,
      maxConsecutiveLosses: session.riskSettings.maxConsecutiveLosses,
    };

    // Calculate stake size first
    const stake = this.calculateStakeSize(balance, riskSettings, signal.entryPrice, signal.stopLoss);

    return this.checkTradeAllowed(session.userId, stake, balance, riskSettings);
  }

  /**
   * Check if a trade is allowed based on risk rules
   */
  async checkTradeAllowed(
    userId: string,
    stake: number,
    currentBalance: number,
    riskSettings: RiskSettings
  ): Promise<RiskCheckResult> {
    await connectToDatabase();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get today's trades
    const todayTrades = await SignalistBotTrade.find({
      userId,
      broker: 'deriv',
      entryTimestamp: { $gte: today, $lt: tomorrow },
    });

    const dailyTradeCount = todayTrades.length;
    const dailyProfitLoss = todayTrades.reduce((sum, trade) => {
      return sum + (trade.realizedPnl || trade.unrealizedPnl || 0);
    }, 0);

    // Check max trades per day
    if (riskSettings.maxTradesPerDay > 0 && dailyTradeCount >= riskSettings.maxTradesPerDay) {
      return {
        allowed: false,
        reason: `Daily trade limit reached (${dailyTradeCount}/${riskSettings.maxTradesPerDay})`,
        metrics: {
          dailyTradeCount,
          dailyProfitLoss,
          currentDrawdown: 0,
          consecutiveLosses: 0,
        },
      };
    }

    // Check daily loss limit
    if (riskSettings.dailyLossLimit > 0 && dailyProfitLoss <= -riskSettings.dailyLossLimit) {
      return {
        allowed: false,
        reason: `Daily loss limit reached (${Math.abs(dailyProfitLoss)}/${riskSettings.dailyLossLimit})`,
        metrics: {
          dailyTradeCount,
          dailyProfitLoss,
          currentDrawdown: 0,
          consecutiveLosses: 0,
        },
      };
    }

    // Check max stake size
    if (riskSettings.maxStakeSize > 0 && stake > riskSettings.maxStakeSize) {
      return {
        allowed: false,
        reason: `Stake exceeds maximum allowed (${stake}/${riskSettings.maxStakeSize})`,
        metrics: {
          dailyTradeCount,
          dailyProfitLoss,
          currentDrawdown: 0,
          consecutiveLosses: 0,
        },
      };
    }

    // Check risk per trade
    const riskAmount = (currentBalance * riskSettings.riskPerTrade) / 100;
    if (stake > riskAmount * 1.1) { // Allow 10% tolerance
      return {
        allowed: false,
        reason: `Stake exceeds risk per trade limit (${stake}/${riskAmount})`,
        metrics: {
          dailyTradeCount,
          dailyProfitLoss,
          currentDrawdown: 0,
          consecutiveLosses: 0,
        },
      };
    }

    // Get active session for drawdown check
    const activeSession = await AutoTradingSession.findOne({
      userId,
      broker: 'deriv',
      status: 'active',
    }).sort({ startedAt: -1 });

    let currentDrawdown = 0;
    if (activeSession) {
      const drawdown = ((activeSession.startBalance - currentBalance) / activeSession.startBalance) * 100;
      currentDrawdown = drawdown;

      if (riskSettings.autoStopDrawdown && drawdown >= riskSettings.autoStopDrawdown) {
        return {
          allowed: false,
          reason: `Drawdown limit reached (${drawdown.toFixed(2)}%/${riskSettings.autoStopDrawdown}%)`,
          metrics: {
            dailyTradeCount,
            dailyProfitLoss,
            currentDrawdown: drawdown,
            consecutiveLosses: 0,
          },
        };
      }
    }

    // Check consecutive losses
    const recentTrades = await SignalistBotTrade.find({
      userId,
      broker: 'deriv',
      status: { $in: ['TP_HIT', 'SL_HIT', 'CLOSED'] },
    })
      .sort({ exitTimestamp: -1 })
      .limit(riskSettings.maxConsecutiveLosses || 10);

    let consecutiveLosses = 0;
    for (const trade of recentTrades) {
      if ((trade.realizedPnl || 0) < 0) {
        consecutiveLosses++;
      } else {
        break;
      }
    }

    if (riskSettings.maxConsecutiveLosses && consecutiveLosses >= riskSettings.maxConsecutiveLosses) {
      return {
        allowed: false,
        reason: `Maximum consecutive losses reached (${consecutiveLosses})`,
        metrics: {
          dailyTradeCount,
          dailyProfitLoss,
          currentDrawdown,
          consecutiveLosses,
        },
      };
    }

    return {
      allowed: true,
      metrics: {
        dailyTradeCount,
        dailyProfitLoss,
        currentDrawdown,
        consecutiveLosses,
      },
    };
  }

  /**
   * Check daily limits for a session
   */
  async checkDailyLimits(sessionId: string): Promise<RiskCheckResult> {
    await connectToDatabase();
    
    const session = await AutoTradingSession.findOne({ sessionId });
    if (!session) {
      return { allowed: false, reason: 'Session not found' };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayTrades = await SignalistBotTrade.find({
      userId: session.userId,
      broker: session.broker,
      entryTimestamp: { $gte: today, $lt: tomorrow },
    });

    const dailyTradeCount = todayTrades.length;
    const dailyProfitLoss = todayTrades.reduce((sum, trade) => {
      return sum + (trade.realizedPnl || trade.unrealizedPnl || 0);
    }, 0);

    const riskSettings = session.riskSettings;

    if (riskSettings.maxTradesPerDay > 0 && dailyTradeCount >= riskSettings.maxTradesPerDay) {
      return {
        allowed: false,
        reason: `Daily trade limit reached (${dailyTradeCount}/${riskSettings.maxTradesPerDay})`,
        metrics: {
          dailyTradeCount,
          dailyProfitLoss,
          currentDrawdown: session.currentDrawdown || 0,
          consecutiveLosses: session.consecutiveLosses || 0,
        },
      };
    }

    if (riskSettings.dailyLossLimit > 0 && dailyProfitLoss <= -riskSettings.dailyLossLimit) {
      return {
        allowed: false,
        reason: `Daily loss limit reached (${Math.abs(dailyProfitLoss)}/${riskSettings.dailyLossLimit})`,
        metrics: {
          dailyTradeCount,
          dailyProfitLoss,
          currentDrawdown: session.currentDrawdown || 0,
          consecutiveLosses: session.consecutiveLosses || 0,
        },
      };
    }

    return {
      allowed: true,
      metrics: {
        dailyTradeCount,
        dailyProfitLoss,
        currentDrawdown: session.currentDrawdown || 0,
        consecutiveLosses: session.consecutiveLosses || 0,
      },
    };
  }

  /**
   * Check drawdown for a session
   */
  async checkDrawdown(sessionId: string, currentBalance: number): Promise<RiskCheckResult> {
    await connectToDatabase();
    
    const session = await AutoTradingSession.findOne({ sessionId });
    if (!session) {
      return { allowed: false, reason: 'Session not found' };
    }

    const drawdown = session.startBalance > 0
      ? ((session.startBalance - currentBalance) / session.startBalance) * 100
      : 0;

    // Update session drawdown
    session.currentDrawdown = drawdown;
    if (drawdown > session.maxDrawdown) {
      session.maxDrawdown = drawdown;
    }
    await session.save();

    if (session.riskSettings.autoStopDrawdown && drawdown >= session.riskSettings.autoStopDrawdown) {
      return {
        allowed: false,
        reason: `Drawdown limit reached (${drawdown.toFixed(2)}%/${session.riskSettings.autoStopDrawdown}%)`,
        metrics: {
          dailyTradeCount: session.dailyTradeCount || 0,
          dailyProfitLoss: session.dailyProfitLoss || 0,
          currentDrawdown: drawdown,
          consecutiveLosses: session.consecutiveLosses || 0,
        },
      };
    }

    return {
      allowed: true,
      metrics: {
        dailyTradeCount: session.dailyTradeCount || 0,
        dailyProfitLoss: session.dailyProfitLoss || 0,
        currentDrawdown: drawdown,
        consecutiveLosses: session.consecutiveLosses || 0,
      },
    };
  }

  /**
   * Check consecutive losses for a session
   */
  async checkConsecutiveLosses(sessionId: string): Promise<RiskCheckResult> {
    await connectToDatabase();
    
    const session = await AutoTradingSession.findOne({ sessionId });
    if (!session) {
      return { allowed: false, reason: 'Session not found' };
    }

    const recentTrades = await SignalistBotTrade.find({
      userId: session.userId,
      broker: session.broker,
      status: { $in: ['TP_HIT', 'SL_HIT', 'CLOSED'] },
    })
      .sort({ exitTimestamp: -1 })
      .limit(session.riskSettings.maxConsecutiveLosses || 10);

    let consecutiveLosses = 0;
    for (const trade of recentTrades) {
      if ((trade.realizedPnl || 0) < 0) {
        consecutiveLosses++;
      } else {
        break;
      }
    }

    // Update session consecutive losses
    session.consecutiveLosses = consecutiveLosses;
    await session.save();

    if (session.riskSettings.maxConsecutiveLosses && consecutiveLosses >= session.riskSettings.maxConsecutiveLosses) {
      return {
        allowed: false,
        reason: `Maximum consecutive losses reached (${consecutiveLosses})`,
        metrics: {
          dailyTradeCount: session.dailyTradeCount || 0,
          dailyProfitLoss: session.dailyProfitLoss || 0,
          currentDrawdown: session.currentDrawdown || 0,
          consecutiveLosses,
        },
      };
    }

    return {
      allowed: true,
      metrics: {
        dailyTradeCount: session.dailyTradeCount || 0,
        dailyProfitLoss: session.dailyProfitLoss || 0,
        currentDrawdown: session.currentDrawdown || 0,
        consecutiveLosses,
      },
    };
  }

  /**
   * Calculate safe stake size based on risk settings
   */
  calculateStakeSize(
    balance: number,
    riskSettings: RiskSettings,
    entryPrice?: number,
    stopLoss?: number
  ): number {
    // Calculate risk amount based on percentage
    const riskAmount = (balance * riskSettings.riskPerTrade) / 100;

    // If stop loss is provided, calculate stake based on risk amount
    if (stopLoss && entryPrice > 0) {
      const riskPerUnit = Math.abs(entryPrice - stopLoss);
      if (riskPerUnit > 0) {
        const calculatedStake = riskAmount / riskPerUnit;
        // Apply max stake limit
        if (riskSettings.maxStakeSize > 0) {
          return Math.min(calculatedStake, riskSettings.maxStakeSize);
        }
        return calculatedStake;
      }
    }

    // Default: use risk amount as stake (for binary options)
    const stake = riskAmount;
    if (riskSettings.maxStakeSize > 0) {
      return Math.min(stake, riskSettings.maxStakeSize);
    }
    return stake;
  }

  /**
   * Get risk metrics for a user
   */
  async getRiskMetrics(userId: string): Promise<{
    dailyTradeCount: number;
    dailyProfitLoss: number;
    weeklyProfitLoss: number;
    monthlyProfitLoss: number;
    currentDrawdown: number;
    consecutiveLosses: number;
    winRate: number;
  }> {
    await connectToDatabase();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    // Daily trades
    const dailyTrades = await SignalistBotTrade.find({
      userId,
      broker: 'deriv',
      entryTimestamp: { $gte: today, $lt: tomorrow },
    });

    // Weekly trades
    const weeklyTrades = await SignalistBotTrade.find({
      userId,
      broker: 'deriv',
      entryTimestamp: { $gte: weekAgo },
    });

    // Monthly trades
    const monthlyTrades = await SignalistBotTrade.find({
      userId,
      broker: 'deriv',
      entryTimestamp: { $gte: monthAgo },
    });

    // All closed trades for win rate
    const closedTrades = await SignalistBotTrade.find({
      userId,
      broker: 'deriv',
      status: { $in: ['TP_HIT', 'SL_HIT', 'CLOSED'] },
    });

    const dailyProfitLoss = dailyTrades.reduce((sum, t) => sum + (t.realizedPnl || t.unrealizedPnl || 0), 0);
    const weeklyProfitLoss = weeklyTrades.reduce((sum, t) => sum + (t.realizedPnl || t.unrealizedPnl || 0), 0);
    const monthlyProfitLoss = monthlyTrades.reduce((sum, t) => sum + (t.realizedPnl || t.unrealizedPnl || 0), 0);

    const winningTrades = closedTrades.filter(t => (t.realizedPnl || 0) > 0).length;
    const winRate = closedTrades.length > 0 ? (winningTrades / closedTrades.length) * 100 : 0;

    // Get active session for drawdown
    const activeSession = await AutoTradingSession.findOne({
      userId,
      broker: 'deriv',
      status: 'active',
    }).sort({ startedAt: -1 });

    let currentDrawdown = 0;
    if (activeSession) {
      // Would need current balance, but for now use session P/L
      const sessionPnL = activeSession.totalProfitLoss;
      currentDrawdown = activeSession.startBalance > 0 
        ? ((activeSession.startBalance - (activeSession.startBalance + sessionPnL)) / activeSession.startBalance) * 100
        : 0;
    }

    // Consecutive losses
    const recentTrades = closedTrades.sort((a, b) => 
      (b.exitTimestamp?.getTime() || 0) - (a.exitTimestamp?.getTime() || 0)
    );
    let consecutiveLosses = 0;
    for (const trade of recentTrades) {
      if ((trade.realizedPnl || 0) < 0) {
        consecutiveLosses++;
      } else {
        break;
      }
    }

    return {
      dailyTradeCount: dailyTrades.length,
      dailyProfitLoss,
      weeklyProfitLoss,
      monthlyProfitLoss,
      currentDrawdown,
      consecutiveLosses,
      winRate,
    };
  }
}

export const riskManagementService = new RiskManagementService();


