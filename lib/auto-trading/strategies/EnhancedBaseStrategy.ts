/**
 * Enhanced Base Strategy
 * Advanced strategy with SMC concepts, confirmation layers, and smart filters
 */

import { BaseStrategy } from './BaseStrategy';
import { StrategySignal, MarketData, Position } from '../types';
import {
  calculateEMA,
  calculateRSI,
  calculateATR,
  calculateVWAP,
  detectTrend,
  detectFairValueGap,
  calculateVolatility,
} from '../utils/technical-indicators';
import {
  analyzeMarketStructure,
  detectLiquidityGrab,
  detectConsolidation,
} from '../utils/market-analysis';
import {
  applySmartFilters,
  isWithinTradingSession,
  getCurrentSession,
} from '../utils/smart-filters';
import { NewsEvent } from '../utils/smart-filters';

export interface EnhancedStrategyConfig {
  // SMC Settings
  useSMC?: boolean;
  requireBOS?: boolean; // Require Break of Structure
  requireCHoCH?: boolean; // Require Change of Character
  useLiquidityGrab?: boolean;
  
  // Confirmation Layers
  useEMA?: boolean;
  emaPeriod?: number;
  emaFastPeriod?: number;
  emaSlowPeriod?: number;
  
  useRSI?: boolean;
  rsiPeriod?: number;
  rsiOverbought?: number;
  rsiOversold?: number;
  
  useVolume?: boolean;
  minVolumePercent?: number; // Minimum volume vs average
  
  useVWAP?: boolean;
  vwapDeviation?: number; // Price deviation from VWAP
  
  useFVG?: boolean; // Fair Value Gap
  
  // Filters
  useVolatilityFilter?: boolean;
  minVolatility?: number;
  maxVolatility?: number;
  
  useSessionFilter?: boolean;
  allowedSessions?: Array<'Asian' | 'London' | 'New York'>;
  
  useNewsFilter?: boolean;
  upcomingNews?: NewsEvent[];
  
  useConsolidationFilter?: boolean; // Avoid trading during consolidation
  
  // Risk Management
  useATRForSL?: boolean;
  atrMultiplier?: number;
  riskRewardRatio?: number; // Default RR ratio
  
  // Lookback periods
  lookbackPeriod?: number;
  structureLookback?: number;
}

export abstract class EnhancedBaseStrategy extends BaseStrategy {
  protected enhancedConfig: EnhancedStrategyConfig;

  constructor(name: string, config: any) {
    super(name, config);
    this.enhancedConfig = {
      useSMC: true,
      requireBOS: false,
      requireCHoCH: false,
      useLiquidityGrab: true,
      useEMA: true,
      emaPeriod: 20,
      emaFastPeriod: 9,
      emaSlowPeriod: 21,
      useRSI: true,
      rsiPeriod: 14,
      rsiOverbought: 70,
      rsiOversold: 30,
      useVolume: true,
      minVolumePercent: 80,
      useVWAP: false,
      vwapDeviation: 0.5,
      useFVG: true,
      useVolatilityFilter: true,
      minVolatility: 0.3,
      maxVolatility: 3.0,
      useSessionFilter: false,
      allowedSessions: ['London', 'New York'],
      useNewsFilter: true,
      useConsolidationFilter: true,
      useATRForSL: true,
      atrMultiplier: 2,
      riskRewardRatio: 2,
      lookbackPeriod: 50,
      structureLookback: 50,
      ...config.enhancedConfig,
    };
  }

