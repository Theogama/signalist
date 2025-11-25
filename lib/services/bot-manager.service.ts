/**
 * Bot Manager Service
 * Manages active trading bots and their execution
 */

import { IStrategy } from '@/lib/auto-trading/interfaces';
import { IBrokerAdapter } from '@/lib/auto-trading/interfaces';
import { StrategyConfig, MarketData, StrategySignal, OrderRequest, Position } from '@/lib/auto-trading/types';
import { PaperTrader } from '@/lib/auto-trading/paper-trader/PaperTrader';
import { EnhancedRiskManager } from '@/lib/auto-trading/risk-manager/EnhancedRiskManager';
import { executeOrderSafely } from '@/lib/auto-trading/utils/smart-execution';
import { calculateATR } from '@/lib/auto-trading/utils/technical-indicators';
import { marketDataService } from '@/lib/services/market-data.service';
import { sessionManager } from '@/lib/auto-trading/session-manager/SessionManager';
import { logEmitter } from '@/lib/auto-trading/log-emitter/LogEmitter';
import { automationManager } from '@/lib/auto-trading/automation/AutomationManager';

export interface ActiveBot {
  botId: string;
  userId: string;
  sessionId: string;
  strategy: IStrategy;
  adapter: IBrokerAdapter | null;
  paperTrader: PaperTrader | null;
  instrument: string;
  parameters: Record<string, any>;
  isRunning: boolean;
  intervalId?: NodeJS.Timeout;
  startedAt: Date;
  riskManager: EnhancedRiskManager;
  historicalData: MarketData[]; // Store historical data for strategies
}

class BotManagerService {
  private activeBots: Map<string, ActiveBot> = new Map();

  /**
   * Start a bot
   */
  async startBot(
    botId: string,
    userId: string,
    strategy: IStrategy,
    adapter: IBrokerAdapter | null,
    instrument: string,
    parameters: Record<string, any>,
    paperTrading: boolean = true
  ): Promise<string> {
    const botKey = `${userId}-${botId}`;

    // Check if bot is already running
    if (this.activeBots.has(botKey)) {
      const existing = this.activeBots.get(botKey)!;
      if (existing.isRunning) {
        throw new Error('Bot is already running');
      }
    }

    // Initialize paper trader if in paper trading mode
    const paperTrader = paperTrading ? new PaperTrader(userId, parameters.broker || 'demo', parameters.initialBalance || 10000) : null;
    if (paperTrader) {
      await paperTrader.initialize();
    }

    // Create enhanced risk manager
    const riskManager = new EnhancedRiskManager({
      maxRiskPerTrade: parameters.riskPercent || 1,
      maxDailyLoss: parameters.maxDailyLoss || 10,
      maxDrawdown: parameters.maxDrawdown || 20,
      maxConcurrentPositions: parameters.maxTrades || 1,
      maxPositionSize: parameters.riskPercent || 1,
      // Enhanced features
      useATRForSL: parameters.useATRForSL !== false,
      atrMultiplier: parameters.atrMultiplier || 2,
      enableBreakeven: parameters.enableBreakeven !== false,
      breakevenTriggerRR: parameters.breakevenTriggerRR || 1,
      enableTrailingStop: parameters.enableTrailingStop || false,
      trailingStopATRMultiplier: parameters.trailingStopATRMultiplier || 1.5,
      maxDailyTrades: parameters.maxDailyTrades,
      maxDailyProfit: parameters.maxDailyProfit,
      maxTradesPerSession: parameters.maxTradesPerSession,
      minLotSize: parameters.minLotSize,
      maxLotSize: parameters.maxLotSize,
    });

    // Create strategy config
    const strategyConfig: StrategyConfig = {
      name: strategy.name,
      enabled: true,
      riskPercent: parameters.riskPercent || 1,
      takeProfitPercent: parameters.takeProfitPercent || 2,
      stopLossPercent: parameters.stopLossPercent || 1,
      maxConcurrentTrades: parameters.maxTrades || 1,
      maxDailyTrades: parameters.maxDailyTrades,
      maxDailyLoss: parameters.maxDailyLoss,
      maxDrawdown: parameters.maxDrawdown,
      parameters: parameters,
    };

    await strategy.initialize(strategyConfig);

    // Initialize adapter if provided
    if (adapter && !paperTrading) {
      await adapter.initialize({
        apiKey: parameters.apiKey || '',
        apiSecret: parameters.apiSecret || '',
        environment: parameters.environment || 'demo',
      });
      await adapter.authenticate();
    }

    // Create session
    const sessionId = sessionManager.createSession(
      userId,
      botId,
      parameters.broker || 'demo',
      adapter,
      instrument,
      parameters,
      paperTrading
    );

    // Create active bot
    const activeBot: ActiveBot = {
      botId,
      userId,
      sessionId,
      strategy,
      adapter: paperTrading ? null : adapter,
      paperTrader,
      instrument,
      parameters,
      isRunning: true,
      startedAt: new Date(),
      riskManager,
      historicalData: [], // Initialize empty historical data
    };

    // Log bot start
    logEmitter.success(
      `Bot ${botId} started on ${instrument}${paperTrading ? ' (Paper Trading)' : ''}`,
      userId,
      { botId, instrument, paperTrading, sessionId }
    );

    // Start trading loop
    const intervalId = setInterval(async () => {
      await this.executeTradingLoop(activeBot);
    }, 5000); // Check every 5 seconds

    activeBot.intervalId = intervalId;
    this.activeBots.set(botKey, activeBot);

    return botKey;
  }

