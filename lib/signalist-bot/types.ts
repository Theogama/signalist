/**
 * Signalist Unified Trading Bot Types
 * Core type definitions for the unified trading engine
 */

export type BrokerType = 'exness' | 'deriv';

export type InstrumentType = 
  // Exness instruments
  | 'XAUUSD' | 'US30' | 'NAS100'
  // Deriv instruments
  | 'BOOM1000' | 'BOOM500' | 'CRASH1000' | 'CRASH500'
  | string; // Allow custom instruments

export type Timeframe = '1m' | '3m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d';

export type OrderSide = 'BUY' | 'SELL';

export type OrderStatus = 'PENDING' | 'FILLED' | 'PARTIALLY_FILLED' | 'CANCELLED' | 'REJECTED' | 'CLOSED';

export type TradeStatus = 'OPEN' | 'CLOSED' | 'TP_HIT' | 'SL_HIT' | 'REVERSE_SIGNAL' | 'MANUAL_CLOSE' | 'FORCE_STOP';

export type StrategyType = 'Signalist-SMA-3C' | 'Custom';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Candle/Bar data structure
 */
export interface Candle {
  symbol: string;
  timeframe: Timeframe;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: Date;
  isClosed: boolean; // True if this is a closed candle
}

/**
 * Tick data structure
 */
export interface Tick {
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  timestamp: Date;
}

/**
 * Unified broker adapter interface
 */
export interface UnifiedBrokerAdapter {
  // Connection management
  initialize(config: BrokerAdapterConfig): Promise<void>;
  connect(): Promise<boolean>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  getBrokerType(): BrokerType;

  // Account operations
  getAccountInfo(): Promise<AccountInfo>;
  getBalance(): Promise<number>;

  // Market data
  subscribeToTicks(symbol: string, callback: (tick: Tick) => void): Promise<() => void>;
  subscribeToCandles(symbol: string, timeframe: Timeframe, callback: (candle: Candle) => void): Promise<() => void>;
  getHistoricalCandles(symbol: string, timeframe: Timeframe, count: number): Promise<Candle[]>;

  // Trading operations
  placeTrade(request: UnifiedTradeRequest): Promise<UnifiedTradeResponse>;
  closeTrade(tradeId: string): Promise<boolean>;
  getOpenTrades(symbol?: string): Promise<OpenTrade[]>;
  getClosedTrades(symbol?: string, fromDate?: Date, toDate?: Date): Promise<ClosedTrade[]>;

  // Position sizing
  computeLotFromRisk(riskPercent: number, accountBalance: number, entryPrice: number, stopLoss: number, symbol: string): Promise<number>;
  computeStakeFromRisk(riskPercent: number, accountBalance: number, symbol: string): Promise<number>;

  // Health check
  healthCheck(): Promise<HealthCheck>;
}

/**
 * Broker adapter configuration
 */
export interface BrokerAdapterConfig {
  broker: BrokerType;
  // For Exness MT5
  mt5Login?: number;
  mt5Password?: string;
  mt5Server?: string;
  mt5MagicNumber?: number;
  // For Deriv WebSocket
  derivToken?: string;
  derivAppId?: string;
  // Common
  paperTrading?: boolean;
  environment?: 'live' | 'demo';
}

/**
 * Unified trade request (works for both brokers)
 */
export interface UnifiedTradeRequest {
  symbol: string;
  side: OrderSide;
  lotOrStake: number; // Lot size for Exness, stake amount for Deriv
  stopLoss: number;
  takeProfit: number;
  comment?: string;
  // For Deriv contracts
  duration?: number; // Duration in minutes for Deriv contracts
}

/**
 * Unified trade response
 */
export interface UnifiedTradeResponse {
  success: boolean;
  tradeId: string;
  symbol: string;
  side: OrderSide;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  lotOrStake: number;
  timestamp: Date;
  error?: string;
}

/**
 * Open trade structure
 */
export interface OpenTrade {
  tradeId: string;
  symbol: string;
  side: OrderSide;
  entryPrice: number;
  currentPrice: number;
  lotOrStake: number;
  stopLoss: number;
  takeProfit: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  openedAt: Date;
  brokerTradeId?: string; // Internal broker trade ID
}

