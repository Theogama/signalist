/**
 * Log Emitter
 * Centralized logging system for auto-trading that can be consumed by WebSocket/SSE
 */

export type LogLevel = 'info' | 'warning' | 'error' | 'success';

export interface LogEvent {
  id: string;
  timestamp: Date;
  level: LogLevel;
  message: string;
  userId?: string;
  botId?: string;
  sessionId?: string;
  data?: any;
  type?: 'price' | 'signal' | 'order' | 'risk' | 'system' | 'trade' | 'balance';
}

type LogListener = (log: LogEvent) => void;

class LogEmitter {
  private listeners: Map<string, Set<LogListener>> = new Map();
  private logs: Map<string, LogEvent[]> = new Map(); // Store logs per user
  private maxLogsPerUser = 1000;

  /**
   * Subscribe to logs for a user
   */
  subscribe(userId: string, listener: LogListener): () => void {
    if (!this.listeners.has(userId)) {
      this.listeners.set(userId, new Set());
    }
    this.listeners.get(userId)!.add(listener);

    // Return unsubscribe function
    return () => {
      const userListeners = this.listeners.get(userId);
      if (userListeners) {
        userListeners.delete(listener);
        if (userListeners.size === 0) {
          this.listeners.delete(userId);
        }
      }
    };
  }

  /**
   * Emit a log event
   */
  emit(log: Omit<LogEvent, 'id' | 'timestamp'>): void {
    const logEvent: LogEvent = {
      ...log,
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };

    // Store log
    if (logEvent.userId) {
      if (!this.logs.has(logEvent.userId)) {
        this.logs.set(logEvent.userId, []);
      }
      const userLogs = this.logs.get(logEvent.userId)!;
      userLogs.push(logEvent);
      
      // Keep only last N logs
      if (userLogs.length > this.maxLogsPerUser) {
        userLogs.shift();
      }
    }

    // Notify listeners
    if (logEvent.userId) {
      const userListeners = this.listeners.get(logEvent.userId);
      if (userListeners) {
        userListeners.forEach((listener) => {
          try {
            listener(logEvent);
          } catch (error) {
            console.error('Error in log listener:', error);
          }
        });
      }
    }

    // Also notify global listeners (for system logs)
    const globalListeners = this.listeners.get('*');
    if (globalListeners) {
      globalListeners.forEach((listener) => {
        try {
          listener(logEvent);
        } catch (error) {
          console.error('Error in global log listener:', error);
        }
      });
    }
  }

  /**
   * Get logs for a user
   */
  getLogs(userId: string, limit?: number): LogEvent[] {
    const userLogs = this.logs.get(userId) || [];
    if (limit) {
      return userLogs.slice(-limit);
    }
    return userLogs;
  }

  /**
   * Clear logs for a user
   */
  clearLogs(userId: string): void {
    this.logs.delete(userId);
  }

  /**
   * Helper methods for different log types
   */
  info(message: string, userId?: string, data?: any): void {
    this.emit({ level: 'info', message, userId, data, type: 'system' });
  }

  warning(message: string, userId?: string, data?: any): void {
    this.emit({ level: 'warning', message, userId, data, type: 'risk' });
  }

  error(message: string, userId?: string, data?: any): void {
    this.emit({ level: 'error', message, userId, data, type: 'system' });
  }

  success(message: string, userId?: string, data?: any): void {
    this.emit({ level: 'success', message, userId, data, type: 'system' });
  }

  price(symbol: string, price: number, userId?: string): void {
    this.emit({
      level: 'info',
      message: `Price update: ${symbol} = ${price}`,
      userId,
      data: { symbol, price },
      type: 'price',
    });
  }

  signal(signal: any, userId?: string, botId?: string): void {
    const details = [
      `Entry: ${signal.entryPrice?.toFixed(4) || 'N/A'}`,
      signal.stopLoss ? `SL: ${signal.stopLoss.toFixed(4)}` : '',
      signal.takeProfit ? `TP: ${signal.takeProfit.toFixed(4)}` : '',
      signal.confidence ? `Confidence: ${(signal.confidence * 100).toFixed(1)}%` : '',
      signal.reason ? `Reason: ${signal.reason}` : '',
    ].filter(Boolean).join(' | ');

    this.emit({
      level: 'info',
      message: `Signal generated: ${signal.side} ${signal.symbol} @ ${signal.entryPrice} | ${details}`,
      userId,
      botId,
      data: {
        ...signal,
        details: {
          entryPrice: signal.entryPrice,
          stopLoss: signal.stopLoss,
          takeProfit: signal.takeProfit,
          confidence: signal.confidence,
          reason: signal.reason,
          indicators: signal.indicators || [],
        },
      },
      type: 'signal',
    });
  }

