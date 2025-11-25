/**
 * Enhanced Backtester
 * Advanced backtesting with comprehensive performance reports and forward testing mode
 */

import { IBacktester } from '../interfaces';
import { IStrategy } from '../interfaces';
import { MarketData, StrategyConfig, BacktestResult, TradeResult, StrategySignal, Position, MonthlyPerformance } from '../types';
import { EnhancedRiskManager } from '../risk-manager/EnhancedRiskManager';
import { calculateATR } from '../utils/technical-indicators';

export interface EnhancedBacktestResult extends BacktestResult {
  // Additional metrics
  sharpeRatio: number;
  sortinoRatio?: number;
  calmarRatio?: number;
  recoveryFactor?: number;
  expectancy?: number;
  averageRR: number;
  bestTrade: TradeResult | null;
  worstTrade: TradeResult | null;
  largestWin: number;
  largestLoss: number;
  consecutiveWins: number;
  consecutiveLosses: number;
  averageWinDuration: number; // milliseconds
  averageLossDuration: number; // milliseconds
  monthlyBreakdown: MonthlyPerformance[];
  weeklyBreakdown?: WeeklyPerformance[];
  equityCurve: EquityPoint[];
  drawdownCurve: DrawdownPoint[];
  tradeDistribution: {
    byHour: Record<number, { trades: number; winRate: number; avgPnl: number }>;
    byDayOfWeek: Record<string, { trades: number; winRate: number; avgPnl: number }>;
    byMonth: Record<string, { trades: number; winRate: number; avgPnl: number }>;
  };
  riskMetrics: {
    maxConsecutiveLosses: number;
    maxConsecutiveWins: number;
    maxDrawdownDuration: number; // milliseconds
    recoveryTime: number; // milliseconds
    riskRewardDistribution: Array<{ rr: number; count: number }>;
  };
}

// MonthlyPerformance is now imported from types

export interface WeeklyPerformance {
  week: string; // "2024-W01"
  startBalance: number;
  endBalance: number;
  totalPnl: number;
  pnlPercent: number;
  trades: number;
  winRate: number;
}

export interface EquityPoint {
  timestamp: Date;
  balance: number;
  equity: number;
  drawdown: number;
  drawdownPercent: number;
}

export interface DrawdownPoint {
  timestamp: Date;
  drawdown: number;
  drawdownPercent: number;
  peakBalance: number;
  currentBalance: number;
}

export interface ForwardTestConfig {
  enabled: boolean;
  speedMultiplier?: number; // 1 = real-time, 2 = 2x speed, 0.5 = half speed
  onTick?: (data: {
    timestamp: Date;
    balance: number;
    equity: number;
    openPositions: number;
    trades: number;
    currentPnl: number;
  }) => void;
  onTrade?: (trade: TradeResult) => void;
  onError?: (error: Error) => void;
}

export class EnhancedBacktester implements IBacktester {
  private riskManager: EnhancedRiskManager;
  private forwardTestConfig?: ForwardTestConfig;

  constructor(riskLimits: any, forwardTestConfig?: ForwardTestConfig) {
    this.riskManager = new EnhancedRiskManager(riskLimits);
    this.forwardTestConfig = forwardTestConfig;
  }

