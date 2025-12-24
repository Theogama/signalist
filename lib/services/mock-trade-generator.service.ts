/**
 * Mock Trade Generator Service
 * 
 * Generates realistic trade outcomes for demo mode.
 * Simulates various trading scenarios and market conditions.
 */

/**
 * Trade Outcome Configuration
 */
export interface TradeOutcomeConfig {
  winRate: number; // 0-1, probability of winning
  volatility: number; // 0-1, outcome variance
  minProfitPercent: number;
  maxProfitPercent: number;
  minLossPercent: number;
  maxLossPercent: number;
  trendBias?: number; // -1 to 1, market trend bias
}

/**
 * Trade Outcome
 */
export interface TradeOutcome {
  willWin: boolean;
  profitLoss: number;
  profitLossPercent: number;
  executionTime: number; // ms until settlement
  priceMovement: {
    start: number;
    end: number;
    peak: number;
    trough: number;
  };
}

/**
 * Market Scenario
 */
export enum MarketScenario {
  BULLISH = 'bullish', // Trending up
  BEARISH = 'bearish', // Trending down
  VOLATILE = 'volatile', // High volatility
  RANGING = 'ranging', // Sideways movement
  BREAKOUT = 'breakout', // Strong directional move
}

/**
 * Mock Trade Generator
 */
export class MockTradeGenerator {
  private config: TradeOutcomeConfig;
  private currentScenario: MarketScenario = MarketScenario.RANGING;
  private scenarioStartTime: number = Date.now();
  private scenarioDuration: number = 300000; // 5 minutes

  constructor(config?: Partial<TradeOutcomeConfig>) {
    this.config = {
      winRate: 0.55,
      volatility: 0.3,
      minProfitPercent: 50,
      maxProfitPercent: 200,
      minLossPercent: 50,
      maxLossPercent: 100,
      trendBias: 0,
      ...config,
    };
  }

  /**
   * Generate trade outcome
   */
  generateOutcome(
    stake: number,
    contractType: 'CALL' | 'PUT',
    symbol: string
  ): TradeOutcome {
    // Update market scenario periodically
    this.updateMarketScenario();

    // Determine win/loss based on win rate and market scenario
    const adjustedWinRate = this.adjustWinRateForScenario(contractType);
    const willWin = Math.random() < adjustedWinRate;

    // Calculate profit/loss
    const profitLoss = this.calculateProfitLoss(stake, willWin);
    const profitLossPercent = (profitLoss / stake) * 100;

    // Generate price movement simulation
    const priceMovement = this.generatePriceMovement(
      symbol,
      contractType,
      willWin
    );

    // Execution time (contract duration with some variance)
    const executionTime = this.generateExecutionTime();

    return {
      willWin,
      profitLoss,
      profitLossPercent,
      executionTime,
      priceMovement,
    };
  }

  /**
   * Generate multiple outcomes (for backtesting/analytics)
   */
  generateMultipleOutcomes(
    count: number,
    stake: number,
    contractType: 'CALL' | 'PUT',
    symbol: string
  ): TradeOutcome[] {
    const outcomes: TradeOutcome[] = [];
    for (let i = 0; i < count; i++) {
      outcomes.push(this.generateOutcome(stake, contractType, symbol));
    }
    return outcomes;
  }

  /**
   * Calculate profit/loss
   */
  private calculateProfitLoss(stake: number, willWin: boolean): number {
    if (willWin) {
      const profitPercent =
        this.config.minProfitPercent +
        Math.random() *
          (this.config.maxProfitPercent - this.config.minProfitPercent);
      return (stake * profitPercent) / 100;
    } else {
      const lossPercent =
        this.config.minLossPercent +
        Math.random() *
          (this.config.maxLossPercent - this.config.minLossPercent);
      return -(stake * lossPercent) / 100;
    }
  }

