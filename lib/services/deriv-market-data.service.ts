/**
 * Deriv Market Data Service
 * 
 * Handles real-time market data streaming for Deriv symbols.
 * Provides tick data, OHLC data, and chart data for visualization.
 */

import { EventEmitter } from 'events';
import { DerivServerWebSocketClient } from '@/lib/deriv/server-websocket-client';

export interface TickData {
  symbol: string;
  quote: number;
  timestamp: number;
  id?: string;
}

export interface OHLCData {
  symbol: string;
  open: number;
  high: number;
  low: number;
  close: number;
  epoch: number;
  granularity: number;
}

export interface ChartDataPoint {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

/**
 * Deriv Market Data Service
 */
export class DerivMarketDataService extends EventEmitter {
  private wsClient: DerivServerWebSocketClient | null = null;
  private subscriptions: Map<string, {
    type: 'ticks' | 'ohlc';
    subscriptionId: string;
  }> = new Map();
  private token: string;
  private connected: boolean = false;

  constructor(token: string) {
    super();
    this.token = token;
  }

  /**
   * Connect to Deriv WebSocket
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    this.wsClient = new DerivServerWebSocketClient(this.token);
    
    this.wsClient.on('error', (error) => {
      this.emit('error', error);
    });

    this.wsClient.on('disconnect', () => {
      this.connected = false;
      this.emit('disconnect');
    });

    await this.wsClient.connect();
    this.connected = true;
    this.emit('connect');
  }

  /**
   * Subscribe to tick data for a symbol
   */
  async subscribeToTicks(symbol: string, callback: (data: TickData) => void): Promise<string> {
    if (!this.wsClient || !this.connected) {
      await this.connect();
    }

    const key = `ticks:${symbol}`;
    
    // If already subscribed, return existing subscription
    if (this.subscriptions.has(key)) {
      return this.subscriptions.get(key)!.subscriptionId;
    }

    try {
      // Subscribe to ticks using Deriv API
      // Note: This requires adding tick subscription to DerivServerWebSocketClient
      // For now, we'll use a polling approach or extend the client
      const reqId = this.wsClient!['requestId']++;
      const subscriptionKey = `ticks_${symbol}_${reqId}`;
      
      // Send tick subscription request
      this.wsClient!['sendMessage']({
        ticks: symbol,
        subscribe: 1,
        req_id: reqId,
      });

      // Store subscription handler
      const handler = (data: any) => {
        if (data.tick && data.tick.symbol === symbol) {
          const tickData: TickData = {
            symbol: data.tick.symbol || symbol,
            quote: data.tick.quote || data.tick.spot || 0,
            timestamp: data.tick.epoch * 1000 || Date.now(),
            id: data.tick.id,
          };
          callback(tickData);
          this.emit('tick', tickData);
        }
      };

      this.wsClient!['subscriptions'].set(subscriptionKey, {
        id: `ticks_${reqId}`,
        callback: handler,
      });

      const subscriptionId = `ticks_${reqId}`;

      this.subscriptions.set(key, {
        type: 'ticks',
        subscriptionId,
      });

      return subscriptionId;
    } catch (error: any) {
      throw new Error(`Failed to subscribe to ticks: ${error.message}`);
    }
  }

