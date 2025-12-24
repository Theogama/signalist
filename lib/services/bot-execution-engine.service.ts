/**
 * Bot Execution Engine for Signalist
 * 
 * Core auto-trading engine that executes bots server-side only.
 * One execution instance per active bot.
 * 
 * Trade Lifecycle:
 * 1. Check market status
 * 2. Fetch balance
 * 3. Request proposal
 * 4. Execute buy
 * 5. Monitor result
 * 6. Log transaction
 * 
 * SERVER-ONLY: This module uses Node.js WebSocket and database connections
 * Do not import this in client components
 */

import { EventEmitter } from 'events';
import { connectToDatabase } from '@/database/mongoose';
import { DerivApiToken } from '@/database/models/deriv-api-token.model';
import { SignalistBotTrade } from '@/database/models/signalist-bot-trade.model';
import { DerivServerWebSocketClient, DerivBuyRequest, DerivContract } from '@/lib/deriv/server-websocket-client';
import { DerivMarketStatusService, MarketStatus } from '@/lib/services/deriv-market-status.service';
import { DemoDerivService } from '@/lib/services/demo-deriv.service';
import { 
  botRiskManager, 
  BotRiskSettings, 
  BotStopReason,
  type BotStopEvent 
} from '@/lib/services/bot-risk-manager.service';
import { tradeLoggingService } from '@/lib/services/trade-logging.service';
import { decrypt } from '@/lib/utils/encryption';
import { randomUUID } from 'crypto';

/**
 * Bot Execution Configuration
 */
export interface BotExecutionConfig {
  userId: string;
  botId: string;
  symbol: string;
  contractType: 'CALL' | 'PUT';
  stake: number;
  duration: number;
  durationUnit: 't' | 's' | 'm' | 'h' | 'd';
  maxTradesPerDay?: number;
  maxDailyLoss?: number;
  enabled?: boolean;
  riskSettings?: BotRiskSettings; // Risk enforcement settings
  demoMode?: boolean; // Use demo trading simulator
  demoInitialBalance?: number; // Initial balance for demo mode
}

/**
 * Trade Execution Result
 */
export interface TradeExecutionResult {
  success: boolean;
  tradeId?: string;
  contractId?: string;
  error?: string;
  message?: string;
}

/**
 * Bot Execution Status
 */
export interface BotExecutionStatus {
  botId: string;
  userId: string;
  isRunning: boolean;
  isInTrade: boolean;
  currentTradeId?: string;
  dailyTradeCount: number;
  dailyProfitLoss: number;
  startedAt?: Date;
  lastTradeAt?: Date;
  error?: string;
}

/**
 * Proposal Result
 */
interface ProposalResult {
  success: boolean;
  proposal?: {
    ask_price: number;
    payout: number;
    spot: number;
  };
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Bot Execution Engine
 * Manages the complete lifecycle of bot execution
 */
export class BotExecutionEngine extends EventEmitter {
  private static instances: Map<string, BotExecutionEngine> = new Map();
  
  private config: BotExecutionConfig | null = null;
  private wsClient: DerivServerWebSocketClient | null = null;
  private marketStatusService: DerivMarketStatusService;
  private isRunning: boolean = false;
  private isInTrade: boolean = false;
  private currentTradeId: string | null = null;
  private currentContractId: string | null = null;
  private contractSubscription: (() => void) | null = null;
  private dailyTradeCount: number = 0;
  private dailyProfitLoss: number = 0;
  private lastTradeDate: string = '';
  private executionInterval: NodeJS.Timeout | null = null;
  private startedAt: Date | null = null;
  private lastError: string | null = null;
  private isExecuting: boolean = false; // Prevent concurrent execution cycles
  private executionQueue: Array<() => Promise<void>> = []; // Queue for execution cycles

  private constructor() {
    super();
    this.marketStatusService = DerivMarketStatusService.getInstance();
  }

  /**
   * Get or create bot execution instance
   * Ensures one instance per active bot
   */
  static getInstance(botId: string, userId: string): BotExecutionEngine {
    const key = `${userId}-${botId}`;
    
    if (!BotExecutionEngine.instances.has(key)) {
      BotExecutionEngine.instances.set(key, new BotExecutionEngine());
    }
    
    return BotExecutionEngine.instances.get(key)!;
  }

  /**
   * Remove instance
   */
  static removeInstance(botId: string, userId: string): void {
    const key = `${userId}-${botId}`;
    BotExecutionEngine.instances.delete(key);
  }

