/**
 * Strategy Helper Utilities
 */

import { IStrategy } from '../interfaces';
import { StrategySignal, MarketData } from '../types';

/**
 * Calculate position size based on risk percentage
 */
export function calculatePositionSize(
  balance: number,
  riskPercent: number,
  entryPrice: number,
  stopLoss?: number
): number {
  const riskAmount = (balance * riskPercent) / 100;
  
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

/**
 * Calculate stop loss price
 */
export function calculateStopLoss(
  entryPrice: number,
  side: 'BUY' | 'SELL',
  percent: number
): number {
  if (side === 'BUY') {
    return entryPrice * (1 - percent / 100);
  } else {
    return entryPrice * (1 + percent / 100);
  }
}

/**
 * Calculate take profit price
 */
export function calculateTakeProfit(
  entryPrice: number,
  side: 'BUY' | 'SELL',
  percent: number
): number {
  if (side === 'BUY') {
    return entryPrice * (1 + percent / 100);
  } else {
    return entryPrice * (1 - percent / 100);
  }
}

/**
 * Get last digit of price
 */
export function getLastDigit(price: number): number {
  return Math.floor(price * 100) % 10;
}

/**
 * Check if digit is even
 */
export function isEvenDigit(price: number): boolean {
  return getLastDigit(price) % 2 === 0;
}

/**
 * Analyze digit patterns in historical data
 */
export function analyzeDigitPattern(
  historicalData: MarketData[],
  lookback: number = 10
): {
  digitCounts: Map<number, number>;
  mostCommonDigit: number;
  evenCount: number;
  oddCount: number;
} {
  const recent = historicalData.slice(-lookback);
  const digits = recent.map(d => getLastDigit(d.last));
  
  const digitCounts = new Map<number, number>();
  let evenCount = 0;
  let oddCount = 0;

  digits.forEach(digit => {
    digitCounts.set(digit, (digitCounts.get(digit) || 0) + 1);
    if (digit % 2 === 0) {
      evenCount++;
    } else {
      oddCount++;
    }
  });

  const mostCommonDigit = Array.from(digitCounts.entries())
    .sort((a, b) => b[1] - a[1])[0]?.[0] || 0;

  return {
    digitCounts,
    mostCommonDigit,
    evenCount,
    oddCount,
  };
}

/**
 * Calculate price trend
 */
export function calculateTrend(
  historicalData: MarketData[],
  lookback: number = 5
): {
  isRising: boolean;
  isFalling: boolean;
  change: number;
  changePercent: number;
  momentum: number;
} {
  if (historicalData.length < lookback) {
    return {
      isRising: false,
      isFalling: false,
      change: 0,
      changePercent: 0,
      momentum: 0,
    };
  }

  const recent = historicalData.slice(-lookback);
  const prices = recent.map(d => d.last);
  const firstPrice = prices[0];
  const lastPrice = prices[prices.length - 1];
  const change = lastPrice - firstPrice;
  const changePercent = (change / firstPrice) * 100;
  
  // Momentum: compare last two prices
  const momentum = prices.length >= 2 
    ? prices[prices.length - 1] - prices[prices.length - 2]
    : 0;

  return {
    isRising: change > 0 && momentum > 0,
    isFalling: change < 0 && momentum < 0,
    change,
    changePercent,
    momentum,
  };
}

/**
 * Validate signal before execution
 */
export function validateSignal(signal: StrategySignal | null): boolean {
  if (!signal) return false;
  
  if (!signal.symbol || !signal.side || !signal.entryPrice) {
    return false;
  }

  if (signal.entryPrice <= 0) {
    return false;
  }

  if (signal.quantity && signal.quantity <= 0) {
    return false;
  }

  // Validate stop loss and take profit
  if (signal.stopLoss && signal.takeProfit) {
    if (signal.side === 'BUY') {
      if (signal.stopLoss >= signal.entryPrice || signal.takeProfit <= signal.entryPrice) {
        return false;
      }
    } else {
      if (signal.stopLoss <= signal.entryPrice || signal.takeProfit >= signal.entryPrice) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Format strategy name for display
 */
export function formatStrategyName(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}











