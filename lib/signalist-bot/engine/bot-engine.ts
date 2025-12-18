/**
 * Signalist Unified Bot Engine
 * Main trading engine implementing Signalist-SMA-3C strategy
 */

import { EventEmitter } from 'events';
import {
  UnifiedBrokerAdapter,
  SignalistBotSettings,
  BotStatus,
  EntrySignal,
  Candle,
  UnifiedTradeRequest,
  UnifiedTradeResponse,
  OpenTrade,
  ClosedTrade,
  BotEvent,
  OrderSide,
} from '../types';
import { SignalistSMA3CStrategy } from '../strategies/signalist-sma-3c';

export class SignalistBotEngine extends EventEmitter {
  private settings: SignalistBotSettings;
  private adapter: UnifiedBrokerAdapter;
  private strategy: SignalistSMA3CStrategy;
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private status: BotStatus;
  private candleUnsubscribe: (() => void) | null = null;
  private processedCandles: Set<string> = new Set(); // Track processed candles by timestamp
  private dayStartBalance: number = 0;
  private dayStartTime: Date = new Date();
  private consecutiveLosses: number = 0;
  private intervalId: NodeJS.Timeout | null = null;

  constructor(settings: SignalistBotSettings, adapter: UnifiedBrokerAdapter) {
    super();
    this.settings = settings;
    this.adapter = adapter;
    this.strategy = new SignalistSMA3CStrategy({
      candleTimeframe: settings.candleTimeframe,
      smaPeriod: settings.smaPeriod,
      smaPeriod2: settings.smaPeriod2,
      smaCrossLookback: settings.smaCrossLookback || 8,
      fiveMinTrendConfirmation: settings.fiveMinTrendConfirmation,
      spikeDetectionEnabled: settings.spikeDetectionEnabled,
      spikeThreshold: settings.spikeThreshold || 0.5,
    });

    this.status = this.initializeStatus();
  }

  /**
   * Initialize bot status
   */
  private initializeStatus(): BotStatus {
    return {
      userId: this.settings.userId,
      isRunning: false,
      isPaused: false,
      broker: this.settings.broker,
      instrument: this.settings.instrument,
      dailyStats: {
        tradesCount: 0,
        wins: 0,
        losses: 0,
        totalPnl: 0,
        startingBalance: 0,
        currentBalance: 0,
        drawdown: 0,
        drawdownPercent: 0,
      },
      consecutiveLosses: 0,
    };
  }

  /**
   * Start the bot
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Bot is already running');
    }

    // Connect to broker
    if (!this.adapter.isConnected()) {
      await this.adapter.connect();
    }

    // Get initial balance
    const balance = await this.adapter.getBalance();
    this.dayStartBalance = balance;
    this.status.dailyStats.startingBalance = balance;
    this.status.dailyStats.currentBalance = balance;
    this.status.startedAt = new Date();
    this.dayStartTime = new Date();

    // Subscribe to candles
    this.candleUnsubscribe = await this.adapter.subscribeToCandles(
      this.settings.instrument,
      this.settings.candleTimeframe,
      (candle: Candle) => this.onNewCandle(candle)
    );

    // Load historical candles
    const historicalCandles = await this.adapter.getHistoricalCandles(
      this.settings.instrument,
      this.settings.candleTimeframe,
      Math.max(this.settings.smaPeriod, 50)
    );

    // Add historical candles to strategy
    historicalCandles.forEach((candle) => {
      this.strategy.addCandle(candle);
    });

    this.isRunning = true;
    this.status.isRunning = true;
    this.emit('status_update', {
      type: 'status_update',
      status: this.status,
      timestamp: new Date(),
    });

    // Start monitoring loop (check for exits, safety rules, etc.)
    this.startMonitoringLoop();

    console.log(`[BotEngine] Bot started for user ${this.settings.userId} on ${this.settings.instrument}`);
  }

  /**
   * Stop the bot
   */
  async stop(reason?: string): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    this.status.isRunning = false;
    this.status.stoppedAt = new Date();
    if (reason) {
      this.status.stopReason = reason;
    }

