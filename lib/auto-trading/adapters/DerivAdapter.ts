/**
 * Deriv Broker Adapter
 * Implements trading operations for Deriv broker (Boom/Crash indices)
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

export class DerivAdapter extends BaseAdapter {
  private apiBaseUrl: string = 'https://api.deriv.com';
  private wsUrl: string = 'wss://ws.derivws.com/websockets/v3';
  private appId: string = '113058'; // Deriv app ID
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  private wsConnection: WebSocket | null = null;
  private wsSubscriptions: Map<string, (data: any) => void> = new Map();
  private wsRequestId: number = 1;
  private wsReconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;

  async initialize(config: BrokerConfig): Promise<void> {
    this.config = config;
    this.paperTrading = config.environment === 'demo' || false;
    this.rateLimitRpm = config.rateLimitRpm || 60;
    this.rateLimitRps = config.rateLimitRps || 10;
    
    if (config.baseUrl) {
      this.apiBaseUrl = config.baseUrl;
    }

    await this.authenticate();
    
    // Initialize WebSocket connection for real-time data (client-side only)
    // Server-side adapters will use REST API
    if (typeof window !== 'undefined' && typeof WebSocket !== 'undefined') {
      this.connectWebSocket();
    }
  }

  async authenticate(): Promise<boolean> {
    if (!this.config) {
      throw new Error('Adapter not initialized');
    }

    try {
      // Deriv uses OAuth2 token authentication
      const response = await this.rateLimit(async () => {
        const res = await fetch(`${this.apiBaseUrl}/oauth2/token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: this.config!.apiKey,
            client_secret: this.config!.apiSecret,
            app_id: this.appId,
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
      console.error('Deriv authentication error:', error);
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
      const data = await this.makeRequest('/account');
      
      return {
        balance: data.balance || data.currency_account?.balance || 0,
        equity: data.equity || data.balance || 0,
        margin: data.margin || 0,
        freeMargin: data.available || data.balance || 0,
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
      // Return mock symbol info for Boom/Crash indices
      const isBoom = mappedSymbol.startsWith('BOOM');
      const basePrice = isBoom ? 10000 : 10000; // Boom starts at 10000, Crash starts at 10000
      
      return {
        symbol: mappedSymbol,
        name: mappedSymbol,
        baseCurrency: 'USD',
        quoteCurrency: 'USD',
        minQuantity: 0.01,
        maxQuantity: 1000,
        quantityStep: 0.01,
        minPrice: 0.01,
        maxPrice: 20000,
        priceStep: 0.01,
        leverage: 1, // Binary options typically have 1:1 payout
        maxLeverage: 1,
        tickSize: 0.01,
        lotSize: 1,
      };
    }

    try {
      const data = await this.makeRequest(`/trading/symbols/${mappedSymbol}`);
      
      return {
        symbol: mappedSymbol,
        name: data.display_name || mappedSymbol,
        baseCurrency: 'USD',
        quoteCurrency: 'USD',
        minQuantity: data.min_contract || 0.01,
        maxQuantity: data.max_contract || 1000,
        quantityStep: data.contract_step || 0.01,
        minPrice: data.min_price || 0.01,
        maxPrice: data.max_price || 20000,
        priceStep: data.price_step || 0.01,
        leverage: 1,
        maxLeverage: 1,
        tickSize: data.tick_size || 0.01,
        lotSize: 1,
      };
    } catch (error: any) {
      console.error('Error fetching symbol info:', error);
      throw error;
    }
  }

  mapSymbol(internalSymbol: string): string {
    return mapSymbolToBroker(internalSymbol, 'deriv');
  }

  async placeOrder(request: OrderRequest): Promise<OrderResponse> {
    this.validateOrderRequest(request);

    const mappedSymbol = this.mapSymbol(request.symbol);

    if (this.paperTrading) {
      const marketData = await this.getMarketData(mappedSymbol);
      const filledPrice = request.type === 'MARKET' 
        ? (request.side === 'BUY' ? marketData.ask : marketData.bid)
        : (request.price || marketData.last);

      return {
        orderId: `PAPER-DERIV-${Date.now()}`,
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
      // Try WebSocket first if available and connected
      if (this.wsConnection?.readyState === WebSocket.OPEN && this.accessToken) {
        return this.placeOrderViaWebSocket(request, mappedSymbol);
      }

      // Fallback to REST API
      // Deriv uses contract-based trading for Boom/Crash
      const orderData: any = {
        symbol: mappedSymbol,
        contract_type: request.side === 'BUY' ? 'CALL' : 'PUT', // For binary options
        amount: request.quantity,
        duration: 5, // Default 5 ticks for Boom/Crash
        duration_unit: 't', // 't' for ticks, 's' for seconds
      };

      // For CFDs (if supported)
      if (request.type === 'MARKET') {
        orderData.order_type = 'market';
      } else if (request.type === 'LIMIT') {
        orderData.order_type = 'limit';
        orderData.limit_price = request.price;
      }

      const data = await this.makeRequest('/buy', {
        method: 'POST',
        body: JSON.stringify(orderData),
      });

      return {
        orderId: data.buy?.contract_id || data.contract_id || data.order_id,
        symbol: mappedSymbol,
        side: request.side,
        type: request.type,
        quantity: request.quantity,
        filledQuantity: request.quantity,
        price: request.price || data.purchase_price,
        filledPrice: data.purchase_price || request.price,
        status: 'FILLED' as OrderStatus,
        timestamp: new Date(data.date_start * 1000 || Date.now()),
        stopLoss: request.stopLoss,
        takeProfit: request.takeProfit,
        exchangeOrderId: data.contract_id,
      };
    } catch (error: any) {
      console.error('Error placing order:', error);
      return this.createErrorResponse(error, request);
    }
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    if (this.paperTrading) {
      return true;
    }

    try {
      await this.makeRequest(`/sell/${orderId}`, {
        method: 'POST',
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
      const data = await this.makeRequest(`/contract/${orderId}`);
      
      return {
        orderId: data.contract_id,
        symbol: data.symbol,
        side: data.contract_type === 'CALL' ? 'BUY' : 'SELL',
        type: 'MARKET',
        quantity: data.amount,
        filledQuantity: data.amount,
        price: data.purchase_price,
        filledPrice: data.purchase_price,
        status: data.status === 'sold' ? 'FILLED' : 'PENDING',
        timestamp: new Date(data.date_start * 1000),
        exchangeOrderId: data.contract_id,
      };
    } catch (error: any) {
      console.error('Error fetching order status:', error);
      throw error;
    }
  }

  async getOpenPositions(): Promise<Position[]> {
    if (this.paperTrading) {
      return [];
    }

    try {
      const data = await this.makeRequest('/portfolio');
      
      return (data.contracts || []).map((contract: any) => {
        const currentPrice = contract.current_spot || contract.spot;
        const entryPrice = contract.purchase_price;
        const pnl = contract.profit || 0;
        
        return {
          positionId: contract.contract_id,
          symbol: contract.symbol,
          side: contract.contract_type === 'CALL' ? 'BUY' : 'SELL',
          quantity: contract.amount,
          entryPrice,
          currentPrice,
          unrealizedPnl: pnl,
          unrealizedPnlPercent: entryPrice > 0 ? (pnl / entryPrice) * 100 : 0,
          leverage: 1,
          status: contract.status === 'open' ? 'OPEN' : 'CLOSED',
          openedAt: new Date(contract.date_start * 1000),
          closedAt: contract.date_expiry ? new Date(contract.date_expiry * 1000) : undefined,
        };
      });
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
      await this.makeRequest(`/sell/${positionId}`, {
        method: 'POST',
      });
      return true;
    } catch (error: any) {
      console.error('Error closing position:', error);
      return false;
    }
  }

  async updatePosition(positionId: string, stopLoss?: number, takeProfit?: number): Promise<boolean> {
    // Deriv binary options don't support stop loss/take profit in traditional sense
    // They have fixed payout structures
    // This would be for CFD positions if supported
    if (this.paperTrading) {
      return true;
    }

    try {
      const updateData: any = {};
      if (stopLoss !== undefined) updateData.stop_loss = stopLoss;
      if (takeProfit !== undefined) updateData.take_profit = takeProfit;

      await this.makeRequest(`/contract/${positionId}`, {
        method: 'PATCH',
        body: JSON.stringify(updateData),
      });
      return true;
    } catch (error: any) {
      console.error('Error updating position:', error);
      return false;
    }
  }

  /**
   * Connect to Deriv WebSocket API
   */
  private connectWebSocket(): void {
    if (typeof WebSocket === 'undefined') {
      console.warn('[DerivAdapter] WebSocket not available');
      return;
    }

    if (this.wsConnection?.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    try {
      const wsUrl = `${this.wsUrl}?app_id=${this.appId}`;
      this.wsConnection = new WebSocket(wsUrl);

      this.wsConnection.onopen = () => {
        console.log('[DerivAdapter] WebSocket connected');
        this.wsReconnectAttempts = 0;
        
        // Authorize with token if available
        if (this.accessToken) {
          this.sendWebSocketMessage({
            authorize: this.accessToken,
          });
        }
      };

      this.wsConnection.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleWebSocketMessage(data);
        } catch (error) {
          console.error('[DerivAdapter] Error parsing WebSocket message:', error);
        }
      };

      this.wsConnection.onerror = (error) => {
        console.error('[DerivAdapter] WebSocket error:', error);
      };

      this.wsConnection.onclose = () => {
        console.log('[DerivAdapter] WebSocket closed');
        this.wsConnection = null;
        
        // Attempt to reconnect
        if (this.wsReconnectAttempts < this.maxReconnectAttempts) {
          this.wsReconnectAttempts++;
          const delay = Math.min(1000 * Math.pow(2, this.wsReconnectAttempts), 30000);
          setTimeout(() => this.connectWebSocket(), delay);
        }
      };
    } catch (error) {
      console.error('[DerivAdapter] Error connecting WebSocket:', error);
    }
  }

  /**
   * Send message via WebSocket
   */
  private sendWebSocketMessage(message: any): void {
    if (this.wsConnection?.readyState === WebSocket.OPEN) {
      const request = {
        ...message,
        req_id: this.wsRequestId++,
      };
      this.wsConnection.send(JSON.stringify(request));
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleWebSocketMessage(data: any): void {
    // Handle authorization response
    if (data.authorize) {
      if (data.authorize.error) {
        console.error('[DerivAdapter] Authorization error:', data.authorize.error);
      } else {
        console.log('[DerivAdapter] Authorized successfully');
      }
      return;
    }

    // Handle tick/price updates
    if (data.tick) {
      const tick = data.tick;
      const symbol = tick.symbol;
      const callback = this.wsSubscriptions.get(symbol);
      
      if (callback) {
        callback({
          symbol,
          price: tick.quote || tick.spot || 0,
          bid: tick.bid || tick.quote || 0,
          ask: tick.ask || tick.quote || 0,
          timestamp: tick.epoch * 1000 || Date.now(),
        });
      }
    }

    // Handle subscription responses
    if (data.subscription) {
      if (data.subscription.error) {
        console.error('[DerivAdapter] Subscription error:', data.subscription.error);
      }
    }
  }

  /**
   * Subscribe to real-time price updates for a symbol
   */
  subscribeToPrice(symbol: string, callback: (data: MarketData) => void): () => void {
    const mappedSymbol = this.mapSymbol(symbol);
    
    if (!this.wsConnection || this.wsConnection.readyState !== WebSocket.OPEN) {
      // Fallback to polling if WebSocket not available
      const interval = setInterval(async () => {
        try {
          const marketData = await this.getMarketData(symbol);
          callback(marketData);
        } catch (error) {
          console.error('[DerivAdapter] Error fetching market data:', error);
        }
      }, 3000);
      
      return () => clearInterval(interval);
    }

    // Store callback
    this.wsSubscriptions.set(mappedSymbol, callback);

    // Subscribe to tick stream
    this.sendWebSocketMessage({
      ticks: mappedSymbol,
      subscribe: 1,
    });

    // Return unsubscribe function
    return () => {
      this.wsSubscriptions.delete(mappedSymbol);
      this.sendWebSocketMessage({
        forget: mappedSymbol,
      });
    };
  }

  /**
   * Get real-time market data via WebSocket (if available) or REST API
   */
  async getMarketData(symbol: string): Promise<MarketData> {
    const mappedSymbol = this.mapSymbol(symbol);

    // If WebSocket is connected and we have a subscription, return cached data
    // Otherwise, fetch via REST API
    if (this.paperTrading) {
      // Return mock market data for Boom/Crash
      const isBoom = mappedSymbol.startsWith('BOOM');
      const basePrice = isBoom ? 10000 : 10000;
      const tick = Math.floor(Math.random() * 100) - 50;
      const price = basePrice + tick;
      
      return {
        symbol: mappedSymbol,
        bid: price * 0.999,
        ask: price * 1.001,
        last: price,
        volume: Math.random() * 100000,
        timestamp: new Date(),
        high24h: basePrice + 100,
        low24h: basePrice - 100,
        change24h: tick,
        changePercent24h: (tick / basePrice) * 100,
      };
    }

    // Try WebSocket first if connected
    if (this.wsConnection?.readyState === WebSocket.OPEN) {
      // Request current tick
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('WebSocket request timeout'));
        }, 5000);

        const tempCallback = (data: any) => {
          clearTimeout(timeout);
          resolve({
            symbol: mappedSymbol,
            bid: data.bid || data.price || 0,
            ask: data.ask || data.price || 0,
            last: data.price || 0,
            volume: 0,
            timestamp: new Date(data.timestamp || Date.now()),
            high24h: 0,
            low24h: 0,
            change24h: 0,
            changePercent24h: 0,
          });
          this.wsSubscriptions.delete(mappedSymbol);
        };

        this.wsSubscriptions.set(mappedSymbol, tempCallback);
        this.sendWebSocketMessage({
          ticks: mappedSymbol,
          subscribe: 1,
        });
      });
    }

    // Fallback to REST API
    try {
      const data = await this.makeRequest(`/ticker/${mappedSymbol}`);
      
      return {
        symbol: mappedSymbol,
        bid: data.bid || data.quote,
        ask: data.ask || data.quote,
        last: data.quote || data.last,
        volume: data.volume || 0,
        timestamp: new Date(data.epoch * 1000 || Date.now()),
        high24h: data.high,
        low24h: data.low,
        change24h: data.change,
        changePercent24h: data.change_percent,
      };
    } catch (error: any) {
      console.error('Error fetching market data:', error);
      throw error;
    }
  }

  /**
   * Place order via WebSocket
   */
  private async placeOrderViaWebSocket(request: OrderRequest, mappedSymbol: string): Promise<OrderResponse> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('WebSocket order timeout'));
      }, 10000);

      const reqId = this.wsRequestId++;
      
      // Set up response handler
      const messageHandler = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          
          // Check if this is the response to our buy request
          if (data.buy && data.req_id === reqId) {
            clearTimeout(timeout);
            this.wsConnection?.removeEventListener('message', messageHandler);
            
            if (data.buy.error) {
              reject(new Error(data.buy.error.message || 'Order failed'));
              return;
            }

            const buyData = data.buy;
            resolve({
              orderId: buyData.contract_id || `WS-${Date.now()}`,
              symbol: mappedSymbol,
              side: request.side,
              type: request.type,
              quantity: request.quantity,
              filledQuantity: request.quantity,
              price: buyData.purchase_price || request.price || 0,
              filledPrice: buyData.purchase_price || request.price || 0,
              status: 'FILLED' as OrderStatus,
              timestamp: new Date(buyData.date_start * 1000 || Date.now()),
              stopLoss: request.stopLoss,
              takeProfit: request.takeProfit,
              exchangeOrderId: buyData.contract_id,
            });
          }
        } catch (error) {
          // Ignore parsing errors for other messages
        }
      };

      this.wsConnection?.addEventListener('message', messageHandler);

      // Send buy request via WebSocket
      this.sendWebSocketMessage({
        buy: mappedSymbol,
        price: request.price || 0,
        amount: request.quantity,
        duration: 5,
        duration_unit: 't',
        contract_type: request.side === 'BUY' ? 'CALL' : 'PUT',
        req_id: reqId,
      });
    });
  }

  /**
   * Disconnect WebSocket
   */
  disconnectWebSocket(): void {
    if (this.wsConnection) {
      this.wsConnection.close();
      this.wsConnection = null;
      this.wsSubscriptions.clear();
    }
  }

  protected getBrokerType(): 'exness' | 'deriv' {
    return 'deriv';
  }
}



