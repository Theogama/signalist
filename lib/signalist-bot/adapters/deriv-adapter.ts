/**
 * Deriv WebSocket Adapter
 * Connects to Deriv via WebSocket API
 */

import {
  UnifiedBrokerAdapter,
  BrokerAdapterConfig,
  AccountInfo,
  Tick,
  Candle,
  Timeframe,
  UnifiedTradeRequest,
  UnifiedTradeResponse,
  OpenTrade,
  ClosedTrade,
  HealthCheck,
} from '../types';

const DERIV_WS_URL = process.env.DERIV_WS_URL || 'wss://ws.derivws.com/websockets/v3';
const DERIV_APP_ID = process.env.DERIV_APP_ID || '113058';

export class DerivAdapter implements UnifiedBrokerAdapter {
  private config: BrokerAdapterConfig | null = null;
  private ws: WebSocket | null = null;
  private connected: boolean = false;
  private authenticated: boolean = false;
  private requestId: number = 1;
  private pendingRequests: Map<number, { resolve: (data: any) => void; reject: (error: any) => void }> = new Map();
  private tickSubscriptions: Map<string, { id: string; callback: (tick: Tick) => void }> = new Map();
  private candleSubscriptions: Map<string, { id: string; callback: (candle: Candle) => void }> = new Map();
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectTimer: NodeJS.Timeout | null = null;

  async initialize(config: BrokerAdapterConfig): Promise<void> {
    this.config = config;
    if (!config.derivToken) {
      throw new Error('Deriv token is required');
    }
  }

