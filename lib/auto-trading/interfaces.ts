/**
 * Auto-Trading Module Interfaces
 * Core interfaces for broker adapters and strategies
 */

import {
  BrokerConfig,
  OrderRequest,
  OrderResponse,
  Position,
  AccountBalance,
  SymbolInfo,
  MarketData,
  StrategyConfig,
  StrategySignal,
  HealthCheck,
  TradeResult,
  BacktestResult,
} from './types';

/**
 * Base interface for all broker adapters
 */
export interface IBrokerAdapter {
  /**
   * Initialize the adapter with configuration
   */
  initialize(config: BrokerConfig): Promise<void>;

  /**
   * Authenticate with the broker
   */
  authenticate(): Promise<boolean>;

  /**
   * Get account balance information
   */
  getBalance(): Promise<AccountBalance>;

  /**
   * Get symbol information
   */
  getSymbolInfo(symbol: string): Promise<SymbolInfo>;

  /**
   * Get current market data for a symbol
   */
  getMarketData(symbol: string): Promise<MarketData>;

  /**
   * Map internal symbol to broker-specific symbol
   */
  mapSymbol(internalSymbol: string): string;

  /**
   * Place an order
   */
  placeOrder(request: OrderRequest): Promise<OrderResponse>;

  /**
   * Cancel an order
   */
  cancelOrder(orderId: string): Promise<boolean>;

  /**
   * Get order status
   */
  getOrderStatus(orderId: string): Promise<OrderResponse>;

  /**
   * Get open positions
   */
  getOpenPositions(): Promise<Position[]>;

  /**
   * Close a position
   */
  closePosition(positionId: string): Promise<boolean>;

  /**
   * Update position stop loss / take profit
   */
  updatePosition(positionId: string, stopLoss?: number, takeProfit?: number): Promise<boolean>;

  /**
   * Health check
   */
  healthCheck(): Promise<HealthCheck>;

  /**
   * Check if adapter is in paper trading mode
   */
  isPaperTrading(): boolean;
}

/**
 * Base interface for all trading strategies
 */
export interface IStrategy {
  /**
   * Strategy name
   */
  name: string;

  /**
   * Strategy configuration
   */
  config: StrategyConfig;

  /**
   * Initialize the strategy
   */
  initialize(config: StrategyConfig): Promise<void>;

  /**
   * Analyze market data and generate signals
   */
  analyze(marketData: MarketData, historicalData?: MarketData[]): Promise<StrategySignal | null>;

  /**
   * Check if strategy should enter a trade
   */
  shouldEnter(marketData: MarketData, historicalData?: MarketData[]): Promise<boolean>;

  /**
   * Check if strategy should exit a position
   */
  shouldExit(position: Position, marketData: MarketData): Promise<boolean>;

  /**
   * Calculate position size based on risk
   */
  calculatePositionSize(balance: number, entryPrice: number, stopLoss?: number): number;

  /**
   * Get strategy parameters
   */
  getParameters(): Record<string, any>;

  /**
   * Update strategy parameters
   */
  updateParameters(parameters: Record<string, any>): void;
}

/**
 * Interface for risk manager
 */
export interface IRiskManager {
  /**
   * Check if a trade is allowed based on risk limits
   */
  canTrade(signal: StrategySignal, balance: number, openPositions: Position[]): Promise<boolean>;

  /**
   * Calculate maximum position size based on risk
   */
  calculateMaxPositionSize(balance: number, riskPercent: number, entryPrice: number, stopLoss?: number): number;

  /**
   * Check daily loss limits
   */
  checkDailyLoss(balance: number, dailyPnl: number): boolean;

  /**
   * Check drawdown limits
   */
  checkDrawdown(peakBalance: number, currentBalance: number): boolean;

  /**
   * Record a trade for risk tracking
   */
  recordTrade(trade: TradeResult): void;

  /**
   * Get current risk metrics
   */
  getRiskMetrics(): {
    dailyPnl: number;
    dailyTrades: number;
    maxDrawdown: number;
    peakBalance: number;
  };
}

/**
 * Interface for backtester
 */
export interface IBacktester {
  /**
   * Run backtest on historical data
   */
  backtest(
    strategy: IStrategy,
    historicalData: MarketData[],
    initialBalance: number,
    config: StrategyConfig
  ): Promise<BacktestResult>;

  /**
   * Load historical data from file or API
   */
  loadHistoricalData(symbol: string, startDate: Date, endDate: Date): Promise<MarketData[]>;
}

/**
 * Interface for paper trader
 */
export interface IPaperTrader {
  /**
   * Execute a paper trade
   */
  executeTrade(signal: StrategySignal, marketData: MarketData): Promise<OrderResponse>;

  /**
   * Simulate order fill
   */
  simulateFill(order: OrderRequest, marketData: MarketData): OrderResponse;

  /**
   * Update positions with current market data
   */
  updatePositions(marketData: MarketData): Promise<void>;

  /**
   * Get paper trading balance
   */
  getBalance(): AccountBalance;

  /**
   * Reset paper trading account
   */
  reset(initialBalance: number): Promise<void>;

  /**
   * Get paper trading history
   */
  getHistory(): TradeResult[];

  /**
   * Get open positions
   */
  getOpenPositions(): Array<{ tradeId: string; position: any }>;

  /**
   * Initialize paper trader (load from database)
   */
  initialize(): Promise<void>;
}

