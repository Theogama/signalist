/**
 * Bot Analytics Service
 * 
 * Aggregates and analyzes trade data by bot ID.
 * Provides performance metrics, daily P/L, and bot-specific analytics.
 * 
 * Features:
 * - Daily P/L aggregation
 * - Bot performance metrics
 * - Win rate calculations
 * - Profit factor analysis
 * - Demo & Live mode compatible
 */

import { connectToDatabase } from '@/database/mongoose';
import { SignalistBotTrade } from '@/database/models/signalist-bot-trade.model';

/**
 * Bot Performance Metrics
 */
export interface BotPerformanceMetrics {
  botId: string;
  userId: string;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalProfitLoss: number;
  totalProfitLossPercent: number;
  averageWin: number;
  averageLoss: number;
  largestWin: number;
  largestLoss: number;
  profitFactor: number;
  riskRewardRatio: number;
  totalStake: number;
  averageStake: number;
}

/**
 * Daily Performance
 */
export interface DailyPerformance {
  date: string;
  trades: number;
  wins: number;
  losses: number;
  profitLoss: number;
  winRate: number;
  totalStake: number;
}

/**
 * Bot Analytics Summary
 */
export interface BotAnalyticsSummary {
  botId: string;
  userId: string;
  performance: BotPerformanceMetrics;
  dailyPerformance: DailyPerformance[];
  symbolPerformance: Array<{
    symbol: string;
    trades: number;
    wins: number;
    losses: number;
    winRate: number;
    profitLoss: number;
  }>;
  recentTrades: Array<{
    tradeId: string;
    symbol: string;
    stake: number;
    profitLoss: number;
    status: string;
    timestamp: Date;
  }>;
  isDemo: boolean;
}

/**
 * Bot Analytics Service
 */
export class BotAnalyticsService {
  /**
   * Get bot performance metrics
   */
  async getBotPerformance(
    userId: string,
    botId: string,
    filters?: {
      startDate?: Date;
      endDate?: Date;
      isDemo?: boolean;
    }
  ): Promise<BotPerformanceMetrics> {
    await connectToDatabase();

    const query: any = {
      userId,
      botId,
      status: { $in: ['TP_HIT', 'SL_HIT', 'CLOSED'] }, // Only closed trades
    };

    if (filters?.isDemo !== undefined) {
      query.isDemo = filters.isDemo;
    }

    if (filters?.startDate || filters?.endDate) {
      query.exitTimestamp = {};
      if (filters.startDate) {
        query.exitTimestamp.$gte = filters.startDate;
      }
      if (filters.endDate) {
        query.exitTimestamp.$lte = filters.endDate;
      }
    }

    const trades = await SignalistBotTrade.find(query).lean();

    const totalTrades = trades.length;
    const winningTrades = trades.filter(t => (t.realizedPnl || 0) > 0);
    const losingTrades = trades.filter(t => (t.realizedPnl || 0) < 0);
    const winRate = totalTrades > 0 ? (winningTrades.length / totalTrades) * 100 : 0;

    const totalProfitLoss = trades.reduce((sum, t) => sum + (t.realizedPnl || 0), 0);
    const totalStake = trades.reduce((sum, t) => sum + t.lotOrStake, 0);
    const totalProfitLossPercent = totalStake > 0 ? (totalProfitLoss / totalStake) * 100 : 0;

    const wins = winningTrades.map(t => t.realizedPnl || 0);
    const losses = losingTrades.map(t => Math.abs(t.realizedPnl || 0));

    const averageWin = wins.length > 0 ? wins.reduce((a, b) => a + b, 0) / wins.length : 0;
    const averageLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / losses.length : 0;
    const largestWin = wins.length > 0 ? Math.max(...wins) : 0;
    const largestLoss = losses.length > 0 ? -Math.max(...losses) : 0;

    const totalWins = wins.reduce((a, b) => a + b, 0);
    const totalLosses = losses.reduce((a, b) => a + b, 0);
    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;
    const riskRewardRatio = averageLoss > 0 ? averageWin / averageLoss : averageWin > 0 ? Infinity : 0;
    const averageStake = totalTrades > 0 ? totalStake / totalTrades : 0;

    return {
      botId,
      userId,
      totalTrades,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate,
      totalProfitLoss,
      totalProfitLossPercent,
      averageWin,
      averageLoss,
      largestWin,
      largestLoss,
      profitFactor,
      riskRewardRatio,
      totalStake,
      averageStake,
    };
  }