  /**
   * Start bot execution
   * Initializes connection and begins trading lifecycle
   */
  async startBot(config: BotExecutionConfig): Promise<void> {
    if (this.isRunning) {
      throw new Error('Bot is already running');
    }

    this.config = config;
    this.isRunning = true;
    this.startedAt = new Date();
    this.lastError = null;

    try {
      // Initialize database connection
      await connectToDatabase();

      // Check if demo mode
      this.isDemoMode = config.demoMode || false;

      if (this.isDemoMode) {
        // Use demo trading simulator (no token required)
        this.demoClient = new DemoDerivService(
          config.userId,
          config.demoInitialBalance || 10000
        );

        // Set up error handlers (demo mode rarely has errors)
        this.demoClient.on('error', (error) => {
          this.handleError('Demo service error', error);
        });

        // Connect to demo service
        await this.demoClient.connect();
      } else {
        // Use real Deriv API (token required)
        const tokenDoc = await DerivApiToken.findOne({ 
          userId: config.userId, 
          isValid: true 
        });

        if (!tokenDoc) {
          throw new Error('No valid Deriv API token found. Please connect your Deriv account first.');
        }

        const token = await decrypt(tokenDoc.token);

        // Initialize WebSocket client
        this.wsClient = new DerivServerWebSocketClient(token);
        
        // Set up error handlers
        this.wsClient.on('error', (error) => {
          this.handleError('WebSocket error', error);
        });

        this.wsClient.on('disconnect', () => {
          this.handleError('WebSocket disconnected', new Error('Connection lost'));
        });

        // Connect to Deriv
        await this.wsClient.connect();
      }

      // Initialize market status service
      await this.marketStatusService.initialize(config.userId);

      // Initialize risk manager if settings provided
      if (config.riskSettings) {
        botRiskManager.initializeBot(config.botId, config.userId, config.riskSettings);
        
        // Set up risk manager event listeners
        botRiskManager.on('bot_stopped', (event: BotStopEvent) => {
          if (event.botId === config.botId && event.userId === config.userId) {
            this.handleRiskStop(event);
          }
        });
      }

      // Initialize daily tracking
      const today = new Date().toISOString().split('T')[0];
      this.lastTradeDate = today;
      this.dailyTradeCount = 0;
      this.dailyProfitLoss = 0;

      // Get initial balance for risk manager
      if (config.riskSettings) {
        try {
          const accountInfo = await this.wsClient.getAccountInfo();
          botRiskManager.setStartBalance(config.botId, config.userId, accountInfo.balance);
        } catch (error) {
          console.warn('[BotExecutionEngine] Failed to get initial balance for risk manager:', error);
        }
      }

      // Start execution loop
      this.startExecutionLoop();

      this.emit('started', { botId: config.botId, userId: config.userId });
      
      console.log(`[BotExecutionEngine] Bot ${config.botId} started successfully`);
    } catch (error: any) {
      this.isRunning = false;
      this.lastError = error.message;
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Stop bot execution
   * Gracefully shuts down and cleans up resources
   */
  async stopBot(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    // Stop execution loop
    if (this.executionInterval) {
      clearInterval(this.executionInterval);
      this.executionInterval = null;
    }

    // Unsubscribe from contract updates
    if (this.contractSubscription) {
      this.contractSubscription();
      this.contractSubscription = null;
    }

    // Disconnect WebSocket or demo client
    if (this.isDemoMode && this.demoClient) {
      try {
        await this.demoClient.disconnect();
      } catch (error) {
        console.error('[BotExecutionEngine] Error disconnecting demo client:', error);
      }
      this.demoClient = null;
    } else if (this.wsClient) {
      try {
        await this.wsClient.disconnect();
      } catch (error) {
        console.error('[BotExecutionEngine] Error disconnecting WebSocket:', error);
      }
      this.wsClient = null;
    }

    // Disconnect market status service
    try {
      await this.marketStatusService.disconnect();
    } catch (error) {
      console.error('[BotExecutionEngine] Error disconnecting market status service:', error);
    }

    // Reset state
    this.isInTrade = false;
    this.currentTradeId = null;
    this.currentContractId = null;

    // Clear risk manager data
    if (this.config) {
      botRiskManager.clearBot(this.config.botId, this.config.userId);
    }

    this.emit('stopped', { 
      botId: this.config?.botId, 
      userId: this.config?.userId 
    });

    console.log(`[BotExecutionEngine] Bot ${this.config?.botId} stopped`);
  }

  /**
   * Get current execution status
   */
  getStatus(): BotExecutionStatus {
    return {
      botId: this.config?.botId || '',
      userId: this.config?.userId || '',
      isRunning: this.isRunning,
      isInTrade: this.isInTrade,
      currentTradeId: this.currentTradeId || undefined,
      dailyTradeCount: this.dailyTradeCount,
      dailyProfitLoss: this.dailyProfitLoss,
      startedAt: this.startedAt || undefined,
      lastTradeAt: this.currentTradeId ? new Date() : undefined,
      error: this.lastError || undefined,
    };
  }

  /**
   * Start execution loop
   * Continuously executes trading lifecycle
   */
  private startExecutionLoop(): void {
    // Execute immediately on start (with longer delay to prevent blocking)
    setTimeout(() => {
      // Use requestIdleCallback if available for non-blocking execution
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(() => {
          this.executeTradingCycle().catch((error) => {
            this.handleError('Error in initial trading cycle', error);
          });
        }, { timeout: 2000 });
      } else {
        setTimeout(() => {
          this.executeTradingCycle().catch((error) => {
            this.handleError('Error in initial trading cycle', error);
          });
        }, 2000);
      }
    }, 2000); // Increased delay to allow UI to fully render

    // Then execute every 15 seconds (increased from 10s to further reduce load)
    // Use a longer interval to prevent overlapping executions
    this.executionInterval = setInterval(() => {
      if (!this.isRunning || this.isExecuting) {
        return; // Skip if already executing
      }

      // Use requestIdleCallback for non-blocking execution
      const executeCycle = () => {
        this.executeTradingCycle().catch((error) => {
          this.handleError('Error in trading cycle', error);
        });
      };

      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(executeCycle, { timeout: 5000 });
      } else {
        setTimeout(executeCycle, 100);
      }
    }, 15000); // Increased to 15 seconds for better performance
  }

