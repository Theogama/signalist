/**
 * Fake Analytics Data Service
 * 
 * Generates realistic fake analytics data for demo mode.
 * Includes trading statistics, performance metrics, and historical data.
 */

import { randomUUID } from 'crypto';

/**
 * Trading Statistics
 */
export interface TradingStatistics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalProfitLoss: number;
  averageProfit: number;
  averageLoss: number;
  largestWin: number;
  largestLoss: number;
  profitFactor: number;
  sharpeRatio: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  currentStreak: number;
  longestWinStreak: number;
  longestLossStreak: number;
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
}

/**
 * Trade History Entry
 */
export interface TradeHistoryEntry {
  tradeId: string;
  symbol: string;
  contractType: 'CALL' | 'PUT';
  stake: number;
  profitLoss: number;
  profitLossPercent: number;
  timestamp: Date;
  status: 'won' | 'lost';
  duration: number;
}

/**
 * Performance Metrics
 */
export interface PerformanceMetrics {
  totalProfitLoss: number;
  totalProfitLossPercent: number;
  monthlyReturn: number;
  weeklyReturn: number;
  dailyReturn: number;
  volatility: number;
  riskRewardRatio: number;
}

/**
 * Fake Analytics Service
 */
export class FakeAnalyticsService {
  /**
   * Generate trading statistics
   */
  generateStatistics(
    totalTrades: number = 100,
    winRate: number = 0.55
  ): TradingStatistics {
    const winningTrades = Math.floor(totalTrades * winRate);
    const losingTrades = totalTrades - winningTrades;

    // Generate realistic profit/loss values
    const averageWin = 10 + Math.random() * 20; // $10-$30 average win
    const averageLoss = 5 + Math.random() * 15; // $5-$20 average loss

    const totalProfit = winningTrades * averageWin;
    const totalLoss = losingTrades * averageLoss;
    const totalProfitLoss = totalProfit - totalLoss;

    const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : 0;

    // Calculate drawdown (simulated)
    const maxDrawdown = totalLoss * (0.3 + Math.random() * 0.4); // 30-70% of total loss
    const maxDrawdownPercent = (maxDrawdown / (totalProfitLoss + maxDrawdown)) * 100;

    // Calculate Sharpe ratio (simulated)
    const sharpeRatio = 0.5 + Math.random() * 2; // 0.5-2.5

    // Generate streaks
    const currentStreak = Math.floor(Math.random() * 5) - 2; // -2 to 2
    const longestWinStreak = Math.floor(winningTrades * 0.1) + Math.random() * 5;
    const longestLossStreak = Math.floor(losingTrades * 0.1) + Math.random() * 3;

    return {
      totalTrades,
      winningTrades,
      losingTrades,
      winRate: (winningTrades / totalTrades) * 100,
      totalProfitLoss,
      averageProfit: averageWin,
      averageLoss: averageLoss,
      largestWin: averageWin * (1.5 + Math.random() * 1.5), // 1.5x-3x average
      largestLoss: averageLoss * (1.2 + Math.random() * 1.3), // 1.2x-2.5x average
      profitFactor,
      sharpeRatio,
      maxDrawdown,
      maxDrawdownPercent,
      currentStreak,
      longestWinStreak: Math.floor(longestWinStreak),
      longestLossStreak: Math.floor(longestLossStreak),
    };
  }

  /**
   * Generate daily performance data
   */
  generateDailyPerformance(
    days: number = 30,
    baseWinRate: number = 0.55
  ): DailyPerformance[] {
    const performance: DailyPerformance[] = [];
    const today = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      // Vary win rate slightly day by day
      const winRate = baseWinRate + (Math.random() - 0.5) * 0.2; // ±10%
      const trades = Math.floor(5 + Math.random() * 20); // 5-25 trades per day
      const wins = Math.floor(trades * winRate);
      const losses = trades - wins;

      // Calculate profit/loss
      const avgWin = 10 + Math.random() * 20;
      const avgLoss = 5 + Math.random() * 15;
      const profitLoss = wins * avgWin - losses * avgLoss;

      performance.push({
        date: dateStr,
        trades,
        wins,
        losses,
        profitLoss,
        winRate: (wins / trades) * 100,
      });
    }

