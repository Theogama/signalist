/**
 * Risk Manager
 * Enforces risk limits and position sizing rules
 */

import { IRiskManager } from '../interfaces';
import { StrategySignal, Position, RiskLimits, TradeResult } from '../types';

export class RiskManager implements IRiskManager {
  private limits: RiskLimits;
  private dailyPnl: number = 0;
  private dailyTrades: number = 0;
  private peakBalance: number = 0;
  private maxDrawdown: number = 0;
  private trades: TradeResult[] = [];
  private dailyResetTime: number = 0;

  constructor(limits: RiskLimits) {
    this.limits = limits;
    this.peakBalance = limits.minAccountBalance || 10000;
    this.resetDailyCounters();
  }

  private resetDailyCounters(): void {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    this.dailyResetTime = tomorrow.getTime();
    
    // Reset if it's a new day
    if (Date.now() >= this.dailyResetTime) {
      this.dailyPnl = 0;
      this.dailyTrades = 0;
      this.resetDailyCounters(); // Recalculate for next day
    }
  }

  async canTrade(
    signal: StrategySignal,
    balance: number,
    openPositions: Position[]
  ): Promise<boolean> {
    // Check if it's a new day and reset counters
    if (Date.now() >= this.dailyResetTime) {
      this.resetDailyCounters();
    }

    // Check minimum account balance
    if (this.limits.minAccountBalance && balance < this.limits.minAccountBalance) {
      console.warn(`Account balance ${balance} below minimum ${this.limits.minAccountBalance}`);
      return false;
    }

    // Check max concurrent positions
    if (openPositions.length >= this.limits.maxConcurrentPositions) {
      console.warn(`Max concurrent positions (${this.limits.maxConcurrentPositions}) reached`);
      return false;
    }

    // Check daily loss limit
    if (!this.checkDailyLoss(balance, this.dailyPnl)) {
      console.warn(`Daily loss limit exceeded: ${this.dailyPnl}`);
      return false;
    }

    // Check drawdown
    if (!this.checkDrawdown(this.peakBalance, balance)) {
      console.warn(`Max drawdown exceeded: ${((balance - this.peakBalance) / this.peakBalance) * 100}%`);
      return false;
    }

    // Check position size
    const maxPositionSize = this.calculateMaxPositionSize(
      balance,
      this.limits.maxRiskPerTrade,
      signal.entryPrice,
      signal.stopLoss
    );

    if (signal.quantity && signal.quantity > maxPositionSize) {
      console.warn(`Position size ${signal.quantity} exceeds max ${maxPositionSize}`);
      return false;
    }

    return true;
  }

  calculateMaxPositionSize(
    balance: number,
    riskPercent: number,
    entryPrice: number,
    stopLoss?: number
  ): number {
    if (!stopLoss || stopLoss === entryPrice) {
      // If no stop loss, use max position size limit
      return (balance * this.limits.maxPositionSize) / 100;
    }

    // Calculate position size based on risk
    const riskAmount = (balance * riskPercent) / 100;
    const priceRisk = Math.abs(entryPrice - stopLoss);
    
    if (priceRisk === 0) {
      return (balance * this.limits.maxPositionSize) / 100;
    }

    const positionSize = riskAmount / priceRisk;
    const maxSize = (balance * this.limits.maxPositionSize) / 100;
    
    return Math.min(positionSize, maxSize);
  }

  checkDailyLoss(balance: number, dailyPnl: number): boolean {
    if (this.limits.maxDailyLoss === undefined) {
      return true;
    }

    const dailyLossPercent = (Math.abs(dailyPnl) / balance) * 100;
    return dailyLossPercent <= this.limits.maxDailyLoss;
  }

  checkDrawdown(peakBalance: number, currentBalance: number): boolean {
    if (this.limits.maxDrawdown === undefined) {
      return true;
    }

    if (currentBalance > peakBalance) {
      this.peakBalance = currentBalance;
      return true;
    }

    const drawdown = peakBalance - currentBalance;
    const drawdownPercent = (drawdown / peakBalance) * 100;
    
    if (drawdown > this.maxDrawdown) {
      this.maxDrawdown = drawdown;
    }

    return drawdownPercent <= this.limits.maxDrawdown;
  }

  recordTrade(trade: TradeResult): void {
    this.trades.push(trade);
    this.dailyTrades++;

    if (trade.profitLoss) {
      this.dailyPnl += trade.profitLoss;
    }

    // Update peak balance
    if (trade.profitLoss && trade.profitLoss > 0) {
      // This would need to be calculated based on account balance
      // For now, we track it separately
    }
  }

  getRiskMetrics(): {
    dailyPnl: number;
    dailyTrades: number;
    maxDrawdown: number;
    peakBalance: number;
  } {
    return {
      dailyPnl: this.dailyPnl,
      dailyTrades: this.dailyTrades,
      maxDrawdown: this.maxDrawdown,
      peakBalance: this.peakBalance,
    };
  }

  updateLimits(limits: Partial<RiskLimits>): void {
    this.limits = { ...this.limits, ...limits };
  }

  getLimits(): RiskLimits {
    return { ...this.limits };
  }
}












