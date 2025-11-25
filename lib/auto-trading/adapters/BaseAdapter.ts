/**
 * Base Broker Adapter
 * Abstract base class for all broker adapters
 */

import { IBrokerAdapter } from '../interfaces';
import {
  BrokerConfig,
  OrderRequest,
  OrderResponse,
  Position,
  AccountBalance,
  SymbolInfo,
  MarketData,
  HealthCheck,
  OrderStatus,
} from '../types';

export abstract class BaseAdapter implements IBrokerAdapter {
  protected config: BrokerConfig | null = null;
  protected authenticated: boolean = false;
  protected paperTrading: boolean = false;
  protected rateLimitQueue: Array<() => Promise<any>> = [];
  protected rateLimitRpm: number = 60; // requests per minute
  protected rateLimitRps: number = 10; // requests per second
  protected lastRequestTime: number = 0;
  protected requestCount: number = 0;
  protected requestWindowStart: number = Date.now();

  abstract initialize(config: BrokerConfig): Promise<void>;
  abstract authenticate(): Promise<boolean>;
  abstract getBalance(): Promise<AccountBalance>;
  abstract getSymbolInfo(symbol: string): Promise<SymbolInfo>;
  abstract getMarketData(symbol: string): Promise<MarketData>;
  abstract mapSymbol(internalSymbol: string): string;
  abstract placeOrder(request: OrderRequest): Promise<OrderResponse>;
  abstract cancelOrder(orderId: string): Promise<boolean>;
  abstract getOrderStatus(orderId: string): Promise<OrderResponse>;
  abstract getOpenPositions(): Promise<Position[]>;
  abstract closePosition(positionId: string): Promise<boolean>;
  abstract updatePosition(positionId: string, stopLoss?: number, takeProfit?: number): Promise<boolean>;

  /**
   * Rate limiting helper
   */
  protected async rateLimit<T>(fn: () => Promise<T>): Promise<T> {
    const now = Date.now();
    
    // Reset counter if window expired
    if (now - this.requestWindowStart >= 60000) {
      this.requestCount = 0;
      this.requestWindowStart = now;
    }

    // Check per-minute limit
    if (this.requestCount >= this.rateLimitRpm) {
      const waitTime = 60000 - (now - this.requestWindowStart);
      if (waitTime > 0) {
        await this.sleep(waitTime);
        this.requestCount = 0;
        this.requestWindowStart = Date.now();
      }
    }

    // Check per-second limit
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < 1000 / this.rateLimitRps) {
      await this.sleep(1000 / this.rateLimitRps - timeSinceLastRequest);
    }

    this.lastRequestTime = Date.now();
    this.requestCount++;
    
    return fn();
  }

  /**
   * Sleep helper
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Health check implementation
   */
  async healthCheck(): Promise<HealthCheck> {
    try {
      const startTime = Date.now();
      await this.getBalance();
      const latency = Date.now() - startTime;

      return {
        status: this.authenticated ? 'healthy' : 'degraded',
        broker: this.getBrokerType(),
        connected: this.authenticated,
        lastUpdate: new Date(),
        latency,
      };
    } catch (error: any) {
      return {
        status: 'down',
        broker: this.getBrokerType(),
        connected: false,
        lastUpdate: new Date(),
        errors: [error.message],
      };
    }
  }

  /**
   * Get broker type (must be implemented by subclasses)
   */
  protected abstract getBrokerType(): 'exness' | 'deriv';

  /**
   * Check if adapter is in paper trading mode
   */
  isPaperTrading(): boolean {
    return this.paperTrading;
  }

  /**
   * Set paper trading mode
   */
  setPaperTrading(enabled: boolean): void {
    this.paperTrading = enabled;
  }

  /**
   * Validate order request
   */
  protected validateOrderRequest(request: OrderRequest): void {
    if (!request.symbol) {
      throw new Error('Symbol is required');
    }
    if (!request.side) {
      throw new Error('Order side is required');
    }
    if (request.quantity <= 0) {
      throw new Error('Quantity must be greater than 0');
    }
    if (request.type === 'LIMIT' && !request.price) {
      throw new Error('Price is required for LIMIT orders');
    }
    if (request.type === 'STOP' && !request.price) {
      throw new Error('Price is required for STOP orders');
    }
  }

  /**
   * Create error response
   */
  protected createErrorResponse(error: any, request: OrderRequest): OrderResponse {
    return {
      orderId: `ERROR-${Date.now()}`,
      symbol: request.symbol,
      side: request.side,
      type: request.type,
      quantity: request.quantity,
      filledQuantity: 0,
      price: request.price || 0,
      status: 'REJECTED' as OrderStatus,
      timestamp: new Date(),
    };
  }
}