    return performance;
  }

  /**
   * Generate trade history
   */
  generateTradeHistory(
    count: number = 100,
    winRate: number = 0.55
  ): TradeHistoryEntry[] {
    const history: TradeHistoryEntry[] = [];
    const now = Date.now();
    const symbols = ['BOOM500', 'BOOM1000', 'CRASH500', 'CRASH1000'];
    const contractTypes: ('CALL' | 'PUT')[] = ['CALL', 'PUT'];

    for (let i = 0; i < count; i++) {
      const willWin = Math.random() < winRate;
      const stake = 5 + Math.random() * 45; // $5-$50
      const profitLoss = willWin
        ? stake * (0.5 + Math.random() * 1.5) // 50-200% profit
        : -stake * (0.5 + Math.random() * 0.5); // 50-100% loss

      const timestamp = new Date(now - (count - i) * 3600000); // Spread over hours
      const duration = 60 + Math.random() * 240; // 1-5 minutes

      history.push({
        tradeId: randomUUID(),
        symbol: symbols[Math.floor(Math.random() * symbols.length)],
        contractType: contractTypes[Math.floor(Math.random() * contractTypes.length)],
        stake,
        profitLoss,
        profitLossPercent: (profitLoss / stake) * 100,
        timestamp,
        status: willWin ? 'won' : 'lost',
        duration: Math.floor(duration),
      });
    }

    // Sort by timestamp (newest first)
    return history.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Generate performance metrics
   */
  generatePerformanceMetrics(
    initialBalance: number = 10000,
    currentBalance: number = 12000
  ): PerformanceMetrics {
    const totalProfitLoss = currentBalance - initialBalance;
    const totalProfitLossPercent = (totalProfitLoss / initialBalance) * 100;

    // Simulate time periods
    const monthlyReturn = totalProfitLossPercent * (0.8 + Math.random() * 0.4); // 80-120% of total
    const weeklyReturn = monthlyReturn / 4 + (Math.random() - 0.5) * 2;
    const dailyReturn = weeklyReturn / 7 + (Math.random() - 0.5) * 0.5;

    // Volatility (standard deviation of returns)
    const volatility = 5 + Math.random() * 15; // 5-20%

    // Risk-reward ratio
    const riskRewardRatio = 1.2 + Math.random() * 1.8; // 1.2-3.0

    return {
      totalProfitLoss,
      totalProfitLossPercent,
      monthlyReturn,
      weeklyReturn,
      dailyReturn,
      volatility,
      riskRewardRatio,
    };
  }

  /**
   * Generate portfolio summary
   */
  generatePortfolioSummary(
    initialBalance: number = 10000,
    currentBalance: number = 12000
  ): {
    initialBalance: number;
    currentBalance: number;
    totalProfitLoss: number;
    totalProfitLossPercent: number;
    totalTrades: number;
    activeTrades: number;
    winRate: number;
    profitFactor: number;
  } {
    const totalProfitLoss = currentBalance - initialBalance;
    const totalProfitLossPercent = (totalProfitLoss / initialBalance) * 100;
    const totalTrades = Math.floor(50 + Math.random() * 150); // 50-200 trades
    const activeTrades = Math.floor(Math.random() * 5); // 0-5 active trades
    const winRate = 50 + Math.random() * 20; // 50-70% win rate
    const profitFactor = 1.2 + Math.random() * 1.5; // 1.2-2.7

    return {
      initialBalance,
      currentBalance,
      totalProfitLoss,
      totalProfitLossPercent,
      totalTrades,
      activeTrades,
      winRate,
      profitFactor,
    };
  }

  /**
   * Generate symbol performance breakdown
   */
  generateSymbolPerformance(): Array<{
    symbol: string;
    trades: number;
    wins: number;
    losses: number;
    winRate: number;
    profitLoss: number;
  }> {
    const symbols = ['BOOM500', 'BOOM1000', 'CRASH500', 'CRASH1000'];
    const performance: Array<{
      symbol: string;
      trades: number;
      wins: number;
      losses: number;
      winRate: number;
      profitLoss: number;
    }> = [];

    for (const symbol of symbols) {
      const trades = Math.floor(10 + Math.random() * 40); // 10-50 trades
      const winRate = 0.45 + Math.random() * 0.3; // 45-75% win rate
      const wins = Math.floor(trades * winRate);
      const losses = trades - wins;

      const avgWin = 10 + Math.random() * 20;
      const avgLoss = 5 + Math.random() * 15;
      const profitLoss = wins * avgWin - losses * avgLoss;

      performance.push({
        symbol,
        trades,
        wins,
        losses,
        winRate: winRate * 100,
        profitLoss,
      });
    }

    return performance;
  }
}

// Singleton instance
export const fakeAnalyticsService = new FakeAnalyticsService();