  /**
   * Execute complete trading lifecycle
   * 
   * Lifecycle Steps:
   * 1. Check market status
   * 2. Fetch balance
   * 3. Request proposal
   * 4. Execute buy
   * 5. Monitor result
   * 6. Log transaction
   */
  private async executeTradingCycle(): Promise<void> {
    if (!this.config || !this.isRunning) {
      return;
    }

    // Prevent concurrent execution cycles
    if (this.isExecuting) {
      console.log('[BotExecutionEngine] Cycle already executing, skipping...');
      return;
    }

    // Check if we have a client (demo or live)
    if (!this.wsClient && !this.demoClient) {
      console.log('[BotExecutionEngine] No client available');
      return;
    }

    // Skip if already in trade (sequential execution)
    if (this.isInTrade) {
      return;
    }

    // Set executing flag
    this.isExecuting = true;

    try {
      // Check daily limits (non-blocking)
      const today = new Date().toISOString().split('T')[0];
      if (this.lastTradeDate !== today) {
        // Reset daily counters for new day
        this.dailyTradeCount = 0;
        this.dailyProfitLoss = 0;
        this.lastTradeDate = today;
      }
      
      // Yield to event loop before each step to prevent blocking
      await new Promise(resolve => setImmediate(resolve));
      
      // STEP 1: Check market status
      const marketStatus = await this.checkMarketStatus();
      if (!marketStatus.isTradable) {
        console.log(`[BotExecutionEngine] Market not tradable: ${marketStatus.status}`);
        return;
      }

      // Yield to event loop
      await new Promise(resolve => setImmediate(resolve));

      // STEP 2: Fetch balance
      const balance = await this.fetchBalance();
      if (balance < this.config.stake) {
        console.log(`[BotExecutionEngine] Insufficient balance: ${balance} < ${this.config.stake}`);
        this.emit('insufficient_balance', { balance, required: this.config.stake });
        return;
      }

      // Yield to event loop
      await new Promise(resolve => setImmediate(resolve));

      // RISK CHECK: Check risk limits before proceeding
      if (this.config.riskSettings) {
        const riskCheck = await botRiskManager.checkRisk(
          this.config.botId,
          this.config.userId,
          balance,
          this.config.symbol
        );

        if (!riskCheck.allowed) {
          console.log(`[BotExecutionEngine] Risk check failed: ${riskCheck.message}`);
          this.emit('risk_check_failed', riskCheck);
          
          // Auto-stop if required
          if (riskCheck.shouldStop && riskCheck.reason) {
            await this.stopBotWithReason(riskCheck.reason, riskCheck.message || 'Risk limit reached');
            return;
          }
          return;
        }
      }

      // Yield to event loop
      await new Promise(resolve => setImmediate(resolve));

      // STEP 3: Request proposal
      const proposal = await this.requestProposal();
      if (!proposal.success || !proposal.proposal) {
        console.log(`[BotExecutionEngine] Proposal failed: ${proposal.error?.message}`);
        return;
      }

      // Yield to event loop
      await new Promise(resolve => setImmediate(resolve));

      // STEP 4: Execute buy
      const buyResult = await this.executeBuy(proposal.proposal);
      if (!buyResult.success || !buyResult.contractId) {
        console.log(`[BotExecutionEngine] Buy execution failed: ${buyResult.error}`);
        return;
      }

      // Yield to event loop
      await new Promise(resolve => setImmediate(resolve));

      // STEP 5: Monitor result (setup monitoring)
      await this.monitorContract(buyResult.contractId, buyResult.tradeId!);

      // STEP 6: Log transaction (handled in monitorContract when trade closes)

      this.dailyTradeCount++;
      
      // Emit event asynchronously to prevent blocking
      setImmediate(() => {
        this.emit('trade_executed', {
          tradeId: buyResult.tradeId,
          contractId: buyResult.contractId,
          symbol: this.config.symbol,
          stake: this.config.stake,
        });
      });

    } catch (error: any) {
      this.handleError('Error in trading cycle', error);
    } finally {
      // Always clear the executing flag
      this.isExecuting = false;
    }
  }