  /**
   * Subscribe to OHLC data for a symbol
   */
  async subscribeToOHLC(
    symbol: string,
    granularity: number,
    callback: (data: OHLCData) => void
  ): Promise<string> {
    if (!this.wsClient || !this.connected) {
      await this.connect();
    }

    const key = `ohlc:${symbol}:${granularity}`;
    
    // If already subscribed, return existing subscription
    if (this.subscriptions.has(key)) {
      return this.subscriptions.get(key)!.subscriptionId;
    }

    try {
      // Subscribe to OHLC using Deriv API
      const reqId = this.wsClient!['requestId']++;
      const subscriptionKey = `ohlc_${symbol}_${granularity}_${reqId}`;
      
      // Send OHLC subscription request
      this.wsClient!['sendMessage']({
        ohlc: 1,
        symbol,
        granularity,
        subscribe: 1,
        req_id: reqId,
      });

      // Store subscription handler
      const handler = (data: any) => {
        if (data.ohlc && data.ohlc.symbol === symbol) {
          const ohlcData: OHLCData = {
            symbol: data.ohlc.symbol || symbol,
            open: data.ohlc.open || 0,
            high: data.ohlc.high || 0,
            low: data.ohlc.low || 0,
            close: data.ohlc.close || 0,
            epoch: data.ohlc.epoch || Math.floor(Date.now() / 1000),
            granularity: data.ohlc.granularity || granularity,
          };
          callback(ohlcData);
          this.emit('ohlc', ohlcData);
        }
      };

      this.wsClient!['subscriptions'].set(subscriptionKey, {
        id: `ohlc_${reqId}`,
        callback: handler,
      });

      const subscriptionId = `ohlc_${reqId}`;

      this.subscriptions.set(key, {
        type: 'ohlc',
        subscriptionId,
      });

      return subscriptionId;
    } catch (error: any) {
      throw new Error(`Failed to subscribe to OHLC: ${error.message}`);
    }
  }

  /**
   * Get historical OHLC data
   */
  async getHistoricalOHLC(
    symbol: string,
    granularity: number,
    count: number = 1000
  ): Promise<ChartDataPoint[]> {
    if (!this.wsClient || !this.connected) {
      await this.connect();
    }

    try {
      // Request historical data using Deriv API
      const reqId = this.wsClient!['requestId']++;
      
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('History request timeout'));
        }, 10000);

        this.wsClient!['sendMessage']({
          ticks_history: symbol,
          adjust_start_time: 1,
          end: 'latest',
          count,
          granularity,
          style: 'candles',
          req_id: reqId,
        });

        const handler = (data: any) => {
          if (data.req_id === reqId) {
            clearTimeout(timeout);
            if (data.error) {
              reject(new Error(data.error.message));
              return;
            }
            
            const candles = data.candles || data.history?.candles || [];
            const history = candles.map((candle: any) => ({
              time: candle.epoch * 1000,
              open: candle.open || 0,
              high: candle.high || 0,
              low: candle.low || 0,
              close: candle.close || 0,
              volume: candle.volume || 0,
            }));
            resolve(history);
          }
        };

        // Temporarily store handler
        this.wsClient!['pendingRequests'].set(reqId, {
          resolve: handler,
          reject: (error: Error) => {
            clearTimeout(timeout);
            reject(error);
          },
          timeout,
        });
      });
    } catch (error: any) {
      throw new Error(`Failed to get historical data: ${error.message}`);
    }
  }

  /**
   * Unsubscribe from a symbol
   */
  async unsubscribe(symbol: string, type?: 'ticks' | 'ohlc'): Promise<void> {
    if (!this.wsClient) {
      return;
    }

    if (type) {
      const key = `${type}:${symbol}`;
      const subscription = this.subscriptions.get(key);
      if (subscription && this.wsClient) {
        // Send forget message
        this.wsClient['sendMessage']({
          forget: subscription.subscriptionId,
        });
        this.subscriptions.delete(key);
      }
    } else {
      // Unsubscribe from all types for this symbol
      for (const [key, subscription] of this.subscriptions.entries()) {
        if (key.includes(symbol)) {
          await this.wsClient.unsubscribe(subscription.subscriptionId);
          this.subscriptions.delete(key);
        }
      }
    }
  }

  /**
   * Disconnect from Deriv
   */
  async disconnect(): Promise<void> {
    // Unsubscribe from all
    for (const [key, subscription] of this.subscriptions.entries()) {
      if (this.wsClient) {
        try {
          await this.wsClient.unsubscribe(subscription.subscriptionId);
        } catch (error) {
          console.error(`Error unsubscribing from ${key}:`, error);
        }
      }
    }

    this.subscriptions.clear();

    if (this.wsClient) {
      await this.wsClient.disconnect();
      this.wsClient = null;
    }

    this.connected = false;
    this.emit('disconnect');
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }
}

