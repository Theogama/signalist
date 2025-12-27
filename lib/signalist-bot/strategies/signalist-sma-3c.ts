/**
 * Signalist-SMA-3C Strategy
 * Implements the exact trading logic as specified:
 * - 3-candle alignment
 * - SMA confirmation
 * - 5-minute trend confirmation
 * - Spike detection for Boom/Crash
 */

import { Candle, EntrySignal, OrderSide, Timeframe } from '../types';

export interface SMA3CConfig {
  candleTimeframe: Timeframe;
  smaPeriod: number;
  smaPeriod2?: number;
  smaCrossLookback: number; // Default 8
  fiveMinTrendConfirmation: boolean;
  fiveMinTrendSMA: number; // Default 21
  spikeDetectionEnabled: boolean;
  spikeThreshold: number; // Default 0.5%
  dojiThreshold: number; // Minimum body size to not be considered Doji
}

export class SignalistSMA3CStrategy {
  private config: SMA3CConfig;
  private candles: Map<string, Candle[]> = new Map(); // Store candles by symbol+timeframe
  private fiveMinCandles: Map<string, Candle[]> = new Map(); // 5m candles for trend confirmation

  constructor(config: Partial<SMA3CConfig> = {}) {
    this.config = {
      candleTimeframe: config.candleTimeframe || '5m',
      smaPeriod: config.smaPeriod || 50,
      smaPeriod2: config.smaPeriod2,
      smaCrossLookback: config.smaCrossLookback || 8,
      fiveMinTrendConfirmation: config.fiveMinTrendConfirmation !== false,
      fiveMinTrendSMA: config.fiveMinTrendSMA || 21,
      spikeDetectionEnabled: config.spikeDetectionEnabled || false,
      spikeThreshold: config.spikeThreshold || 0.5,
      dojiThreshold: config.dojiThreshold || 0.001, // 0.1% of price
    };
  }

  /**
   * Add a candle to the strategy's data
   */
  addCandle(candle: Candle): void {
    const key = `${candle.symbol}_${candle.timeframe}`;
    const candles = this.candles.get(key) || [];
    candles.push(candle);
    
    // Keep only last 100 candles
    if (candles.length > 100) {
      candles.shift();
    }
    this.candles.set(key, candles);

    // Also store 5m candles if timeframe is different
    if (candle.timeframe === '5m') {
      const fiveMinKey = `${candle.symbol}_5m`;
      const fiveMinCandles = this.fiveMinCandles.get(fiveMinKey) || [];
      fiveMinCandles.push(candle);
      if (fiveMinCandles.length > 100) {
        fiveMinCandles.shift();
      }
      this.fiveMinCandles.set(fiveMinKey, fiveMinCandles);
    }
  }

  /**
   * Analyze and generate entry signal
   * Returns null if no signal, or EntrySignal if conditions are met
   */
  analyze(symbol: string, instrumentType?: 'boom' | 'crash' | 'normal'): EntrySignal | null {
    const key = `${symbol}_${this.config.candleTimeframe}`;
    const candles = this.candles.get(key) || [];

    if (candles.length < Math.max(this.config.smaPeriod, this.config.smaCrossLookback + 3)) {
      return null; // Not enough data
    }

    // Get only closed candles for analysis
    const closedCandles = candles.filter(c => c.isClosed);
    if (closedCandles.length < 3) {
      return null;
    }

    // Get last 3 closed candles
    const last3Candles = closedCandles.slice(-3);

    // 1. Check 3-candle alignment
    const alignmentResult = this.checkThreeCandleAlignment(last3Candles);
    if (!alignmentResult.aligned) {
      return null;
    }

    const direction: OrderSide = alignmentResult.direction;

    // 2. Check SMA confirmation
    const smaConfirmation = this.checkSMAConfirmation(closedCandles, direction);
    if (!smaConfirmation.confirmed) {
      return null;
    }

    // 3. Check 5-minute trend confirmation (if enabled)
    let fiveMinTrendConfirmed = true;
    if (this.config.fiveMinTrendConfirmation && this.config.candleTimeframe !== '5m') {
      const fiveMinKey = `${symbol}_5m`;
      const fiveMinCandles = this.fiveMinCandles.get(fiveMinKey) || [];
      fiveMinTrendConfirmed = this.checkFiveMinuteTrend(fiveMinCandles, direction);
      if (!fiveMinTrendConfirmed) {
        return null;
      }
    }

    // 4. Check spike detection for Boom/Crash instruments
    if ((instrumentType === 'boom' || instrumentType === 'crash') && this.config.spikeDetectionEnabled) {
      const spikeDetected = this.detectSpike(closedCandles.slice(-10)); // Check last 10 candles
      if (!spikeDetected) {
        return null;
      }
    }

    // All conditions met - generate signal
    return {
      direction,
      reason: this.buildReasonString(alignmentResult, smaConfirmation, fiveMinTrendConfirmed),
      confidence: this.calculateConfidence(alignmentResult, smaConfirmation),
      timestamp: new Date(),
      threeCandleAlignment: true,
      smaConfirmation: true,
      fiveMinTrendConfirmation: fiveMinTrendConfirmed,
      spikeDetected: (instrumentType === 'boom' || instrumentType === 'crash') && this.config.spikeDetectionEnabled,
      indicators: {
        sma50: smaConfirmation.smaValue,
        sma200: smaConfirmation.sma2Value,
        price: last3Candles[last3Candles.length - 1].close,
      },
    };
  }