  /**
   * Enhanced analyze method with all filters and confirmations
   */
  async analyze(
    marketData: MarketData,
    historicalData?: MarketData[]
  ): Promise<StrategySignal | null> {
    if (!historicalData || historicalData.length < (this.enhancedConfig.lookbackPeriod || 50)) {
      return null;
    }

    // Apply smart filters
    const filterResult = applySmartFilters(
      marketData,
      historicalData,
      marketData.symbol,
      this.enhancedConfig.upcomingNews,
      0.1 // max spread percent
    );

    if (!filterResult.canTrade) {
      return null; // Blocked by filters
    }

    // Check session filter
    if (this.enhancedConfig.useSessionFilter && this.enhancedConfig.allowedSessions) {
      const currentSession = getCurrentSession();
      if (!currentSession || !this.enhancedConfig.allowedSessions.includes(currentSession.name as any)) {
        return null; // Not in allowed session
      }
    }

    // Check consolidation filter
    if (this.enhancedConfig.useConsolidationFilter && detectConsolidation(historicalData)) {
      return null; // Avoid trading during consolidation
    }

    // Analyze market structure (SMC)
    let marketStructure;
    if (this.enhancedConfig.useSMC) {
      marketStructure = analyzeMarketStructure(
        historicalData,
        this.enhancedConfig.structureLookback
      );

      // Check BOS requirement
      if (this.enhancedConfig.requireBOS && !marketStructure.hasBOS) {
        return null;
      }

      // Check CHoCH requirement
      if (this.enhancedConfig.requireCHoCH && !marketStructure.hasCHoCH) {
        return null;
      }
    }

    // Get base signal from strategy-specific logic
    const baseSignal = await this.analyzeBase(marketData, historicalData);
    if (!baseSignal) {
      return null;
    }

    // Apply confirmation layers
    const confirmed = await this.applyConfirmations(
      baseSignal,
      marketData,
      historicalData,
      marketStructure
    );

    if (!confirmed) {
      return null;
    }

    // Calculate enhanced stop loss and take profit
    const prices = historicalData.map(d => d.last);
    const highs = historicalData.map(d => d.high24h || d.last * 1.001);
    const lows = historicalData.map(d => d.low24h || d.last * 0.999);

    let stopLoss = baseSignal.stopLoss;
    let takeProfit = baseSignal.takeProfit;

    if (this.enhancedConfig.useATRForSL) {
      const atr = calculateATR(highs, lows, prices, 14);
      if (atr.length > 0) {
        const currentATR = atr[atr.length - 1];
        const multiplier = this.enhancedConfig.atrMultiplier || 2;
        const stopDistance = currentATR * multiplier;

        stopLoss = baseSignal.side === 'BUY'
          ? baseSignal.entryPrice - stopDistance
          : baseSignal.entryPrice + stopDistance;

        // Calculate TP based on RR ratio
        const risk = stopDistance;
        const reward = risk * (this.enhancedConfig.riskRewardRatio || 2);
        takeProfit = baseSignal.side === 'BUY'
          ? baseSignal.entryPrice + reward
          : baseSignal.entryPrice - reward;
      }
    }

    // Build detailed reason
    const reasons: string[] = [];
    if (baseSignal.reason) {
      reasons.push(baseSignal.reason);
    }
    if (marketStructure) {
      reasons.push(`Structure: ${marketStructure.structure}, Trend: ${marketStructure.trend}`);
      if (marketStructure.hasBOS) reasons.push('BOS detected');
      if (marketStructure.hasCHoCH) reasons.push('CHoCH detected');
    }
    if (filterResult.warnings.length > 0) {
      reasons.push(`Warnings: ${filterResult.warnings.join(', ')}`);
    }

    return {
      ...baseSignal,
      stopLoss,
      takeProfit,
      reason: reasons.join(' | '),
      confidence: this.calculateConfidence(baseSignal, marketStructure, historicalData),
    };
  }

  /**
   * Strategy-specific analysis (to be implemented by subclasses)
   */
  protected abstract analyzeBase(
    marketData: MarketData,
    historicalData: MarketData[]
  ): Promise<StrategySignal | null>;