  async backtest(
    strategy: IStrategy,
    historicalData: MarketData[],
    initialBalance: number,
    config: StrategyConfig
  ): Promise<EnhancedBacktestResult> {
    let balance = initialBalance;
    let equity = initialBalance;
    let peakBalance = initialBalance;
    let maxDrawdown = 0;
    let maxDrawdownPercent = 0;
    const trades: TradeResult[] = [];
    const openPositions: Map<string, {
      signal: StrategySignal;
      entryPrice: number;
      entryTime: Date;
      stopLoss?: number;
      takeProfit?: number;
      atr?: number;
    }> = new Map();

    // Track equity curve and drawdown
    const equityCurve: EquityPoint[] = [{
      timestamp: historicalData[0]?.timestamp || new Date(),
      balance: initialBalance,
      equity: initialBalance,
      drawdown: 0,
      drawdownPercent: 0,
    }];

    const drawdownCurve: DrawdownPoint[] = [];
    let currentDrawdown = 0;
    let currentDrawdownPercent = 0;
    let drawdownStartTime: Date | null = null;
    let maxDrawdownDuration = 0;

    // Sort data by timestamp
    const sortedData = [...historicalData].sort((a, b) =>
      a.timestamp.getTime() - b.timestamp.getTime()
    );

    // Calculate ATR for dynamic stops
    const prices = sortedData.map(d => d.last);
    const highs = sortedData.map(d => d.high24h || d.last * 1.001);
    const lows = sortedData.map(d => d.low24h || d.last * 0.999);
    const atrArray = calculateATR(highs, lows, prices, 14);

    for (let i = 0; i < sortedData.length; i++) {
      const marketData = sortedData[i];
      const previousData = sortedData.slice(Math.max(0, i - 100), i);
      const currentATR = atrArray.length > i ? atrArray[i] : undefined;

      // Update equity (including unrealized PnL)
      let unrealizedPnl = 0;
      for (const position of openPositions.values()) {
        const positionPnl = this.calculatePnl(
          position.entryPrice,
          marketData.last,
          position.signal.quantity || 1,
          position.signal.side
        );
        unrealizedPnl += positionPnl;
      }
      equity = balance + unrealizedPnl;

      // Update drawdown
      if (equity > peakBalance) {
        peakBalance = equity;
        if (drawdownStartTime) {
          const drawdownDuration = marketData.timestamp.getTime() - drawdownStartTime.getTime();
          if (drawdownDuration > maxDrawdownDuration) {
            maxDrawdownDuration = drawdownDuration;
          }
          drawdownStartTime = null;
        }
      } else {
        const drawdown = peakBalance - equity;
        const drawdownPercent = peakBalance > 0 ? (drawdown / peakBalance) * 100 : 0;
        if (drawdown > currentDrawdown) {
          currentDrawdown = drawdown;
          currentDrawdownPercent = drawdownPercent;
          if (!drawdownStartTime) {
            drawdownStartTime = marketData.timestamp;
          }
        }
        if (drawdown > maxDrawdown) {
          maxDrawdown = drawdown;
          maxDrawdownPercent = drawdownPercent;
        }
      }

      // Record equity curve point
      equityCurve.push({
        timestamp: marketData.timestamp,
        balance,
        equity,
        drawdown: currentDrawdown,
        drawdownPercent: currentDrawdownPercent,
      });

      // Record drawdown curve point
      drawdownCurve.push({
        timestamp: marketData.timestamp,
        drawdown: currentDrawdown,
        drawdownPercent: currentDrawdownPercent,
        peakBalance,
        currentBalance: equity,
      });

      // Forward test callback
      if (this.forwardTestConfig?.enabled && this.forwardTestConfig.onTick) {
        await this.forwardTestCallback(marketData.timestamp, balance, equity, openPositions.size, trades.length, unrealizedPnl);
      }

      // Check if we can trade
      const canTrade = await this.riskManager.canTrade(
        { symbol: marketData.symbol, side: 'BUY', entryPrice: marketData.last, timestamp: marketData.timestamp },
        balance,
        Array.from(openPositions.values()).map(pos => ({
          positionId: pos.signal.symbol,
          symbol: pos.signal.symbol,
          side: pos.signal.side,
          quantity: pos.signal.quantity || 1,
          entryPrice: pos.entryPrice,
          currentPrice: marketData.last,
          unrealizedPnl: this.calculatePnl(pos.entryPrice, marketData.last, pos.signal.quantity || 1, pos.signal.side),
          unrealizedPnlPercent: 0,
          status: 'OPEN' as const,
          openedAt: pos.entryTime,
          stopLoss: pos.stopLoss,
          takeProfit: pos.takeProfit,
        }))
      );

      if (!canTrade) {
        continue;
      }

      // Analyze and generate signal
      const signal = await strategy.analyze(marketData, previousData);

      if (signal) {
        // Calculate position size
        const positionSize = strategy.calculatePositionSize(balance, signal.entryPrice, signal.stopLoss);
        signal.quantity = positionSize;

        // Check risk manager
        const canTradeSignal = await this.riskManager.canTrade(signal, balance, []);

        if (canTradeSignal) {
          // Enter position
          const tradeId = `BT-${Date.now()}-${trades.length}`;
          openPositions.set(tradeId, {
            signal,
            entryPrice: signal.entryPrice,
            entryTime: marketData.timestamp,
            stopLoss: signal.stopLoss,
            takeProfit: signal.takeProfit,
            atr: currentATR,
          });

          // Track position for risk management
          if (signal.stopLoss) {
            this.riskManager.trackPosition(
              tradeId,
              signal.entryPrice,
              signal.side,
              signal.stopLoss,
              signal.takeProfit || 0,
              currentATR
            );
          }
        }
      }

      // Update positions (check for exits and risk management)
      for (const [tradeId, position] of openPositions.entries()) {
        const positionObj: Position = {
          positionId: tradeId,
          symbol: position.signal.symbol,
          side: position.signal.side,
          quantity: position.signal.quantity || 1,
          entryPrice: position.entryPrice,
          currentPrice: marketData.last,
          unrealizedPnl: this.calculatePnl(position.entryPrice, marketData.last, position.signal.quantity || 1, position.signal.side),
          unrealizedPnlPercent: 0,
          status: 'OPEN' as const,
          openedAt: position.entryTime,
          stopLoss: position.stopLoss,
          takeProfit: position.takeProfit,
        };

        // Update risk management (breakeven, trailing stop)
        const riskUpdates = this.riskManager.updatePositionRisk(
          positionObj,
          marketData.last,
          position.atr
        );

        // Update stop loss if needed
        if (riskUpdates.stopLoss) {
          position.stopLoss = riskUpdates.stopLoss;
          positionObj.stopLoss = riskUpdates.stopLoss;
        }

        // Check exit
        const shouldExit = await strategy.shouldExit(positionObj, marketData);

        // Check stop loss / take profit
        let exitReason: 'STOPPED' | 'TAKE_PROFIT' | 'CLOSED' = 'CLOSED';
        let exitPrice = marketData.last;

        if (position.stopLoss) {
          if (position.signal.side === 'BUY' && marketData.last <= position.stopLoss) {
            exitPrice = position.stopLoss;
            exitReason = 'STOPPED';
          } else if (position.signal.side === 'SELL' && marketData.last >= position.stopLoss) {
            exitPrice = position.stopLoss;
            exitReason = 'STOPPED';
          }
        }

        if (position.takeProfit) {
          if (position.signal.side === 'BUY' && marketData.last >= position.takeProfit) {
            exitPrice = position.takeProfit;
            exitReason = 'TAKE_PROFIT';
          } else if (position.signal.side === 'SELL' && marketData.last <= position.takeProfit) {
            exitPrice = position.takeProfit;
            exitReason = 'TAKE_PROFIT';
          }
        }

        if (shouldExit || exitReason !== 'CLOSED') {
          // Close position
          const quantity = position.signal.quantity || 1;
          const pnl = this.calculatePnl(
            position.entryPrice,
            exitPrice,
            quantity,
            position.signal.side
          );
          const pnlPercent = (pnl / (position.entryPrice * quantity)) * 100;

          balance += pnl;
          equity = balance; // Update equity after closing
          if (balance > peakBalance) {
            peakBalance = balance;
          }

          const drawdown = peakBalance - balance;
          if (drawdown > maxDrawdown) {
            maxDrawdown = drawdown;
            maxDrawdownPercent = peakBalance > 0 ? (maxDrawdown / peakBalance) * 100 : 0;
          }

          const trade: TradeResult = {
            tradeId,
            strategyName: strategy.name,
            symbol: position.signal.symbol,
            side: position.signal.side,
            entryPrice: position.entryPrice,
            exitPrice,
            quantity,
            profitLoss: pnl,
            profitLossPercent: pnlPercent,
            status: exitReason,
            openedAt: position.entryTime,
            closedAt: marketData.timestamp,
            duration: marketData.timestamp.getTime() - position.entryTime.getTime(),
          };

          trades.push(trade);
          this.riskManager.recordTrade(trade);
          this.riskManager.untrackPosition(tradeId);
          openPositions.delete(tradeId);

          // Forward test callback
          if (this.forwardTestConfig?.enabled && this.forwardTestConfig.onTrade) {
            this.forwardTestConfig.onTrade(trade);
          }
        }
      }
    }

    // Close any remaining positions at the end
    const lastData = sortedData[sortedData.length - 1];
    for (const [tradeId, position] of openPositions.entries()) {
      const quantity = position.signal.quantity || 1;
      const pnl = this.calculatePnl(position.entryPrice, lastData.last, quantity, position.signal.side);
      const pnlPercent = (pnl / (position.entryPrice * quantity)) * 100;

      balance += pnl;
      equity = balance;

      const trade: TradeResult = {
        tradeId,
        strategyName: strategy.name,
        symbol: position.signal.symbol,
        side: position.signal.side,
        entryPrice: position.entryPrice,
        exitPrice: lastData.last,
        quantity,
        profitLoss: pnl,
        profitLossPercent: pnlPercent,
        status: 'CLOSED',
        openedAt: position.entryTime,
        closedAt: lastData.timestamp,
        duration: lastData.timestamp.getTime() - position.entryTime.getTime(),
      };

      trades.push(trade);
      this.riskManager.recordTrade(trade);
    }

    return this.calculateEnhancedResults(
      trades,
      initialBalance,
      balance,
      maxDrawdown,
      maxDrawdownPercent,
      peakBalance,
      sortedData,
      equityCurve,
      drawdownCurve
    );
  }

