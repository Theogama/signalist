/**
 * Trading Analytics Service
 * Computes trading statistics and performance metrics
 */

import { connectToDatabase } from '@/database/mongoose';
import { SignalistBotTrade } from '@/database/models/signalist-bot-trade.model';
import { AutoTradingSession } from '@/database/models/auto-trading-session.model';

export interface TradingAnalytics {
  // Core Metrics
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
  riskToRewardRatio: number;

  // Performance Metrics
  roi: number;
  sharpeRatio?: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  recoveryFactor?: number;

  // Activity Metrics
  tradesPerDay: number;
  averageTradesPerDay: number;
  activeTrades: number;

  // Strategy Performance
  performanceBySymbol: Record<string, {
    trades: number;
    winRate: number;
    profitLoss: number;
  }>;
  performanceByTimeframe: Record<string, {
    trades: number;
    winRate: number;
    profitLoss: number;
  }>;

  // Time-based Analysis
  dailyPerformance: Array<{
    date: string;
    trades: number;
    profitLoss: number;
    winRate: number;
  }>;
  weeklyPerformance: Array<{
    week: string;
    trades: number;
    profitLoss: number;
    winRate: number;
  }>;
  monthlyPerformance: Array<{
    month: string;
    trades: number;
    profitLoss: number;
    winRate: number;
  }>;

  // Equity Curve
  equityCurve: Array<{
    timestamp: Date;
    balance: number;
    equity: number;
  }>;
}

export class TradingAnalyticsService {
  /**
   * Get comprehensive analytics for a user
   */
  async getAnalytics(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<TradingAnalytics> {
    await connectToDatabase();

    const query: any = { userId, broker: 'deriv' };
    if (startDate || endDate) {
      query.entryTimestamp = {};
      if (startDate) query.entryTimestamp.$gte = startDate;
      if (endDate) query.entryTimestamp.$lte = endDate;
    }

    const allTrades = await SignalistBotTrade.find(query).sort({ entryTimestamp: 1 });
    const closedTrades = allTrades.filter(t => 
      ['TP_HIT', 'SL_HIT', 'CLOSED'].includes(t.status)
    );
    const openTrades = allTrades.filter(t => t.status === 'OPEN');

    // Core Metrics
    const totalTrades = closedTrades.length;
    const winningTrades = closedTrades.filter(t => (t.realizedPnl || 0) > 0);
    const losingTrades = closedTrades.filter(t => (t.realizedPnl || 0) < 0);
    const winRate = totalTrades > 0 ? (winningTrades.length / totalTrades) * 100 : 0;

    const totalProfitLoss = closedTrades.reduce((sum, t) => sum + (t.realizedPnl || 0), 0);
    const totalStake = closedTrades.reduce((sum, t) => sum + t.lotOrStake, 0);
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
    const riskToRewardRatio = averageLoss > 0 ? averageWin / averageLoss : averageWin > 0 ? Infinity : 0;

    // Performance Metrics
    const sessions = await AutoTradingSession.find({ userId, broker: 'deriv' })
      .sort({ startedAt: 1 });

    let initialBalance = 0;
    let currentBalance = 0;
    if (sessions.length > 0) {
      initialBalance = sessions[0].startBalance;
      const lastSession = sessions[sessions.length - 1];
      currentBalance = lastSession.endBalance || lastSession.startBalance + lastSession.totalProfitLoss;
    }

    const roi = initialBalance > 0 ? ((currentBalance - initialBalance) / initialBalance) * 100 : 0;

    // Drawdown calculation
    let maxDrawdown = 0;
    let maxDrawdownPercent = 0;
    let peakBalance = initialBalance;

    for (const session of sessions) {
      const sessionBalance = session.endBalance || session.startBalance + session.totalProfitLoss;
      if (sessionBalance > peakBalance) {
        peakBalance = sessionBalance;
      }
      const drawdown = peakBalance - sessionBalance;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
        maxDrawdownPercent = peakBalance > 0 ? (drawdown / peakBalance) * 100 : 0;
      }
    }

    // Activity Metrics
    const tradesPerDay = this.calculateTradesPerDay(closedTrades);
    const averageTradesPerDay = tradesPerDay.length > 0
      ? tradesPerDay.reduce((sum, d) => sum + d.trades, 0) / tradesPerDay.length
      : 0;

    // Strategy Performance
    const performanceBySymbol: Record<string, any> = {};
    for (const trade of closedTrades) {
      if (!performanceBySymbol[trade.symbol]) {
        performanceBySymbol[trade.symbol] = { trades: 0, wins: 0, profitLoss: 0 };
      }
      performanceBySymbol[trade.symbol].trades++;
      if ((trade.realizedPnl || 0) > 0) {
        performanceBySymbol[trade.symbol].wins++;
      }
      performanceBySymbol[trade.symbol].profitLoss += trade.realizedPnl || 0;
    }

    for (const symbol in performanceBySymbol) {
      const perf = performanceBySymbol[symbol];
      perf.winRate = perf.trades > 0 ? (perf.wins / perf.trades) * 100 : 0;
      delete perf.wins;
    }

    // Time-based Analysis
    const dailyPerformance = this.calculateDailyPerformance(closedTrades);
    const weeklyPerformance = this.calculateWeeklyPerformance(closedTrades);
    const monthlyPerformance = this.calculateMonthlyPerformance(closedTrades);

    // Equity Curve
    const equityCurve = this.calculateEquityCurve(sessions, closedTrades);

    return {
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
      riskToRewardRatio,
      roi,
      maxDrawdown,
      maxDrawdownPercent,
      tradesPerDay: tradesPerDay.length,
      averageTradesPerDay,
      activeTrades: openTrades.length,
      performanceBySymbol,
      performanceByTimeframe: {}, // Would need timeframe data
      dailyPerformance,
      weeklyPerformance,
      monthlyPerformance,
      equityCurve,
    };
  }