  /**
   * STEP 1: Check market status
   */
  private async checkMarketStatus(): Promise<{ status: MarketStatus; isTradable: boolean }> {
    if (!this.config) {
      throw new Error('Bot configuration not set');
    }

    // In demo mode, market is always tradable
    if (this.isDemoMode) {
      return { status: MarketStatus.OPEN, isTradable: true };
    }

    try {
      const statusResult = await this.marketStatusService.getMarketStatus(this.config.symbol);
      return {
        status: statusResult.status,
        isTradable: statusResult.isTradable,
      };
    } catch (error: any) {
      console.error('[BotExecutionEngine] Market status check error:', error);
      // Fail open - assume market is tradable if check fails
      return { status: MarketStatus.UNKNOWN, isTradable: true };
    }
  }

  /**
   * STEP 2: Fetch balance
   */
  private async fetchBalance(): Promise<number> {
    if (!this.wsClient) {
      throw new Error('WebSocket client not initialized');
    }

    try {
      const accountInfo = await this.wsClient.getAccountInfo();
      return accountInfo.balance;
    } catch (error: any) {
      throw new Error(`Failed to fetch balance: ${error.message}`);
    }
  }

  /**
   * STEP 3: Request proposal
   */
  private async requestProposal(): Promise<ProposalResult> {
    if (!this.config) {
      return { success: false, error: { code: 'CONFIG_ERROR', message: 'Configuration not available' } };
    }

    if (this.isDemoMode && this.demoClient) {
      try {
        const result = await this.demoClient.getProposal({
          symbol: this.config.symbol,
          contract_type: this.config.contractType,
          amount: this.config.stake,
          duration: this.config.duration,
          duration_unit: this.config.durationUnit,
        });
        return result;
      } catch (error: any) {
        return {
          success: false,
          error: { code: 'REQUEST_ERROR', message: error.message || 'Failed to request demo proposal' },
        };
      }
    }

    if (!this.wsClient) {
      return { success: false, error: { code: 'CONFIG_ERROR', message: 'Client not available' } };
    }

    try {
      const result = await this.wsClient.getProposal({
        symbol: this.config.symbol,
        contract_type: this.config.contractType,
        amount: this.config.stake,
        duration: this.config.duration,
        duration_unit: this.config.durationUnit,
      });

      return result;
    } catch (error: any) {
      return {
        success: false,
        error: { code: 'REQUEST_ERROR', message: error.message || 'Failed to request proposal' },
      };
    }
  }

