/**
 * Bollinger Bands Indicator
 * 
 * Bollinger Bands consist of:
 * - Middle Band: SMA (typically 20-period)
 * - Upper Band: Middle Band + (Standard Deviation × Multiplier)
 * - Lower Band: Middle Band - (Standard Deviation × Multiplier)
 * 
 * Default multiplier is 2 (covers ~95% of price action)
 */

import { calculateSMA } from './moving-averages';

export interface BollingerBandsPoint {
  time: number;
  upper: number;
  middle: number;
  lower: number;
}

/**
 * Calculate standard deviation
 */
function calculateStdDev(values: number[], mean: number): number {
  const variance = values.reduce((sum, val) => {
    return sum + Math.pow(val - mean, 2);
  }, 0) / values.length;
  
  return Math.sqrt(variance);
}

/**
 * Calculate Bollinger Bands
 * @param closes Array of closing prices
 * @param period Period for SMA (default: 20)
 * @param multiplier Standard deviation multiplier (default: 2)
 * @returns Array of Bollinger Bands points
 */
export function calculateBollingerBands(
  closes: number[],
  period: number = 20,
  multiplier: number = 2
): BollingerBandsPoint[] {
  if (closes.length < period) {
    return [];
  }

  const sma = calculateSMA(closes, period);
  const bands: BollingerBandsPoint[] = [];

  for (let i = period - 1; i < closes.length; i++) {
    const periodValues = closes.slice(i - period + 1, i + 1);
    const middle = sma[i - period + 1];
    const stdDev = calculateStdDev(periodValues, middle);
    
    bands.push({
      time: 0, // Will be set by caller
      upper: middle + (stdDev * multiplier),
      middle,
      lower: middle - (stdDev * multiplier),
    });
  }

  return bands;
}

/**
 * Calculate Bollinger Bands with timestamps
 */
export function calculateBollingerBandsWithTime(
  data: Array<{ time: number; close: number }>,
  period: number = 20,
  multiplier: number = 2
): BollingerBandsPoint[] {
  const closes = data.map(d => d.close);
  const bands = calculateBollingerBands(closes, period, multiplier);
  
  return bands.map((band, i) => ({
    ...band,
    time: data[period - 1 + i]?.time || 0,
  }));
}

/**
 * Get Bollinger Bands signal
 * @param price Current price
 * @param bands Bollinger Bands point
 * @returns Signal: 'overbought' | 'oversold' | 'neutral'
 */
export function getBollingerBandsSignal(
  price: number,
  bands: BollingerBandsPoint
): 'overbought' | 'oversold' | 'neutral' {
  if (price >= bands.upper) return 'overbought';
  if (price <= bands.lower) return 'oversold';
  return 'neutral';
}

/**
 * Calculate %B (Bollinger Band Percent)
 * @param price Current price
 * @param bands Bollinger Bands point
 * @returns %B value (0-1, can exceed for extreme moves)
 */
export function calculatePercentB(price: number, bands: BollingerBandsPoint): number {
  const bandWidth = bands.upper - bands.lower;
  if (bandWidth === 0) return 0.5;
  return (price - bands.lower) / bandWidth;
}