  async connect(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      try {
        const wsUrl = `${DERIV_WS_URL}?app_id=${DERIV_APP_ID}`;
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = async () => {
          console.log('[DerivAdapter] WebSocket connected');
          this.connected = true;
          this.reconnectAttempts = 0;

          // Authorize with token
          if (this.config?.derivToken) {
            await this.authorize(this.config.derivToken);
          }

          resolve(true);
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (error) {
            console.error('[DerivAdapter] Error parsing message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('[DerivAdapter] WebSocket error:', error);
          this.connected = false;
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('[DerivAdapter] WebSocket closed');
          this.connected = false;
          this.ws = null;

          // Attempt to reconnect
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
            this.reconnectTimer = setTimeout(() => {
              this.connect().catch(console.error);
            }, delay);
          }
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    this.authenticated = false;
  }

  isConnected(): boolean {
    return this.connected && this.authenticated && this.ws?.readyState === WebSocket.OPEN;
  }

  getBrokerType(): 'deriv' {
    return 'deriv';
  }

  private async authorize(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const reqId = this.requestId++;
      this.sendMessage({ authorize: token, req_id: reqId });

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(reqId);
        reject(new Error('Authorization timeout'));
      }, 10000);

      this.pendingRequests.set(reqId, {
        resolve: (data: any) => {
          clearTimeout(timeout);
          if (data.error) {
            reject(new Error(data.error.message || 'Authorization failed'));
          } else {
            this.authenticated = true;
            resolve();
          }
        },
        reject: (error: any) => {
          clearTimeout(timeout);
          reject(error);
        },
      });
    });
  }

  private sendMessage(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      throw new Error('WebSocket not connected');
    }
  }

  private handleMessage(data: any): void {
    const reqId = data.req_id;

    // Handle response to pending request
    if (reqId && this.pendingRequests.has(reqId)) {
      const { resolve } = this.pendingRequests.get(reqId)!;
      this.pendingRequests.delete(reqId);
      resolve(data);
      return;
    }

    // Handle tick updates
    if (data.tick) {
      const symbol = data.tick.symbol;
      const subscription = this.tickSubscriptions.get(symbol);
      if (subscription && subscription.callback) {
        subscription.callback({
          symbol,
          bid: data.tick.bid || data.tick.quote,
          ask: data.tick.ask || data.tick.quote,
          last: data.tick.quote || data.tick.bid,
          timestamp: new Date(data.tick.epoch * 1000),
        });
      }
    }

    // Handle candle updates
    if (data.ohlc) {
      const key = `${data.ohlc.symbol}_${data.ohlc.granularity}`;
      const subscription = this.candleSubscriptions.get(key);
      if (subscription && subscription.callback) {
        subscription.callback({
          symbol: data.ohlc.symbol,
          timeframe: this.mapTimeframe(data.ohlc.granularity),
          open: parseFloat(data.ohlc.open),
          high: parseFloat(data.ohlc.high),
          low: parseFloat(data.ohlc.low),
          close: parseFloat(data.ohlc.close),
          volume: 0,
          timestamp: new Date(data.ohlc.epoch * 1000),
          isClosed: data.ohlc.ohlc_end === 1,
        });
      }
    }
  }

  private mapTimeframe(granularity: number): Timeframe {
    // Map Deriv granularity to Timeframe
    const mapping: Record<number, Timeframe> = {
      60: '1m',
      180: '3m',
      300: '5m',
      900: '15m',
      1800: '30m',
      3600: '1h',
    };
    return mapping[granularity] || '5m';
  }

  private mapTimeframeToGranularity(timeframe: Timeframe): number {
    const mapping: Record<Timeframe, number> = {
      '1m': 60,
      '3m': 180,
      '5m': 300,
      '15m': 900,
      '30m': 1800,
      '1h': 3600,
      '4h': 14400,
      '1d': 86400,
    };
    return mapping[timeframe] || 300;
  }

  async getAccountInfo(): Promise<AccountInfo> {
    return new Promise((resolve, reject) => {
      const reqId = this.requestId++;
      this.sendMessage({ account: 1, req_id: reqId });

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(reqId);
        reject(new Error('Get account info timeout'));
      }, 10000);

      this.pendingRequests.set(reqId, {
        resolve: (data: any) => {
          clearTimeout(timeout);
          if (data.error) {
            reject(new Error(data.error.message || 'Failed to get account info'));
          } else {
            const account = data.account;
            resolve({
              balance: parseFloat(account.balance || 0),
              equity: parseFloat(account.balance || 0), // Deriv uses balance as equity
              margin: 0,
              freeMargin: parseFloat(account.balance || 0),
              currency: account.currency || 'USD',
            });
          }
        },
        reject: (error: any) => {
          clearTimeout(timeout);
          reject(error);
        },
      });
    });
  }

  async getBalance(): Promise<number> {
    const info = await this.getAccountInfo();
    return info.balance;
  }

  async subscribeToTicks(symbol: string, callback: (tick: Tick) => void): Promise<() => void> {
    return new Promise((resolve, reject) => {
      const reqId = this.requestId++;
      const subscribeId = `tick_${symbol}_${reqId}`;

      this.sendMessage({
        ticks: symbol,
        subscribe: 1,
        req_id: reqId,
      });

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(reqId);
        reject(new Error('Subscribe to ticks timeout'));
      }, 10000);

      this.pendingRequests.set(reqId, {
        resolve: (data: any) => {
          clearTimeout(timeout);
          if (data.error) {
            reject(new Error(data.error.message || 'Failed to subscribe to ticks'));
          } else {
            this.tickSubscriptions.set(symbol, { id: subscribeId, callback });
            resolve(() => {
              // Unsubscribe
              const unsubscribeReqId = this.requestId++;
              this.sendMessage({
                forget: subscribeId,
                req_id: unsubscribeReqId,
              });
              this.tickSubscriptions.delete(symbol);
            });
          }
        },
        reject: (error: any) => {
          clearTimeout(timeout);
          reject(error);
        },
      });
    });
  }

  async subscribeToCandles(
    symbol: string,
    timeframe: Timeframe,
    callback: (candle: Candle) => void
  ): Promise<() => void> {
    return new Promise((resolve, reject) => {
      const reqId = this.requestId++;
      const subscribeId = `candle_${symbol}_${timeframe}_${reqId}`;
      const granularity = this.mapTimeframeToGranularity(timeframe);
      const key = `${symbol}_${timeframe}`;

      this.sendMessage({
        ohlc: 1,
        ohlc_stream: 1,
        symbol,
        granularity,
        req_id: reqId,
      });

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(reqId);
        reject(new Error('Subscribe to candles timeout'));
      }, 10000);

      this.pendingRequests.set(reqId, {
        resolve: (data: any) => {
          clearTimeout(timeout);
          if (data.error) {
            reject(new Error(data.error.message || 'Failed to subscribe to candles'));
          } else {
            this.candleSubscriptions.set(key, { id: subscribeId, callback });
            resolve(() => {
              // Unsubscribe
              const unsubscribeReqId = this.requestId++;
              this.sendMessage({
                forget: subscribeId,
                req_id: unsubscribeReqId,
              });
              this.candleSubscriptions.delete(key);
            });
          }
        },
        reject: (error: any) => {
          clearTimeout(timeout);
          reject(error);
        },
      });
    });
  }

  async getHistoricalCandles(symbol: string, timeframe: Timeframe, count: number): Promise<Candle[]> {
    return new Promise((resolve, reject) => {
      const reqId = this.requestId++;
      const granularity = this.mapTimeframeToGranularity(timeframe);

      this.sendMessage({
        ohlc: 1,
        symbol,
        granularity,
        count,
        req_id: reqId,
      });

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(reqId);
        reject(new Error('Get historical candles timeout'));
      }, 10000);

      this.pendingRequests.set(reqId, {
        resolve: (data: any) => {
          clearTimeout(timeout);
          if (data.error) {
            reject(new Error(data.error.message || 'Failed to get historical candles'));
          } else {
            const ohlc = data.ohlc || [];
            const candles: Candle[] = ohlc.map((c: any) => ({
              symbol,
              timeframe,
              open: parseFloat(c.open),
              high: parseFloat(c.high),
              low: parseFloat(c.low),
              close: parseFloat(c.close),
              volume: 0,
              timestamp: new Date(c.epoch * 1000),
              isClosed: true,
            }));
            resolve(candles);
          }
        },
        reject: (error: any) => {
          clearTimeout(timeout);
          reject(error);
        },
      });
    });
  }

  async placeTrade(request: UnifiedTradeRequest): Promise<UnifiedTradeResponse> {
    return new Promise((resolve, reject) => {
      const reqId = this.requestId++;

      // Map symbol to Deriv format
      const derivSymbol = this.mapSymbolToDeriv(request.symbol);

      // For Deriv, determine contract type
      const isBoomCrash = request.symbol.includes('BOOM') || request.symbol.includes('CRASH');
      
      if (isBoomCrash) {
        // Binary option: Rise/Fall
        const contractType = request.side === 'BUY' ? 'CALL' : 'PUT';
        const duration = request.duration || this.mapTimeframeToDuration(this.config?.candleTimeframe || '5m');

        this.sendMessage({
          buy: reqId,
          price: request.lotOrStake,
          parameters: {
            contract_type: contractType,
            symbol: derivSymbol,
            amount: request.lotOrStake,
            duration,
            duration_unit: 'm', // minutes
          },
          req_id: reqId,
        });
      } else {
        // CFD trade
        const contractType = request.side === 'BUY' ? 'BUY' : 'SELL';
        this.sendMessage({
          buy: reqId,
          price: request.lotOrStake,
          parameters: {
            contract_type: contractType,
            symbol: derivSymbol,
            amount: request.lotOrStake,
          },
          req_id: reqId,
        });
      }

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(reqId);
        reject(new Error('Place trade timeout'));
      }, 30000);

      this.pendingRequests.set(reqId, {
        resolve: (data: any) => {
          clearTimeout(timeout);
          if (data.error) {
            resolve({
              success: false,
              tradeId: '',
              symbol: request.symbol,
              side: request.side,
              entryPrice: 0,
              stopLoss: request.stopLoss,
              takeProfit: request.takeProfit,
              lotOrStake: request.lotOrStake,
              timestamp: new Date(),
              error: data.error.message || 'Trade failed',
            });
          } else {
            const buy = data.buy;
            resolve({
              success: true,
              tradeId: buy.contract_id.toString(),
              symbol: request.symbol,
              side: request.side,
              entryPrice: parseFloat(buy.buy_price || buy.purchase_price || 0),
              stopLoss: request.stopLoss,
              takeProfit: request.takeProfit,
              lotOrStake: request.lotOrStake,
              timestamp: new Date(),
            });
          }
        },
        reject: (error: any) => {
          clearTimeout(timeout);
          reject(error);
        },
      });
    });
  }

  async closeTrade(tradeId: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const reqId = this.requestId++;

      this.sendMessage({
        sell: tradeId,
        price: 0,
        req_id: reqId,
      });

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(reqId);
        reject(new Error('Close trade timeout'));
      }, 10000);

      this.pendingRequests.set(reqId, {
        resolve: (data: any) => {
          clearTimeout(timeout);
          if (data.error) {
            resolve(false);
          } else {
            resolve(true);
          }
        },
        reject: (error: any) => {
          clearTimeout(timeout);
          reject(error);
        },
      });
    });
  }

  async getOpenTrades(symbol?: string): Promise<OpenTrade[]> {
    return new Promise((resolve, reject) => {
      const reqId = this.requestId++;

      this.sendMessage({
        portfolio: 1,
        req_id: reqId,
      });

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(reqId);
        reject(new Error('Get open trades timeout'));
      }, 10000);

      this.pendingRequests.set(reqId, {
        resolve: (data: any) => {
          clearTimeout(timeout);
          if (data.error) {
            reject(new Error(data.error.message || 'Failed to get open trades'));
          } else {
            const contracts = data.portfolio?.contracts || [];
            const trades: OpenTrade[] = contracts
              .filter((c: any) => !symbol || c.symbol === symbol)
              .map((c: any) => ({
                tradeId: c.contract_id.toString(),
                symbol: c.symbol,
                side: c.contract_type === 'CALL' || c.contract_type === 'BUY' ? 'BUY' : 'SELL',
                entryPrice: parseFloat(c.buy_price || c.purchase_price || 0),
                currentPrice: parseFloat(c.current_spot || c.buy_price || 0),
                lotOrStake: parseFloat(c.amount || 0),
                stopLoss: 0,
                takeProfit: 0,
                unrealizedPnl: parseFloat(c.profit || 0),
                unrealizedPnlPercent: c.amount ? (parseFloat(c.profit || 0) / parseFloat(c.amount)) * 100 : 0,
                openedAt: new Date(c.date_start * 1000),
                brokerTradeId: c.contract_id.toString(),
              }));
            resolve(trades);
          }
        },
        reject: (error: any) => {
          clearTimeout(timeout);
          reject(error);
        },
      });
    });
  }

  async getClosedTrades(symbol?: string, fromDate?: Date, toDate?: Date): Promise<ClosedTrade[]> {
    return new Promise((resolve, reject) => {
      const reqId = this.requestId++;

      this.sendMessage({
        profit_table: 1,
        description: 1,
        limit: 1000,
        req_id: reqId,
      });

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(reqId);
        reject(new Error('Get closed trades timeout'));
      }, 10000);

      this.pendingRequests.set(reqId, {
        resolve: (data: any) => {
          clearTimeout(timeout);
          if (data.error) {
            reject(new Error(data.error.message || 'Failed to get closed trades'));
          } else {
            const transactions = data.profit_table?.transactions || [];
            const trades: ClosedTrade[] = transactions
              .filter((t: any) => {
                if (symbol && t.symbol !== symbol) return false;
                if (fromDate && new Date(t.purchase_time * 1000) < fromDate) return false;
                if (toDate && new Date(t.purchase_time * 1000) > toDate) return false;
                return true;
              })
              .map((t: any) => ({
                tradeId: t.transaction_id.toString(),
                symbol: t.symbol,
                side: t.action_type === 'buy' ? 'BUY' : 'SELL',
                entryPrice: parseFloat(t.purchase_price || 0),
                exitPrice: parseFloat(t.sell_price || t.exit_price || 0),
                lotOrStake: parseFloat(t.amount || 0),
                stopLoss: 0,
                takeProfit: 0,
                realizedPnl: parseFloat(t.profit || 0),
                realizedPnlPercent: t.amount ? (parseFloat(t.profit || 0) / parseFloat(t.amount)) * 100 : 0,
                status: parseFloat(t.profit || 0) > 0 ? 'TP_HIT' : 'SL_HIT',
                openedAt: new Date(t.purchase_time * 1000),
                closedAt: new Date(t.sell_time * 1000),
              }));
            resolve(trades);
          }
        },
        reject: (error: any) => {
          clearTimeout(timeout);
          reject(error);
        },
      });
    });
  }

  async computeLotFromRisk(
    riskPercent: number,
    accountBalance: number,
    entryPrice: number,
    stopLoss: number,
    symbol: string
  ): Promise<number> {
    throw new Error('computeLotFromRisk is not applicable for Deriv (use computeStakeFromRisk)');
  }

  async computeStakeFromRisk(riskPercent: number, accountBalance: number, symbol: string): Promise<number> {
    const riskAmount = (accountBalance * riskPercent) / 100;
    // For Deriv, stake is direct amount
    // Minimum stake is usually $1
    return Math.max(1, Math.floor(riskAmount));
  }

  private mapSymbolToDeriv(symbol: string): string {
    // Map internal symbol to Deriv symbol
    // BOOM1000 -> "BOOM1000", CRASH1000 -> "CRASH1000", etc.
    return symbol;
  }

  private mapTimeframeToDuration(timeframe: Timeframe): number {
    // Map timeframe to contract duration in minutes
    const mapping: Record<Timeframe, number> = {
      '1m': 1,
      '3m': 3,
      '5m': 5,
      '15m': 15,
      '30m': 30,
      '1h': 60,
      '4h': 240,
      '1d': 1440,
    };
    return mapping[timeframe] || 5;
  }

  async healthCheck(): Promise<HealthCheck> {
    try {
      const startTime = Date.now();
      await this.getAccountInfo();
      const latency = Date.now() - startTime;

      return {
        status: this.isConnected() ? 'healthy' : 'degraded',
        broker: 'deriv',
        connected: this.isConnected(),
        lastUpdate: new Date(),
        latency,
      };
    } catch (error: any) {
      return {
        status: 'down',
        broker: 'deriv',
        connected: false,
        lastUpdate: new Date(),
        errors: [error.message],
      };
    }
  }
}

