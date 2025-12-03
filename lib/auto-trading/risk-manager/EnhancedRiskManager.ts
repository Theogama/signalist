/**
 * Enhanced Risk Manager
 * Advanced risk management with dynamic SL/TP, breakeven, trailing stops, and daily limits
 */

import { IRiskManager } from '../interfaces';
import { StrategySignal, Position, RiskLimits, TradeResult, MarketData } from '../types';
import { calculateATR } from '../utils/technical-indicators';

export interface EnhancedRiskLimits extends RiskLimits {
  // Dynamic SL/TP settings
  useATRForSL?: boolean;
  atrMultiplier?: number; // Multiplier for ATR-based stops (e.g., 2x ATR)
  minStopLossPercent?: number; // Minimum stop loss as % of entry
  maxStopLossPercent?: number; // Maximum stop loss as % of entry
  
  // Breakeven settings
  enableBreakeven?: boolean;
  breakevenTriggerRR?: number; // Move to breakeven when profit reaches this RR (e.g., 1:1)
  breakevenTriggerPips?: number; // Alternative: move to breakeven after X pips profit
  
  // Trailing stop settings
  enableTrailingStop?: boolean;
  trailingStopDistance?: number; // Distance in pips or price units
  trailingStopPercent?: number; // Distance as % of entry price
  trailingStopATRMultiplier?: number; // Use ATR multiplier for trailing distance
  
  // Daily limits
  maxDailyTrades?: number;
  maxDailyLoss?: number; // % of balance
  maxDailyProfit?: number; // % of balance - auto-shutoff when reached
  dailyProfitTarget?: number; // % of balance - target to reach
  
  // Position limits
  maxTradesPerSession?: number; // Max trades per trading session
  maxLotSize?: number; // Maximum lot size per trade
  minLotSize?: number; // Minimum lot size per trade
}

export interface PositionTracker {
  positionId: string;
  entryPrice: number;
  side: 'BUY' | 'SELL';
  stopLoss: number;
  takeProfit: number;
  originalStopLoss: number;
  originalTakeProfit: number;
  breakevenTriggered: boolean;
  trailingStopActivated: boolean;
  highestPrice: number; // For BUY positions
  lowestPrice: number; // For SELL positions
  atrValue?: number; // ATR at entry
}

export class EnhancedRiskManager implements IRiskManager {
  private limits: EnhancedRiskLimits;
  private dailyPnl: number = 0;
  private dailyTrades: number = 0;
  private dailyProfit: number = 0;
  private peakBalance: number = 0;
  private maxDrawdown: number = 0;
  private trades: TradeResult[] = [];
  private dailyResetTime: number = 0;
  private sessionTrades: number = 0;
  private sessionResetTime: number = 0;
  private positionTrackers: Map<string, PositionTracker> = new Map();
  private isShutOff: boolean = false;

  constructor(limits: EnhancedRiskLimits) {
    this.limits = limits;
    this.peakBalance = limits.minAccountBalance || 10000;
    this.resetDailyCounters();
    this.resetSessionCounters();
  }

  private resetDailyCounters(): void {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    this.dailyResetTime = tomorrow.getTime();
    
    if (Date.now() >= this.dailyResetTime) {
      this.dailyPnl = 0;
      this.dailyTrades = 0;
      this.dailyProfit = 0;
      this.isShutOff = false;
      this.resetDailyCounters();
    }
  }

  private resetSessionCounters(): void {
    const now = new Date();
    const nextHour = new Date(now);
    nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
    this.sessionResetTime = nextHour.getTime();
    
    if (Date.now() >= this.sessionResetTime) {
      this.sessionTrades = 0;
      this.resetSessionCounters();
    }
  }

  /**
   * Calculate dynamic stop loss based on ATR
   */
  calculateDynamicStopLoss(
    entryPrice: number,
    side: 'BUY' | 'SELL',
    atr: number,
    marketData: MarketData[]
  ): number {
    if (!this.limits.useATRForSL || !atr) {
      // Fallback to percentage-based
      const percent = this.limits.minStopLossPercent || this.limits.maxRiskPerTrade || 1;
      return side === 'BUY'
        ? entryPrice * (1 - percent / 100)
        : entryPrice * (1 + percent / 100);
    }

    const multiplier = this.limits.atrMultiplier || 2;
    const stopDistance = atr * multiplier;

    const stopLoss = side === 'BUY'
      ? entryPrice - stopDistance
      : entryPrice + stopDistance;

    // Apply min/max constraints
    const minPercent = this.limits.minStopLossPercent || 0.5;
    const maxPercent = this.limits.maxStopLossPercent || 5;
    
    const minStop = side === 'BUY'
      ? entryPrice * (1 - maxPercent / 100)
      : entryPrice * (1 + maxPercent / 100);
    
    const maxStop = side === 'BUY'
      ? entryPrice * (1 - minPercent / 100)
      : entryPrice * (1 + minPercent / 100);

    return Math.max(minStop, Math.min(maxStop, stopLoss));
  }

