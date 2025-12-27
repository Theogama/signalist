/**
 * Strategy Interface for Bot Marketplace
 * Defines the contract for pluggable trading strategies
 */

import { MarketData, StrategySignal, Position } from '@/lib/auto-trading/types';

/**
 * Strategy Configuration
 */
export interface StrategyConfiguration {
  name: string;
  version: string;
  description: string;
  parameters: Record<string, any>;
}

/**
 * Strategy Analysis Result
 */
export interface StrategyAnalysisResult {
  signal: StrategySignal | null;
  confidence?: number; // 0-1 confidence score
  indicators?: Record<string, any>; // Indicator values used
  reasoning?: string; // Human-readable reasoning
}

/**
 * Strategy Interface
 * All marketplace strategies must implement this interface
 */
export interface IMarketplaceStrategy {
  /**
   * Strategy identifier
   */
  readonly strategyId: string;
  
  /**
   * Strategy name
   */
  readonly name: string;
  
  /**
   * Strategy version
   */
  readonly version: string;
  
  /**
   * Strategy description
   */
  readonly description: string;
  
  /**
   * Required indicators for this strategy
   */
  readonly requiredIndicators: string[];
  
  /**
   * Required timeframes
   */
  readonly requiredTimeframes: string[];
  
  /**
   * Supported markets
   */
  readonly supportedMarkets: ('forex' | 'synthetic' | 'crypto' | 'commodities' | 'indices')[];
  
  /**
   * Initialize strategy with configuration
   */
  initialize(config: StrategyConfiguration): Promise<void>;
  
  /**
   * Analyze market data and generate signal
   * @param marketData - Current market data
   * @param historicalData - Historical market data (optional)
   * @returns Analysis result with signal
   */
  analyze(
    marketData: MarketData,
    historicalData?: MarketData[]
  ): Promise<StrategyAnalysisResult>;
  
  /**
   * Check if strategy should enter a position
   * @param marketData - Current market data
   * @param historicalData - Historical market data (optional)
   * @returns True if should enter
   */
  shouldEnter(
    marketData: MarketData,
    historicalData?: MarketData[]
  ): Promise<boolean>;
  
  /**
   * Check if strategy should exit a position
   * @param position - Current position
   * @param marketData - Current market data
   * @returns True if should exit
   */
  shouldExit(position: Position, marketData: MarketData): Promise<boolean>;
  
  /**
   * Calculate position size based on risk
   * @param balance - Account balance
   * @param entryPrice - Entry price
   * @param stopLoss - Stop loss price
   * @param riskPercent - Risk percentage
   * @returns Position size (lot/stake)
   */
  calculatePositionSize(
    balance: number,
    entryPrice: number,
    stopLoss: number,
    riskPercent: number
  ): number;
  
  /**
   * Get strategy parameters
   */
  getParameters(): Record<string, any>;
  
  /**
   * Update strategy parameters
   */
  updateParameters(parameters: Record<string, any>): void;
  
  /**
   * Validate configuration
   * @param config - Configuration to validate
   * @returns Validation result
   */
  validateConfiguration(config: StrategyConfiguration): {
    valid: boolean;
    errors: string[];
  };
  
  /**
   * Get default configuration
   */
  getDefaultConfiguration(): StrategyConfiguration;
  
  /**
   * Get strategy metadata for UI
   */
  getMetadata(): {
    name: string;
    description: string;
    riskLevel: 'low' | 'medium' | 'high';
    category: string;
    tags: string[];
    parameters: Array<{
      key: string;
      label: string;
      type: 'number' | 'boolean' | 'string' | 'select';
      description?: string;
      default?: any;
      min?: number;
      max?: number;
      options?: string[];
      required?: boolean;
    }>;
  };
}

/**
 * Base Strategy Implementation
 * Abstract base class for marketplace strategies
 */