  /**
   * Check if last 3 candles are aligned (all bullish or all bearish)
   */
  private checkThreeCandleAlignment(candles: Candle[]): {
    aligned: boolean;
    direction?: OrderSide;
    hasDoji: boolean;
  } {
    if (candles.length < 3) {
      return { aligned: false, hasDoji: false };
    }

    let bullishCount = 0;
    let bearishCount = 0;
    let hasDoji = false;

    for (const candle of candles) {
      const bodySize = Math.abs(candle.close - candle.open);
      const bodyThreshold = candle.close * this.config.dojiThreshold;

      // Check if Doji (very small body)
      if (bodySize < bodyThreshold) {
        hasDoji = true;
        return { aligned: false, hasDoji: true };
      }

      // Determine direction
      if (candle.close > candle.open) {
        bullishCount++;
      } else if (candle.close < candle.open) {
        bearishCount++;
      }
    }

    // All 3 must be in same direction
    if (bullishCount === 3) {
      return { aligned: true, direction: 'BUY', hasDoji: false };
    } else if (bearishCount === 3) {
      return { aligned: true, direction: 'SELL', hasDoji: false };
    }

    return { aligned: false, hasDoji: false };
  }

  /**
   * Check SMA confirmation - price must have crossed SMA in the same direction
   */
  private checkSMAConfirmation(candles: Candle[], direction: OrderSide): {
    confirmed: boolean;
    smaValue?: number;
    sma2Value?: number;
  } {
    if (candles.length < this.config.smaPeriod) {
      return { confirmed: false };
    }

    // Calculate SMA
    const closes = candles.map(c => c.close);
    const sma50 = this.calculateSMA(closes, this.config.smaPeriod);
    const currentPrice = closes[closes.length - 1];
    const currentSMA = sma50[sma50.length - 1];

    // Check if price crossed SMA within lookback period
    const lookbackCandles = candles.slice(-this.config.smaCrossLookback - 1);
    const lookbackCloses = lookbackCandles.map(c => c.close);
    const lookbackSMA = this.calculateSMA(lookbackCloses, Math.min(this.config.smaPeriod, lookbackCloses.length));

    let crossed = false;
    for (let i = 1; i < lookbackCandles.length; i++) {
      const prevPrice = lookbackCloses[i - 1];
      const prevSMA = lookbackSMA[i - 1] || prevPrice;
      const currPrice = lookbackCloses[i];
      const currSMA = lookbackSMA[i] || currPrice;

      // Check for cross
      if (direction === 'BUY') {
        // Bullish: price crossed above SMA
        if (prevPrice <= prevSMA && currPrice > currSMA) {
          crossed = true;
          break;
        }
      } else {
        // Bearish: price crossed below SMA
        if (prevPrice >= prevSMA && currPrice < currSMA) {
          crossed = true;
          break;
        }
      }
    }

    if (!crossed) {
      return { confirmed: false };
    }

    // Check second SMA if enabled
    if (this.config.smaPeriod2) {
      const sma2Period = this.config.smaPeriod2;
      if (candles.length < sma2Period) {
        return { confirmed: false };
      }

      const sma200 = this.calculateSMA(closes, sma2Period);
      const currentSMA2 = sma200[sma200.length - 1];

      // Trend must align with longer SMA
      if (direction === 'BUY' && currentPrice < currentSMA2) {
        return { confirmed: false };
      } else if (direction === 'SELL' && currentPrice > currentSMA2) {
        return { confirmed: false };
      }

      return {
        confirmed: true,
        smaValue: currentSMA,
        sma2Value: currentSMA2,
      };
    }

    return {
      confirmed: true,
      smaValue: currentSMA,
    };
  }