  private async forwardTestCallback(
    timestamp: Date,
    balance: number,
    equity: number,
    openPositions: number,
    totalTrades: number,
    currentPnl: number
  ): Promise<void> {
    if (!this.forwardTestConfig?.onTick) return;

    const speedMultiplier = this.forwardTestConfig.speedMultiplier || 1;
    const delay = 1000 / speedMultiplier; // Adjust delay based on speed

    await new Promise(resolve => setTimeout(resolve, delay));

    try {
      this.forwardTestConfig.onTick({
        timestamp,
        balance,
        equity,
        openPositions,
        trades: totalTrades,
        currentPnl,
      });
    } catch (error: any) {
      if (this.forwardTestConfig.onError) {
        this.forwardTestConfig.onError(error);
      }
    }
  }

  private calculatePnl(entryPrice: number, exitPrice: number, quantity: number, side: 'BUY' | 'SELL'): number {
    if (side === 'BUY') {
      return (exitPrice - entryPrice) * quantity;
    } else {
      return (entryPrice - exitPrice) * quantity;
    }
  }

  private calculateEnhancedResults(
    trades: TradeResult[],
    initialBalance: number,
    finalBalance: number,
    maxDrawdown: number,
    maxDrawdownPercent: number,
    peakBalance: number,
    historicalData: MarketData[],
    equityCurve: EquityPoint[],
    drawdownCurve: DrawdownPoint[]
  ): EnhancedBacktestResult {
    const winningTrades = trades.filter(t => (t.profitLoss || 0) > 0);
    const losingTrades = trades.filter(t => (t.profitLoss || 0) < 0);
    const totalProfit = winningTrades.reduce((sum, t) => sum + (t.profitLoss || 0), 0);
    const totalLoss = Math.abs(losingTrades.reduce((sum, t) => sum + (t.profitLoss || 0), 0));
    const averageProfit = winningTrades.length > 0 ? totalProfit / winningTrades.length : 0;
    const averageLoss = losingTrades.length > 0 ? totalLoss / losingTrades.length : 0;
    const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? Infinity : 0;
    const winRate = trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0;

    // Calculate average Risk/Reward
    const avgRR = this.calculateAverageRR(trades);
    const totalPnl = finalBalance - initialBalance;

    // Calculate Sharpe Ratio
    const sharpeRatio = this.calculateSharpeRatio(trades, historicalData);

    // Calculate Sortino Ratio
    const sortinoRatio = this.calculateSortinoRatio(trades);

    // Calculate Calmar Ratio
    const calmarRatio = maxDrawdownPercent > 0 ? (totalPnl / initialBalance) / (maxDrawdownPercent / 100) : 0;

    // Calculate Recovery Factor
    const recoveryFactor = maxDrawdown > 0 ? totalPnl / maxDrawdown : 0;

    // Calculate Expectancy
    const expectancy = this.calculateExpectancy(trades, winRate);

    // Find best and worst trades
    const bestTrade = trades.length > 0 ? trades.reduce((best, t) => 
      (t.profitLoss || 0) > (best.profitLoss || 0) ? t : best
    ) : null;
    const worstTrade = trades.length > 0 ? trades.reduce((worst, t) => 
      (t.profitLoss || 0) < (worst.profitLoss || 0) ? t : worst
    ) : null;

    const largestWin = bestTrade?.profitLoss || 0;
    const largestLoss = Math.abs(worstTrade?.profitLoss || 0);

    // Calculate consecutive wins/losses
    const { consecutiveWins, consecutiveLosses } = this.calculateConsecutiveStreaks(trades);

    // Calculate average durations
    const averageWinDuration = winningTrades.length > 0
      ? winningTrades.reduce((sum, t) => sum + (t.duration || 0), 0) / winningTrades.length
      : 0;
    const averageLossDuration = losingTrades.length > 0
      ? losingTrades.reduce((sum, t) => sum + (t.duration || 0), 0) / losingTrades.length
      : 0;

    // Monthly breakdown
    const monthlyBreakdown = this.calculateMonthlyBreakdown(trades, initialBalance, historicalData);

    // Trade distribution
    const tradeDistribution = this.calculateTradeDistribution(trades);

    // Risk metrics
    const riskMetrics = this.calculateRiskMetrics(trades, drawdownCurve);

    return {
      strategyName: trades[0]?.strategyName || 'Unknown',
      startDate: historicalData[0]?.timestamp || new Date(),
      endDate: historicalData[historicalData.length - 1]?.timestamp || new Date(),
      totalTrades: trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate,
      totalProfitLoss: totalPnl,
      averageProfit,
      averageLoss,
      profitFactor,
      maxDrawdown,
      maxDrawdownPercent,
      sharpeRatio,
      sortinoRatio,
      calmarRatio,
      recoveryFactor,
      expectancy,
      averageRR: avgRR,
      bestTrade,
      worstTrade,
      largestWin,
      largestLoss,
      consecutiveWins,
      consecutiveLosses,
      averageWinDuration,
      averageLossDuration,
      monthlyBreakdown,
      equityCurve,
      drawdownCurve,
      tradeDistribution,
      riskMetrics,
      trades,
    };
  }

