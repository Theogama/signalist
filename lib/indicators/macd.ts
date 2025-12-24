/**
 * MACD (Moving Average Convergence Divergence) Indicator
 * 
 * MACD is a trend-following momentum indicator that shows the relationship
 * between two moving averages of a security's price.
 * 
 * Components:
 * - MACD Line: 12-period EMA - 26-period EMA
 * - Signal Line: 9-period EMA of MACD Line
 * - Histogram: MACD Line - Signal Line
 */

export interface MACDPoint {
  time: number;
  macd: number;
  signal: number;
  histogram: number;
}

/**
 * Calculate EMA (Exponential Moving Average)
 */
function calculateEMA(values: number[], period: number): number[] {
  const ema: number[] = [];
  const multiplier = 2 / (period + 1);

  // Start with SMA
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += values[i];
  }
  ema.push(sum / period);

  // Calculate EMA for remaining values
  for (let i = period; i < values.length; i++) {
    const value = (values[i] - ema[ema.length - 1]) * multiplier + ema[ema.length - 1];
    ema.push(value);
  }

  return ema;
}

/**
 * Calculate MACD for a series of prices
 * @param closes Array of closing prices
 * @param fastPeriod Fast EMA period (default: 12)
 * @param slowPeriod Slow EMA period (default: 26)
 * @param signalPeriod Signal EMA period (default: 9)
 * @returns Array of MACD points
 */
export function calculateMACD(
  closes: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): MACDPoint[] {
  if (closes.length < slowPeriod + signalPeriod) {
    return [];
  }

  // Calculate EMAs
  const fastEMA = calculateEMA(closes, fastPeriod);
  const slowEMA = calculateEMA(closes, slowPeriod);

  // Calculate MACD line (fast EMA - slow EMA)
  const macdLine: number[] = [];
  const minLength = Math.min(fastEMA.length, slowEMA.length);
  const fastOffset = fastEMA.length - minLength;
  const slowOffset = slowEMA.length - minLength;

  for (let i = 0; i < minLength; i++) {
    macdLine.push(fastEMA[i + fastOffset] - slowEMA[i + slowOffset]);
  }

  // Calculate Signal line (EMA of MACD line)
  const signalLine = calculateEMA(macdLine, signalPeriod);
  const signalOffset = macdLine.length - signalLine.length;

  // Calculate Histogram (MACD - Signal)
  const macdPoints: MACDPoint[] = [];
  for (let i = 0; i < signalLine.length; i++) {
    const macd = macdLine[i + signalOffset];
    const signal = signalLine[i];
    macdPoints.push({
      time: 0, // Will be set by caller
      macd,
      signal,
      histogram: macd - signal,
    });
  }

  return macdPoints;
}

/**
 * Calculate MACD with timestamps
 */
export function calculateMACDWithTime(
  data: Array<{ time: number; close: number }>,
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): MACDPoint[] {
  const closes = data.map(d => d.close);
  const macdPoints = calculateMACD(closes, fastPeriod, slowPeriod, signalPeriod);
  
  // Map timestamps (skip initial periods)
  const startIndex = slowPeriod + signalPeriod - macdPoints.length;
  return macdPoints.map((point, i) => ({
    ...point,
    time: data[startIndex + i]?.time || 0,
  }));
}

/**
 * Get MACD signal
 * @param macd MACD point
 * @returns Signal: 'bullish' | 'bearish' | 'neutral'
 */
export function getMACDSignal(macd: MACDPoint): 'bullish' | 'bearish' | 'neutral' {
  if (macd.histogram > 0 && macd.macd > macd.signal) return 'bullish';
  if (macd.histogram < 0 && macd.macd < macd.signal) return 'bearish';
  return 'neutral';
}

