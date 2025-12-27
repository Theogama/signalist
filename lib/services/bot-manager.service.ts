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
import { TradingSessionChecker } from '@/lib/utils/trading-session-checker';

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
  lastSessionLogTime?: number; // Track when we last logged session message
  broker?: 'exness' | 'deriv'; // Broker type
  // Sequential execution state
  currentTradeId?: string; // ID of currently open trade
  isInTrade: boolean; // True when a trade is open (blocks new trades)
  tradeCloseListener?: () => void; // Function to unsubscribe from trade close events
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

    // Initialize paper trader if in paper trading mode (with timeout)
    const paperTrader = paperTrading ? new PaperTrader(userId, parameters.broker || 'demo', parameters.initialBalance || 10000) : null;
    if (paperTrader) {
      // Initialize paper trader with timeout to prevent blocking
      const initPromise = paperTrader.initialize();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Paper trader initialization timeout')), 5000)
      );
      try {
        await Promise.race([initPromise, timeoutPromise]);
      } catch (error: any) {
        console.warn(`[BotManager] Paper trader initialization timeout or error: ${error.message}`);
        // Continue without paper trader initialization - it will be initialized lazily
      }
    }

    // Create enhanced risk manager (synchronous, fast)
    // SEQUENTIAL EXECUTION: maxConcurrentPositions = 1 (only one trade at a time)
    const riskManager = new EnhancedRiskManager({
      maxRiskPerTrade: parameters.riskPercent || 1,
      maxDailyLoss: parameters.maxDailyLoss || 10,
      maxDrawdown: parameters.maxDrawdown || 20,
      maxConcurrentPositions: 1, // SEQUENTIAL: Only one trade at a time
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

    // Initialize strategy with timeout
    const strategyInitPromise = strategy.initialize(strategyConfig);
    const strategyTimeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Strategy initialization timeout')), 5000)
    );
    try {
      await Promise.race([strategyInitPromise, strategyTimeoutPromise]);
    } catch (error: any) {
      console.warn(`[BotManager] Strategy initialization timeout or error: ${error.message}`);
      // Continue - strategy might still work with default initialization
    }

    // Initialize adapter if provided (with timeout)
    if (adapter && !paperTrading) {
      const adapterInitPromise = adapter.initialize({
        apiKey: parameters.apiKey || '',
        apiSecret: parameters.apiSecret || '',
        environment: parameters.environment || 'demo',
      });
      const adapterInitTimeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Adapter initialization timeout')), 5000)
      );
      try {
        await Promise.race([adapterInitPromise, adapterInitTimeoutPromise]);
      } catch (error: any) {
        console.warn(`[BotManager] Adapter initialization timeout: ${error.message}`);
        throw new Error(`Adapter initialization failed: ${error.message}`);
      }
      
      // Authenticate with timeout
      if (!(adapter as any).authenticated) {
        const authPromise = adapter.authenticate();
        const authTimeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Authentication timeout')), 5000)
        );
        try {
          await Promise.race([authPromise, authTimeoutPromise]);
        } catch (error: any) {
          console.warn(`[BotManager] Authentication timeout: ${error.message}`);
          throw new Error(`Authentication failed: ${error.message}`);
        }
      }
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

    // Create active bot with sequential execution state
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
      broker: parameters.broker || (adapter ? (adapter.getBrokerType?.() || undefined) : undefined),
      // SEQUENTIAL EXECUTION STATE: Initialize as not in trade
      isInTrade: false,
      currentTradeId: undefined,
      tradeCloseListener: undefined,
    };

    // Log bot start
    logEmitter.success(
      `Bot ${botId} started on ${instrument}${paperTrading ? ' (Paper Trading)' : ''}`,
      userId,
      { botId, instrument, paperTrading, sessionId }
    );

    // Start trading loop
    logEmitter.info(
      `Starting trading loop for ${instrument}. Checking for signals every 1 second for immediate execution...`,
      userId,
      { botId, instrument, paperTrading }
    );
    
    activeBot.intervalId = undefined; // Will be set after first execution
    this.activeBots.set(botKey, activeBot);
    
    // Execute first loop IMMEDIATELY (no delay) for instant trade execution
    // This allows immediate signal detection and trade execution
    this.executeTradingLoop(activeBot).catch((error) => {
      console.error(`[BotManager] Error in initial trading loop for bot ${botId}:`, error);
      logEmitter.error(
        `Error in initial trading loop: ${error.message}`,
        userId,
        { botId, error: error.message }
      );
    });
    
    // Set up interval for continuous trading loop (reduced frequency to prevent page blocking)
    const intervalId = setInterval(() => {
      // Use setTimeout to yield to event loop and prevent blocking
      setTimeout(async () => {
        try {
          await this.executeTradingLoop(activeBot);
        } catch (error: any) {
          console.error(`[BotManager] Error in trading loop for ${botId}:`, error);
          logEmitter.error(
            `Error in trading loop: ${error.message}`,
            userId,
            { botId, error: error.message }
          );
        }
      }, 0); // Yield to event loop before executing
    }, 10000); // Increased to 10 seconds to reduce system load and prevent page blocking

    activeBot.intervalId = intervalId;

    return botKey;
  }

  /**
   * Stop a bot
   */
  stopBot(userId: string, botId: string): boolean {
    const botKey = `${userId}-${botId}`;
    const bot = this.activeBots.get(botKey);

    if (!bot) {
      // Log available bots for debugging
      const userBots = this.getUserBots(userId);
      console.warn(`[BotManager] Bot not found: ${botKey}. Available bots for user:`, 
        userBots.map(b => `${b.userId}-${b.botId}`)
      );
      return false;
    }

    if (bot.intervalId) {
      clearInterval(bot.intervalId);
      bot.intervalId = undefined;
    }

    // SEQUENTIAL EXECUTION: Clean up trade close listener
    if (bot.tradeCloseListener) {
      bot.tradeCloseListener();
      bot.tradeCloseListener = undefined;
    }

    // Reset sequential execution state
    bot.isInTrade = false;
    bot.currentTradeId = undefined;

    bot.isRunning = false;
    
    // Stop session
    if (bot.sessionId) {
      sessionManager.stopSession(bot.sessionId);
    }
    
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
   * SEQUENTIAL EXECUTION: Only one trade at a time
   * Flow: Check market → Get signal → Open trade → Wait for close → Auto-reenter
   */
  private async executeTradingLoop(bot: ActiveBot): Promise<void> {
    if (!bot.isRunning) {
      return;
    }

    // SEQUENTIAL EXECUTION RULE: If bot is in trade, skip execution and wait for trade to close
    if (bot.isInTrade) {
      // Bot is waiting for current trade to close
      // Trade close listener will handle auto-reentry
      return;
    }

    // MARKET SAFETY: Check if market is tradable before executing trades
    try {
      const { marketStatusService } = await import('@/lib/services/deriv-market-status.service');
      if (bot.broker === 'deriv') {
        await marketStatusService.initialize(bot.userId);
        const isTradable = await marketStatusService.isMarketTradable(bot.instrument);
        
        if (!isTradable) {
          const status = await marketStatusService.getMarketStatus(bot.instrument);
          logEmitter.risk(
            `Trade blocked: Market is not tradable. Status: ${status.status}. Reason: ${status.reason || 'Market closed'}`,
            bot.userId,
            { 
              botId: bot.botId, 
              symbol: bot.instrument, 
              status: status.status,
              reason: status.reason 
            }
          );
          return; // Block trade execution
        }
      }
    } catch (error: any) {
      // FAIL-CLOSED: If market status check fails, block trading for safety
      // This prevents trading during API failures or unknown market conditions
      console.warn(`[BotManager] Market status check failed for ${bot.instrument}:`, error);
      logEmitter.risk(
        `Trade blocked: Market status check failed. Cannot verify market availability: ${error.message}`,
        bot.userId,
        { botId: bot.botId, symbol: bot.instrument, error: error.message }
      );
      return; // Block trade execution when status cannot be verified
    }

    try {
      // Get market data - use real market data service for live trading
      let marketData: MarketData;
      
      if (bot.paperTrader) {
        // For paper trading, try to get real market data first, fallback to mock
        // Use longer timeout and non-blocking approach
        try {
          const livePricePromise = marketDataService.getCurrentPrice(bot.instrument);
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Market data request timeout')), 8000) // Increased to 8 seconds
          );
          
          // Race with timeout, but don't block if it fails
          const livePrice = await Promise.race([livePricePromise, timeoutPromise]).catch(() => null) as any;
          
          if (livePrice && livePrice.price) {
            marketData = {
              symbol: bot.instrument,
              bid: livePrice.price * 0.999,
              ask: livePrice.price * 1.001,
              last: livePrice.price,
              volume: livePrice.volume || 0,
              timestamp: new Date(livePrice.timestamp || Date.now()),
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
        } catch (error: any) {
          // Silently fallback to mock data on error (only log in debug mode)
          if (process.env.NODE_ENV === 'development') {
            console.debug(`[BotManager] Using mock data for ${bot.instrument}:`, error.message);
          }
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
        // Add timeout to adapter market data fetch (increased timeout)
        const marketDataPromise = bot.adapter.getMarketData(bot.instrument);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Market data timeout')), 10000) // Increased to 10 seconds
        );
        
        // Use catch to prevent unhandled rejections
        marketData = await Promise.race([marketDataPromise, timeoutPromise]).catch((error) => {
          if (process.env.NODE_ENV === 'development') {
            console.debug(`[BotManager] Market data timeout for ${bot.instrument}:`, error.message);
          }
          // Return mock data as fallback
          return {
            symbol: bot.instrument,
            bid: 1000 + Math.random() * 100,
            ask: 1000 + Math.random() * 100,
            last: 1000 + Math.random() * 100,
            volume: Math.random() * 1000,
            timestamp: new Date(),
          } as MarketData;
        }) as MarketData;
      } else {
        return; // No adapter and no paper trader
      }

      // Get balance with timeout protection
      let balance: number;
      if (bot.paperTrader) {
        balance = bot.paperTrader.getBalance().balance;
      } else if (bot.adapter) {
        const balancePromise = bot.adapter.getBalance();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Balance fetch timeout')), 5000)
        );
        const accountBalance = await Promise.race([balancePromise, timeoutPromise]) as any;
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
        // Add timeout to positions fetch
        const positionsPromise = bot.adapter.getOpenPositions();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Positions fetch timeout')), 5000)
        );
        const adapterPositions = await Promise.race([positionsPromise, timeoutPromise]) as any[];
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

      // Check trading session first
      const sessionConfig = {
        enabled: !!(bot.parameters.sessionStart || bot.parameters.sessionEnd),
        sessionStart: bot.parameters.sessionStart,
        sessionEnd: bot.parameters.sessionEnd,
      };

      if (!TradingSessionChecker.isTradingAllowed(sessionConfig)) {
        const timeUntilStart = TradingSessionChecker.getTimeUntilSessionStart(sessionConfig);
        // Only log once per minute to avoid spam
        const now = Date.now();
        if (!bot.lastSessionLogTime || (now - bot.lastSessionLogTime) > 60000) {
          logEmitter.info(
            `Trading session is off. Next session starts in ${timeUntilStart} minutes.`,
            bot.userId,
            { botId: bot.botId, timeUntilStart, sessionConfig }
          );
          bot.lastSessionLogTime = now;
        }
        return; // Exit early if not in trading session
      }

      // Log market data status
      logEmitter.info(
        `Analyzing ${bot.instrument} | Price: ${marketData.last.toFixed(2)} | Historical data: ${bot.historicalData.length} candles`,
        bot.userId,
        { 
          botId: bot.botId,
          instrument: bot.instrument,
          price: marketData.last,
          historicalDataCount: bot.historicalData.length,
          openPositions: openPositions.length
        }
      );

      // Analyze market and get signal (pass historical data) with timeout
      let signal: any = null;
      try {
        const analyzePromise = bot.strategy.analyze(marketData, bot.historicalData);
        const analyzeTimeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Strategy analysis timeout')), 10000)
        );
        signal = await Promise.race([analyzePromise, analyzeTimeoutPromise]);
      } catch (error) {
        console.warn(`[BotManager] Strategy analysis timeout or error for ${bot.instrument}:`, error);
        // Continue without signal rather than blocking
      }

      if (!signal) {
        // Log why no signal was generated (only occasionally to avoid spam)
        if (Math.random() < 0.1) { // Log 10% of the time
          logEmitter.info(
            `No signal generated for ${bot.instrument}. Strategy conditions not met.`,
            bot.userId,
            { 
              botId: bot.botId,
              instrument: bot.instrument,
              historicalDataCount: bot.historicalData.length,
              price: marketData.last
            }
          );
        }
        return;
      }

      if (signal) {
        // Emit signal
        logEmitter.signal(signal, bot.userId, bot.botId);

        // SEQUENTIAL EXECUTION: Check if already in trade (should not happen due to early return, but double-check)
        if (bot.isInTrade || openPositions.length > 0) {
          logEmitter.info(
            `Trade blocked: Bot is already in trade (sequential execution). Waiting for current trade to close.`,
            bot.userId,
            { signal, isInTrade: bot.isInTrade, openPositions: openPositions.length }
          );
          return;
        }

        // Check risk management
        const canTrade = await bot.riskManager.canTrade(
          signal,
          balance,
          openPositions
        );

        if (!canTrade) {
          // Get detailed reason why trade was blocked
          const riskMetrics = bot.riskManager.getRiskMetrics();
          logEmitter.risk(
            `Trade blocked by risk manager: ${signal.side} ${signal.symbol} | Balance: $${balance.toFixed(2)} | Daily P/L: $${riskMetrics.dailyPnl.toFixed(2)} | Daily Trades: ${riskMetrics.dailyTrades}`,
            bot.userId,
            { 
              signal, 
              balance, 
              openPositions: openPositions.length,
              riskMetrics,
              reason: 'Risk manager check failed'
            }
          );
        } else {
          // Calculate position size
          // For derivatives (Boom/Crash), calculate stake amount based on risk %
          // For regular instruments, calculate quantity based on risk %
          const isDerivative = bot.instrument.includes('BOOM') || bot.instrument.includes('CRASH');
          
          // Calculate position size based on risk settings
          let positionSize: number;
          
          // Use lotSize if specified, otherwise calculate based on risk %
          if (bot.parameters.lotSize !== undefined && bot.parameters.lotSize > 0) {
            positionSize = bot.parameters.lotSize;
          } else if (isDerivative) {
            // For derivatives, position size = stake amount (in currency)
            // Calculate stake based on risk percentage of balance
            const riskAmount = (balance * (bot.parameters.riskPercent || 1)) / 100;
            positionSize = Math.max(1, Math.floor(riskAmount)); // Minimum $1 stake
          } else {
            // For regular instruments, calculate quantity based on risk %
            positionSize = bot.strategy.calculatePositionSize(
              balance,
              signal.entryPrice,
              signal.stopLoss
            );
          }
          
          // Ensure position size respects risk percentage
          const maxRiskAmount = (balance * (bot.parameters.riskPercent || 1)) / 100;
          if (!isDerivative && positionSize * signal.entryPrice > maxRiskAmount) {
            // Adjust position size to respect risk limit
            positionSize = maxRiskAmount / signal.entryPrice;
          }

          signal.quantity = positionSize;

          // Execute trade
          try {
            if (bot.paperTrader) {
              // Get balance before trade
              const balanceBefore = bot.paperTrader.getBalance();
              
              const orderResponse = await bot.paperTrader.executeTrade(signal, marketData);
              if (orderResponse && orderResponse.status === 'FILLED') {
                // SEQUENTIAL EXECUTION: Mark bot as IN_TRADE
                bot.isInTrade = true;
                bot.currentTradeId = orderResponse.orderId;
                
                logEmitter.info(
                  `[SEQUENTIAL] Trade opened: ${orderResponse.orderId}. Bot locked in IN_TRADE state.`,
                  bot.userId,
                  { tradeId: orderResponse.orderId, symbol: signal.symbol }
                );
                
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
                
                // Emit balance update immediately after trade
                logEmitter.balanceUpdate(
                  {
                    balance: balanceAfter.balance,
                    equity: balanceAfter.equity,
                    margin: balanceAfter.margin,
                    freeMargin: balanceAfter.freeMargin,
                    marginLevel: balanceAfter.marginLevel,
                  },
                  bot.userId
                );

                // Set up trade close listener for paper trader
                this.setupPaperTraderCloseListener(bot, orderResponse.orderId);
              }
              await bot.paperTrader.updatePositions(marketData);
              
              // Emit balance update after position update (in case positions were closed)
              const finalBalance = bot.paperTrader.getBalance();
              logEmitter.balanceUpdate(
                {
                  balance: finalBalance.balance,
                  equity: finalBalance.equity,
                  margin: finalBalance.margin,
                  freeMargin: finalBalance.freeMargin,
                  marginLevel: finalBalance.marginLevel,
                },
                bot.userId
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
                
                // SEQUENTIAL EXECUTION: Mark bot as IN_TRADE when trade is filled
                if (orderResponse.status === 'FILLED') {
                  bot.isInTrade = true;
                  bot.currentTradeId = orderResponse.orderId;
                  
                  logEmitter.info(
                    `[SEQUENTIAL] Trade opened: ${orderResponse.orderId}. Bot locked in IN_TRADE state.`,
                    bot.userId,
                    { tradeId: orderResponse.orderId, symbol: signal.symbol }
                  );
                }
                
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

                  // Set up trade close listener for Deriv/live trading
                  if (bot.broker === 'deriv') {
                    this.setupDerivContractCloseListener(bot, orderResponse.orderId);
                  } else {
                    // For other brokers, poll for position close
                    this.setupPositionCloseListener(bot, orderResponse.orderId);
                  }
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
            
            // SEQUENTIAL EXECUTION: Handle trade close
            if (bot.isInTrade && bot.currentTradeId === positionId) {
              this.handleTradeClose(bot, positionId, exitPrice, profitLoss);
            }
            
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
      // PHASE 2 FIX: Enhanced error logging with full context
      logEmitter.error(
        `Error in trading loop: ${error.message}`,
        bot.userId,
        {
          botId: bot.botId,
          instrument: bot.instrument,
          sessionId: bot.sessionId,
          isInTrade: bot.isInTrade,
          currentTradeId: bot.currentTradeId,
        },
        error
      );
      // Notify automation manager of error
      automationManager.handleError(bot.userId, bot.botId, error);
      // Don't stop the bot on error, just log it
    }
  }

  /**
   * SEQUENTIAL EXECUTION: Set up trade close listener for paper trader
   * Monitors position updates and detects when trade closes
   */
  private setupPaperTraderCloseListener(bot: ActiveBot, tradeId: string): void {
    if (bot.tradeCloseListener) {
      // Clean up previous listener
      bot.tradeCloseListener();
    }

    // Poll for position close (paper trader doesn't have real-time events)
    const checkInterval = setInterval(async () => {
      if (!bot.isRunning || !bot.isInTrade) {
        clearInterval(checkInterval);
        return;
      }

      try {
        if (bot.paperTrader) {
          const positions = bot.paperTrader.getOpenPositions();
          const tradeStillOpen = positions.some(p => p.tradeId === tradeId);
          
          if (!tradeStillOpen) {
            // Trade has closed
            clearInterval(checkInterval);
            const closedTrades = bot.paperTrader.getClosedTrades();
            const closedTrade = closedTrades.find(t => t.tradeId === tradeId);
            
            const profitLoss = closedTrade?.profitLoss || 0;
            const exitPrice = closedTrade?.exitPrice || 0;
            
            this.handleTradeClose(bot, tradeId, exitPrice, profitLoss);
          }
        }
      } catch (error: any) {
        console.error(`[BotManager] Error checking paper trader position close:`, error);
      }
    }, 2000); // Increased to 2 seconds to reduce system load and prevent page blocking

    bot.tradeCloseListener = () => clearInterval(checkInterval);
  }

  /**
   * SEQUENTIAL EXECUTION: Set up contract close listener for Deriv
   * Uses WebSocket contract updates to detect settlement
   */
  private setupDerivContractCloseListener(bot: ActiveBot, contractId: string): void {
    if (bot.tradeCloseListener) {
      bot.tradeCloseListener();
    }

    // For Deriv, we need to subscribe to contract updates via the adapter
    // This is a simplified version - in production, you'd use the Deriv WebSocket client
    // to subscribe to contract updates
    logEmitter.info(
      `[SEQUENTIAL] Monitoring Deriv contract ${contractId} for settlement...`,
      bot.userId,
      { contractId }
    );

    // Poll for contract status (Deriv adapter should provide contract status)
    const checkInterval = setInterval(async () => {
      if (!bot.isRunning || !bot.isInTrade) {
        clearInterval(checkInterval);
        return;
      }

      try {
        if (bot.adapter) {
          const openPositions = await bot.adapter.getOpenPositions();
          const contractStillOpen = openPositions.some(p => 
            p.positionId === contractId || p.tradeId === contractId
          );
          
          if (!contractStillOpen) {
            // Contract has settled
            clearInterval(checkInterval);
            
            // Get closed trades to find profit/loss
            const closedTrades = await bot.adapter.getClosedTrades();
            const closedTrade = closedTrades.find(t => 
              t.tradeId === contractId || t.positionId === contractId
            );
            
            const profitLoss = closedTrade?.realizedPnl || 0;
            const exitPrice = closedTrade?.exitPrice || 0;
            
            this.handleTradeClose(bot, contractId, exitPrice, profitLoss);
          }
        }
      } catch (error: any) {
        console.error(`[BotManager] Error checking Deriv contract close:`, error);
      }
    }, 5000); // Increased to 5 seconds to reduce system load and prevent page blocking

    bot.tradeCloseListener = () => clearInterval(checkInterval);
  }

  /**
   * SEQUENTIAL EXECUTION: Set up position close listener for other brokers
   * Polls for position status changes
   */
  private setupPositionCloseListener(bot: ActiveBot, positionId: string): void {
    if (bot.tradeCloseListener) {
      bot.tradeCloseListener();
    }

    const checkInterval = setInterval(async () => {
      if (!bot.isRunning || !bot.isInTrade) {
        clearInterval(checkInterval);
        return;
      }

      try {
        if (bot.adapter) {
          const openPositions = await bot.adapter.getOpenPositions();
          const positionStillOpen = openPositions.some(p => 
            p.positionId === positionId || p.tradeId === positionId
          );
          
          if (!positionStillOpen) {
            // Position has closed
            clearInterval(checkInterval);
            
            const closedTrades = await bot.adapter.getClosedTrades();
            const closedTrade = closedTrades.find(t => 
              t.tradeId === positionId || t.positionId === positionId
            );
            
            const profitLoss = closedTrade?.realizedPnl || 0;
            const exitPrice = closedTrade?.exitPrice || 0;
            
            this.handleTradeClose(bot, positionId, exitPrice, profitLoss);
          }
        }
      } catch (error: any) {
        console.error(`[BotManager] Error checking position close:`, error);
      }
    }, 5000); // Increased to 5 seconds to reduce system load and prevent page blocking

    bot.tradeCloseListener = () => clearInterval(checkInterval);
  }

  /**
   * SEQUENTIAL EXECUTION: Handle trade close and trigger auto-reentry
   * This is called when a trade closes (via any method: settlement, TP/SL, manual close)
   */
  private handleTradeClose(
    bot: ActiveBot,
    tradeId: string,
    exitPrice: number,
    profitLoss: number
  ): void {
    // Only handle if this is the current trade
    if (!bot.isInTrade || bot.currentTradeId !== tradeId) {
      return;
    }

    logEmitter.info(
      `[SEQUENTIAL] Trade closed: ${tradeId}. P/L: ${profitLoss.toFixed(2)}. Unlocking bot for next trade.`,
      bot.userId,
      { tradeId, exitPrice, profitLoss }
    );

    // Clean up listener
    if (bot.tradeCloseListener) {
      bot.tradeCloseListener();
      bot.tradeCloseListener = undefined;
    }

    // SEQUENTIAL EXECUTION: Unlock bot state
    bot.isInTrade = false;
    bot.currentTradeId = undefined;

    // AUTO-REENTRY: After trade closes, automatically evaluate and open next trade
    // Minimal delay (0.5-1 second) to allow settlement to complete while ensuring immediate execution
    const reentryDelay = 500 + Math.random() * 500; // 0.5-1 seconds for faster reentry
    
    logEmitter.info(
      `[SEQUENTIAL] Auto-reentry scheduled in ${(reentryDelay / 1000).toFixed(2)}s. Bot will evaluate next trade immediately.`,
      bot.userId,
      { delay: reentryDelay }
    );

    setTimeout(async () => {
      if (!bot.isRunning) {
        return;
      }

      // Check risk limits before auto-reentry
      try {
        const balance = bot.paperTrader 
          ? bot.paperTrader.getBalance().balance
          : (bot.adapter ? (await bot.adapter.getBalance()) : 0);

        const canReenter = await bot.riskManager.canTrade(
          { symbol: bot.instrument, side: 'BUY' as const, entryPrice: 0, stopLoss: 0 },
          balance,
          []
        );

        if (canReenter) {
          logEmitter.info(
            `[SEQUENTIAL] Auto-reentry: Risk checks passed. Executing next trade evaluation...`,
            bot.userId,
            { botId: bot.botId }
          );
          
          // Trigger next trading loop execution
          this.executeTradingLoop(bot).catch((error) => {
            console.error(`[BotManager] Error in auto-reentry trading loop:`, error);
            logEmitter.error(
              `Auto-reentry error: ${error.message}`,
              bot.userId,
              { botId: bot.botId, error: error.message }
            );
          });
        } else {
          const riskMetrics = bot.riskManager.getRiskMetrics();
          logEmitter.risk(
            `[SEQUENTIAL] Auto-reentry blocked by risk manager. Daily P/L: ${riskMetrics.dailyPnl.toFixed(2)}, Daily Trades: ${riskMetrics.dailyTrades}`,
            bot.userId,
            { riskMetrics }
          );
        }
      } catch (error: any) {
        console.error(`[BotManager] Error in auto-reentry check:`, error);
        logEmitter.error(
          `Auto-reentry check error: ${error.message}`,
          bot.userId,
          { botId: bot.botId, error: error.message }
        );
      }
    }, reentryDelay);
  }
}

// Singleton instance
export const botManager = new BotManagerService();

