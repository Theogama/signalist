/**
 * Technical Indicators
 * Collection of technical analysis indicators for trading strategies
 */

import { MarketData } from '../types';

export interface EMAConfig {
  period: number;
}

export interface RSIConfig {
  period: number;
}

export interface ATRConfig {
  period: number;
}

/**
 * Calculate Exponential Moving Average (EMA)
 */
export function calculateEMA(prices: number[], period: number): number[] {
  if (prices.length < period) {
    return [];
  }

  const multiplier = 2 / (period + 1);
  const ema: number[] = [];

  // Start with SMA
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += prices[i];
  }
  ema[period - 1] = sum / period;

  // Calculate EMA for remaining prices
  for (let i = period; i < prices.length; i++) {
    ema[i] = (prices[i] - ema[i - 1]) * multiplier + ema[i - 1];
  }

  return ema;
}

/**
 * Calculate Simple Moving Average (SMA)
 */
export function calculateSMA(prices: number[], period: number): number[] {
  if (prices.length < period) {
    return [];
  }

  const sma: number[] = [];
  for (let i = period - 1; i < prices.length; i++) {
    const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    sma[i] = sum / period;
  }

  return sma;
}

/**
 * Calculate Relative Strength Index (RSI)
 */
export function calculateRSI(prices: number[], period: number = 14): number[] {
  if (prices.length < period + 1) {
    return [];
  }

  const rsi: number[] = [];
  const gains: number[] = [];
  const losses: number[] = [];

  // Calculate price changes
  for (let i = 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);
  }

  // Calculate initial average gain and loss
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

  // Calculate RSI
  for (let i = period; i < gains.length; i++) {
    if (i === period) {
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      rsi[i] = 100 - (100 / (1 + rs));
    } else {
      // Use Wilder's smoothing method
      avgGain = (avgGain * (period - 1) + gains[i]) / period;
      avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      rsi[i] = 100 - (100 / (1 + rs));
    }
  }

  return rsi;
}

/**
 * Calculate Average True Range (ATR)
 */
export function calculateATR(
  high: number[],
  low: number[],
  close: number[],
  period: number = 14
): number[] {
  if (high.length < period + 1 || low.length < period + 1 || close.length < period + 1) {
    return [];
  }

  const trueRanges: number[] = [];
  for (let i = 1; i < high.length; i++) {
    const tr1 = high[i] - low[i];
    const tr2 = Math.abs(high[i] - close[i - 1]);
    const tr3 = Math.abs(low[i] - close[i - 1]);
    trueRanges.push(Math.max(tr1, tr2, tr3));
  }

  const atr: number[] = [];
  let sum = trueRanges.slice(0, period).reduce((a, b) => a + b, 0);
  atr[period - 1] = sum / period;

  for (let i = period; i < trueRanges.length; i++) {
    atr[i] = (atr[i - 1] * (period - 1) + trueRanges[i]) / period;
  }

  return atr;
}

/**
 * Calculate Volume Weighted Average Price (VWAP)
 */
export function calculateVWAP(marketData: MarketData[]): number[] {
  if (marketData.length === 0) {
    return [];
  }

  const vwap: number[] = [];
  let cumulativeTPV = 0; // Typical Price * Volume
  let cumulativeVolume = 0;

  for (let i = 0; i < marketData.length; i++) {
    const data = marketData[i];
    const typicalPrice = (data.high24h || data.last + data.last * 0.001) + 
                        (data.low24h || data.last - data.last * 0.001) + 
                        data.last;
    const volume = data.volume || 1;

    cumulativeTPV += typicalPrice * volume;
    cumulativeVolume += volume;

    vwap[i] = cumulativeTPV / cumulativeVolume;
  }

  return vwap;
}

/**
 * Detect trend direction
 */
export function detectTrend(prices: number[], emaPeriod: number = 20): 'UP' | 'DOWN' | 'SIDEWAYS' {
  if (prices.length < emaPeriod + 5) {
    return 'SIDEWAYS';
  }

  const ema = calculateEMA(prices, emaPeriod);
  if (ema.length < 5) {
    return 'SIDEWAYS';
  }

  const recentEMA = ema.slice(-5);
  const isRising = recentEMA[recentEMA.length - 1] > recentEMA[0];
  const isFalling = recentEMA[recentEMA.length - 1] < recentEMA[0];
  const priceChange = Math.abs(recentEMA[recentEMA.length - 1] - recentEMA[0]) / recentEMA[0];

  // Consider it sideways if change is less than 0.5%
  if (priceChange < 0.005) {
    return 'SIDEWAYS';
  }

  return isRising ? 'UP' : isFalling ? 'DOWN' : 'SIDEWAYS';
}

/**
 * Calculate volatility (standard deviation of returns)
 */
export function calculateVolatility(prices: number[], period: number = 20): number {
  if (prices.length < period + 1) {
    return 0;
  }

  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
  }

  const recentReturns = returns.slice(-period);
  const mean = recentReturns.reduce((a, b) => a + b, 0) / recentReturns.length;
  const variance = recentReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / recentReturns.length;

  return Math.sqrt(variance);
}

/**
 * Detect Fair Value Gap (FVG)
 * FVG is a gap between three candles where the middle candle doesn't overlap with the first and third
 */
export function detectFairValueGap(marketData: MarketData[]): {
  hasFVG: boolean;
  direction: 'BULLISH' | 'BEARISH' | null;
  gapPrice: number | null;
} {
  if (marketData.length < 3) {
    return { hasFVG: false, direction: null, gapPrice: null };
  }

  const [first, second, third] = marketData.slice(-3);
  const firstHigh = first.high24h || first.last * 1.001;
  const firstLow = first.low24h || first.last * 0.999;
  const secondHigh = second.high24h || second.last * 1.001;
  const secondLow = second.low24h || second.last * 0.999;
  const thirdHigh = third.high24h || third.last * 1.001;
  const thirdLow = third.low24h || third.last * 0.999;

  // Bullish FVG: first high < second low AND second high < third low
  const bullishFVG = firstHigh < secondLow && secondHigh < thirdLow;
  
  // Bearish FVG: first low > second high AND second low > third high
  const bearishFVG = firstLow > secondHigh && secondLow > thirdHigh;

  if (bullishFVG) {
    return {
      hasFVG: true,
      direction: 'BULLISH',
      gapPrice: (secondLow + secondHigh) / 2,
    };
  }

  if (bearishFVG) {
    return {
      hasFVG: true,
      direction: 'BEARISH',
      gapPrice: (secondLow + secondHigh) / 2,
    };
  }

  return { hasFVG: false, direction: null, gapPrice: null };
}