  order(order: any, userId?: string, botId?: string): void {
    const details = [
      `Qty: ${order.quantity || order.filledQuantity || 'N/A'}`,
      order.price ? `Price: ${order.price.toFixed(4)}` : '',
      order.filledPrice ? `Filled: ${order.filledPrice.toFixed(4)}` : '',
      order.slippage ? `Slippage: ${order.slippage.toFixed(3)}%` : '',
      order.latency ? `Latency: ${order.latency}ms` : '',
    ].filter(Boolean).join(' | ');

    this.emit({
      level: order.status === 'FILLED' ? 'success' : order.status === 'REJECTED' ? 'error' : 'info',
      message: `Order ${order.status}: ${order.side} ${order.symbol} | ${details}`,
      userId,
      botId,
      data: {
        ...order,
        details: {
          quantity: order.quantity,
          price: order.price,
          filledPrice: order.filledPrice,
          slippage: order.slippage,
          latency: order.latency,
          retries: order.retries,
        },
      },
      type: 'order',
    });
  }

  trade(trade: any, userId?: string, botId?: string): void {
    const profitLoss = trade.profitLoss || 0;
    const level = profitLoss > 0 ? 'success' : profitLoss < 0 ? 'error' : 'info';
    this.emit({
      level,
      message: `Trade ${trade.status}: ${trade.symbol} ${trade.side} - P/L: $${profitLoss.toFixed(2)}`,
      userId,
      botId,
      data: trade,
      type: 'trade',
    });
  }

  risk(message: string, userId?: string, data?: any): void {
    this.emit({
      level: 'warning',
      message: `Risk Alert: ${message}`,
      userId,
      data,
      type: 'risk',
    });
  }

  /**
   * Emit balance update
   */
  balanceUpdate(balance: {
    balance: number;
    equity: number;
    margin: number;
    freeMargin: number;
    marginLevel?: number;
  }, userId?: string): void {
    this.emit({
      level: 'info',
      message: `Balance: $${balance.balance.toFixed(2)} | Equity: $${balance.equity.toFixed(2)} | Margin: $${balance.margin.toFixed(2)}`,
      userId,
      data: balance,
      type: 'balance',
    });
  }

  /**
   * Log detailed strategy analysis
   */
  strategyAnalysis(
    analysis: {
      signal?: any;
      marketStructure?: any;
      indicators?: Record<string, any>;
      filters?: any;
      confirmations?: string[];
    },
    userId?: string,
    botId?: string
  ): void {
    const details: string[] = [];
    
    if (analysis.marketStructure) {
      details.push(`Structure: ${analysis.marketStructure.structure}`);
      details.push(`Trend: ${analysis.marketStructure.trend}`);
      if (analysis.marketStructure.hasBOS) details.push('BOS');
      if (analysis.marketStructure.hasCHoCH) details.push('CHoCH');
    }

    if (analysis.indicators) {
      const indicatorValues = Object.entries(analysis.indicators)
        .map(([key, value]) => `${key}: ${typeof value === 'number' ? value.toFixed(2) : value}`)
        .join(', ');
      if (indicatorValues) details.push(`Indicators: ${indicatorValues}`);
    }

    if (analysis.confirmations && analysis.confirmations.length > 0) {
      details.push(`Confirmations: ${analysis.confirmations.join(', ')}`);
    }

    this.emit({
      level: 'info',
      message: `Strategy Analysis: ${details.join(' | ')}`,
      userId,
      botId,
      data: analysis,
      type: 'system',
    });
  }

  /**
   * Log SL/TP calculation details
   */
  riskCalculation(
    calculation: {
      entryPrice: number;
      stopLoss: number;
      takeProfit: number;
      method: string;
      atr?: number;
      riskAmount?: number;
      rewardAmount?: number;
      riskRewardRatio?: number;
    },
    userId?: string,
    botId?: string
  ): void {
    const details = [
      `Method: ${calculation.method}`,
      `SL: ${calculation.stopLoss.toFixed(4)} (${((Math.abs(calculation.entryPrice - calculation.stopLoss) / calculation.entryPrice) * 100).toFixed(2)}%)`,
      `TP: ${calculation.takeProfit.toFixed(4)} (${((Math.abs(calculation.takeProfit - calculation.entryPrice) / calculation.entryPrice) * 100).toFixed(2)}%)`,
      calculation.riskRewardRatio ? `RR: 1:${calculation.riskRewardRatio.toFixed(2)}` : '',
      calculation.atr ? `ATR: ${calculation.atr.toFixed(4)}` : '',
    ].filter(Boolean).join(' | ');

    this.emit({
      level: 'info',
      message: `Risk Calculation: ${details}`,
      userId,
      botId,
      data: calculation,
      type: 'risk',
    });
  }

  /**
   * Log exit reason
   */
  exit(
    exit: {
      positionId: string;
      symbol: string;
      reason: string;
      exitPrice: number;
      entryPrice: number;
      profitLoss?: number;
      profitLossPercent?: number;
    },
    userId?: string,
    botId?: string
  ): void {
    const pnl = exit.profitLoss || 0;
    const level = pnl > 0 ? 'success' : pnl < 0 ? 'error' : 'info';
    const pnlStr = pnl !== 0 ? `P/L: $${pnl.toFixed(2)} (${exit.profitLossPercent?.toFixed(2) || '0.00'}%)` : '';

    this.emit({
      level,
      message: `Position Exit: ${exit.symbol} | Reason: ${exit.reason} | ${pnlStr}`,
      userId,
      botId,
      data: exit,
      type: 'trade',
    });
  }
}

// Singleton instance
export const logEmitter = new LogEmitter();