  /**
   * STEP 4: Execute buy
   */
  private async executeBuy(proposal: { ask_price: number; payout: number; spot: number }): Promise<TradeExecutionResult> {
    if (!this.config) {
      return { success: false, error: 'Configuration not available' };
    }

    try {
      const buyRequest: DerivBuyRequest = {
        symbol: this.config.symbol,
        contract_type: this.config.contractType,
        amount: this.config.stake,
        duration: this.config.duration,
        duration_unit: this.config.durationUnit,
        basis: 'stake',
      };

      let buyResponse: any;

      if (this.isDemoMode && this.demoClient) {
        buyResponse = await this.demoClient.buyContract(buyRequest);
      } else if (this.wsClient) {
        buyResponse = await this.wsClient.buyContract(buyRequest);
      } else {
        return { success: false, error: 'Client not available' };
      }

      if (buyResponse.error || !buyResponse.buy) {
        return {
          success: false,
          error: buyResponse.error?.message || 'Buy execution failed',
        };
      }

      const contractId = buyResponse.buy.contract_id?.toString() || buyResponse.buy.contract_id;
      const purchasePrice = buyResponse.buy.purchase_price;

      // Log trade using trade logging service
      const tradeId = await tradeLoggingService.logTrade({
        userId: this.config.userId,
        botId: this.config.botId,
        broker: 'deriv',
        symbol: this.config.symbol,
        side: this.config.contractType === 'CALL' ? 'BUY' : 'SELL',
        stake: this.config.stake,
        entryPrice: purchasePrice,
        status: 'OPEN',
        entryTimestamp: new Date(),
        isDemo: this.isDemoMode,
        entryReason: `Bot: ${this.config.botId}`,
        brokerTradeId: contractId,
      });

      // Update state
      this.isInTrade = true;
      this.currentTradeId = tradeId;
      this.currentContractId = contractId;

      return {
        success: true,
        tradeId,
        contractId,
        message: 'Trade executed successfully',
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Buy execution failed',
      };
    }
  }

  /**
   * STEP 5: Monitor result
   * Subscribes to contract updates and handles settlement
   */
  private async monitorContract(contractId: string, tradeId: string): Promise<void> {
    if (this.isDemoMode && this.demoClient) {
      // Subscribe to contract updates
      this.contractSubscription = await this.demoClient.subscribeToContract(contractId, async (contract: DerivContract) => {
        await this.handleContractUpdate(contract, tradeId);
      });
      return;
    }

    if (!this.wsClient) {
      return;
    }

    // Subscribe to contract updates
    this.contractSubscription = await this.wsClient.subscribeToContract(contractId, async (contract: DerivContract) => {
      await this.handleContractUpdate(contract, tradeId);
    });
  }

  /**
   * Handle contract update
   * Called when contract status changes (settlement, win/loss)
   */
  private async handleContractUpdate(contract: DerivContract, tradeId: string): Promise<void> {
    // Check if contract is closed
    if (contract.status === 'sold' || contract.status === 'won' || contract.status === 'lost') {
      const profitLoss = contract.profit || 0;
      const exitPrice = contract.current_spot || 0;

      // Update trade record using trade logging service
      await connectToDatabase();
      const trade = await SignalistBotTrade.findOne({ tradeId });

      if (trade && trade.status === 'OPEN') {
        const profitLossPercent = trade.lotOrStake > 0 
          ? (profitLoss / trade.lotOrStake) * 100 
          : 0;

        const status = contract.status === 'won' ? 'TP_HIT' : 'SL_HIT';
        
        // Update using trade logging service
        await tradeLoggingService.updateTradeResult(tradeId, {
          exitPrice,
          profitLoss,
          profitLossPercent,
          status,
          exitReason: contract.status === 'won' ? 'Contract won' : 'Contract lost',
        });

        // STEP 6: Log transaction (completed)
        // Emit event asynchronously to prevent blocking
        setImmediate(() => {
          this.emit('trade_closed', {
            tradeId,
            contractId: contract.contract_id,
            profitLoss,
            profitLossPercent,
            status,
          });
        });

        // Update daily P/L
        this.dailyProfitLoss += profitLoss;

        // Mark trade as closed (allow next cycle to start)
        this.isInTrade = false;
        this.currentTradeId = null;
        this.currentContractId = null;

        // Unsubscribe from contract updates
        if (this.contractSubscription) {
          try {
            this.contractSubscription();
          } catch (error) {
            console.error('[BotExecutionEngine] Error unsubscribing from contract:', error);
          }
          this.contractSubscription = null;
        }

        // RISK CHECK: Check trade result for stop loss/take profit
        if (this.config?.riskSettings) {
          botRiskManager.recordTradeResult(
            this.config.botId,
            this.config.userId,
            profitLoss,
            trade.lotOrStake
          );

          const tradeResultCheck = botRiskManager.checkTradeResult(
            this.config.botId,
            this.config.userId,
            profitLoss,
            trade.lotOrStake
          );

          if (tradeResultCheck.reason) {
            this.emit('trade_risk_event', {
              reason: tradeResultCheck.reason,
              message: tradeResultCheck.message,
              profitLoss,
            });

            // Stop bot if stop loss hit
            if (tradeResultCheck.shouldStop && tradeResultCheck.reason === BotStopReason.STOP_LOSS_HIT) {
              await this.stopBotWithReason(
                BotStopReason.STOP_LOSS_HIT,
                tradeResultCheck.message || 'Stop loss hit'
              );
            }
          }
        }

        // Unsubscribe from contract
        if (this.contractSubscription) {
          this.contractSubscription();
          this.contractSubscription = null;
        }

        // Reset trade state
        this.isInTrade = false;
        this.currentTradeId = null;
        this.currentContractId = null;
      }
    } else {
      // Update unrealized P/L for open contracts
      await connectToDatabase();
      const trade = await SignalistBotTrade.findOne({ tradeId });
      if (trade && trade.status === 'OPEN') {
        const unrealizedPnl = contract.profit || 0;
        const unrealizedPnlPercent = trade.lotOrStake > 0 
          ? (unrealizedPnl / trade.lotOrStake) * 100 
          : 0;

        trade.unrealizedPnl = unrealizedPnl;
        trade.unrealizedPnlPercent = unrealizedPnlPercent;
        await trade.save();

        this.emit('trade_update', {
          tradeId,
          contractId: contract.contract_id,
          unrealizedPnl,
          unrealizedPnlPercent,
        });
      }
    }
  }

