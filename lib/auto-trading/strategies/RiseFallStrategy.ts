/**
 * Rise/Fall Strategy (Enhanced)
 * Based on candle close/open analysis with SMC concepts and confirmation layers
 */

import { EnhancedBaseStrategy } from './EnhancedBaseStrategy';
import { StrategySignal, MarketData, Position } from '../types';

export class RiseFallStrategy extends EnhancedBaseStrategy {
  private lookbackPeriod: number = 5;

  constructor(config: any) {
    super('RiseFall', {
      name: 'RiseFall',
      enabled: true,
      riskPercent: config.riskPercent || 1,
      takeProfitPercent: config.takeProfitPercent || 2,
      stopLossPercent: config.stopLossPercent || 1,
      maxConcurrentTrades: config.maxConcurrentTrades || 1,
      parameters: {
        lookbackPeriod: config.lookbackPeriod || 5,
        ...config.parameters,
      },
      enhancedConfig: {
        useSMC: config.useSMC !== false, // Default true
        requireBOS: config.requireBOS || false,
        useLiquidityGrab: config.useLiquidityGrab !== false,
        useEMA: config.useEMA !== false,
        emaPeriod: config.emaPeriod || 20,
        useRSI: config.useRSI !== false,
        rsiPeriod: config.rsiPeriod || 14,
        useVolume: config.useVolume !== false,
        useFVG: config.useFVG !== false,
        useATRForSL: config.useATRForSL !== false,
        atrMultiplier: config.atrMultiplier || 2,
        riskRewardRatio: config.riskRewardRatio || 2,
        useSessionFilter: config.useSessionFilter || false,
        allowedSessions: config.allowedSessions || ['London', 'New York'],
        useNewsFilter: config.useNewsFilter !== false,
        useConsolidationFilter: config.useConsolidationFilter !== false,
        lookbackPeriod: config.lookbackPeriod || 50,
        ...config.enhancedConfig,
      },
    });

    this.lookbackPeriod = this.config.parameters?.lookbackPeriod || 5;
  }

  protected async analyzeBase(marketData: MarketData, historicalData?: MarketData[]): Promise<StrategySignal | null> {
    if (!historicalData || historicalData.length < this.lookbackPeriod) {
      return null;
    }

    // Analyze candle patterns (close vs open)
    const recent = historicalData.slice(-this.lookbackPeriod);
    
    // Calculate trend
    const firstPrice = recent[0].last;
    const lastPrice = recent[recent.length - 1].last;
    const priceChange = lastPrice - firstPrice;
    const priceChangePercent = (priceChange / firstPrice) * 100;

    // Determine if we should trade
    const shouldRise = this.shouldPredictRise(recent);
    const shouldFall = this.shouldPredictFall(recent);

    if (!shouldRise && !shouldFall) {
      return null;
    }

    const side = shouldRise ? 'BUY' : 'SELL';
    const entryPrice = marketData.last;
    const stopLoss = this.calculateStopLoss(entryPrice, side, this.config.stopLossPercent);
    const takeProfit = this.calculateTakeProfit(entryPrice, side, this.config.takeProfitPercent);

    const confidence = Math.min(Math.abs(priceChangePercent) / 2, 0.9);

    return {
      symbol: marketData.symbol,
      side,
      entryPrice,
      stopLoss,
      takeProfit,
      confidence,
      reason: `Price trend analysis: ${priceChangePercent > 0 ? 'rising' : 'falling'}`,
      timestamp: new Date(),
    };
  }

  private shouldPredictRise(historicalData: MarketData[]): boolean {
    // Check if recent candles suggest price will rise
    // Look for bullish patterns: higher closes, increasing volume
    
    if (historicalData.length < 2) {
      return false;
    }

    const prices = historicalData.map(d => d.last);
    const isUptrend = prices[prices.length - 1] > prices[0];
    const recentMomentum = prices[prices.length - 1] > prices[prices.length - 2];

    // Simple logic: uptrend with recent momentum
    return isUptrend && recentMomentum;
  }

  private shouldPredictFall(historicalData: MarketData[]): boolean {
    // Check if recent candles suggest price will fall
    // Look for bearish patterns: lower closes, decreasing volume
    
    if (historicalData.length < 2) {
      return false;
    }

    const prices = historicalData.map(d => d.last);
    const isDowntrend = prices[prices.length - 1] < prices[0];
    const recentMomentum = prices[prices.length - 1] < prices[prices.length - 2];

    // Simple logic: downtrend with recent momentum
    return isDowntrend && recentMomentum;
  }

  async shouldExit(position: Position, marketData: MarketData): Promise<boolean> {
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