  /**
   * Calculate dynamic take profit based on risk/reward ratio
   */
  calculateDynamicTakeProfit(
    entryPrice: number,
    stopLoss: number,
    side: 'BUY' | 'SELL',
    riskRewardRatio: number = 2
  ): number {
    const risk = Math.abs(entryPrice - stopLoss);
    const reward = risk * riskRewardRatio;

    return side === 'BUY'
      ? entryPrice + reward
      : entryPrice - reward;
  }

  /**
   * Check if breakeven should be triggered
   */
  checkBreakeven(
    position: Position,
    tracker: PositionTracker,
    currentPrice: number
  ): { shouldMove: boolean; newStopLoss: number } {
    if (!this.limits.enableBreakeven || tracker.breakevenTriggered) {
      return { shouldMove: false, newStopLoss: position.stopLoss || 0 };
    }

    const entryPrice = tracker.entryPrice;
    const side = tracker.side;
    
    // Check RR-based trigger
    if (this.limits.breakevenTriggerRR) {
      const risk = Math.abs(entryPrice - tracker.originalStopLoss);
      const currentProfit = side === 'BUY'
        ? currentPrice - entryPrice
        : entryPrice - currentPrice;
      
      if (risk > 0 && currentProfit >= risk * this.limits.breakevenTriggerRR) {
        return {
          shouldMove: true,
          newStopLoss: entryPrice, // Move to entry (breakeven)
        };
      }
    }

    // Check pips-based trigger
    if (this.limits.breakevenTriggerPips) {
      const profitPips = side === 'BUY'
        ? (currentPrice - entryPrice) / (entryPrice / 10000) // Approximate pips
        : (entryPrice - currentPrice) / (entryPrice / 10000);
      
      if (profitPips >= this.limits.breakevenTriggerPips) {
        return {
          shouldMove: true,
          newStopLoss: entryPrice,
        };
      }
    }

    return { shouldMove: false, newStopLoss: position.stopLoss || 0 };
  }

  /**
   * Calculate trailing stop loss
   */
  calculateTrailingStop(
    position: Position,
    tracker: PositionTracker,
    currentPrice: number,
    atr?: number
  ): { shouldUpdate: boolean; newStopLoss: number } {
    if (!this.limits.enableTrailingStop) {
      return { shouldUpdate: false, newStopLoss: position.stopLoss || 0 };
    }

    const side = tracker.side;
    let trailingDistance: number;

    // Calculate trailing distance
    if (this.limits.trailingStopATRMultiplier && atr) {
      trailingDistance = atr * this.limits.trailingStopATRMultiplier;
    } else if (this.limits.trailingStopPercent) {
      trailingDistance = tracker.entryPrice * (this.limits.trailingStopPercent / 100);
    } else if (this.limits.trailingStopDistance) {
      trailingDistance = this.limits.trailingStopDistance;
    } else {
      return { shouldUpdate: false, newStopLoss: position.stopLoss || 0 };
    }

    // Update highest/lowest price
    if (side === 'BUY') {
      if (currentPrice > tracker.highestPrice) {
        tracker.highestPrice = currentPrice;
        const newStopLoss = currentPrice - trailingDistance;
        
        // Only move stop loss up, never down
        if (newStopLoss > (position.stopLoss || tracker.originalStopLoss)) {
          tracker.trailingStopActivated = true;
          return {
            shouldUpdate: true,
            newStopLoss,
          };
        }
      }
    } else {
      // SELL
      if (currentPrice < tracker.lowestPrice || tracker.lowestPrice === 0) {
        tracker.lowestPrice = currentPrice;
        const newStopLoss = currentPrice + trailingDistance;
        
        // Only move stop loss down, never up
        if (newStopLoss < (position.stopLoss || tracker.originalStopLoss) || position.stopLoss === undefined) {
          tracker.trailingStopActivated = true;
          return {
            shouldUpdate: true,
            newStopLoss,
          };
        }
      }
    }

    return { shouldUpdate: false, newStopLoss: position.stopLoss || 0 };
  }

  /**
   * Track a new position
   */
  trackPosition(
    positionId: string,
    entryPrice: number,
    side: 'BUY' | 'SELL',
    stopLoss: number,
    takeProfit: number,
    atr?: number
  ): void {
    this.positionTrackers.set(positionId, {
      positionId,
      entryPrice,
      side,
      stopLoss,
      takeProfit,
      originalStopLoss: stopLoss,
      originalTakeProfit: takeProfit,
      breakevenTriggered: false,
      trailingStopActivated: false,
      highestPrice: side === 'BUY' ? entryPrice : 0,
      lowestPrice: side === 'SELL' ? entryPrice : 0,
      atrValue: atr,
    });
  }

