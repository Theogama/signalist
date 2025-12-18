/**
 * Base Strategy Class
 * Abstract base class for all trading strategies
 */

import { IStrategy } from '../interfaces';
import { StrategyConfig, StrategySignal, MarketData, Position } from '../types';

export abstract class BaseStrategy implements IStrategy {
  name: string;
  config: StrategyConfig;

  constructor(name: string, config: StrategyConfig) {
    this.name = name;
    this.config = config;
  }

  async initialize(config: StrategyConfig): Promise<void> {
    this.config = config;
  }

  abstract analyze(marketData: MarketData, historicalData?: MarketData[]): Promise<StrategySignal | null>;

  async shouldEnter(marketData: MarketData, historicalData?: MarketData[]): Promise<boolean> {
    const signal = await this.analyze(marketData, historicalData);
    return signal !== null;
  }

  abstract shouldExit(position: Position, marketData: MarketData): Promise<boolean>;

  calculatePositionSize(balance: number, entryPrice: number, stopLoss?: number): number {
    const riskAmount = (balance * this.config.riskPercent) / 100;
    
    if (!stopLoss || stopLoss === entryPrice) {
      // Default to 1% of balance if no stop loss
      return (balance * 0.01) / entryPrice;
    }

    const priceRisk = Math.abs(entryPrice - stopLoss);
    if (priceRisk === 0) {
      return (balance * 0.01) / entryPrice;
    }

    return riskAmount / priceRisk;
  }

  getParameters(): Record<string, any> {
    return this.config.parameters || {};
  }

  updateParameters(parameters: Record<string, any>): void {
    this.config.parameters = {
      ...this.config.parameters,
      ...parameters,
    };
  }

  protected calculateStopLoss(entryPrice: number, side: 'BUY' | 'SELL', percent: number): number {
    if (side === 'BUY') {
      return entryPrice * (1 - percent / 100);
    } else {
      return entryPrice * (1 + percent / 100);
    }
  }

  protected calculateTakeProfit(entryPrice: number, side: 'BUY' | 'SELL', percent: number): number {
    if (side === 'BUY') {
      return entryPrice * (1 + percent / 100);
    } else {
      return entryPrice * (1 - percent / 100);
    }
  }
}









