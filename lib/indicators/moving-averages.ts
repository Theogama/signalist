/**
 * Moving Averages Indicators
 * 
 * Simple Moving Average (SMA) and Exponential Moving Average (EMA)
 */

export interface MAPoint {
  time: number;
  value: number;
}

/**
 * Calculate Simple Moving Average (SMA)
 * @param values Array of values
 * @param period Period for moving average
 * @returns Array of SMA values
 */
export function calculateSMA(values: number[], period: number): number[] {
  if (values.length < period) {
    return [];
  }

  const sma: number[] = [];
  
  for (let i = period - 1; i < values.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += values[j];
    }
    sma.push(sum / period);
  }

  return sma;
}

/**
 * Calculate Exponential Moving Average (EMA)
 * @param values Array of values
 * @param period Period for moving average
 * @returns Array of EMA values
 */
export function calculateEMA(values: number[], period: number): number[] {
  if (values.length < period) {
    return [];
  }

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
 * Calculate SMA with timestamps
 */
export function calculateSMAWithTime(
  data: Array<{ time: number; close: number }>,
  period: number
): MAPoint[] {
  const closes = data.map(d => d.close);
  const smaValues = calculateSMA(closes, period);
  
  return data.slice(period - 1).map((d, i) => ({
    time: d.time,
    value: smaValues[i] || 0,
  }));
}

/**
 * Calculate EMA with timestamps
 */
export function calculateEMAWithTime(
  data: Array<{ time: number; close: number }>,
  period: number
): MAPoint[] {
  const closes = data.map(d => d.close);
  const emaValues = calculateEMA(closes, period);
  
  return data.slice(period - 1).map((d, i) => ({
    time: d.time,
    value: emaValues[i] || 0,
  }));
}

/**
 * Calculate multiple moving averages
 */
export function calculateMultipleMA(
  data: Array<{ time: number; close: number }>,
  periods: number[],
  type: 'SMA' | 'EMA' = 'SMA'
): Record<number, MAPoint[]> {
  const result: Record<number, MAPoint[]> = {};
  
  for (const period of periods) {
    if (type === 'SMA') {
      result[period] = calculateSMAWithTime(data, period);
    } else {
      result[period] = calculateEMAWithTime(data, period);
    }
  }
  
  return result;
}

