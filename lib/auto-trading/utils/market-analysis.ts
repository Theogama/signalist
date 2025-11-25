/**
 * Market Analysis Utilities
 * SMC (Smart Money Concepts) and market structure analysis
 */

import { MarketData } from '../types';
import { detectTrend, calculateEMA, calculateATR } from './technical-indicators';

export interface MarketStructure {
  trend: 'UP' | 'DOWN' | 'SIDEWAYS';
  structure: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  liquidityZones: Array<{ price: number; type: 'SUPPORT' | 'RESISTANCE' }>;
  hasBOS: boolean; // Break of Structure
  hasCHoCH: boolean; // Change of Character
  volatility: 'LOW' | 'MEDIUM' | 'HIGH';
}

/**
 * Analyze market structure using SMC concepts
 */
export function analyzeMarketStructure(
  marketData: MarketData[],
  lookbackPeriod: number = 50
): MarketStructure {
  if (marketData.length < lookbackPeriod) {
    return {
      trend: 'SIDEWAYS',
      structure: 'NEUTRAL',
      liquidityZones: [],
      hasBOS: false,
      hasCHoCH: false,
      volatility: 'LOW',
    };
  }

  const recent = marketData.slice(-lookbackPeriod);
  const prices = recent.map(d => d.last);
  const highs = recent.map(d => d.high24h || d.last * 1.001);
  const lows = recent.map(d => d.low24h || d.last * 0.999);

  // Detect trend
  const trend = detectTrend(prices, 20);

  // Identify swing highs and lows for structure
  const swingHighs: number[] = [];
  const swingLows: number[] = [];

  for (let i = 2; i < highs.length - 2; i++) {
    // Swing high: higher than 2 candles before and after
    if (highs[i] > highs[i - 1] && highs[i] > highs[i - 2] &&
        highs[i] > highs[i + 1] && highs[i] > highs[i + 2]) {
      swingHighs.push(highs[i]);
    }

    // Swing low: lower than 2 candles before and after
    if (lows[i] < lows[i - 1] && lows[i] < lows[i - 2] &&
        lows[i] < lows[i + 1] && lows[i] < lows[i + 2]) {
      swingLows.push(lows[i]);
    }
  }

  // Determine market structure
  let structure: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  if (swingHighs.length >= 2 && swingLows.length >= 2) {
    const lastSwingHigh = swingHighs[swingHighs.length - 1];
    const prevSwingHigh = swingHighs[swingHighs.length - 2];
    const lastSwingLow = swingLows[swingLows.length - 1];
    const prevSwingLow = swingLows[swingLows.length - 2];

    // Bullish structure: higher highs and higher lows
    if (lastSwingHigh > prevSwingHigh && lastSwingLow > prevSwingLow) {
      structure = 'BULLISH';
    }
    // Bearish structure: lower highs and lower lows
    else if (lastSwingHigh < prevSwingHigh && lastSwingLow < prevSwingLow) {
      structure = 'BEARISH';
    }
  }

  // Detect Break of Structure (BOS)
  let hasBOS = false;
  if (swingHighs.length >= 2 && swingLows.length >= 2) {
    const lastPrice = prices[prices.length - 1];
    const highestSwingHigh = Math.max(...swingHighs);
    const lowestSwingLow = Math.min(...swingLows);

    // BOS: price breaks above previous swing high (bullish) or below previous swing low (bearish)
    if (structure === 'BULLISH' && lastPrice > highestSwingHigh) {
      hasBOS = true;
    } else if (structure === 'BEARISH' && lastPrice < lowestSwingLow) {
      hasBOS = true;
    }
  }

  // Detect Change of Character (CHoCH)
  // CHoCH occurs when structure changes from bearish to bullish or vice versa
  let hasCHoCH = false;
  if (swingHighs.length >= 3 && swingLows.length >= 3) {
    const recentHighs = swingHighs.slice(-3);
    const recentLows = swingLows.slice(-3);
    
    // Check for structure reversal
    const wasBearish = recentHighs[0] > recentHighs[1] && recentLows[0] > recentLows[1];
    const isNowBullish = recentHighs[recentHighs.length - 1] > recentHighs[recentHighs.length - 2] &&
                         recentLows[recentLows.length - 1] > recentLows[recentLows.length - 2];
    
    const wasBullish = recentHighs[0] < recentHighs[1] && recentLows[0] < recentLows[1];
    const isNowBearish = recentHighs[recentHighs.length - 1] < recentHighs[recentHighs.length - 2] &&
                         recentLows[recentLows.length - 1] < recentLows[recentLows.length - 2];

    hasCHoCH = (wasBearish && isNowBullish) || (wasBullish && isNowBearish);
  }

  // Identify liquidity zones (support and resistance)
  const liquidityZones: Array<{ price: number; type: 'SUPPORT' | 'RESISTANCE' }> = [];
  
  if (swingHighs.length > 0) {
    const avgResistance = swingHighs.reduce((a, b) => a + b, 0) / swingHighs.length;
    liquidityZones.push({ price: avgResistance, type: 'RESISTANCE' });
  }
  
  if (swingLows.length > 0) {
    const avgSupport = swingLows.reduce((a, b) => a + b, 0) / swingLows.length;
    liquidityZones.push({ price: avgSupport, type: 'SUPPORT' });
  }

  // Calculate volatility
  const atr = calculateATR(highs, lows, prices, 14);
  const currentATR = atr.length > 0 ? atr[atr.length - 1] : 0;
  const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
  const atrPercent = (currentATR / avgPrice) * 100;

  let volatility: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
  if (atrPercent > 2) {
    volatility = 'HIGH';
  } else if (atrPercent > 0.5) {
    volatility = 'MEDIUM';
  }

  return {
    trend,
    structure,
    liquidityZones,
    hasBOS,
    hasCHoCH,
    volatility,
  };
}

