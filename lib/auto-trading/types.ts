/**
 * Auto-Trading Module Types
 * Core type definitions for the auto-trading system
 */

export type BrokerType = 'exness' | 'deriv';

export type OrderType = 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT';

export type OrderSide = 'BUY' | 'SELL';

export type OrderStatus = 'PENDING' | 'FILLED' | 'PARTIALLY_FILLED' | 'CANCELLED' | 'REJECTED' | 'EXPIRED';

export type PositionStatus = 'OPEN' | 'CLOSED' | 'PENDING';

export interface BrokerConfig {
  apiKey: string;
  apiSecret: string;
  accountId?: string;
  environment?: 'live' | 'demo';
  baseUrl?: string;
  rateLimitRpm?: number;
  rateLimitRps?: number;
}

export interface OrderRequest {
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  price?: number;
  stopLoss?: number;
  takeProfit?: number;
  leverage?: number;
  comment?: string;
}

export interface OrderResponse {
  orderId: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  filledQuantity: number;
  price: number;
  filledPrice?: number;
  status: OrderStatus;
  timestamp: Date;
  stopLoss?: number;
  takeProfit?: number;
  exchangeOrderId?: string;
}

export interface Position {
  positionId: string;
  symbol: string;
  side: OrderSide;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  leverage?: number;
  stopLoss?: number;
  takeProfit?: number;
  status: PositionStatus;
  openedAt: Date;
  closedAt?: Date;
}

export interface AccountBalance {
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  marginLevel?: number;
  currency: string;
}

export interface SymbolInfo {
  symbol: string;
  name: string;
  baseCurrency: string;
  quoteCurrency: string;
  minQuantity: number;
  maxQuantity: number;
  quantityStep: number;
  minPrice: number;
  maxPrice: number;
  priceStep: number;
  leverage?: number;
  maxLeverage?: number;
  tickSize: number;
  lotSize?: number;
}

export interface MarketData {
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  volume: number;
  timestamp: Date;
  high24h?: number;
  low24h?: number;
  change24h?: number;
  changePercent24h?: number;
}

export interface StrategyConfig {
  name: string;
  enabled: boolean;
  riskPercent: number; // Risk per trade as % of balance
  takeProfitPercent: number;
  stopLossPercent: number;
  maxConcurrentTrades: number;
  maxDailyTrades?: number;
  maxDailyLoss?: number;
  maxDrawdown?: number;
  parameters?: Record<string, any>;
}

export interface StrategySignal {
  symbol: string;
  side: OrderSide;
  entryPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  quantity?: number;
  confidence?: number;
  reason?: string;
  timestamp: Date;
}

export interface TradeResult {
  tradeId: string;
  strategyName: string;
  symbol: string;
  side: OrderSide;
  entryPrice: number;
  exitPrice?: number;
  quantity: number;
  profitLoss?: number;
  profitLossPercent?: number;
  status: 'OPEN' | 'CLOSED' | 'STOPPED' | 'TAKE_PROFIT';
  openedAt: Date;
  closedAt?: Date;
  duration?: number; // milliseconds
}

export interface BacktestResult {
  strategyName: string;
  startDate: Date;
  endDate: Date;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalProfitLoss: number;
  averageProfit: number;
  averageLoss: number;
  profitFactor: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  sharpeRatio?: number;
  averageRR?: number; // Average Risk/Reward ratio
  trades: TradeResult[];
}

// Enhanced backtest result with comprehensive metrics
export interface MonthlyPerformance {
  month: string;
  startBalance: number;
  endBalance: number;
  totalPnl: number;
  pnlPercent: number;
  trades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  averagePnl: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
}

export interface EquityPoint {
  timestamp: Date;
  balance: number;
  equity: number;
  drawdown: number;
  drawdownPercent: number;
}

export interface DrawdownPoint {
  timestamp: Date;
  drawdown: number;
  drawdownPercent: number;
  peakBalance: number;
  currentBalance: number;
}

export interface RiskLimits {
  maxRiskPerTrade: number; // % of balance
  maxDailyLoss: number; // % of balance
  maxDrawdown: number; // % of balance
  maxConcurrentPositions: number;
  maxPositionSize: number; // % of balance
  minAccountBalance?: number;
}

export interface HealthCheck {
  status: 'healthy' | 'degraded' | 'down';
  broker: BrokerType;
  connected: boolean;
  lastUpdate: Date;
  latency?: number;
  errors?: string[];
}

export interface Metrics {
  tradesPerSecond: number;
  totalPnl: number;
  openPositions: number;
  totalTrades: number;
  winRate: number;
  averageRR: number;
  timestamp: Date;
}




