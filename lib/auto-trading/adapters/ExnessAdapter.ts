/**
 * Exness Broker Adapter
 * Implements trading operations for Exness broker
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

    await this.authenticate();
  }

  async authenticate(): Promise<boolean> {
    if (!this.config) {
      throw new Error('Adapter not initialized');
    }

    try {
      // Exness uses OAuth2 or API key authentication
      // This is a simplified implementation - actual implementation depends on Exness API docs
      const response = await this.rateLimit(async () => {
        const res = await fetch(`${this.apiBaseUrl}/v1/auth/token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            api_key: this.config!.apiKey,
            api_secret: this.config!.apiSecret,
          }),
        });

        if (!res.ok) {
          throw new Error(`Authentication failed: ${res.statusText}`);
        }

        return res.json();
      });

      this.accessToken = response.access_token || response.token;
      this.tokenExpiry = Date.now() + (response.expires_in * 1000 || 3600000);
      this.authenticated = true;

      return true;
    } catch (error: any) {
      console.error('Exness authentication error:', error);
      this.authenticated = false;
      return false;
    }
  }

  private async ensureAuthenticated(): Promise<void> {
    if (!this.authenticated || Date.now() >= this.tokenExpiry) {
      await this.authenticate();
    }
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    await this.ensureAuthenticated();

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
    if (this.paperTrading) {
      // Return mock balance for paper trading
      return {
        balance: 10000,
        equity: 10000,
        margin: 0,
        freeMargin: 10000,
        marginLevel: 0,
        currency: 'USD',
      };
    }

    try {
      const data = await this.makeRequest('/v1/account/balance');
      
      return {
        balance: data.balance || 0,
        equity: data.equity || data.balance || 0,
        margin: data.margin || 0,
        freeMargin: data.free_margin || data.available || 0,
        marginLevel: data.margin_level,
        currency: data.currency || 'USD',
      };
    } catch (error: any) {
      console.error('Error fetching balance:', error);
      throw error;
    }
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

    try {
      const data = await this.makeRequest(`/v1/symbols/${mappedSymbol}`);
      
      return {
        symbol: mappedSymbol,
        name: data.name || mappedSymbol,
        baseCurrency: data.base_currency || 'USD',
        quoteCurrency: data.quote_currency || 'USD',
        minQuantity: data.min_volume || 0.01,
        maxQuantity: data.max_volume || 100,
        quantityStep: data.volume_step || 0.01,
        minPrice: data.min_price || 0.0001,
        maxPrice: data.max_price || 1000000,
        priceStep: data.price_step || 0.0001,
        leverage: data.leverage || 100,
        maxLeverage: data.max_leverage || 500,
        tickSize: data.tick_size || 0.0001,
        lotSize: data.lot_size || 1,
      };
    } catch (error: any) {
      console.error('Error fetching symbol info:', error);
      throw error;
    }
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

    try {
      const data = await this.makeRequest(`/v1/market/ticker/${mappedSymbol}`);
      
      return {
        symbol: mappedSymbol,
        bid: data.bid || data.last,
        ask: data.ask || data.last,
        last: data.last || data.close,
        volume: data.volume || 0,
        timestamp: new Date(data.timestamp || Date.now()),
        high24h: data.high_24h,
        low24h: data.low_24h,
        change24h: data.change_24h,
        changePercent24h: data.change_percent_24h,
      };
    } catch (error: any) {
      console.error('Error fetching market data:', error);
      throw error;
    }
  }

  mapSymbol(internalSymbol: string): string {
    return mapSymbolToBroker(internalSymbol, 'exness');
  }

  async placeOrder(request: OrderRequest): Promise<OrderResponse> {
    this.validateOrderRequest(request);

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
    if (this.paperTrading) {
      return true; // Paper trading orders are immediately filled
    }

    try {
      await this.makeRequest(`/v1/orders/${orderId}`, {
        method: 'DELETE',
      });
      return true;
    } catch (error: any) {
      console.error('Error cancelling order:', error);
      return false;
    }
  }

  async getOrderStatus(orderId: string): Promise<OrderResponse> {
    if (this.paperTrading) {
      throw new Error('Order status not available in paper trading mode');
    }

    try {
      const data = await this.makeRequest(`/v1/orders/${orderId}`);
      
      return {
        orderId: data.order_id || data.id,
        symbol: data.symbol,
        side: data.side.toUpperCase() as 'BUY' | 'SELL',
        type: data.type.toUpperCase() as any,
        quantity: data.quantity,
        filledQuantity: data.filled_quantity || 0,
        price: data.price,
        filledPrice: data.filled_price,
        status: this.mapOrderStatus(data.status),
        timestamp: new Date(data.timestamp || Date.now()),
        stopLoss: data.stop_loss,
        takeProfit: data.take_profit,
        exchangeOrderId: data.exchange_order_id,
      };
    } catch (error: any) {
      console.error('Error fetching order status:', error);
      throw error;
    }
  }

  async getOpenPositions(): Promise<Position[]> {
    if (this.paperTrading) {
      return []; // Paper trading positions are tracked separately
    }

    try {
      const data = await this.makeRequest('/v1/positions');
      
      return (data.positions || data || []).map((pos: any) => ({
        positionId: pos.position_id || pos.id,
        symbol: pos.symbol,
        side: pos.side.toUpperCase() as 'BUY' | 'SELL',
        quantity: pos.quantity,
        entryPrice: pos.entry_price,
        currentPrice: pos.current_price || pos.mark_price,
        unrealizedPnl: pos.unrealized_pnl || 0,
        unrealizedPnlPercent: pos.unrealized_pnl_percent || 0,
        leverage: pos.leverage,
        stopLoss: pos.stop_loss,
        takeProfit: pos.take_profit,
        status: pos.status === 'open' ? 'OPEN' : 'CLOSED',
        openedAt: new Date(pos.opened_at || pos.timestamp),
        closedAt: pos.closed_at ? new Date(pos.closed_at) : undefined,
      }));
    } catch (error: any) {
      console.error('Error fetching positions:', error);
      return [];
    }
  }

  async closePosition(positionId: string): Promise<boolean> {
    if (this.paperTrading) {
      return true;
    }

    try {
      await this.makeRequest(`/v1/positions/${positionId}`, {
        method: 'DELETE',
      });
      return true;
    } catch (error: any) {
      console.error('Error closing position:', error);
      return false;
    }
  }

  async updatePosition(positionId: string, stopLoss?: number, takeProfit?: number): Promise<boolean> {
    if (this.paperTrading) {
      return true;
    }

    try {
      const updateData: any = {};
      if (stopLoss !== undefined) updateData.stop_loss = stopLoss;
      if (takeProfit !== undefined) updateData.take_profit = takeProfit;

      await this.makeRequest(`/v1/positions/${positionId}`, {
        method: 'PATCH',
        body: JSON.stringify(updateData),
      });
      return true;
    } catch (error: any) {
      console.error('Error updating position:', error);
      return false;
    }
  }

  protected getBrokerType(): 'exness' | 'deriv' {
    return 'exness';
  }
}