  private calculateAverageRR(trades: TradeResult[]): number {
    if (trades.length === 0) return 0;

    const rrs: number[] = [];
    for (const trade of trades) {
      if (trade.profitLoss && trade.profitLoss > 0 && trade.entryPrice && trade.exitPrice) {
        // Simplified RR calculation - in production, use actual risk amount
        const risk = Math.abs(trade.entryPrice - (trade.exitPrice - trade.profitLoss / (trade.quantity || 1)));
        const reward = Math.abs(trade.exitPrice - trade.entryPrice);
        if (risk > 0) {
          rrs.push(reward / risk);
        }
      }
    }

    return rrs.length > 0 ? rrs.reduce((a, b) => a + b, 0) / rrs.length : 0;
  }

  private calculateSharpeRatio(trades: TradeResult[], historicalData: MarketData[]): number {
    if (trades.length < 2) return 0;

    const returns = trades.map(t => (t.profitLoss || 0) / (t.entryPrice * (t.quantity || 1)));
    const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    // Risk-free rate assumed to be 0 for simplicity
    return stdDev > 0 ? meanReturn / stdDev : 0;
  }

  private calculateSortinoRatio(trades: TradeResult[]): number {
    if (trades.length < 2) return 0;

    const returns = trades.map(t => (t.profitLoss || 0) / (t.entryPrice * (t.quantity || 1)));
    const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const negativeReturns = returns.filter(r => r < 0);
    const downsideVariance = negativeReturns.length > 0
      ? negativeReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / negativeReturns.length
      : 0;
    const downsideStdDev = Math.sqrt(downsideVariance);

    return downsideStdDev > 0 ? meanReturn / downsideStdDev : 0;
  }

