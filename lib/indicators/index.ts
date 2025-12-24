/**
 * Technical Indicators Index
 * 
 * Central export for all technical indicators
 */

export * from './rsi';
export * from './macd';
export * from './moving-averages';
export * from './bollinger-bands';

/**
 * Indicator configuration
 */
export interface IndicatorConfig {
  type: 'RSI' | 'MACD' | 'SMA' | 'EMA' | 'BollingerBands';
  period?: number;
  fastPeriod?: number;
  slowPeriod?: number;
  signalPeriod?: number;
  multiplier?: number;
  color?: string;
  enabled: boolean;
}

/**
 * Indicator result
 */
export interface IndicatorResult {
  type: string;
  data: any[];
  signal?: 'bullish' | 'bearish' | 'overbought' | 'oversold' | 'neutral';
}