export abstract class BaseMarketplaceStrategy implements IMarketplaceStrategy {
  abstract readonly strategyId: string;
  abstract readonly name: string;
  abstract readonly version: string;
  abstract readonly description: string;
  abstract readonly requiredIndicators: string[];
  abstract readonly requiredTimeframes: string[];
  abstract readonly supportedMarkets: ('forex' | 'synthetic' | 'crypto' | 'commodities' | 'indices')[];
  
  protected config: StrategyConfiguration;
  
  constructor(config?: StrategyConfiguration) {
    this.config = config || this.getDefaultConfiguration();
  }
  
  async initialize(config: StrategyConfiguration): Promise<void> {
    const validation = this.validateConfiguration(config);
    if (!validation.valid) {
      throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
    }
    this.config = config;
  }
  
  abstract analyze(
    marketData: MarketData,
    historicalData?: MarketData[]
  ): Promise<StrategyAnalysisResult>;
  
  async shouldEnter(
    marketData: MarketData,
    historicalData?: MarketData[]
  ): Promise<boolean> {
    const result = await this.analyze(marketData, historicalData);
    return result.signal !== null;
  }
  
  abstract shouldExit(position: Position, marketData: MarketData): Promise<boolean>;
  
  calculatePositionSize(
    balance: number,
    entryPrice: number,
    stopLoss: number,
    riskPercent: number
  ): number {
    const riskAmount = (balance * riskPercent) / 100;
    const priceRisk = Math.abs(entryPrice - stopLoss);
    
    if (priceRisk === 0) {
      // Default to 1% of balance if no stop loss
      return (balance * 0.01) / entryPrice;
    }
    
    return riskAmount / priceRisk;
  }
  
  getParameters(): Record<string, any> {
    return this.config.parameters || {};
  }
  
  updateParameters(parameters: Record<string, any>): void {
    this.config.parameters = {
      ...this.config.parameters,
      ...parameters,
    };
  }
  
  validateConfiguration(config: StrategyConfiguration): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    
    if (!config.name) {
      errors.push('Name is required');
    }
    
    if (!config.version) {
      errors.push('Version is required');
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }
  
  abstract getDefaultConfiguration(): StrategyConfiguration;
  
  abstract getMetadata(): {
    name: string;
    description: string;
    riskLevel: 'low' | 'medium' | 'high';
    category: string;
    tags: string[];
    parameters: Array<{
      key: string;
      label: string;
      type: 'number' | 'boolean' | 'string' | 'select';
      description?: string;
      default?: any;
      min?: number;
      max?: number;
      options?: string[];
      required?: boolean;
    }>;
  };
}

/**
 * Strategy Registry
 * Manages available strategies in the marketplace
 */
export class StrategyRegistry {
  private static strategies: Map<string, new (config?: StrategyConfiguration) => IMarketplaceStrategy> = new Map();
  
  /**
   * Register a strategy
   */
  static register(
    strategyId: string,
    strategyClass: new (config?: StrategyConfiguration) => IMarketplaceStrategy
  ): void {
    this.strategies.set(strategyId, strategyClass);
  }
  
  /**
   * Get a strategy instance
   */
  static create(
    strategyId: string,
    config?: StrategyConfiguration
  ): IMarketplaceStrategy {
    const StrategyClass = this.strategies.get(strategyId);
    if (!StrategyClass) {
      throw new Error(`Strategy not found: ${strategyId}`);
    }
    return new StrategyClass(config);
  }
  
  /**
   * Get all registered strategy IDs
   */
  static getStrategyIds(): string[] {
    return Array.from(this.strategies.keys());
  }
  
  /**
   * Check if strategy exists
   */
  static hasStrategy(strategyId: string): boolean {
    return this.strategies.has(strategyId);
  }
  
  /**
   * Get strategy metadata
   */
  static getStrategyMetadata(strategyId: string): ReturnType<IMarketplaceStrategy['getMetadata']> | null {
    try {
      const strategy = this.create(strategyId);
      return strategy.getMetadata();
    } catch {
      return null;
    }
  }
}