  private calculateExpectancy(trades: TradeResult[], winRate: number): number {
    if (trades.length === 0) return 0;

    const winningTrades = trades.filter(t => (t.profitLoss || 0) > 0);
    const losingTrades = trades.filter(t => (t.profitLoss || 0) < 0);

    const avgWin = winningTrades.length > 0
      ? winningTrades.reduce((sum, t) => sum + (t.profitLoss || 0), 0) / winningTrades.length
      : 0;
    const avgLoss = losingTrades.length > 0
      ? Math.abs(losingTrades.reduce((sum, t) => sum + (t.profitLoss || 0), 0) / losingTrades.length)
      : 0;

    return (winRate / 100) * avgWin - ((100 - winRate) / 100) * avgLoss;
  }

  private calculateConsecutiveStreaks(trades: TradeResult[]): { consecutiveWins: number; consecutiveLosses: number } {
    let maxConsecutiveWins = 0;
    let maxConsecutiveLosses = 0;
    let currentWins = 0;
    let currentLosses = 0;

    for (const trade of trades) {
      if ((trade.profitLoss || 0) > 0) {
        currentWins++;
        currentLosses = 0;
        maxConsecutiveWins = Math.max(maxConsecutiveWins, currentWins);
      } else if ((trade.profitLoss || 0) < 0) {
        currentLosses++;
        currentWins = 0;
        maxConsecutiveLosses = Math.max(maxConsecutiveLosses, currentLosses);
      }
    }

    return {
      consecutiveWins: maxConsecutiveWins,
      consecutiveLosses: maxConsecutiveLosses,
    };
  }