    if (this.candleUnsubscribe) {
      this.candleUnsubscribe();
      this.candleUnsubscribe = null;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.emit('status_update', {
      type: 'status_update',
      status: this.status,
      timestamp: new Date(),
    });

    console.log(`[BotEngine] Bot stopped for user ${this.settings.userId}. Reason: ${reason || 'Manual stop'}`);
  }

  /**
   * Pause the bot
   */
  pause(): void {
    this.isPaused = true;
    this.status.isPaused = true;
    this.emit('status_update', {
      type: 'status_update',
      status: this.status,
      timestamp: new Date(),
    });
  }

  /**
   * Resume the bot
   */
  resume(): void {
    this.isPaused = false;
    this.status.isPaused = false;
    this.emit('status_update', {
      type: 'status_update',
      status: this.status,
      timestamp: new Date(),
    });
  }

  /**
   * Handle new candle from subscription
   */
  private async onNewCandle(candle: Candle): Promise<void> {
    if (!this.isRunning || this.isPaused) {
      return;
    }

    // Only process closed candles
    if (!candle.isClosed) {
      return;
    }

    // Check if we already processed this candle
    const candleKey = `${candle.timestamp.getTime()}_${candle.symbol}_${candle.timeframe}`;
    if (this.processedCandles.has(candleKey)) {
      return;
    }

    this.processedCandles.add(candleKey);
    
    // Keep only last 1000 processed candle keys
    if (this.processedCandles.size > 1000) {
      const keysArray = Array.from(this.processedCandles);
      keysArray.slice(0, keysArray.length - 1000).forEach((key) => {
        this.processedCandles.delete(key);
      });
    }

    // Add candle to strategy
    this.strategy.addCandle(candle);

    // Update status
    this.status.lastCandleProcessed = candle.timestamp;

    this.emit('candle_processed', {
      type: 'candle_processed',
      candle,
      timestamp: new Date(),
    });

    // Check for entry signal
    await this.evaluateEntrySignal(candle);
  }

  /**
   * Evaluate entry signal based on strategy
   */
  private async evaluateEntrySignal(candle: Candle): Promise<void> {
    // Check if auto-trade is enabled
    if (!this.settings.enabled) {
      return;
    }

    // Check once-per-candle rule
    if (this.status.lastTradeTimestamp) {
      const lastTradeTime = this.status.lastTradeTimestamp.getTime();
      const candleTime = candle.timestamp.getTime();
      const timeframeMs = this.getTimeframeMs(this.settings.candleTimeframe);
      
      // If we traded in the same candle timeframe, skip
      if (Math.floor(lastTradeTime / timeframeMs) === Math.floor(candleTime / timeframeMs)) {
        return;
      }
    }

    // Determine instrument type for spike detection
    const instrumentType = this.getInstrumentType(this.settings.instrument);

    // Analyze with strategy
    const signal = this.strategy.analyze(candle.symbol, instrumentType);
    if (!signal) {
      return;
    }

    // Emit signal detected
    this.emit('signal_detected', {
      type: 'signal_detected',
      data: signal,
      timestamp: new Date(),
    });

    // Check safety rules before entering
    if (!(await this.checkSafetyRules())) {
      return;
    }

    // Calculate position size
    const accountBalance = await this.adapter.getBalance();
    const entryPrice = candle.close;
    
    // Calculate stop loss
    const stopLoss = await this.calculateStopLoss(candle);
    if (!stopLoss) {
      console.warn('[BotEngine] Failed to calculate stop loss');
      return;
    }

    // Calculate take profit
    const takeProfit = this.calculateTakeProfit(entryPrice, stopLoss, signal.direction);

    // Calculate lot/stake
    let lotOrStake: number;
    if (this.settings.broker === 'exness') {
      lotOrStake = await this.adapter.computeLotFromRisk(
        this.settings.riskPerTrade,
        accountBalance,
        entryPrice,
        stopLoss,
        candle.symbol
      );
    } else {
      lotOrStake = await this.adapter.computeStakeFromRisk(
        this.settings.riskPerTrade,
        accountBalance,
        candle.symbol
      );
    }

    // Check margin/funds
    if (!(await this.checkMarginAvailability(lotOrStake, entryPrice))) {
      console.warn('[BotEngine] Insufficient margin/funds');
      return;
    }

    // Place trade
    const tradeRequest: UnifiedTradeRequest = {
      symbol: candle.symbol,
      side: signal.direction,
      lotOrStake,
      stopLoss,
      takeProfit,
      comment: `SIGNALIST-SMA-3C: ${signal.reason}`,
      duration: this.settings.broker === 'deriv' ? this.getTimeframeMinutes(this.settings.candleTimeframe) : undefined,
    };

    try {
      const tradeResponse = await this.adapter.placeTrade(tradeRequest);
      if (tradeResponse.success) {
        this.status.lastTradeTimestamp = new Date();
        this.status.dailyStats.tradesCount++;

        const openTrade: OpenTrade = {
          tradeId: tradeResponse.tradeId,
          symbol: tradeResponse.symbol,
          side: tradeResponse.side,
          entryPrice: tradeResponse.entryPrice,
          currentPrice: tradeResponse.entryPrice,
          lotOrStake: tradeResponse.lotOrStake,
          stopLoss: tradeResponse.stopLoss,
          takeProfit: tradeResponse.takeProfit,
          unrealizedPnl: 0,
          unrealizedPnlPercent: 0,
          openedAt: tradeResponse.timestamp,
          brokerTradeId: tradeResponse.tradeId,
        };

        this.emit('trade_opened', {
          type: 'trade_opened',
          data: openTrade,
          timestamp: new Date(),
        });
      } else {
        console.error(`[BotEngine] Trade failed: ${tradeResponse.error}`);
        this.emit('error', {
          type: 'error',
          error: tradeResponse.error || 'Trade placement failed',
          timestamp: new Date(),
        });
      }
    } catch (error: any) {
      console.error('[BotEngine] Trade execution error:', error);
      this.emit('error', {
        type: 'error',
        error: error.message || 'Trade execution error',
        timestamp: new Date(),
      });
    }
  }