/**
 * Closed trade structure
 */
export interface ClosedTrade {
  tradeId: string;
  symbol: string;
  side: OrderSide;
  entryPrice: number;
  exitPrice: number;
  lotOrStake: number;
  stopLoss: number;
  takeProfit: number;
  realizedPnl: number;
  realizedPnlPercent: number;
  status: TradeStatus;
  openedAt: Date;
  closedAt: Date;
  entryReason?: string;
  exitReason?: string;
}

/**
 * Account information
 */
export interface AccountInfo {
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  marginLevel?: number;
  currency: string;
  leverage?: number;
}

/**
 * Health check result
 */
export interface HealthCheck {
  status: 'healthy' | 'degraded' | 'down';
  broker: BrokerType;
  connected: boolean;
  lastUpdate: Date;
  latency?: number;
  errors?: string[];
}

/**
 * Bot settings configuration
 */
export interface SignalistBotSettings {
  userId: string;
  broker: BrokerType;
  instrument: InstrumentType;
  enabled: boolean;
  riskPerTrade: number; // Percentage (1-50, default 10)
  maxDailyLoss: number; // Percentage of account balance
  maxDailyTrades: number;
  tradeFrequency: 'once-per-candle'; // Only supported mode
  candleTimeframe: Timeframe; // Default: 5m
  smaPeriod: number; // Default: 50
  smaPeriod2?: number; // Optional second SMA (e.g., 200)
  tpMultiplier: number; // TP = tpMultiplier * SL (default: 3)
  slMethod: 'pips' | 'atr' | 'candle'; // Default: 'atr'
  slValue?: number; // For pips method
  atrPeriod?: number; // For ATR method (default: 14)
  spikeDetectionEnabled: boolean; // For Deriv Boom/Crash
  spikeThreshold?: number; // Percentage (default: 0.5 for Boom/Crash)
  strategy: StrategyType; // Default: 'Signalist-SMA-3C'
  magicNumber?: number; // For Exness MT5
  loggingLevel: LogLevel;
  forceStopDrawdown?: number; // Percentage
  forceStopConsecutiveLosses?: number;
  minTimeInTrade?: number; // Minimum candles before reverse signal exit (default: 1)
  smaCrossLookback?: number; // Number of candles to look back for SMA cross (default: 8)
  fiveMinTrendConfirmation: boolean; // Default: true
}

/**
 * Bot status and state
 */
export interface BotStatus {
  userId: string;
  isRunning: boolean;
  isPaused: boolean;
  broker: BrokerType;
  instrument: InstrumentType;
  startedAt?: Date;
  stoppedAt?: Date;
  lastCandleProcessed?: Date;
  lastTradeTimestamp?: Date;
  dailyStats: {
    tradesCount: number;
    wins: number;
    losses: number;
    totalPnl: number;
    startingBalance: number;
    currentBalance: number;
    drawdown: number;
    drawdownPercent: number;
  };
  consecutiveLosses: number;
  stopReason?: string; // Reason why bot was stopped
  error?: string;
}

/**
 * Trade entry signal
 */
export interface EntrySignal {
  direction: OrderSide;
  reason: string; // Human-readable reason
  confidence: number; // 0-1
  timestamp: Date;
  // Strategy components
  threeCandleAlignment: boolean;
  smaConfirmation: boolean;
  fiveMinTrendConfirmation?: boolean;
  spikeDetected?: boolean;
  indicators?: Record<string, any>;
}

/**
 * Bot event for real-time updates
 */
export type BotEvent =
  | { type: 'trade_opened'; data: OpenTrade; timestamp: Date }
  | { type: 'trade_closed'; data: ClosedTrade; timestamp: Date }
  | { type: 'signal_detected'; data: EntrySignal; timestamp: Date }
  | { type: 'stop_triggered'; reason: string; timestamp: Date }
  | { type: 'error'; error: string; timestamp: Date }
  | { type: 'status_update'; status: BotStatus; timestamp: Date }
  | { type: 'candle_processed'; candle: Candle; timestamp: Date };