  /**
   * Stop bot with reason
   * Called when risk limits are hit or errors occur
   */
  private async stopBotWithReason(reason: BotStopReason, message: string): Promise<void> {
    if (!this.config) {
      return;
    }

    console.log(`[BotExecutionEngine] Stopping bot due to: ${reason} - ${message}`);

    // Emit stop event through risk manager
    if (this.config.riskSettings) {
      const metrics = botRiskManager.getMetrics(this.config.botId, this.config.userId);
      botRiskManager.emitStopEvent(
        this.config.botId,
        this.config.userId,
        reason,
        message,
        metrics || undefined
      );
    }

    // Emit stop event
    this.emit('bot_stopped', {
      botId: this.config.botId,
      userId: this.config.userId,
      reason,
      message,
      timestamp: new Date(),
    });

    // Stop the bot
    await this.stopBot();
  }

  /**
   * Handle errors gracefully
   */
  private handleError(context: string, error: any): void {
    const errorMessage = error.message || 'Unknown error';
    this.lastError = `${context}: ${errorMessage}`;
    
    console.error(`[BotExecutionEngine] ${context}:`, error);
    
    this.emit('error', { context, error: errorMessage });

    // Check if this is a critical error that should stop the bot
    if (this.config?.riskSettings) {
      const isConnectionError = context.includes('Connection') || context.includes('WebSocket');
      const isApiError = context.includes('API') || context.includes('timeout');

      if (isConnectionError || isApiError) {
        const riskResult = botRiskManager.handleApiError(
          this.config.botId,
          this.config.userId,
          error,
          isConnectionError ? 'CONNECTION_LOST' : 'API_ERROR'
        );

        if (riskResult.shouldStop) {
          this.stopBotWithReason(
            riskResult.reason || BotStopReason.API_ERROR,
            riskResult.message || errorMessage
          ).catch(console.error);
        }
      }
    }
  }
}

/**
 * Convenience functions for bot management
 */

/**
 * Start a bot
 */
export async function startBot(config: BotExecutionConfig): Promise<void> {
  const engine = BotExecutionEngine.getInstance(config.botId, config.userId);
  await engine.startBot(config);
}

/**
 * Stop a bot
 */
export async function stopBot(botId: string, userId: string): Promise<void> {
  const key = `${userId}-${botId}`;
  const engine = BotExecutionEngine.instances.get(key);
  if (engine) {
    await engine.stopBot();
    BotExecutionEngine.removeInstance(botId, userId);
  }
}

/**
 * Get bot status
 */
export function getBotStatus(botId: string, userId: string): BotExecutionStatus {
  const key = `${userId}-${botId}`;
  const engine = BotExecutionEngine.instances.get(key);
  if (engine) {
    return engine.getStatus();
  }
  // Return default status if bot is not running
  return {
    botId,
    userId,
    isRunning: false,
    isInTrade: false,
    dailyTradeCount: 0,
    dailyProfitLoss: 0,
  };
}