/**
 * Detect liquidity grab
 * Liquidity grab occurs when price briefly breaks a support/resistance then reverses
 */
export function detectLiquidityGrab(
  marketData: MarketData[],
  lookbackPeriod: number = 20
): {
  hasLiquidityGrab: boolean;
  direction: 'BULLISH' | 'BEARISH' | null;
  grabPrice: number | null;
} {
  if (marketData.length < lookbackPeriod + 5) {
    return { hasLiquidityGrab: false, direction: null, grabPrice: null };
  }

  const recent = marketData.slice(-lookbackPeriod - 5);
  const prices = recent.map(d => d.last);
  const highs = recent.map(d => d.high24h || d.last * 1.001);
  const lows = recent.map(d => d.low24h || d.last * 0.999);

  // Find recent swing high and low
  const recentHighs = highs.slice(-10);
  const recentLows = lows.slice(-10);
  const maxHigh = Math.max(...recentHighs);
  const minLow = Math.min(...recentLows);

  const lastPrice = prices[prices.length - 1];
  const prevPrice = prices[prices.length - 5];

  // Bullish liquidity grab: price breaks below support then reverses up
  if (lastPrice < minLow * 0.998 && lastPrice > prevPrice) {
    return {
      hasLiquidityGrab: true,
      direction: 'BULLISH',
      grabPrice: minLow,
    };
  }

  // Bearish liquidity grab: price breaks above resistance then reverses down
  if (lastPrice > maxHigh * 1.002 && lastPrice < prevPrice) {
    return {
      hasLiquidityGrab: true,
      direction: 'BEARISH',
      grabPrice: maxHigh,
    };
  }

  return { hasLiquidityGrab: false, direction: null, grabPrice: null };
}

/**
 * Detect consolidation (ranging market)
 */
export function detectConsolidation(
  marketData: MarketData[],
  period: number = 20
): boolean {
  if (marketData.length < period) {
    return false;
  }

  const recent = marketData.slice(-period);
  const prices = recent.map(d => d.last);
  const highs = recent.map(d => d.high24h || d.last * 1.001);
  const lows = recent.map(d => d.low24h || d.last * 0.999);

  const maxHigh = Math.max(...highs);
  const minLow = Math.min(...lows);
  const range = maxHigh - minLow;
  const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
  const rangePercent = (range / avgPrice) * 100;

  // Consider it consolidation if range is less than 1% of average price
  return rangePercent < 1;
}