  /**
   * Calculate trades per day
   */
  private calculateTradesPerDay(trades: any[]): Array<{ date: string; trades: number }> {
    const dailyMap: Record<string, number> = {};
    for (const trade of trades) {
      const date = trade.entryTimestamp.toISOString().split('T')[0];
      dailyMap[date] = (dailyMap[date] || 0) + 1;
    }
    return Object.entries(dailyMap).map(([date, trades]) => ({ date, trades }));
  }

  /**
   * Calculate daily performance
   */
  private calculateDailyPerformance(trades: any[]): Array<{
    date: string;
    trades: number;
    profitLoss: number;
    winRate: number;
  }> {
    const dailyMap: Record<string, { trades: number; wins: number; profitLoss: number }> = {};
    for (const trade of trades) {
      const date = trade.entryTimestamp.toISOString().split('T')[0];
      if (!dailyMap[date]) {
        dailyMap[date] = { trades: 0, wins: 0, profitLoss: 0 };
      }
      dailyMap[date].trades++;
      if ((trade.realizedPnl || 0) > 0) {
        dailyMap[date].wins++;
      }
      dailyMap[date].profitLoss += trade.realizedPnl || 0;
    }
    return Object.entries(dailyMap).map(([date, data]) => ({
      date,
      trades: data.trades,
      profitLoss: data.profitLoss,
      winRate: data.trades > 0 ? (data.wins / data.trades) * 100 : 0,
    }));
  }

  /**
   * Calculate weekly performance
   */
  private calculateWeeklyPerformance(trades: any[]): Array<{
    week: string;
    trades: number;
    profitLoss: number;
    winRate: number;
  }> {
    const weeklyMap: Record<string, { trades: number; wins: number; profitLoss: number }> = {};
    for (const trade of trades) {
      const date = new Date(trade.entryTimestamp);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      const weekKey = weekStart.toISOString().split('T')[0];
      
      if (!weeklyMap[weekKey]) {
        weeklyMap[weekKey] = { trades: 0, wins: 0, profitLoss: 0 };
      }
      weeklyMap[weekKey].trades++;
      if ((trade.realizedPnl || 0) > 0) {
        weeklyMap[weekKey].wins++;
      }
      weeklyMap[weekKey].profitLoss += trade.realizedPnl || 0;
    }
    return Object.entries(weeklyMap).map(([week, data]) => ({
      week,
      trades: data.trades,
      profitLoss: data.profitLoss,
      winRate: data.trades > 0 ? (data.wins / data.trades) * 100 : 0,
    }));
  }

  /**
   * Calculate monthly performance
   */
  private calculateMonthlyPerformance(trades: any[]): Array<{
    month: string;
    trades: number;
    profitLoss: number;
    winRate: number;
  }> {
    const monthlyMap: Record<string, { trades: number; wins: number; profitLoss: number }> = {};
    for (const trade of trades) {
      const date = new Date(trade.entryTimestamp);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyMap[monthKey]) {
        monthlyMap[monthKey] = { trades: 0, wins: 0, profitLoss: 0 };
      }
      monthlyMap[monthKey].trades++;
      if ((trade.realizedPnl || 0) > 0) {
        monthlyMap[monthKey].wins++;
      }
      monthlyMap[monthKey].profitLoss += trade.realizedPnl || 0;
    }
    return Object.entries(monthlyMap).map(([month, data]) => ({
      month,
      trades: data.trades,
      profitLoss: data.profitLoss,
      winRate: data.trades > 0 ? (data.wins / data.trades) * 100 : 0,
    }));
  }

  /**
   * Calculate equity curve
   */
  private calculateEquityCurve(sessions: any[], trades: any[]): Array<{
    timestamp: Date;
    balance: number;
    equity: number;
  }> {
    const curve: Array<{ timestamp: Date; balance: number; equity: number }> = [];
    
    if (sessions.length === 0) {
      return curve;
    }

    let runningBalance = sessions[0].startBalance;
    const sortedTrades = trades.sort((a, b) => 
      a.entryTimestamp.getTime() - b.entryTimestamp.getTime()
    );

    // Add initial point
    curve.push({
      timestamp: sessions[0].startedAt,
      balance: runningBalance,
      equity: runningBalance,
    });

    // Add points for each trade
    for (const trade of sortedTrades) {
      if (trade.status === 'OPEN') {
        runningBalance += trade.unrealizedPnl || 0;
      } else {
        runningBalance += trade.realizedPnl || 0;
      }
      curve.push({
        timestamp: trade.exitTimestamp || trade.entryTimestamp,
        balance: runningBalance - (trade.unrealizedPnl || 0),
        equity: runningBalance,
      });
    }

    return curve;
  }
}

export const tradingAnalyticsService = new TradingAnalyticsService();