  /**
   * Update position risk management (breakeven, trailing stop)
   */
  updatePositionRisk(
    position: Position,
    currentPrice: number,
    atr?: number
  ): { stopLoss?: number; takeProfit?: number; reason?: string } {
    const tracker = this.positionTrackers.get(position.positionId);
    if (!tracker) {
      return {};
    }

    const updates: { stopLoss?: number; takeProfit?: number; reason?: string } = {};

    // Check breakeven
    const breakevenCheck = this.checkBreakeven(position, tracker, currentPrice);
    if (breakevenCheck.shouldMove) {
      tracker.breakevenTriggered = true;
      updates.stopLoss = breakevenCheck.newStopLoss;
      updates.reason = 'Breakeven triggered';
    }

    // Check trailing stop (only if breakeven already triggered or trailing is independent)
    if (tracker.breakevenTriggered || !this.limits.enableBreakeven) {
      const trailingCheck = this.calculateTrailingStop(position, tracker, currentPrice, atr);
      if (trailingCheck.shouldUpdate) {
        updates.stopLoss = trailingCheck.newStopLoss;
        updates.reason = updates.reason 
          ? `${updates.reason}, Trailing stop updated`
          : 'Trailing stop updated';
      }
    }

    return updates;
  }

  /**
   * Remove position tracker
   */
  untrackPosition(positionId: string): void {
    this.positionTrackers.delete(positionId);
  }

  async canTrade(
    signal: StrategySignal,
    balance: number,
    openPositions: Position[]
  ): Promise<boolean> {
    // Reset counters if needed
    if (Date.now() >= this.dailyResetTime) {
      this.resetDailyCounters();
    }
    if (Date.now() >= this.sessionResetTime) {
      this.resetSessionCounters();
    }

    // Check if shut off
    if (this.isShutOff) {
      return false;
    }

    // Check minimum account balance
    if (this.limits.minAccountBalance && balance < this.limits.minAccountBalance) {
      return false;
    }

    // Check max concurrent positions
    if (openPositions.length >= this.limits.maxConcurrentPositions) {
      return false;
    }

    // Check daily loss limit
    if (!this.checkDailyLoss(balance, this.dailyPnl)) {
      this.isShutOff = true;
      return false;
    }

    // Check daily profit target (auto-shutoff)
    if (this.limits.maxDailyProfit && this.dailyProfit >= (balance * this.limits.maxDailyProfit) / 100) {
      this.isShutOff = true;
      return false;
    }

    // Check daily trade limit
    if (this.limits.maxDailyTrades && this.dailyTrades >= this.limits.maxDailyTrades) {
      return false;
    }

    // Check session trade limit
    if (this.limits.maxTradesPerSession && this.sessionTrades >= this.limits.maxTradesPerSession) {
      return false;
    }

    // Check drawdown
    if (!this.checkDrawdown(this.peakBalance, balance)) {
      this.isShutOff = true;
      return false;
    }

    // Check position size limits
    const maxPositionSize = this.calculateMaxPositionSize(
      balance,
      this.limits.maxRiskPerTrade,
      signal.entryPrice,
      signal.stopLoss
    );

    if (this.limits.maxLotSize && maxPositionSize > this.limits.maxLotSize) {
      return false;
    }

    if (this.limits.minLotSize && maxPositionSize < this.limits.minLotSize) {
      return false;
    }

    if (signal.quantity && signal.quantity > maxPositionSize) {
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
      return (balance * (this.limits.maxPositionSize || riskPercent)) / 100 / entryPrice;
    }

    const riskAmount = (balance * riskPercent) / 100;
    const priceRisk = Math.abs(entryPrice - stopLoss);
    
    if (priceRisk === 0) {
      return (balance * (this.limits.maxPositionSize || riskPercent)) / 100 / entryPrice;
    }

    const positionSize = riskAmount / priceRisk;
    const maxSize = (balance * (this.limits.maxPositionSize || riskPercent)) / 100 / entryPrice;
    
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
    this.sessionTrades++;

    if (trade.profitLoss) {
      this.dailyPnl += trade.profitLoss;
      if (trade.profitLoss > 0) {
        this.dailyProfit += trade.profitLoss;
      }
    }
  }

  getRiskMetrics(): {
    dailyPnl: number;
    dailyTrades: number;
    maxDrawdown: number;
    peakBalance: number;
    dailyProfit: number;
    sessionTrades: number;
    isShutOff: boolean;
  } {
    return {
      dailyPnl: this.dailyPnl,
      dailyTrades: this.dailyTrades,
      maxDrawdown: this.maxDrawdown,
      peakBalance: this.peakBalance,
      dailyProfit: this.dailyProfit,
      sessionTrades: this.sessionTrades,
      isShutOff: this.isShutOff,
    };
  }

  updateLimits(limits: Partial<EnhancedRiskLimits>): void {
    this.limits = { ...this.limits, ...limits };
  }

  getLimits(): EnhancedRiskLimits {
    return { ...this.limits };
  }

  resetShutOff(): void {
    this.isShutOff = false;
  }
}