  /**
   * Apply confirmation layers
   */
  protected async applyConfirmations(
    signal: StrategySignal,
    marketData: MarketData,
    historicalData: MarketData[],
    marketStructure?: any
  ): Promise<boolean> {
    const prices = historicalData.map(d => d.last);
    const volumes = historicalData.map(d => d.volume || 0);

    // EMA confirmation
    if (this.enhancedConfig.useEMA) {
      const emaPeriod = this.enhancedConfig.emaPeriod || 20;
      if (prices.length >= emaPeriod) {
        const ema = calculateEMA(prices, emaPeriod);
        const currentEMA = ema[ema.length - 1];
        const currentPrice = marketData.last;

        // For BUY: price should be above EMA (bullish)
        // For SELL: price should be below EMA (bearish)
        if (signal.side === 'BUY' && currentPrice < currentEMA) {
          return false;
        }
        if (signal.side === 'SELL' && currentPrice > currentEMA) {
          return false;
        }

        // Optional: Check EMA crossover
        if (this.enhancedConfig.emaFastPeriod && this.enhancedConfig.emaSlowPeriod) {
          const fastEMA = calculateEMA(prices, this.enhancedConfig.emaFastPeriod);
          const slowEMA = calculateEMA(prices, this.enhancedConfig.emaSlowPeriod);
          
          if (fastEMA.length > 0 && slowEMA.length > 0) {
            const fast = fastEMA[fastEMA.length - 1];
            const slow = slowEMA[slowEMA.length - 1];
            
            // For BUY: fast EMA should be above slow EMA
            // For SELL: fast EMA should be below slow EMA
            if (signal.side === 'BUY' && fast < slow) {
              return false;
            }
            if (signal.side === 'SELL' && fast > slow) {
              return false;
            }
          }
        }
      }
    }

    // RSI confirmation
    if (this.enhancedConfig.useRSI) {
      const rsiPeriod = this.enhancedConfig.rsiPeriod || 14;
      if (prices.length >= rsiPeriod + 1) {
        const rsi = calculateRSI(prices, rsiPeriod);
        if (rsi.length > 0) {
          const currentRSI = rsi[rsi.length - 1];
          const overbought = this.enhancedConfig.rsiOverbought || 70;
          const oversold = this.enhancedConfig.rsiOversold || 30;

          // For BUY: RSI should not be overbought
          // For SELL: RSI should not be oversold
          if (signal.side === 'BUY' && currentRSI > overbought) {
            return false;
          }
          if (signal.side === 'SELL' && currentRSI < oversold) {
            return false;
          }
        }
      }
    }

    // Volume confirmation
    if (this.enhancedConfig.useVolume && volumes.length > 0) {
      const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
      const currentVolume = marketData.volume || 0;
      const minVolume = avgVolume * ((this.enhancedConfig.minVolumePercent || 80) / 100);

      if (currentVolume < minVolume) {
        return false; // Low volume - avoid trading
      }
    }

    // VWAP confirmation
    if (this.enhancedConfig.useVWAP) {
      const vwap = calculateVWAP(historicalData);
      if (vwap.length > 0) {
        const currentVWAP = vwap[vwap.length - 1];
        const deviation = Math.abs(marketData.last - currentVWAP) / currentVWAP * 100;
        const maxDeviation = this.enhancedConfig.vwapDeviation || 0.5;

        if (deviation > maxDeviation) {
          return false; // Price too far from VWAP
        }
      }
    }

    // Fair Value Gap confirmation
    if (this.enhancedConfig.useFVG) {
      const fvg = detectFairValueGap(historicalData.slice(-10));
      if (fvg.hasFVG) {
        // For BUY: prefer bullish FVG
        // For SELL: prefer bearish FVG
        if (signal.side === 'BUY' && fvg.direction === 'BEARISH') {
          return false;
        }
        if (signal.side === 'SELL' && fvg.direction === 'BULLISH') {
          return false;
        }
      }
    }

    // Liquidity grab confirmation
    if (this.enhancedConfig.useLiquidityGrab) {
      const liquidityGrab = detectLiquidityGrab(historicalData);
      if (liquidityGrab.hasLiquidityGrab) {
        // For BUY: prefer bullish liquidity grab
        // For SELL: prefer bearish liquidity grab
        if (signal.side === 'BUY' && liquidityGrab.direction === 'BEARISH') {
          return false;
        }
        if (signal.side === 'SELL' && liquidityGrab.direction === 'BULLISH') {
          return false;
        }
      }
    }

    // Volatility filter
    if (this.enhancedConfig.useVolatilityFilter) {
      const volatility = calculateVolatility(prices, prices.length);
      const volatilityPercent = volatility * 100;

      if (this.enhancedConfig.minVolatility && volatilityPercent < this.enhancedConfig.minVolatility) {
        return false; // Too low volatility
      }
      if (this.enhancedConfig.maxVolatility && volatilityPercent > this.enhancedConfig.maxVolatility) {
        return false; // Too high volatility
      }
    }

    return true; // All confirmations passed
  }

  /**
   * Calculate signal confidence based on multiple factors
   */
  protected calculateConfidence(
    signal: StrategySignal,
    marketStructure: any,
    historicalData: MarketData[]
  ): number {
    let confidence = signal.confidence || 0.5;

    // Boost confidence if structure aligns
    if (marketStructure) {
      if (signal.side === 'BUY' && marketStructure.structure === 'BULLISH') {
        confidence += 0.1;
      }
      if (signal.side === 'SELL' && marketStructure.structure === 'BEARISH') {
        confidence += 0.1;
      }
      if (marketStructure.hasBOS) {
        confidence += 0.1;
      }
      if (marketStructure.hasCHoCH) {
        confidence += 0.1;
      }
    }

    // Reduce confidence if volatility is too high
    const prices = historicalData.map(d => d.last);
    const volatility = calculateVolatility(prices, prices.length);
    if (volatility > 0.03) { // 3% volatility
      confidence -= 0.1;
    }

    return Math.min(0.95, Math.max(0.1, confidence));
  }

  /**
   * Enhanced exit logic
   */
  async shouldExit(position: Position, marketData: MarketData): Promise<boolean> {
    // Basic exit: stop loss or take profit
    if (position.stopLoss && position.takeProfit) {
      if (position.side === 'BUY') {
        return marketData.last <= position.stopLoss || marketData.last >= position.takeProfit;
      } else {
        return marketData.last >= position.stopLoss || marketData.last <= position.takeProfit;
      }
    }

    return false;
  }
}

