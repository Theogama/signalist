/**
 * Exness Broker Adapter
 * COMPLIANCE: Read-only diagnostics adapter - NO API TRADING
 * 
 * IMPORTANT: Exness does not provide a public trading API.
 * This adapter is for diagnostics only and does NOT support:
 * - API authentication
 * - Automated trading
 * - Real-time account access
 * - Order placement
 * 
 * For Exness diagnostics, use:
 * - Manual data entry
 * - CSV/Excel file upload
 * - User-confirmed data
 */

import { BaseAdapter } from './BaseAdapter';
import {
  BrokerConfig,
  OrderRequest,
  OrderResponse,
  Position,
  AccountBalance,
  SymbolInfo,
  MarketData,
  OrderStatus,
} from '../types';

import { mapSymbolToBroker } from '../utils/symbol-mapper';

export class ExnessAdapter extends BaseAdapter {
  private apiBaseUrl: string = 'https://api.exness.com';
  private wsUrl: string = 'wss://api.exness.com/ws';
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  async initialize(config: BrokerConfig): Promise<void> {
    this.config = config;
    this.paperTrading = config.environment === 'demo' || false;
    this.rateLimitRpm = config.rateLimitRpm || 60;
    this.rateLimitRps = config.rateLimitRps || 10;
    
    if (config.baseUrl) {
      this.apiBaseUrl = config.baseUrl;
    }

    // COMPLIANCE: Exness does not provide a public trading API
    // This adapter is for read-only diagnostics only
    // Authentication is disabled - no API calls should be made
    console.warn('[ExnessAdapter] Exness does not support API trading. This adapter is for diagnostics only.');
    this.authenticated = false; // Mark as not authenticated to prevent API calls
  }

  async authenticate(): Promise<boolean> {
    // COMPLIANCE: Exness does not provide a public trading API
    // This method should never be called for actual API authentication
    console.warn('[ExnessAdapter] Exness does not support API authentication. No API calls will be made.');
    this.authenticated = false;
    return false;
  }

  private async ensureAuthenticated(): Promise<void> {
    // COMPLIANCE: Exness does not support API - always fail authentication
    throw new Error('Exness does not support API trading. This adapter is for diagnostics only. Use manual data entry or CSV upload.');
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    // COMPLIANCE: Block all API requests to Exness
    throw new Error('Exness does not provide a public trading API. API calls are not allowed. Use manual data entry or CSV upload for diagnostics.');

    return this.rateLimit(async () => {
      const response = await fetch(`${this.apiBaseUrl}${endpoint}`, {
        ...options,
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const error = await response.json().catch(() => ({ message: response.statusText }));
          throw new Error(`API request failed: ${error.message || response.statusText}`);
        } else {
          const text = await response.text().catch(() => response.statusText);
          throw new Error(`API request failed: ${response.status} ${text.substring(0, 200)}`);
        }
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text().catch(() => '');
        throw new Error(`Expected JSON but got ${contentType}: ${text.substring(0, 200)}`);
      }

      return response.json();
    });
  }

  async getBalance(): Promise<AccountBalance> {
    // COMPLIANCE: Exness does not support API - return mock data for demo/paper trading mode only
    // For real diagnostics, data should come from manual upload
    // Always return mock data to prevent errors during bot initialization
    // The system should use manual data upload for real Exness accounts
    return {
      balance: 10000,
      equity: 10000,
      margin: 0,
      freeMargin: 10000,
      marginLevel: 0,
      currency: 'USD',
    };
  }

  async getSymbolInfo(symbol: string): Promise<SymbolInfo> {
    const mappedSymbol = this.mapSymbol(symbol);

    if (this.paperTrading) {
      // Return mock symbol info
      return {
        symbol: mappedSymbol,
        name: mappedSymbol,
        baseCurrency: 'USD',
        quoteCurrency: 'USD',
        minQuantity: 0.01,
        maxQuantity: 100,
        quantityStep: 0.01,
        minPrice: 0.0001,
        maxPrice: 1000000,
        priceStep: 0.0001,
        leverage: 100,
        maxLeverage: 500,
        tickSize: 0.0001,
        lotSize: 1,
      };
    }

    // COMPLIANCE: Always return mock symbol info - no API calls
    // Real symbol info should come from manual sources
    return {
      symbol: mappedSymbol,
      name: mappedSymbol,
      baseCurrency: 'USD',
      quoteCurrency: 'USD',
      minQuantity: 0.01,
      maxQuantity: 100,
      quantityStep: 0.01,
      minPrice: 0.0001,
      maxPrice: 1000000,
      priceStep: 0.0001,
      leverage: 100,
      maxLeverage: 500,
      tickSize: 0.0001,
      lotSize: 1,
    };
  }