  /**
   * Start monitoring loop for position management
   */
  private startMonitoringLoop(): void {
    // Check every 5 seconds
    this.intervalId = setInterval(async () => {
      if (!this.isRunning || this.isPaused) {
        return;
      }

      try {
        // Check safety rules
        if (!(await this.checkSafetyRules())) {
          await this.stop('Safety rule triggered');
          return;
        }

        // Check for reverse signals on open positions
        await this.checkReverseSignals();

        // Update daily stats
        await this.updateDailyStats();
      } catch (error: any) {
        console.error('[BotEngine] Monitoring loop error:', error);
        this.emit('error', {
          type: 'error',
          error: error.message || 'Monitoring loop error',
          timestamp: new Date(),
        });
      }
    }, 5000);
  }

  /**
   * Check safety rules (daily loss, max trades, consecutive losses, etc.)
   */
  private async checkSafetyRules(): Promise<boolean> {
    const balance = await this.adapter.getBalance();
    const dailyLoss = this.dayStartBalance - balance;
    const dailyLossPercent = (dailyLoss / this.dayStartBalance) * 100;

    // Check max daily loss
    if (this.settings.maxDailyLoss > 0 && dailyLossPercent >= this.settings.maxDailyLoss) {
      await this.stop(`Max daily loss reached: ${dailyLossPercent.toFixed(2)}%`);
      this.emit('stop_triggered', {
        type: 'stop_triggered',
        reason: `Max daily loss ${this.settings.maxDailyLoss}% reached`,
        timestamp: new Date(),
      });
      return false;
    }

    // Check max daily trades
    if (this.settings.maxDailyTrades > 0 && this.status.dailyStats.tradesCount >= this.settings.maxDailyTrades) {
      await this.stop(`Max daily trades reached: ${this.status.dailyStats.tradesCount}`);
      this.emit('stop_triggered', {
        type: 'stop_triggered',
        reason: `Max daily trades ${this.settings.maxDailyTrades} reached`,
        timestamp: new Date(),
      });
      return false;
    }

    // Check consecutive losses
    if (
      this.settings.forceStopConsecutiveLosses &&
      this.consecutiveLosses >= this.settings.forceStopConsecutiveLosses
    ) {
      await this.stop(`Max consecutive losses reached: ${this.consecutiveLosses}`);
      this.emit('stop_triggered', {
        type: 'stop_triggered',
        reason: `Max consecutive losses ${this.settings.forceStopConsecutiveLosses} reached`,
        timestamp: new Date(),
      });
      return false;
    }

    // Check drawdown
    if (this.settings.forceStopDrawdown) {
      const drawdownPercent = this.status.dailyStats.drawdownPercent;
      if (drawdownPercent >= this.settings.forceStopDrawdown) {
        await this.stop(`Max drawdown reached: ${drawdownPercent.toFixed(2)}%`);
        this.emit('stop_triggered', {
          type: 'stop_triggered',
          reason: `Max drawdown ${this.settings.forceStopDrawdown}% reached`,
          timestamp: new Date(),
        });
        return false;
      }
    }

    return true;
  }