  private calculateMonthlyBreakdown(
    trades: TradeResult[],
    initialBalance: number,
    historicalData: MarketData[]
  ): MonthlyPerformance[] {
    const monthlyData: Map<string, {
      trades: TradeResult[];
      startBalance: number;
      endBalance: number;
    }> = new Map();

    let currentBalance = initialBalance;

    for (const trade of trades) {
      const month = `${trade.closedAt?.getFullYear()}-${String(trade.closedAt?.getMonth() || 0 + 1).padStart(2, '0')}`;
      
      if (!monthlyData.has(month)) {
        monthlyData.set(month, {
          trades: [],
          startBalance: currentBalance,
          endBalance: currentBalance,
        });
      }

      const monthData = monthlyData.get(month)!;
      monthData.trades.push(trade);
      currentBalance += trade.profitLoss || 0;
      monthData.endBalance = currentBalance;
    }

    return Array.from(monthlyData.entries()).map(([month, data]) => {
      const winningTrades = data.trades.filter(t => (t.profitLoss || 0) > 0);
      const losingTrades = data.trades.filter(t => (t.profitLoss || 0) < 0);
      const totalPnl = data.endBalance - data.startBalance;
      const pnlPercent = data.startBalance > 0 ? (totalPnl / data.startBalance) * 100 : 0;
      const winRate = data.trades.length > 0 ? (winningTrades.length / data.trades.length) * 100 : 0;
      const averagePnl = data.trades.length > 0 ? totalPnl / data.trades.length : 0;

      // Calculate monthly drawdown
      let monthPeak = data.startBalance;
      let monthMaxDrawdown = 0;
      let monthBalance = data.startBalance;
      for (const trade of data.trades) {
        monthBalance += trade.profitLoss || 0;
        if (monthBalance > monthPeak) {
          monthPeak = monthBalance;
        }
        const drawdown = monthPeak - monthBalance;
        if (drawdown > monthMaxDrawdown) {
          monthMaxDrawdown = drawdown;
        }
      }

      return {
        month,
        startBalance: data.startBalance,
        endBalance: data.endBalance,
        totalPnl,
        pnlPercent,
        trades: data.trades.length,
        winningTrades: winningTrades.length,
        losingTrades: losingTrades.length,
        winRate,
        averagePnl,
        maxDrawdown: monthMaxDrawdown,
        maxDrawdownPercent: monthPeak > 0 ? (monthMaxDrawdown / monthPeak) * 100 : 0,
      };
    });
  }