  /**
   * Adjust win rate based on market scenario
   */
  private adjustWinRateForScenario(contractType: 'CALL' | 'PUT'): number {
    let adjustedRate = this.config.winRate;

    switch (this.currentScenario) {
      case MarketScenario.BULLISH:
        adjustedRate = contractType === 'CALL' ? adjustedRate + 0.1 : adjustedRate - 0.1;
        break;
      case MarketScenario.BEARISH:
        adjustedRate = contractType === 'PUT' ? adjustedRate + 0.1 : adjustedRate - 0.1;
        break;
      case MarketScenario.VOLATILE:
        adjustedRate = adjustedRate - 0.05; // Lower win rate in volatile markets
        break;
      case MarketScenario.BREAKOUT:
        // Higher win rate for correct direction
        adjustedRate =
          contractType === 'CALL' ? adjustedRate + 0.15 : adjustedRate - 0.15;
        break;
      case MarketScenario.RANGING:
        // Neutral, no adjustment
        break;
    }

    // Clamp between 0 and 1
    return Math.max(0, Math.min(1, adjustedRate));
  }

  /**
   * Generate price movement simulation
   */
  private generatePriceMovement(
    symbol: string,
    contractType: 'CALL' | 'PUT',
    willWin: boolean
  ): {
    start: number;
    end: number;
    peak: number;
    trough: number;
  } {
    const basePrice = this.getBasePrice(symbol);
    const volatility = this.config.volatility * 50; // Scale volatility

    let start = basePrice + (Math.random() - 0.5) * 20;
    let end: number;
    let peak: number;
    let trough: number;

    if (willWin) {
      // Price moves in favor of contract
      if (contractType === 'CALL') {
        end = start + volatility * (0.5 + Math.random() * 0.5);
        peak = end + volatility * 0.2;
        trough = start - volatility * 0.1;
      } else {
        // PUT
        end = start - volatility * (0.5 + Math.random() * 0.5);
        peak = start + volatility * 0.1;
        trough = end - volatility * 0.2;
      }
    } else {
      // Price moves against contract
      if (contractType === 'CALL') {
        end = start - volatility * (0.5 + Math.random() * 0.5);
        peak = start + volatility * 0.1;
        trough = end - volatility * 0.2;
      } else {
        // PUT
        end = start + volatility * (0.5 + Math.random() * 0.5);
        peak = end + volatility * 0.2;
        trough = start - volatility * 0.1;
      }
    }

    return { start, end, peak, trough };
  }

  /**
   * Generate execution time (contract duration)
   */
  private generateExecutionTime(): number {
    // Typical contract durations: 1-5 minutes
    const minDuration = 60 * 1000; // 1 minute
    const maxDuration = 5 * 60 * 1000; // 5 minutes
    return minDuration + Math.random() * (maxDuration - minDuration);
  }

  /**
   * Update market scenario periodically
   */
  private updateMarketScenario(): void {
    const now = Date.now();
    if (now - this.scenarioStartTime > this.scenarioDuration) {
      // Change scenario
      const scenarios = Object.values(MarketScenario);
      this.currentScenario =
        scenarios[Math.floor(Math.random() * scenarios.length)];
      this.scenarioStartTime = now;
      this.scenarioDuration = (2 + Math.random() * 8) * 60000; // 2-10 minutes
    }
  }

  /**
   * Get base price for symbol
   */
  private getBasePrice(symbol: string): number {
    const basePrices: Record<string, number> = {
      BOOM500: 1000,
      BOOM1000: 1000,
      BOOM300: 1000,
      BOOM100: 1000,
      CRASH500: 1000,
      CRASH1000: 1000,
      CRASH300: 1000,
      CRASH100: 1000,
    };
    return basePrices[symbol] || 1000;
  }

  /**
   * Set market scenario manually (for testing)
   */
  setMarketScenario(scenario: MarketScenario): void {
    this.currentScenario = scenario;
    this.scenarioStartTime = Date.now();
  }

  /**
   * Get current market scenario
   */
  getCurrentScenario(): MarketScenario {
    return this.currentScenario;
  }
}

// Singleton instance
export const mockTradeGenerator = new MockTradeGenerator();