  /**
   * Check for reverse signals and close positions if needed
   */
  private async checkReverseSignals(): Promise<void> {
    const openTrades = await this.adapter.getOpenTrades(this.settings.instrument);
    
    if (openTrades.length === 0) {
      return;
    }

    // Get latest candles
    const candles = await this.adapter.getHistoricalCandles(
      this.settings.instrument,
      this.settings.candleTimeframe,
      10
    );

    if (candles.length < 3) {
      return;
    }

    // Check for reverse signal
    const closedCandles = candles.filter((c) => c.isClosed);
    if (closedCandles.length < 3) {
      return;
    }

    const last3Candles = closedCandles.slice(-3);
    
    // Simple reverse signal check: opposite 3-candle alignment
    const reverseDirection = this.detectReverseSignal(last3Candles);

    for (const trade of openTrades) {
      // Check if reverse signal detected and trade has been open for minimum time
      if (reverseDirection && reverseDirection !== trade.side) {
        const minTimeInTrade = this.settings.minTimeInTrade || 1;
        const tradeAge = this.getCandleAge(trade.openedAt);
        
        if (tradeAge >= minTimeInTrade) {
          // Close trade due to reverse signal
          try {
            await this.adapter.closeTrade(trade.tradeId);
            
            // Get updated trade info to calculate P&L
            const closedTrades = await this.adapter.getClosedTrades(
              this.settings.instrument,
              new Date(trade.openedAt.getTime() - 60000),
              new Date()
            );
            
            const closedTrade = closedTrades.find((t) => t.tradeId === trade.tradeId);
            if (closedTrade) {
              this.handleTradeClosed(closedTrade, 'REVERSE_SIGNAL');
            }
          } catch (error: any) {
            console.error('[BotEngine] Error closing trade on reverse signal:', error);
          }
        }
      }
    }
  }

  /**
   * Detect reverse signal (opposite 3-candle alignment)
   */
  private detectReverseSignal(candles: Candle[]): OrderSide | null {
    if (candles.length < 3) {
      return null;
    }

    let bullishCount = 0;
    let bearishCount = 0;

    for (const candle of candles) {
      if (candle.close > candle.open) {
        bullishCount++;
      } else if (candle.close < candle.open) {
        bearishCount++;
      }
    }

    if (bullishCount === 3) {
      return 'BUY';
    } else if (bearishCount === 3) {
      return 'SELL';
    }

    return null;
  }

  /**
   * Calculate stop loss based on settings
   */
  private async calculateStopLoss(candle: Candle): Promise<number | null> {
    if (this.settings.slMethod === 'pips' && this.settings.slValue) {
      const slDistance = this.settings.slValue;
      // For Exness, pips are in price units
      return candle.close - (candle.close * (slDistance / 10000)); // Simplified
    } else if (this.settings.slMethod === 'atr') {
      // Get recent candles for ATR calculation
      const candles = await this.adapter.getHistoricalCandles(
        candle.symbol,
        this.settings.candleTimeframe,
        (this.settings.atrPeriod || 14) + 1
      );
      const atr = this.strategy.calculateATR(candles, this.settings.atrPeriod || 14);
      if (atr) {
        return candle.close - atr; // For BUY, adjust based on direction
      }
    } else if (this.settings.slMethod === 'candle') {
      // Use recent candle low/high
      const candles = await this.adapter.getHistoricalCandles(candle.symbol, this.settings.candleTimeframe, 2);
      if (candles.length >= 1) {
        return candles[candles.length - 1].low; // Simplified
      }
    }

    return null;
  }