  /**
   * Stop a bot
   */
  stopBot(userId: string, botId: string): boolean {
    const botKey = `${userId}-${botId}`;
    const bot = this.activeBots.get(botKey);

    if (!bot) {
      return false;
    }

    if (bot.intervalId) {
      clearInterval(bot.intervalId);
    }

    bot.isRunning = false;
    
    // Stop session
    sessionManager.stopSession(bot.sessionId);
    
    // Log bot stop
    logEmitter.info(
      `Bot ${botId} stopped`,
      userId,
      { botId, sessionId: bot.sessionId }
    );

    this.activeBots.delete(botKey);

    return true;
  }

  /**
   * Get active bot
   */
  getActiveBot(userId: string, botId: string): ActiveBot | null {
    const botKey = `${userId}-${botId}`;
    return this.activeBots.get(botKey) || null;
  }

  /**
   * Get all active bots for a user
   */
  getUserBots(userId: string): ActiveBot[] {
    return Array.from(this.activeBots.values()).filter(bot => bot.userId === userId);
  }

  /**
   * Execute trading loop for a bot
   */
  private async executeTradingLoop(bot: ActiveBot): Promise<void> {
    if (!bot.isRunning) {
      return;
    }

    try {
      // Get market data - use real market data service for live trading
      let marketData: MarketData;
      
      if (bot.paperTrader) {
        // For paper trading, try to get real market data first, fallback to mock
        try {
          const livePrice = await marketDataService.getCurrentPrice(bot.instrument);
          if (livePrice) {
            marketData = {
              symbol: bot.instrument,
              bid: livePrice.price * 0.999,
              ask: livePrice.price * 1.001,
              last: livePrice.price,
              volume: livePrice.volume || 0,
              timestamp: new Date(livePrice.timestamp),
              high24h: livePrice.high || livePrice.price,
              low24h: livePrice.low || livePrice.price,
              change24h: livePrice.change || 0,
              changePercent24h: livePrice.changePercent || 0,
            };
          } else {
            // Fallback to mock data if real data unavailable
            marketData = {
              symbol: bot.instrument,
              bid: 1000 + Math.random() * 100,
              ask: 1000 + Math.random() * 100,
              last: 1000 + Math.random() * 100,
              volume: Math.random() * 1000,
              timestamp: new Date(),
            };
          }
        } catch (error) {
          // Fallback to mock data on error
          console.warn(`Failed to fetch real market data for ${bot.instrument}, using mock data:`, error);
          marketData = {
            symbol: bot.instrument,
            bid: 1000 + Math.random() * 100,
            ask: 1000 + Math.random() * 100,
            last: 1000 + Math.random() * 100,
            volume: Math.random() * 1000,
            timestamp: new Date(),
          };
        }
      } else if (bot.adapter) {
        marketData = await bot.adapter.getMarketData(bot.instrument);
      } else {
        return; // No adapter and no paper trader
      }

      // Get balance
      let balance: number;
      if (bot.paperTrader) {
        balance = bot.paperTrader.getBalance().balance;
      } else if (bot.adapter) {
        const accountBalance = await bot.adapter.getBalance();
        balance = accountBalance.balance;
      } else {
        return;
      }

      // Get open positions
      let openPositions: any[] = [];
      if (bot.paperTrader) {
        const paperPositions = bot.paperTrader.getOpenPositions();
        openPositions = paperPositions.map((p) => ({
          positionId: p.tradeId,
          symbol: p.position.symbol,
          side: p.position.side,
          quantity: p.position.quantity,
          entryPrice: p.position.entryPrice,
          currentPrice: marketData.last,
          unrealizedPnl: 0,
          unrealizedPnlPercent: 0,
          status: 'OPEN' as const,
          openedAt: p.position.openedAt || new Date(),
        }));
      } else if (bot.adapter) {
        const adapterPositions = await bot.adapter.getOpenPositions();
        openPositions = adapterPositions.map((p) => ({
          positionId: p.positionId,
          symbol: p.symbol,
          side: p.side,
          quantity: p.quantity,
          entryPrice: p.entryPrice,
          currentPrice: p.currentPrice,
          unrealizedPnl: p.unrealizedPnl,
          unrealizedPnlPercent: p.unrealizedPnlPercent,
          status: p.status,
          openedAt: p.openedAt,
        }));
      }

      // Emit price update
      logEmitter.price(bot.instrument, marketData.last, bot.userId);

      // Update historical data (keep last 100 candles)
      bot.historicalData.push(marketData);
      if (bot.historicalData.length > 100) {
        bot.historicalData.shift();
      }

      // Analyze market and get signal (pass historical data)
      const signal = await bot.strategy.analyze(marketData, bot.historicalData);

      if (signal) {
        // Emit signal
        logEmitter.signal(signal, bot.userId, bot.botId);

        // Check risk management
        const canTrade = await bot.riskManager.canTrade(
          signal,
          balance,
          openPositions
        );

        if (!canTrade) {
          logEmitter.risk(
            `Trade blocked by risk manager: ${signal.side} ${signal.symbol}`,
            bot.userId,
            { signal, balance, openPositions: openPositions.length }
          );
        } else {
          // Calculate position size
          // For derivatives (Boom/Crash), calculate stake amount based on risk %
          // For regular instruments, calculate quantity based on risk %
          const isDerivative = bot.instrument.includes('BOOM') || bot.instrument.includes('CRASH');
          
          let positionSize: number;
          if (isDerivative) {
            // For derivatives, position size = stake amount (in currency)
            // Calculate stake based on risk percentage of balance
            const riskAmount = (balance * (bot.parameters.riskPercent || 1)) / 100;
            positionSize = Math.max(1, Math.floor(riskAmount)); // Minimum $1 stake
          } else {
            // For regular instruments, calculate quantity
            positionSize = bot.strategy.calculatePositionSize(
              balance,
              signal.entryPrice,
              signal.stopLoss
            );
          }

          signal.quantity = positionSize;

          // Execute trade
          try {
            if (bot.paperTrader) {
              // Get balance before trade
              const balanceBefore = bot.paperTrader.getBalance();
              
              const orderResponse = await bot.paperTrader.executeTrade(signal, marketData);
              if (orderResponse) {
                // Get balance after trade
                const balanceAfter = bot.paperTrader.getBalance();
                
                logEmitter.order(
                  {
                    orderId: orderResponse.orderId,
                    symbol: signal.symbol,
                    side: signal.side,
                    quantity: signal.quantity || 1,
                    status: orderResponse.status,
                    price: orderResponse.price || signal.entryPrice,
                  },
                  bot.userId,
                  bot.botId
                );
                
                // Emit balance update
                logEmitter.info(
                  `Balance updated: $${balanceBefore.balance.toFixed(2)} -> $${balanceAfter.balance.toFixed(2)} | Equity: $${balanceAfter.equity.toFixed(2)} | Margin: $${balanceAfter.margin.toFixed(2)}`,
                  bot.userId,
                  {
                    balance: balanceAfter.balance,
                    equity: balanceAfter.equity,
                    margin: balanceAfter.margin,
                    freeMargin: balanceAfter.freeMargin,
                  }
                );
              }
              await bot.paperTrader.updatePositions(marketData);
              
              // Emit balance update after position update
              const finalBalance = bot.paperTrader.getBalance();
              logEmitter.info(
                `Position updated | Balance: $${finalBalance.balance.toFixed(2)} | Equity: $${finalBalance.equity.toFixed(2)} | Free Margin: $${finalBalance.freeMargin.toFixed(2)}`,
                bot.userId,
                finalBalance
              );
            } else if (bot.adapter) {
              // Use smart execution with retry, confirmation, and slippage protection
              const orderRequest: OrderRequest = {
                symbol: bot.adapter.mapSymbol(signal.symbol),
                side: signal.side,
                type: 'MARKET',
                quantity: signal.quantity || 1,
                stopLoss: signal.stopLoss,
                takeProfit: signal.takeProfit,
              };

              // Calculate ATR for position tracking
              const prices = bot.historicalData.map(d => d.last);
              const highs = bot.historicalData.map(d => d.high24h || d.last * 1.001);
              const lows = bot.historicalData.map(d => d.low24h || d.last * 0.999);
              const atr = calculateATR(highs, lows, prices, 14);
              const currentATR = atr.length > 0 ? atr[atr.length - 1] : undefined;

              const executionResult = await executeOrderSafely(bot.adapter, orderRequest, {
                maxRetries: 3,
                retryDelay: 1000,
                confirmTimeout: 5000,
                maxSlippagePercent: 0.1,
                latencyThreshold: 2000,
                spreadCheck: true,
                maxSpreadPercent: 0.1,
              });

              if (executionResult.success && executionResult.orderResponse) {
                const orderResponse = executionResult.orderResponse;
                
                // Log order with enhanced details
                logEmitter.order({
                  ...orderResponse,
                  slippage: executionResult.slippage,
                  latency: executionResult.latency,
                  retries: executionResult.retries,
                }, bot.userId, bot.botId);

                // Track position for breakeven/trailing stop
                if (orderResponse.status === 'FILLED' && orderResponse.filledPrice) {
                  const positionId = orderResponse.orderId;
                  bot.riskManager.trackPosition(
                    positionId,
                    orderResponse.filledPrice,
                    signal.side,
                    signal.stopLoss || 0,
                    signal.takeProfit || 0,
                    currentATR
                  );

                  // Log risk calculation
                  logEmitter.riskCalculation({
                    entryPrice: orderResponse.filledPrice,
                    stopLoss: signal.stopLoss || 0,
                    takeProfit: signal.takeProfit || 0,
                    method: bot.parameters.useATRForSL !== false ? 'ATR-based' : 'Percentage-based',
                    atr: currentATR,
                    riskRewardRatio: signal.stopLoss && signal.takeProfit
                      ? Math.abs(signal.takeProfit - orderResponse.filledPrice) / Math.abs(orderResponse.filledPrice - signal.stopLoss)
                      : undefined,
                  }, bot.userId, bot.botId);
                }
              } else {
                logEmitter.error(
                  `Order execution failed: ${executionResult.error}`,
                  bot.userId,
                  { signal, error: executionResult.error, retries: executionResult.retries }
                );
              }
            }
          } catch (error: any) {
            logEmitter.error(
              `Failed to execute trade: ${error.message}`,
              bot.userId,
              { signal, error: error.message }
            );
            // Notify automation manager of error
            automationManager.handleError(bot.userId, bot.botId, error);
          }
        }
      }

      // Update positions (check for exits and risk management)
      if (bot.paperTrader) {
        await bot.paperTrader.updatePositions(marketData);
        // Reset error count on successful operation
        automationManager.resetErrorCount(bot.userId, bot.botId);
      } else if (bot.adapter && openPositions.length > 0) {
        // Calculate ATR for risk management updates
        const prices = bot.historicalData.map(d => d.last);
        const highs = bot.historicalData.map(d => d.high24h || d.last * 1.001);
        const lows = bot.historicalData.map(d => d.low24h || d.last * 0.999);
        const atr = calculateATR(highs, lows, prices, 14);
        const currentATR = atr.length > 0 ? atr[atr.length - 1] : undefined;

        for (const position of openPositions) {
          const positionId = position.positionId || position.tradeId;
          
          // Update risk management (breakeven, trailing stop)
          const riskUpdates = bot.riskManager.updatePositionRisk(
            {
              positionId,
              symbol: position.symbol,
              side: position.side,
              quantity: position.quantity,
              entryPrice: position.entryPrice,
              currentPrice: marketData.last,
              unrealizedPnl: position.unrealizedPnl || 0,
              unrealizedPnlPercent: position.unrealizedPnlPercent || 0,
              status: 'OPEN' as const,
              openedAt: position.openedAt || new Date(),
              stopLoss: position.stopLoss,
              takeProfit: position.takeProfit,
            },
            marketData.last,
            currentATR
          );

          // Update stop loss if breakeven or trailing stop triggered
          if (riskUpdates.stopLoss && bot.adapter) {
            await bot.adapter.updatePosition(positionId, riskUpdates.stopLoss);
            logEmitter.info(
              `Position ${positionId} stop loss updated: ${riskUpdates.reason || 'Risk management'}`,
              bot.userId,
              { positionId, newStopLoss: riskUpdates.stopLoss, reason: riskUpdates.reason }
            );
          }

          // Check for exit
          const shouldExit = await bot.strategy.shouldExit(
            {
              positionId,
              symbol: position.symbol,
              side: position.side,
              quantity: position.quantity,
              entryPrice: position.entryPrice,
              currentPrice: marketData.last,
              unrealizedPnl: position.unrealizedPnl || 0,
              unrealizedPnlPercent: position.unrealizedPnlPercent || 0,
              status: 'OPEN' as const,
              openedAt: position.openedAt || new Date(),
              stopLoss: riskUpdates.stopLoss || position.stopLoss,
              takeProfit: position.takeProfit,
            },
            marketData
          );

          if (shouldExit && bot.adapter) {
            const exitPrice = marketData.last;
            const profitLoss = position.side === 'BUY'
              ? (exitPrice - position.entryPrice) * position.quantity
              : (position.entryPrice - exitPrice) * position.quantity;
            const profitLossPercent = (profitLoss / (position.entryPrice * position.quantity)) * 100;

            await bot.adapter.closePosition(positionId);
            
            // Remove from tracking
            bot.riskManager.untrackPosition(positionId);

            // Log exit
            logEmitter.exit({
              positionId,
              symbol: position.symbol,
              reason: 'Strategy exit signal',
              exitPrice,
              entryPrice: position.entryPrice,
              profitLoss,
              profitLossPercent,
            }, bot.userId, bot.botId);
          }
        }
      }
    } catch (error: any) {
      logEmitter.error(
        `Error in trading loop: ${error.message}`,
        bot.userId,
        { botId: bot.botId, error: error.message, stack: error.stack }
      );
      // Notify automation manager of error
      automationManager.handleError(bot.userId, bot.botId, error);
      // Don't stop the bot on error, just log it
    }
  }
}

// Singleton instance
export const botManager = new BotManagerService();

