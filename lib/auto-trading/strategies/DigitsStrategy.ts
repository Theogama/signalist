/**
 * Digits Strategy
 * Analyzes last digits and predicts matches/differs
 */

import { BaseStrategy } from './BaseStrategy';
import { StrategySignal, MarketData } from '../types';

export class DigitsStrategy extends BaseStrategy {
  private lookbackPeriod: number = 10;
  private digitThreshold: number = 3;

  constructor(config: any) {
    super('Digits', {
      name: 'Digits',
      enabled: true,
      riskPercent: config.riskPercent || 1,
      takeProfitPercent: config.takeProfitPercent || 2,
      stopLossPercent: config.stopLossPercent || 1,
      maxConcurrentTrades: config.maxConcurrentTrades || 1,
      parameters: {
        lookbackPeriod: config.lookbackPeriod || 10,
        digitThreshold: config.digitThreshold || 3,
        ...config.parameters,
      },
    });

    this.lookbackPeriod = this.config.parameters?.lookbackPeriod || 10;
    this.digitThreshold = this.config.parameters?.digitThreshold || 3;
  }

  async analyze(marketData: MarketData, historicalData?: MarketData[]): Promise<StrategySignal | null> {
    if (!historicalData || historicalData.length < this.lookbackPeriod) {
      return null;
    }

    // Extract last digits from historical data
    const digits = historicalData.map(d => this.getLastDigit(d.last));
    const currentDigit = this.getLastDigit(marketData.last);

    // Analyze digit patterns
    const digitCounts = this.countDigits(digits);
    const mostCommonDigit = this.getMostCommonDigit(digitCounts);

    // Strategy: Predict if next digit will match or differ
    const shouldMatch = this.shouldPredictMatch(currentDigit, digits, digitCounts);
    const shouldDiffer = this.shouldPredictDiffer(currentDigit, digits, digitCounts);

    if (!shouldMatch && !shouldDiffer) {
      return null;
    }

    // For binary options (Deriv), this would be CALL/PUT
    // For CFDs, we map to BUY/SELL based on digit prediction
    // If predicting match with high digit (5-9), BUY; if low digit (0-4), SELL
    const side = this.determineSideFromDigit(currentDigit, mostCommonDigit, shouldMatch);

    if (!side) {
      return null;
    }

    const entryPrice = marketData.last;
    const stopLoss = this.calculateStopLoss(entryPrice, side, this.config.stopLossPercent);
    const takeProfit = this.calculateTakeProfit(entryPrice, side, this.config.takeProfitPercent);

    const confidence = this.calculateConfidence(digitCounts, currentDigit);

    return {
      symbol: marketData.symbol,
      side,
      entryPrice,
      stopLoss,
      takeProfit,
      confidence,
      reason: `Digit analysis: ${shouldMatch ? 'match' : 'differ'} prediction`,
      timestamp: new Date(),
    };
  }

  private getLastDigit(price: number): number {
    // Get last digit of price (e.g., 1234.56 -> 6)
    return Math.floor(price * 100) % 10;
  }

  private countDigits(digits: number[]): Map<number, number> {
    const counts = new Map<number, number>();
    digits.forEach(digit => {
      counts.set(digit, (counts.get(digit) || 0) + 1);
    });
    return counts;
  }

  private getMostCommonDigit(counts: Map<number, number>): number {
    let maxCount = 0;
    let mostCommon = 0;

    counts.forEach((count, digit) => {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = digit;
      }
    });

    return mostCommon;
  }

  private shouldPredictMatch(currentDigit: number, digits: number[], counts: Map<number, number>): boolean {
    // Predict match if current digit appears frequently
    const currentCount = counts.get(currentDigit) || 0;
    return currentCount >= this.digitThreshold;
  }

  private shouldPredictDiffer(currentDigit: number, digits: number[], counts: Map<number, number>): boolean {
    // Predict differ if current digit is rare
    const currentCount = counts.get(currentDigit) || 0;
    return currentCount < this.digitThreshold;
  }

  private determineSideFromDigit(
    currentDigit: number,
    mostCommonDigit: number,
    shouldMatch: boolean
  ): 'BUY' | 'SELL' | null {
    // Map digit prediction to BUY/SELL
    // High digits (5-9) -> BUY, Low digits (0-4) -> SELL
    // This is a simplified mapping - actual strategy may differ
    
    if (shouldMatch) {
      // If predicting match with high digit, BUY
      return mostCommonDigit >= 5 ? 'BUY' : 'SELL';
    } else {
      // If predicting differ, trade opposite
      return currentDigit >= 5 ? 'SELL' : 'BUY';
    }
  }

  private calculateConfidence(counts: Map<number, number>, currentDigit: number): number {
    const total = Array.from(counts.values()).reduce((a, b) => a + b, 0);
    const currentCount = counts.get(currentDigit) || 0;
    
    if (total === 0) {
      return 0.5;
    }

    // Higher confidence if digit pattern is clear
    const frequency = currentCount / total;
    return Math.min(frequency * 2, 0.9);
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