  async getMarketData(symbol: string): Promise<MarketData> {
    const mappedSymbol = this.mapSymbol(symbol);

    if (this.paperTrading) {
      // Return mock market data
      const basePrice = symbol === 'XAUUSD' ? 2000 : symbol === 'US30' ? 35000 : 15000;
      const variation = (Math.random() - 0.5) * 0.01; // ±0.5% variation
      const price = basePrice * (1 + variation);
      
      return {
        symbol: mappedSymbol,
        bid: price * 0.9999,
        ask: price * 1.0001,
        last: price,
        volume: Math.random() * 1000000,
        timestamp: new Date(),
        high24h: price * 1.02,
        low24h: price * 0.98,
        change24h: variation * basePrice,
        changePercent24h: variation * 100,
      };
    }

    // COMPLIANCE: Always return mock data - no API calls
    // Real market data should come from manual sources
    const basePrice = symbol === 'XAUUSD' ? 2000 : symbol === 'US30' ? 35000 : 15000;
    const variation = (Math.random() - 0.5) * 0.01;
    const price = basePrice * (1 + variation);
    
    return {
      symbol: mappedSymbol,
      bid: price * 0.9999,
      ask: price * 1.0001,
      last: price,
      volume: Math.random() * 1000000,
      timestamp: new Date(),
      high24h: price * 1.02,
      low24h: price * 0.98,
      change24h: variation * basePrice,
      changePercent24h: variation * 100,
    };
  }

  mapSymbol(internalSymbol: string): string {
    return mapSymbolToBroker(internalSymbol, 'exness');
  }

  async placeOrder(request: OrderRequest): Promise<OrderResponse> {
    // COMPLIANCE: Exness does not support API trading - block all order placement
    throw new Error('Exness does not support API trading. Automated order placement is not allowed. All trading must be done manually through the Exness platform.');

    const mappedSymbol = this.mapSymbol(request.symbol);

    if (this.paperTrading) {
      // Simulate order placement
      const marketData = await this.getMarketData(mappedSymbol);
      const filledPrice = request.type === 'MARKET' 
        ? (request.side === 'BUY' ? marketData.ask : marketData.bid)
        : (request.price || marketData.last);

      return {
        orderId: `PAPER-EXNESS-${Date.now()}`,
        symbol: mappedSymbol,
        side: request.side,
        type: request.type,
        quantity: request.quantity,
        filledQuantity: request.quantity,
        price: request.price || filledPrice,
        filledPrice,
        status: 'FILLED' as OrderStatus,
        timestamp: new Date(),
        stopLoss: request.stopLoss,
        takeProfit: request.takeProfit,
      };
    }

    try {
      const orderData: any = {
        symbol: mappedSymbol,
        side: request.side.toLowerCase(),
        type: request.type.toLowerCase(),
        quantity: request.quantity,
      };

      if (request.type === 'LIMIT' || request.type === 'STOP') {
        orderData.price = request.price;
      }

      if (request.leverage) {
        orderData.leverage = request.leverage;
      }

      if (request.stopLoss) {
        orderData.stop_loss = request.stopLoss;
      }

      if (request.takeProfit) {
        orderData.take_profit = request.takeProfit;
      }

      const data = await this.makeRequest('/v1/orders', {
        method: 'POST',
        body: JSON.stringify(orderData),
      });

      return {
        orderId: data.order_id || data.id,
        symbol: mappedSymbol,
        side: request.side,
        type: request.type,
        quantity: request.quantity,
        filledQuantity: data.filled_quantity || 0,
        price: request.price || data.price,
        filledPrice: data.filled_price,
        status: this.mapOrderStatus(data.status),
        timestamp: new Date(data.timestamp || Date.now()),
        stopLoss: request.stopLoss,
        takeProfit: request.takeProfit,
        exchangeOrderId: data.exchange_order_id,
      };
    } catch (error: any) {
      console.error('Error placing order:', error);
      return this.createErrorResponse(error, request);
    }
  }

  private mapOrderStatus(status: string): OrderStatus {
    const statusMap: Record<string, OrderStatus> = {
      'pending': 'PENDING',
      'filled': 'FILLED',
      'partially_filled': 'PARTIALLY_FILLED',
      'cancelled': 'CANCELLED',
      'rejected': 'REJECTED',
      'expired': 'EXPIRED',
    };

    return statusMap[status.toLowerCase()] || 'PENDING';
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    // COMPLIANCE: Exness does not support API trading
    // Return true for paper trading to prevent errors, but block live trading
    if (this.paperTrading) {
      return true;
    }
    throw new Error('Exness does not support API trading. Order cancellation must be done manually through the Exness platform.');
  }

  async getOrderStatus(orderId: string): Promise<OrderResponse> {
    // COMPLIANCE: Exness does not support API access
    // Return mock response for paper trading to prevent errors
    if (this.paperTrading) {
      return {
        orderId,
        symbol: 'UNKNOWN',
        side: 'BUY',
        type: 'MARKET',
        quantity: 0,
        filledQuantity: 0,
        price: 0,
        filledPrice: 0,
        status: 'FILLED',
        timestamp: new Date(),
      };
    }
    throw new Error('Exness does not support API access. Order status must be checked manually through the Exness platform.');
  }

  async getOpenPositions(): Promise<Position[]> {
    // COMPLIANCE: Exness does not support API - always return empty array
    // Positions should come from manual data upload or CSV import
    // This prevents errors during bot initialization
    return [];
  }

  async closePosition(positionId: string): Promise<boolean> {
    // COMPLIANCE: Exness does not support API trading
    throw new Error('Exness does not support API trading. Position closure must be done manually through the Exness platform.');
  }

  async updatePosition(positionId: string, stopLoss?: number, takeProfit?: number): Promise<boolean> {
    // COMPLIANCE: Exness does not support API trading
    // Return true for paper trading to prevent errors, but block live trading
    if (this.paperTrading) {
      return true;
    }
    throw new Error('Exness does not support API trading. Position updates must be done manually through the Exness platform.');
  }

  protected getBrokerType(): 'exness' | 'deriv' {
    return 'exness';
  }
}