  /**
   * Calculate take profit
   */
  private calculateTakeProfit(entryPrice: number, stopLoss: number, direction: OrderSide): number {
    const slDistance = Math.abs(entryPrice - stopLoss);
    const tpDistance = slDistance * (this.settings.tpMultiplier || 3);

    if (direction === 'BUY') {
      return entryPrice + tpDistance;
    } else {
      return entryPrice - tpDistance;
    }
  }

  /**
   * Check margin/funds availability
   */
  private async checkMarginAvailability(lotOrStake: number, price: number): Promise<boolean> {
    try {
      const accountInfo = await this.adapter.getAccountInfo();
      
      if (this.settings.broker === 'exness') {
        // Check free margin
        const requiredMargin = lotOrStake * price * 0.01; // Simplified margin calculation
        return accountInfo.freeMargin >= requiredMargin;
      } else {
        // For Deriv, check balance
        return accountInfo.balance >= lotOrStake;
      }
    } catch (error) {
      return false;
    }
  }

  /**
   * Handle trade closed event
   */
  private handleTradeClosed(closedTrade: ClosedTrade, reason: string): void {
    this.status.dailyStats.totalPnl += closedTrade.realizedPnl;
    this.status.dailyStats.currentBalance += closedTrade.realizedPnl;

    if (closedTrade.realizedPnl > 0) {
      this.status.dailyStats.wins++;
      this.consecutiveLosses = 0;
    } else {
      this.status.dailyStats.losses++;
      this.consecutiveLosses++;
    }

    this.status.consecutiveLosses = this.consecutiveLosses;

    this.emit('trade_closed', {
      type: 'trade_closed',
      data: {
        ...closedTrade,
        exitReason: reason,
      },
      timestamp: new Date(),
    });
  }

  /**
   * Update daily statistics
   */
  private async updateDailyStats(): Promise<void> {
    const balance = await this.adapter.getBalance();
    this.status.dailyStats.currentBalance = balance;

    const dailyChange = balance - this.dayStartBalance;
    const drawdown = Math.max(0, this.dayStartBalance - balance);
    const drawdownPercent = (drawdown / this.dayStartBalance) * 100;

    this.status.dailyStats.drawdown = drawdown;
    this.status.dailyStats.drawdownPercent = drawdownPercent;
  }

  /**
   * Get instrument type for spike detection
   */
  private getInstrumentType(instrument: string): 'boom' | 'crash' | 'normal' {
    if (instrument.includes('BOOM')) {
      return 'boom';
    } else if (instrument.includes('CRASH')) {
      return 'crash';
    }
    return 'normal';
  }

  /**
   * Get timeframe in milliseconds
   */
  private getTimeframeMs(timeframe: string): number {
    const mapping: Record<string, number> = {
      '1m': 60000,
      '3m': 180000,
      '5m': 300000,
      '15m': 900000,
      '30m': 1800000,
      '1h': 3600000,
      '4h': 14400000,
      '1d': 86400000,
    };
    return mapping[timeframe] || 300000;
  }

  /**
   * Get timeframe in minutes
   */
  private getTimeframeMinutes(timeframe: string): number {
    const mapping: Record<string, number> = {
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

  /**
   * Get candle age (number of candles since trade opened)
   */
  private getCandleAge(openedAt: Date): number {
    const now = Date.now();
    const opened = openedAt.getTime();
    const timeframeMs = this.getTimeframeMs(this.settings.candleTimeframe);
    return Math.floor((now - opened) / timeframeMs);
  }

  /**
   * Get current bot status
   */
  getStatus(): BotStatus {
    return { ...this.status };
  }

  /**
   * Update settings
   */
  updateSettings(settings: Partial<SignalistBotSettings>): void {
    this.settings = { ...this.settings, ...settings };
    // Reinitialize strategy with new settings
    this.strategy = new SignalistSMA3CStrategy({
      candleTimeframe: this.settings.candleTimeframe,
      smaPeriod: this.settings.smaPeriod,
      smaPeriod2: this.settings.smaPeriod2,
      smaCrossLookback: this.settings.smaCrossLookback || 8,
      fiveMinTrendConfirmation: this.settings.fiveMinTrendConfirmation,
      spikeDetectionEnabled: this.settings.spikeDetectionEnabled,
      spikeThreshold: this.settings.spikeThreshold || 0.5,
    });
  }
}






