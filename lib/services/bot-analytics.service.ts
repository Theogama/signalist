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
 * Hourly Performance
 */
export interface HourlyPerformance {
  hour: string; // Format: "YYYY-MM-DD HH:00"
  date: string; // Format: "YYYY-MM-DD"
  hourOfDay: number; // 0-23
  trades: number;
  wins: number;
  losses: number;
  profitLoss: number;
  winRate: number;
  totalStake: number;
}

/**
 * Weekly Performance
 */
export interface WeeklyPerformance {
  week: string; // Format: "YYYY-WW" (e.g., "2024-52")
  weekStart: string; // Format: "YYYY-MM-DD"
  weekEnd: string; // Format: "YYYY-MM-DD"
  trades: number;
  wins: number;
  losses: number;
  profitLoss: number;
  winRate: number;
  totalStake: number;
  dailyBreakdown: DailyPerformance[]; // Daily performance within the week
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
   * Get hourly performance for a bot
   */
  async getHourlyPerformance(
    userId: string,
    botId: string,
    hours: number = 24,
    filters?: {
      isDemo?: boolean;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<HourlyPerformance[]> {
    await connectToDatabase();

    const query: any = {
      userId,
      botId,
      status: { $in: ['CLOSED', 'TP_HIT', 'SL_HIT'] },
    };

    if (filters?.isDemo !== undefined) {
      query.isDemo = filters.isDemo;
    }

    // Calculate date range
    const endDate = filters?.endDate || new Date();
    const startDate = filters?.startDate || new Date(endDate.getTime() - hours * 60 * 60 * 1000);

    query.exitTimestamp = {
      $gte: startDate,
      $lte: endDate,
    };

    const trades = await SignalistBotTrade.find(query).sort({ exitTimestamp: 1 });

    // Group by hour
    const hourlyMap = new Map<string, {
      trades: typeof trades;
      wins: number;
      losses: number;
      profitLoss: number;
      totalStake: number;
    }>();

    trades.forEach((trade) => {
      if (!trade.exitTimestamp) return;

      const exitDate = new Date(trade.exitTimestamp);
      const hourKey = `${exitDate.getFullYear()}-${String(exitDate.getMonth() + 1).padStart(2, '0')}-${String(exitDate.getDate()).padStart(2, '0')} ${String(exitDate.getHours()).padStart(2, '0')}:00`;
      const dateKey = `${exitDate.getFullYear()}-${String(exitDate.getMonth() + 1).padStart(2, '0')}-${String(exitDate.getDate()).padStart(2, '0')}`;

      if (!hourlyMap.has(hourKey)) {
        hourlyMap.set(hourKey, {
          trades: [],
          wins: 0,
          losses: 0,
          profitLoss: 0,
          totalStake: 0,
        });
      }

      const hourData = hourlyMap.get(hourKey)!;
      hourData.trades.push(trade);
      hourData.totalStake += trade.lotOrStake || 0;

      const pnl = trade.realizedPnl || 0;
      hourData.profitLoss += pnl;

      if (pnl > 0) {
        hourData.wins++;
      } else if (pnl < 0) {
        hourData.losses++;
      }
    });

    // Convert to array and format
    const hourlyPerformance: HourlyPerformance[] = Array.from(hourlyMap.entries())
      .map(([hour, data]) => {
        const [datePart, timePart] = hour.split(' ');
        const hourOfDay = parseInt(timePart.split(':')[0], 10);
        const winRate = data.trades.length > 0
          ? (data.wins / data.trades.length) * 100
          : 0;

        return {
          hour,
          date: datePart,
          hourOfDay,
          trades: data.trades.length,
          wins: data.wins,
          losses: data.losses,
          profitLoss: data.profitLoss,
          winRate,
          totalStake: data.totalStake,
        };
      })
      .sort((a, b) => a.hour.localeCompare(b.hour));

    return hourlyPerformance;
  }

  /**
   * Get weekly performance for a bot
   */
  async getWeeklyPerformance(
    userId: string,
    botId: string,
    weeks: number = 12,
    filters?: {
      isDemo?: boolean;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<WeeklyPerformance[]> {
    await connectToDatabase();

    const query: any = {
      userId,
      botId,
      status: { $in: ['CLOSED', 'TP_HIT', 'SL_HIT'] },
    };

    if (filters?.isDemo !== undefined) {
      query.isDemo = filters.isDemo;
    }

    // Calculate date range
    const endDate = filters?.endDate || new Date();
    const startDate = filters?.startDate || new Date(endDate.getTime() - weeks * 7 * 24 * 60 * 60 * 1000);

    query.exitTimestamp = {
      $gte: startDate,
      $lte: endDate,
    };

    const trades = await SignalistBotTrade.find(query).sort({ exitTimestamp: 1 });

    // Group by week
    const weeklyMap = new Map<string, {
      trades: typeof trades;
      wins: number;
      losses: number;
      profitLoss: number;
      totalStake: number;
      dailyMap: Map<string, typeof trades>;
    }>();

    trades.forEach((trade) => {
      if (!trade.exitTimestamp) return;

      const exitDate = new Date(trade.exitTimestamp);
      
      // Get week number (ISO week)
      const year = exitDate.getFullYear();
      const week = this.getISOWeek(exitDate);
      const weekKey = `${year}-${String(week).padStart(2, '0')}`;

      if (!weeklyMap.has(weekKey)) {
        weeklyMap.set(weekKey, {
          trades: [],
          wins: 0,
          losses: 0,
          profitLoss: 0,
          totalStake: 0,
          dailyMap: new Map(),
        });
      }

      const weekData = weeklyMap.get(weekKey)!;
      weekData.trades.push(trade);
      weekData.totalStake += trade.lotOrStake || 0;

      const pnl = trade.realizedPnl || 0;
      weekData.profitLoss += pnl;

      if (pnl > 0) {
        weekData.wins++;
      } else if (pnl < 0) {
        weekData.losses++;
      }

      // Track daily breakdown
      const dateKey = exitDate.toISOString().split('T')[0];
      if (!weekData.dailyMap.has(dateKey)) {
        weekData.dailyMap.set(dateKey, []);
      }
      weekData.dailyMap.get(dateKey)!.push(trade);
    });

    // Convert to array and format
    const weeklyPerformance: WeeklyPerformance[] = Array.from(weeklyMap.entries())
      .map(([week, data]) => {
        const winRate = data.trades.length > 0
          ? (data.wins / data.trades.length) * 100
          : 0;

        // Get week start and end from first trade
        const firstTrade = data.trades[0];
        const weekStart = firstTrade?.exitTimestamp 
          ? this.getWeekStart(new Date(firstTrade.exitTimestamp))
          : new Date();
        const weekEnd = firstTrade?.exitTimestamp
          ? this.getWeekEnd(new Date(firstTrade.exitTimestamp))
          : new Date();

        // Build daily breakdown
        const dailyBreakdown: DailyPerformance[] = Array.from(data.dailyMap.entries())
          .map(([date, dayTrades]) => {
            const dayWins = dayTrades.filter(t => (t.realizedPnl || 0) > 0).length;
            const dayLosses = dayTrades.filter(t => (t.realizedPnl || 0) < 0).length;
            const dayProfitLoss = dayTrades.reduce((sum, t) => sum + (t.realizedPnl || 0), 0);
            const dayStake = dayTrades.reduce((sum, t) => sum + (t.lotOrStake || 0), 0);
            const dayWinRate = dayTrades.length > 0 ? (dayWins / dayTrades.length) * 100 : 0;

            return {
              date,
              trades: dayTrades.length,
              wins: dayWins,
              losses: dayLosses,
              profitLoss: dayProfitLoss,
              winRate: dayWinRate,
              totalStake: dayStake,
            };
          })
          .sort((a, b) => a.date.localeCompare(b.date));

        return {
          week,
          weekStart: weekStart.toISOString().split('T')[0],
          weekEnd: weekEnd.toISOString().split('T')[0],
          trades: data.trades.length,
          wins: data.wins,
          losses: data.losses,
          profitLoss: data.profitLoss,
          winRate,
          totalStake: data.totalStake,
          dailyBreakdown,
        };
      })
      .sort((a, b) => a.week.localeCompare(b.week));

    return weeklyPerformance;
  }

  /**
   * Helper: Get ISO week number
   */
  private getISOWeek(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  /**
   * Helper: Get week start (Monday)
   */
  private getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    return new Date(d.setDate(diff));
  }

  /**
   * Helper: Get week end (Sunday)
   */
  private getWeekEnd(date: Date): Date {
    const weekStart = this.getWeekStart(date);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    return weekEnd;
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

