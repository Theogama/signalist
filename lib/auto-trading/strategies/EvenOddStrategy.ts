/**
 * Even/Odd Strategy (Enhanced)
 * Based on last digit analysis with enhanced filters and confirmations
 */

import { EnhancedBaseStrategy } from './EnhancedBaseStrategy';
import { StrategySignal, MarketData } from '../types';

export class EvenOddStrategy extends EnhancedBaseStrategy {
  private consecutiveLosses: number = 0;
  private lastTrade: 'even' | 'odd' | null = null;
  private martingaleMultiplier: number = 2;
  private maxConsecutiveLosses: number = 5;

  constructor(config: any) {
    super('EvenOdd', {
      name: 'EvenOdd',
      enabled: true,
      riskPercent: config.riskPercent || 1,
      takeProfitPercent: config.takeProfitPercent || 2,
      stopLossPercent: config.stopLossPercent || 1,
      maxConcurrentTrades: config.maxConcurrentTrades || 1,
      parameters: {
        martingale: config.martingale || false,
        martingaleMultiplier: config.martingaleMultiplier || 2,
        maxConsecutiveLosses: config.maxConsecutiveLosses || 5,
        ...config.parameters,
      },
      enhancedConfig: {
        useSMC: false, // Even/Odd doesn't use SMC
        useEMA: config.useEMA !== false,
        useRSI: config.useRSI !== false,
        useVolume: config.useVolume !== false,
        useATRForSL: config.useATRForSL !== false,
        atrMultiplier: config.atrMultiplier || 2,
        riskRewardRatio: config.riskRewardRatio || 2,
        useSessionFilter: config.useSessionFilter || false,
        useNewsFilter: config.useNewsFilter !== false,
        useConsolidationFilter: config.useConsolidationFilter !== false,
        ...config.enhancedConfig,
      },
    });

    this.martingaleMultiplier = this.config.parameters?.martingaleMultiplier || 2;
    this.maxConsecutiveLosses = this.config.parameters?.maxConsecutiveLosses || 5;
  }

  protected async analyzeBase(marketData: MarketData, historicalData?: MarketData[]): Promise<StrategySignal | null> {
    if (!historicalData || historicalData.length < 2) {
      return null;
    }

    // Get last digit of the last price
    const lastPrice = marketData.last;
    const lastDigit = Math.floor(lastPrice * 100) % 10;
    const isEven = lastDigit % 2 === 0;

    // Check if we should trade based on strategy logic
    const shouldTrade = this.shouldTradeEvenOdd(isEven, historicalData);

    if (!shouldTrade) {
      return null;
    }

    // Determine direction based on even/odd
    // Strategy: If last digit is even, predict next will be odd (or vice versa)
    // Or: If last digit is even, buy (or sell based on pattern)
    const side = this.determineSide(isEven, historicalData);

    if (!side) {
      return null;
    }

    const entryPrice = marketData.last;
    const stopLoss = this.calculateStopLoss(entryPrice, side, this.config.stopLossPercent);
    const takeProfit = this.calculateTakeProfit(entryPrice, side, this.config.takeProfitPercent);

    // Calculate position size with martingale if enabled
    let quantity = 1;
    if (this.config.parameters?.martingale && this.consecutiveLosses > 0) {
      quantity = Math.pow(this.martingaleMultiplier, this.consecutiveLosses);
    }

    this.lastTrade = isEven ? 'even' : 'odd';

    return {
      symbol: marketData.symbol,
      side,
      entryPrice,
      stopLoss,
      takeProfit,
      quantity,
      confidence: 0.6,
      reason: `Last digit is ${isEven ? 'even' : 'odd'}`,
      timestamp: new Date(),
    };
  }

  private shouldTradeEvenOdd(isEven: boolean, historicalData: MarketData[]): boolean {
    // Check if we've hit max consecutive losses
    if (this.consecutiveLosses >= this.maxConsecutiveLosses) {
      return false;
    }

    // Simple logic: trade if pattern suggests it
    // Can be enhanced with more sophisticated pattern recognition
    if (historicalData.length < 3) {
      return false;
    }

    // Check recent pattern
    const recent = historicalData.slice(-3);
    const recentDigits = recent.map(d => Math.floor(d.last * 100) % 10);
    const recentEvenCount = recentDigits.filter(d => d % 2 === 0).length;

    // Trade if there's a pattern (e.g., alternating or clustering)
    return true; // Simplified - can add more logic
  }

  private determineSide(isEven: boolean, historicalData: MarketData[]): 'BUY' | 'SELL' | null {
    // Strategy logic: 
    // Option 1: If even, predict next will be odd (or vice versa) - this doesn't directly map to BUY/SELL
    // Option 2: If even digits cluster, buy; if odd digits cluster, sell
    // Option 3: Simple reversal - if last was even, buy (expecting odd next)
    
    if (historicalData.length < 2) {
      return null;
    }

    const lastTwo = historicalData.slice(-2);
    const lastTwoDigits = lastTwo.map(d => Math.floor(d.last * 100) % 10);
    const lastTwoEven = lastTwoDigits.map(d => d % 2 === 0);

    // Simple strategy: if last two were even, buy (expecting odd/price rise)
    // This is a simplified interpretation - actual XML logic may differ
    if (lastTwoEven[0] && lastTwoEven[1]) {
      return 'BUY';
    } else if (!lastTwoEven[0] && !lastTwoEven[1]) {
      return 'SELL';
    }

    // Default: trade based on current digit
    return isEven ? 'BUY' : 'SELL';
  }

  async shouldExit(position: Position, marketData: MarketData): Promise<boolean> {
    // Exit if stop loss or take profit hit
    if (position.stopLoss && position.takeProfit) {
      if (position.side === 'BUY') {
        return marketData.last <= position.stopLoss || marketData.last >= position.takeProfit;
      } else {
        return marketData.last >= position.stopLoss || marketData.last <= position.takeProfit;
      }
    }

    return false;
  }

  recordWin(): void {
    this.consecutiveLosses = 0;
  }

  recordLoss(): void {
    this.consecutiveLosses++;
  }
}