  /**
   * Check 5-minute trend confirmation
   */
  private checkFiveMinuteTrend(fiveMinCandles: Candle[], direction: OrderSide): boolean {
    if (fiveMinCandles.length < this.config.fiveMinTrendSMA) {
      return false;
    }

    const closedFiveMin = fiveMinCandles.filter(c => c.isClosed);
    if (closedFiveMin.length < this.config.fiveMinTrendSMA) {
      return false;
    }

    const closes = closedFiveMin.map(c => c.close);
    const sma21 = this.calculateSMA(closes, this.config.fiveMinTrendSMA);
    const currentPrice = closes[closes.length - 1];
    const currentSMA = sma21[sma21.length - 1];

    // Check if trend aligns
    if (direction === 'BUY') {
      return currentPrice > currentSMA;
    } else {
      return currentPrice < currentSMA;
    }
  }

  /**
   * Detect spike for Boom/Crash instruments
   */
  private detectSpike(candles: Candle[]): boolean {
    if (candles.length < 3) {
      return false;
    }

    // Check for sudden price move >= spikeThreshold
    for (let i = 1; i < candles.length; i++) {
      const prevClose = candles[i - 1].close;
      const currHigh = candles[i].high;
      const currLow = candles[i].low;
      const currClose = candles[i].close;

      // Calculate move percentage
      const upMove = ((currHigh - prevClose) / prevClose) * 100;
      const downMove = ((prevClose - currLow) / prevClose) * 100;

      if (upMove >= this.config.spikeThreshold || downMove >= this.config.spikeThreshold) {
        return true; // Spike detected
      }

      // Also check for return move from spike
      if (i >= 2) {
        const spikeHigh = Math.max(...candles.slice(i - 2, i + 1).map(c => c.high));
        const spikeLow = Math.min(...candles.slice(i - 2, i + 1).map(c => c.low));
        const spikeRange = ((spikeHigh - spikeLow) / prevClose) * 100;

        if (spikeRange >= this.config.spikeThreshold) {
          // Check if there's a return move
          const returnMove = Math.abs(currClose - (upMove > downMove ? spikeHigh : spikeLow)) / prevClose * 100;
          if (returnMove >= this.config.spikeThreshold * 0.5) {
            return true; // Return move from spike detected
          }
        }
      }
    }

    return false;
  }

  /**
   * Calculate Simple Moving Average
   */
  private calculateSMA(values: number[], period: number): number[] {
    const sma: number[] = [];
    for (let i = 0; i < values.length; i++) {
      if (i < period - 1) {
        sma.push(NaN);
      } else {
        const sum = values.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
        sma.push(sum / period);
      }
    }
    return sma;
  }

  /**
   * Build human-readable reason string
   */
  private buildReasonString(
    alignment: { direction?: OrderSide },
    sma: { smaValue?: number },
    fiveMinTrend: boolean
  ): string {
    const parts: string[] = [];
    parts.push(`3-candle ${alignment.direction === 'BUY' ? 'bullish' : 'bearish'} alignment`);
    parts.push(`SMA${this.config.smaPeriod} cross confirmed`);
    if (this.config.smaPeriod2) {
      parts.push(`SMA${this.config.smaPeriod2} trend aligned`);
    }
    if (this.config.fiveMinTrendConfirmation && fiveMinTrend) {
      parts.push('5m trend confirmed');
    }
    return parts.join(' + ');
  }

  /**
   * Calculate signal confidence (0-1)
   */
  private calculateConfidence(
    alignment: { direction?: OrderSide },
    sma: { confirmed: boolean }
  ): number {
    let confidence = 0.6; // Base confidence

    if (sma.confirmed) {
      confidence += 0.2;
    }

    if (this.config.smaPeriod2 && sma.confirmed) {
      confidence += 0.1;
    }

    if (this.config.fiveMinTrendConfirmation) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Calculate ATR for stop loss calculation
   */
  calculateATR(candles: Candle[], period: number = 14): number | null {
    if (candles.length < period + 1) {
      return null;
    }

    const trueRanges: number[] = [];
    for (let i = 1; i < candles.length; i++) {
      const high = candles[i].high;
      const low = candles[i].low;
      const prevClose = candles[i - 1].close;

      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      trueRanges.push(tr);
    }

    // Calculate ATR as SMA of True Range
    const atrValues = this.calculateSMA(trueRanges, period);
    const atr = atrValues[atrValues.length - 1];

    return isNaN(atr) ? null : atr;
  }
}