  private calculateTradeDistribution(trades: TradeResult[]): EnhancedBacktestResult['tradeDistribution'] {
    const byHour: Record<number, { trades: number; wins: number; totalPnl: number }> = {};
    const byDayOfWeek: Record<string, { trades: number; wins: number; totalPnl: number }> = {};
    const byMonth: Record<string, { trades: number; wins: number; totalPnl: number }> = {};

    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    for (const trade of trades) {
      const date = trade.closedAt || new Date();
      const hour = date.getHours();
      const dayOfWeek = daysOfWeek[date.getDay()];
      const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      // By hour
      if (!byHour[hour]) {
        byHour[hour] = { trades: 0, wins: 0, totalPnl: 0 };
      }
      byHour[hour].trades++;
      if ((trade.profitLoss || 0) > 0) byHour[hour].wins++;
      byHour[hour].totalPnl += trade.profitLoss || 0;

      // By day of week
      if (!byDayOfWeek[dayOfWeek]) {
        byDayOfWeek[dayOfWeek] = { trades: 0, wins: 0, totalPnl: 0 };
      }
      byDayOfWeek[dayOfWeek].trades++;
      if ((trade.profitLoss || 0) > 0) byDayOfWeek[dayOfWeek].wins++;
      byDayOfWeek[dayOfWeek].totalPnl += trade.profitLoss || 0;

      // By month
      if (!byMonth[month]) {
        byMonth[month] = { trades: 0, wins: 0, totalPnl: 0 };
      }
      byMonth[month].trades++;
      if ((trade.profitLoss || 0) > 0) byMonth[month].wins++;
      byMonth[month].totalPnl += trade.profitLoss || 0;
    }

    return {
      byHour: Object.fromEntries(
        Object.entries(byHour).map(([hour, data]) => [
          parseInt(hour),
          {
            trades: data.trades,
            winRate: data.trades > 0 ? (data.wins / data.trades) * 100 : 0,
            avgPnl: data.trades > 0 ? data.totalPnl / data.trades : 0,
          },
        ])
      ),
      byDayOfWeek: Object.fromEntries(
        Object.entries(byDayOfWeek).map(([day, data]) => [
          day,
          {
            trades: data.trades,
            winRate: data.trades > 0 ? (data.wins / data.trades) * 100 : 0,
            avgPnl: data.trades > 0 ? data.totalPnl / data.trades : 0,
          },
        ])
      ),
      byMonth: Object.fromEntries(
        Object.entries(byMonth).map(([month, data]) => [
          month,
          {
            trades: data.trades,
            winRate: data.trades > 0 ? (data.wins / data.trades) * 100 : 0,
            avgPnl: data.trades > 0 ? data.totalPnl / data.trades : 0,
          },
        ])
      ),
    };
  }

  private calculateRiskMetrics(
    trades: TradeResult[],
    drawdownCurve: DrawdownPoint[]
  ): EnhancedBacktestResult['riskMetrics'] {
    const { consecutiveLosses } = this.calculateConsecutiveStreaks(trades);
    const { consecutiveWins } = this.calculateConsecutiveStreaks(trades);

    // Calculate max drawdown duration
    let maxDrawdownDuration = 0;
    let drawdownStart: Date | null = null;
    for (const point of drawdownCurve) {
      if (point.drawdown > 0) {
        if (!drawdownStart) {
          drawdownStart = point.timestamp;
        }
      } else {
        if (drawdownStart) {
          const duration = point.timestamp.getTime() - drawdownStart.getTime();
          maxDrawdownDuration = Math.max(maxDrawdownDuration, duration);
          drawdownStart = null;
        }
      }
    }

    // Calculate recovery time (time to recover from max drawdown)
    let recoveryTime = 0;
    let maxDrawdownPoint: DrawdownPoint | null = null;
    for (const point of drawdownCurve) {
      if (!maxDrawdownPoint || point.drawdown > maxDrawdownPoint.drawdown) {
        maxDrawdownPoint = point;
      }
      if (maxDrawdownPoint && point.drawdown === 0 && point.timestamp > maxDrawdownPoint.timestamp) {
        recoveryTime = point.timestamp.getTime() - maxDrawdownPoint.timestamp.getTime();
        break;
      }
    }

    // Calculate RR distribution
    const rrDistribution: Map<number, number> = new Map();
    for (const trade of trades) {
      if (trade.profitLoss && trade.entryPrice && trade.exitPrice) {
        // Simplified RR calculation
        const risk = Math.abs(trade.entryPrice - (trade.exitPrice - trade.profitLoss / (trade.quantity || 1)));
        const reward = Math.abs(trade.exitPrice - trade.entryPrice);
        if (risk > 0) {
          const rr = Math.round((reward / risk) * 10) / 10; // Round to 1 decimal
          rrDistribution.set(rr, (rrDistribution.get(rr) || 0) + 1);
        }
      }
    }

    return {
      maxConsecutiveLosses: consecutiveLosses,
      maxConsecutiveWins: consecutiveWins,
      maxDrawdownDuration,
      recoveryTime,
      riskRewardDistribution: Array.from(rrDistribution.entries())
        .map(([rr, count]) => ({ rr, count }))
        .sort((a, b) => a.rr - b.rr),
    };
  }

  async loadHistoricalData(symbol: string, startDate: Date, endDate: Date): Promise<MarketData[]> {
    throw new Error('loadHistoricalData not implemented - use external data source');
  }
}

