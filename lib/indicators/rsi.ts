/**
 * Relative Strength Index (RSI) Indicator
 * 
 * RSI is a momentum oscillator that measures the speed and magnitude of price changes.
 * Values range from 0 to 100.
 * - Above 70: Overbought (potential sell signal)
 * - Below 30: Oversold (potential buy signal)
 */

export interface RSIPoint {
  time: number;
  value: number;
}

/**
 * Calculate RSI for a series of prices
 * @param closes Array of closing prices
 * @param period RSI period (default: 14)
 * @returns Array of RSI values
 */
export function calculateRSI(closes: number[], period: number = 14): number[] {
  if (closes.length < period + 1) {
    return [];
  }

  const rsiValues: number[] = [];
  const gains: number[] = [];
  const losses: number[] = [];

  // Calculate initial average gain and loss
  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) {
      avgGain += change;
    } else {
      avgLoss += Math.abs(change);
    }
  }

  avgGain /= period;
  avgLoss /= period;

  // Calculate RSI for remaining periods
  for (let i = period; i < closes.length; i++) {
    if (i === period) {
      // First RSI value
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      const rsi = 100 - (100 / (1 + rs));
      rsiValues.push(rsi);
    } else {
      // Subsequent RSI values using Wilder's smoothing
      const change = closes[i] - closes[i - 1];
      const gain = change > 0 ? change : 0;
      const loss = change < 0 ? Math.abs(change) : 0;

      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;

      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      const rsi = 100 - (100 / (1 + rs));
      rsiValues.push(rsi);
    }
  }

  return rsiValues;
}

/**
 * Calculate RSI with timestamps
 */
export function calculateRSIWithTime(
  data: Array<{ time: number; close: number }>,
  period: number = 14
): RSIPoint[] {
  const closes = data.map(d => d.close);
  const rsiValues = calculateRSI(closes, period);
  
  return data.slice(period).map((d, i) => ({
    time: d.time,
    value: rsiValues[i] || 0,
  }));
}

/**
 * Get RSI signal
 * @param rsi Current RSI value
 * @returns Signal: 'overbought' | 'oversold' | 'neutral'
 */
export function getRSISignal(rsi: number): 'overbought' | 'oversold' | 'neutral' {
  if (rsi >= 70) return 'overbought';
  if (rsi <= 30) return 'oversold';
  return 'neutral';
}

