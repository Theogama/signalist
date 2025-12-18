/**
 * MT5 Adapter for Exness Broker
 * Connects to MT5 via Python bridge service
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

const MT5_SERVICE_URL = process.env.MT5_SERVICE_URL || 'http://localhost:5000';

export class MT5Adapter implements UnifiedBrokerAdapter {
  private config: BrokerAdapterConfig | null = null;
  private connectionId: string | null = null;
  private connected: boolean = false;
  private tickCallbacks: Map<string, (tick: Tick) => void> = new Map();
  private candleCallbacks: Map<string, (candle: Candle) => void> = new Map();

  async initialize(config: BrokerAdapterConfig): Promise<void> {
    this.config = config;
    if (!config.mt5Login || !config.mt5Password || !config.mt5Server) {
      throw new Error('MT5 credentials are required (login, password, server)');
    }
  }

  async connect(): Promise<boolean> {
    if (!this.config) {
      throw new Error('Adapter not initialized');
    }

    try {
      const response = await fetch(`${MT5_SERVICE_URL}/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          login: this.config.mt5Login,
          password: this.config.mt5Password,
          server: this.config.mt5Server,
        }),
      });

      const data = await response.json();
      if (data.success) {
        this.connectionId = data.connection_id;
        this.connected = true;
        return true;
      } else {
        throw new Error(data.error || 'Connection failed');
      }
    } catch (error: any) {
      console.error('[MT5Adapter] Connection error:', error);
      this.connected = false;
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.connectionId) {
      try {
        await fetch(`${MT5_SERVICE_URL}/disconnect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ connection_id: this.connectionId }),
        });
      } catch (error) {
        console.error('[MT5Adapter] Disconnect error:', error);
      }
      this.connectionId = null;
    }
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected && this.connectionId !== null;
  }

  getBrokerType(): 'exness' {
    return 'exness';
  }

  async getAccountInfo(): Promise<AccountInfo> {
    if (!this.connectionId) {
      throw new Error('Not connected');
    }

    const response = await fetch(`${MT5_SERVICE_URL}/account?connection_id=${this.connectionId}`);
    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to get account info');
    }

    const account = data.account;
    return {
      balance: account.balance,
      equity: account.equity,
      margin: account.margin,
      freeMargin: account.free_margin,
      marginLevel: account.margin_level,
      currency: account.currency,
      leverage: account.leverage,
    };
  }

  async getBalance(): Promise<number> {
    const info = await this.getAccountInfo();
    return info.balance;
  }

  async subscribeToTicks(symbol: string, callback: (tick: Tick) => void): Promise<() => void> {
    // MT5 ticks subscription would require WebSocket or polling
    // For now, implement polling-based tick updates
    const key = symbol;
    this.tickCallbacks.set(key, callback);

    // Poll for ticks every second
    const intervalId = setInterval(async () => {
      try {
        const tick = await this.getLatestTick(symbol);
        if (tick) {
          callback(tick);
        }
      } catch (error) {
        console.error(`[MT5Adapter] Error polling tick for ${symbol}:`, error);
      }
    }, 1000);

    // Return unsubscribe function
    return () => {
      clearInterval(intervalId);
      this.tickCallbacks.delete(key);
    };
  }

  private async getLatestTick(symbol: string): Promise<Tick | null> {
    // MT5 service doesn't have direct tick endpoint, would need to be added
    // For now, return null - this should be implemented in MT5 service
    return null;
  }

  async subscribeToCandles(
    symbol: string,
    timeframe: Timeframe,
    callback: (candle: Candle) => void
  ): Promise<() => void> {
    // MT5 candle subscription would require WebSocket or polling
    // Implement polling-based candle updates
    const key = `${symbol}_${timeframe}`;
    this.candleCallbacks.set(key, callback);

    // Poll for new candles every 2 seconds for faster updates
    const intervalId = setInterval(async () => {
      try {
        const candles = await this.getHistoricalCandles(symbol, timeframe, 1);
        if (candles.length > 0) {
          callback(candles[candles.length - 1]);
        }
      } catch (error) {
        console.error(`[MT5Adapter] Error polling candles for ${symbol}:`, error);
      }
    }, 2000);

    return () => {
      clearInterval(intervalId);
      this.candleCallbacks.delete(key);
    };
  }

  async getHistoricalCandles(symbol: string, timeframe: Timeframe, count: number): Promise<Candle[]> {
    if (!this.connectionId) {
      throw new Error('Not connected');
    }

    try {
      const url = `${MT5_SERVICE_URL}/candles?connection_id=${this.connectionId}&symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}&count=${count}`;
      const response = await fetch(url);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to get historical candles');
      }

      const candles: Candle[] = (data.candles || []).map((c: any) => ({
        symbol,
        timeframe,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume || 0,
        timestamp: new Date(c.time * 1000),
        isClosed: true,
      }));

      return candles;
    } catch (error: any) {
      console.error(`[MT5Adapter] Error fetching candles:`, error);
      throw error;
    }
  }

  async placeTrade(request: UnifiedTradeRequest): Promise<UnifiedTradeResponse> {
    if (!this.connectionId) {
      throw new Error('Not connected');
    }

    const orderType = request.side === 'BUY' ? 'buy' : 'sell';
    const endpoint = `${MT5_SERVICE_URL}/trade/${orderType}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        connection_id: this.connectionId,
        symbol: request.symbol,
        volume: request.lotOrStake,
        sl: request.stopLoss,
        tp: request.takeProfit,
        magic: this.config?.mt5MagicNumber || 2025,
        comment: request.comment || 'SIGNALIST Bot',
      }),
    });

    const data = await response.json();
    if (!data.success) {
      return {
        success: false,
        tradeId: '',
        symbol: request.symbol,
        side: request.side,
        entryPrice: 0,
        stopLoss: request.stopLoss,
        takeProfit: request.takeProfit,
        lotOrStake: request.lotOrStake,
        timestamp: new Date(),
        error: data.error || 'Trade failed',
      };
    }

    const order = data.order;
    return {
      success: true,
      tradeId: order.order_id.toString(),
      symbol: request.symbol,
      side: request.side,
      entryPrice: order.price,
      stopLoss: request.stopLoss,
      takeProfit: request.takeProfit,
      lotOrStake: request.lotOrStake,
      timestamp: new Date(),
    };
  }

  async closeTrade(tradeId: string): Promise<boolean> {
    if (!this.connectionId) {
      throw new Error('Not connected');
    }

    const response = await fetch(`${MT5_SERVICE_URL}/position/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        connection_id: this.connectionId,
        ticket: parseInt(tradeId),
      }),
    });

    const data = await response.json();
    return data.success === true;
  }

  async getOpenTrades(symbol?: string): Promise<OpenTrade[]> {
    if (!this.connectionId) {
      throw new Error('Not connected');
    }

    const url = `${MT5_SERVICE_URL}/trades/open?connection_id=${this.connectionId}${symbol ? `&symbol=${symbol}` : ''}`;
    const response = await fetch(url);
    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to get open trades');
    }

    return data.positions.map((pos: any) => ({
      tradeId: pos.ticket.toString(),
      symbol: pos.symbol,
      side: pos.type === 'BUY' ? 'BUY' : 'SELL',
      entryPrice: pos.price_open,
      currentPrice: pos.price_current,
      lotOrStake: pos.volume,
      stopLoss: pos.sl || 0,
      takeProfit: pos.tp || 0,
      unrealizedPnl: pos.profit,
      unrealizedPnlPercent: pos.price_open !== 0 ? ((pos.profit / (pos.price_open * pos.volume)) * 100) : 0,
      openedAt: new Date(pos.time * 1000),
      brokerTradeId: pos.ticket.toString(),
    }));
  }

  async getClosedTrades(symbol?: string, fromDate?: Date, toDate?: Date): Promise<ClosedTrade[]> {
    if (!this.connectionId) {
      throw new Error('Not connected');
    }

    // MT5 service returns deals history
    const url = `${MT5_SERVICE_URL}/trades/closed?connection_id=${this.connectionId}${symbol ? `&symbol=${symbol}` : ''}`;
    const response = await fetch(url);
    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to get closed trades');
    }

    // Process deals into closed trades (grouping open/close pairs)
    // This is simplified - real implementation should pair buy/sell deals
    return [];
  }

  async computeLotFromRisk(
    riskPercent: number,
    accountBalance: number,
    entryPrice: number,
    stopLoss: number,
    symbol: string
  ): Promise<number> {
    // Calculate risk amount
    const riskAmount = (accountBalance * riskPercent) / 100;

    // Calculate distance to stop loss in price units
    const slDistance = Math.abs(entryPrice - stopLoss);

    if (slDistance === 0) {
      return 0.01; // Minimum lot
    }

    // For MT5, need to get contract size and tick value from symbol info
    // Simplified calculation - in practice, need symbol info
    // Lot size = Risk Amount / (SL Distance * Contract Size * Tick Value)
    // For now, use simplified calculation assuming standard contract
    const contractSize = 1; // Standard lot = 100,000 units
    const tickValue = 1; // Depends on symbol

    const lotSize = riskAmount / (slDistance * contractSize * tickValue);
    const minLot = 0.01;
    const maxLot = 100;

    // Round to nearest lot step (usually 0.01)
    return Math.max(minLot, Math.min(maxLot, Math.round(lotSize * 100) / 100));
  }

  async computeStakeFromRisk(riskPercent: number, accountBalance: number, symbol: string): Promise<number> {
    // Not applicable for MT5 (this is for Deriv)
    throw new Error('computeStakeFromRisk is not applicable for MT5/Exness');
  }

  async healthCheck(): Promise<HealthCheck> {
    try {
      const startTime = Date.now();
      if (this.connectionId) {
        await this.getAccountInfo();
        const latency = Date.now() - startTime;

        return {
          status: this.connected ? 'healthy' : 'degraded',
          broker: 'exness',
          connected: this.connected,
          lastUpdate: new Date(),
          latency,
        };
      } else {
        return {
          status: 'down',
          broker: 'exness',
          connected: false,
          lastUpdate: new Date(),
          errors: ['Not connected'],
        };
      }
    } catch (error: any) {
      return {
        status: 'down',
        broker: 'exness',
        connected: false,
        lastUpdate: new Date(),
        errors: [error.message],
      };
    }
  }
}