  /**
   * Get daily P/L for a bot
   */
  async getDailyPerformance(
    userId: string,
    botId: string,
    days: number = 30,
    filters?: {
      isDemo?: boolean;
    }
  ): Promise<DailyPerformance[]> {
    await connectToDatabase();

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const query: any = {
      userId,
      botId,
      status: { $in: ['TP_HIT', 'SL_HIT', 'CLOSED'] },
      exitTimestamp: { $gte: startDate },
    };

    if (filters?.isDemo !== undefined) {
      query.isDemo = filters.isDemo;
    }

    const trades = await SignalistBotTrade.find(query)
      .sort({ exitTimestamp: 1 })
      .lean();

    const dailyMap: Record<string, {
      trades: number;
      wins: number;
      losses: number;
      profitLoss: number;
      totalStake: number;
    }> = {};

    for (const trade of trades) {
      const date = trade.exitTimestamp?.toISOString().split('T')[0] || 
                   trade.entryTimestamp.toISOString().split('T')[0];
      
      if (!dailyMap[date]) {
        dailyMap[date] = {
          trades: 0,
          wins: 0,
          losses: 0,
          profitLoss: 0,
          totalStake: 0,
        };
      }

      dailyMap[date].trades++;
      dailyMap[date].totalStake += trade.lotOrStake;
      dailyMap[date].profitLoss += trade.realizedPnl || 0;

      if ((trade.realizedPnl || 0) > 0) {
        dailyMap[date].wins++;
      } else {
        dailyMap[date].losses++;
      }
    }

    return Object.entries(dailyMap)
      .map(([date, data]) => ({
        date,
        trades: data.trades,
        wins: data.wins,
        losses: data.losses,
        profitLoss: data.profitLoss,
        winRate: data.trades > 0 ? (data.wins / data.trades) * 100 : 0,
        totalStake: data.totalStake,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Get symbol performance for a bot
   */
  async getSymbolPerformance(
    userId: string,
    botId: string,
    filters?: {
      startDate?: Date;
      endDate?: Date;
      isDemo?: boolean;
    }
  ): Promise<Array<{
    symbol: string;
    trades: number;
    wins: number;
    losses: number;
    winRate: number;
    profitLoss: number;
  }>> {
    await connectToDatabase();

    const query: any = {
      userId,
      botId,
      status: { $in: ['TP_HIT', 'SL_HIT', 'CLOSED'] },
    };

    if (filters?.isDemo !== undefined) {
      query.isDemo = filters.isDemo;
    }

    if (filters?.startDate || filters?.endDate) {
      query.exitTimestamp = {};
      if (filters.startDate) {
        query.exitTimestamp.$gte = filters.startDate;
      }
      if (filters.endDate) {
        query.exitTimestamp.$lte = filters.endDate;
      }
    }

    const trades = await SignalistBotTrade.find(query).lean();

    const symbolMap: Record<string, {
      trades: number;
      wins: number;
      losses: number;
      profitLoss: number;
    }> = {};

    for (const trade of trades) {
      const symbol = trade.symbol;
      if (!symbolMap[symbol]) {
        symbolMap[symbol] = {
          trades: 0,
          wins: 0,
          losses: 0,
          profitLoss: 0,
        };
      }

      symbolMap[symbol].trades++;
      symbolMap[symbol].profitLoss += trade.realizedPnl || 0;

      if ((trade.realizedPnl || 0) > 0) {
        symbolMap[symbol].wins++;
      } else {
        symbolMap[symbol].losses++;
      }
    }

    return Object.entries(symbolMap)
      .map(([symbol, data]) => ({
        symbol,
        trades: data.trades,
        wins: data.wins,
        losses: data.losses,
        winRate: data.trades > 0 ? (data.wins / data.trades) * 100 : 0,
        profitLoss: data.profitLoss,
      }))
      .sort((a, b) => b.profitLoss - a.profitLoss);
  }

  /**
   * Get comprehensive bot analytics
   */
  async getBotAnalytics(
    userId: string,
    botId: string,
    filters?: {
      startDate?: Date;
      endDate?: Date;
      isDemo?: boolean;
      includeRecentTrades?: number;
    }
  ): Promise<BotAnalyticsSummary> {
    const performance = await this.getBotPerformance(userId, botId, filters);
    const dailyPerformance = await this.getDailyPerformance(
      userId,
      botId,
      30,
      filters
    );
    const symbolPerformance = await this.getSymbolPerformance(userId, botId, filters);

    // Get recent trades
    await connectToDatabase();
    const recentQuery: any = {
      userId,
      botId,
    };
    if (filters?.isDemo !== undefined) {
      recentQuery.isDemo = filters.isDemo;
    }

    const recentTrades = await SignalistBotTrade.find(recentQuery)
      .sort({ entryTimestamp: -1 })
      .limit(filters?.includeRecentTrades || 10)
      .lean();

    // Determine if bot is demo or live (check first trade)
    const firstTrade = await SignalistBotTrade.findOne({ userId, botId }).lean();
    const isDemo = firstTrade?.isDemo || false;

    return {
      botId,
      userId,
      performance,
      dailyPerformance,
      symbolPerformance,
      recentTrades: recentTrades.map(t => ({
        tradeId: t.tradeId,
        symbol: t.symbol,
        stake: t.lotOrStake,
        profitLoss: t.realizedPnl || 0,
        status: t.status,
        timestamp: t.exitTimestamp || t.entryTimestamp,
      })),
      isDemo,
    };
  }

  /**
   * Get all bots performance for a user
   */
  async getAllBotsPerformance(
    userId: string,
    filters?: {
      isDemo?: boolean;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<Array<{
    botId: string;
    performance: BotPerformanceMetrics;
    lastTradeDate?: Date;
  }>> {
    await connectToDatabase();

    const query: any = {
      userId,
      botId: { $exists: true, $ne: null },
      status: { $in: ['TP_HIT', 'SL_HIT', 'CLOSED'] },
    };

    if (filters?.isDemo !== undefined) {
      query.isDemo = filters.isDemo;
    }

    if (filters?.startDate || filters?.endDate) {
      query.exitTimestamp = {};
      if (filters.startDate) {
        query.exitTimestamp.$gte = filters.startDate;
      }
      if (filters.endDate) {
        query.exitTimestamp.$lte = filters.endDate;
      }
    }

    // Get unique bot IDs
    const botIds = await SignalistBotTrade.distinct('botId', query);

    const results = await Promise.all(
      botIds.map(async (botId) => {
        const performance = await this.getBotPerformance(userId, botId, filters);
        
        // Get last trade date
        const lastTrade = await SignalistBotTrade.findOne({
          userId,
          botId,
        })
          .sort({ entryTimestamp: -1 })
          .lean();

        return {
          botId,
          performance,
          lastTradeDate: lastTrade?.entryTimestamp,
        };
      })
    );

    return results.sort((a, b) => {
      // Sort by total profit/loss descending
      return b.performance.totalProfitLoss - a.performance.totalProfitLoss;
    });
  }

  /**
   * Get daily P/L summary for all bots
   */
  async getDailyPLSummary(
    userId: string,
    date: Date,
    filters?: {
      isDemo?: boolean;
    }
  ): Promise<{
    date: string;
    totalTrades: number;
    totalProfitLoss: number;
    botBreakdown: Array<{
      botId: string;
      trades: number;
      profitLoss: number;
    }>;
  }> {
    await connectToDatabase();

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const query: any = {
      userId,
      botId: { $exists: true, $ne: null },
      status: { $in: ['TP_HIT', 'SL_HIT', 'CLOSED'] },
      exitTimestamp: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
    };

    if (filters?.isDemo !== undefined) {
      query.isDemo = filters.isDemo;
    }

    const trades = await SignalistBotTrade.find(query).lean();

    const totalTrades = trades.length;
    const totalProfitLoss = trades.reduce((sum, t) => sum + (t.realizedPnl || 0), 0);

    // Group by bot
    const botMap: Record<string, { trades: number; profitLoss: number }> = {};
    for (const trade of trades) {
      const botId = trade.botId || 'unknown';
      if (!botMap[botId]) {
        botMap[botId] = { trades: 0, profitLoss: 0 };
      }
      botMap[botId].trades++;
      botMap[botId].profitLoss += trade.realizedPnl || 0;
    }

    const botBreakdown = Object.entries(botMap)
      .map(([botId, data]) => ({
        botId,
        trades: data.trades,
        profitLoss: data.profitLoss,
      }))
      .sort((a, b) => b.profitLoss - a.profitLoss);

    return {
      date: date.toISOString().split('T')[0],
      totalTrades,
      totalProfitLoss,
      botBreakdown,
    };
  }
}

// Singleton instance
export const botAnalyticsService = new BotAnalyticsService();

