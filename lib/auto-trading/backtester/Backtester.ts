/**
 * Backtester
 * Tests strategies on historical data
 */

import { IBacktester } from '../interfaces';
import { IStrategy } from '../interfaces';
import { MarketData, StrategyConfig, BacktestResult, TradeResult, StrategySignal } from '../types';
import { RiskManager } from '../risk-manager/RiskManager';

export class Backtester implements IBacktester {
  private riskManager: RiskManager;

  constructor(riskLimits: any) {
    this.riskManager = new RiskManager(riskLimits);
  }

  async backtest(
    strategy: IStrategy,
    historicalData: MarketData[],
    initialBalance: number,
    config: StrategyConfig
  ): Promise<BacktestResult> {
    let balance = initialBalance;
    let peakBalance = initialBalance;
    let maxDrawdown = 0;
    const trades: TradeResult[] = [];
    const openPositions: Map<string, { signal: StrategySignal; entryPrice: number; entryTime: Date }> = new Map();

    // Sort data by timestamp
    const sortedData = [...historicalData].sort((a, b) => 
      a.timestamp.getTime() - b.timestamp.getTime()
    );

    for (let i = 0; i < sortedData.length; i++) {
      const marketData = sortedData[i];
      const previousData = sortedData.slice(Math.max(0, i - 100), i); // Last 100 candles

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
          unrealizedPnl: 0,
          unrealizedPnlPercent: 0,
          status: 'OPEN',
          openedAt: pos.entryTime,
        }))
      );

      if (!canTrade) {
        continue;
      }

      // Analyze and generate signal
      const signal = await strategy.analyze(marketData, previousData);

      if (signal) {
        // Check if we should enter
        const shouldEnter = await strategy.shouldEnter(marketData, previousData);

        if (shouldEnter) {
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
            });
          }
        }
      }

      // Check exit conditions for open positions
      for (const [tradeId, position] of openPositions.entries()) {
        const positionObj = {
          positionId: tradeId,
          symbol: position.signal.symbol,
          side: position.signal.side,
          quantity: position.signal.quantity || 1,
          entryPrice: position.entryPrice,
          currentPrice: marketData.last,
          unrealizedPnl: 0,
          unrealizedPnlPercent: 0,
          status: 'OPEN' as const,
          openedAt: position.entryTime,
        };

        let shouldExit = await strategy.shouldExit(positionObj, marketData);

        // Check stop loss / take profit
        let exitReason: 'STOPPED' | 'TAKE_PROFIT' | 'CLOSED' = 'CLOSED';
        let exitPrice = marketData.last;

        if (position.signal.stopLoss) {
          if (position.signal.side === 'BUY' && marketData.last <= position.signal.stopLoss) {
            shouldExit = true;
            exitPrice = position.signal.stopLoss;
            exitReason = 'STOPPED';
          } else if (position.signal.side === 'SELL' && marketData.last >= position.signal.stopLoss) {
            shouldExit = true;
            exitPrice = position.signal.stopLoss;
            exitReason = 'STOPPED';
          }
        }

        if (position.signal.takeProfit) {
          if (position.signal.side === 'BUY' && marketData.last >= position.signal.takeProfit) {
            shouldExit = true;
            exitPrice = position.signal.takeProfit;
            exitReason = 'TAKE_PROFIT';
          } else if (position.signal.side === 'SELL' && marketData.last <= position.signal.takeProfit) {
            shouldExit = true;
            exitPrice = position.signal.takeProfit;
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
          if (balance > peakBalance) {
            peakBalance = balance;
          }

          const drawdown = peakBalance - balance;
          if (drawdown > maxDrawdown) {
            maxDrawdown = drawdown;
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
          openPositions.delete(tradeId);
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

      trades.push({
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
      });
    }

    return this.calculateResults(trades, initialBalance, balance, maxDrawdown, peakBalance, sortedData);
  }

  private calculatePnl(entryPrice: number, exitPrice: number, quantity: number, side: 'BUY' | 'SELL'): number {
    if (side === 'BUY') {
      return (exitPrice - entryPrice) * quantity;
    } else {
      return (entryPrice - exitPrice) * quantity;
    }
  }

  private calculateResults(
    trades: TradeResult[],
    initialBalance: number,
    finalBalance: number,
    maxDrawdown: number,
    peakBalance: number,
    historicalData: MarketData[]
  ): BacktestResult {
    const winningTrades = trades.filter(t => (t.profitLoss || 0) > 0);
    const losingTrades = trades.filter(t => (t.profitLoss || 0) < 0);
    const totalProfit = winningTrades.reduce((sum, t) => sum + (t.profitLoss || 0), 0);
    const totalLoss = Math.abs(losingTrades.reduce((sum, t) => sum + (t.profitLoss || 0), 0));
    const averageProfit = winningTrades.length > 0 ? totalProfit / winningTrades.length : 0;
    const averageLoss = losingTrades.length > 0 ? totalLoss / losingTrades.length : 0;
    const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? Infinity : 0;
    const winRate = trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0;

    // Calculate average Risk/Reward
    const avgRR = trades.reduce((sum, t) => {
      if (t.profitLoss && t.profitLoss > 0) {
        // Simplified RR calculation
        return sum + 1.5; // Placeholder
      }
      return sum;
    }, 0) / trades.length;

    const totalPnl = finalBalance - initialBalance;
    const maxDrawdownPercent = peakBalance > 0 ? (maxDrawdown / peakBalance) * 100 : 0;

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
      averageRR: avgRR,
      trades,
    };
  }

  async loadHistoricalData(symbol: string, startDate: Date, endDate: Date): Promise<MarketData[]> {
    // This would load from a file or API
    // For now, return empty array - implement based on data source
    throw new Error('loadHistoricalData not implemented - use external data source');
  }
}




