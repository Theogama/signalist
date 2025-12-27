/**
 * Deriv Auto-Trading Service
 * Handles automated trading on Deriv based on Signalist signals
 */

import { EventEmitter } from 'events';
import { connectToDatabase } from '@/database/mongoose';
import { DerivApiToken } from '@/database/models/deriv-api-token.model';
import { Signal } from '@/database/models/signal.model';
import { SignalistBotTrade } from '@/database/models/signalist-bot-trade.model';
import { AutoTradingSession } from '@/database/models/auto-trading-session.model';
import { decrypt } from '@/lib/utils/encryption';
import { DerivServerWebSocketClient, DerivBuyRequest, DerivContract } from '@/lib/deriv/server-websocket-client';
import { riskManagementService } from '@/lib/services/risk-management.service';
import { randomUUID } from 'crypto';

export interface AutoTradingConfig {
  userId: string;
  strategy: string;
  riskSettings: {
    maxTradesPerDay: number;
    dailyLossLimit: number;
    maxStakeSize: number;
    riskPerTrade: number; // Percentage of balance
    autoStopDrawdown?: number; // Percentage
  };
  signalFilters?: {
    symbols?: string[];
    sources?: string[];
  };
}

export interface TradeExecutionResult {
  success: boolean;
  tradeId?: string;
  contractId?: string;
  error?: string;
}

export class DerivAutoTradingService extends EventEmitter {
  private wsClient: DerivServerWebSocketClient | null = null;
  private config: AutoTradingConfig | null = null;
  private sessionId: string | null = null;
  private isRunning: boolean = false;
  private activeContracts: Map<string, DerivContract> = new Map();
  private dailyTradeCount: number = 0;
  private dailyProfitLoss: number = 0;
  private sessionStartBalance: number = 0;
  private lastTradeDate: string = '';
  private contractSubscriptions: Map<string, () => void> = new Map();
  private balanceSubscription: (() => void) | null = null;

  /**
   * Start auto-trading session
   */
  async start(config: AutoTradingConfig): Promise<void> {
    if (this.isRunning) {
      throw new Error('Auto-trading is already running');
    }

    this.config = config;
    await connectToDatabase();

    // Get and decrypt API token
    const tokenDoc = await DerivApiToken.findOne({ userId: config.userId }).select('+token');
    if (!tokenDoc || !tokenDoc.isValid || !tokenDoc.token) {
      throw new Error('No valid Deriv API token found. Please connect your Deriv account first.');
    }

    const token = await decrypt(tokenDoc.token);

    // Initialize WebSocket client
    this.wsClient = new DerivServerWebSocketClient(token);
    
    // Set up event handlers
    this.wsClient.on('error', (error) => {
      console.error('[AutoTrading] WebSocket error:', error);
      this.emit('error', error);
    });

    this.wsClient.on('disconnect', () => {
      console.log('[AutoTrading] WebSocket disconnected');
      this.emit('disconnect');
    });

    this.wsClient.on('contract_update', (contract: DerivContract) => {
      this.handleContractUpdate(contract);
    });

    // Connect to Deriv
    await this.wsClient.connect();

    // Get account info
    const accountInfo = await this.wsClient.getAccountInfo();
    this.sessionStartBalance = accountInfo.balance;

    // Initialize daily tracking
    const today = new Date().toISOString().split('T')[0];
    this.lastTradeDate = today;
    this.dailyTradeCount = 0;
    this.dailyProfitLoss = 0;

    // Subscribe to balance updates
    this.balanceSubscription = await this.wsClient.subscribeToBalance((balance) => {
      this.emit('balance_update', balance);
    });

    // Get existing open contracts
    const openContracts = await this.wsClient.getOpenContracts();
    for (const contract of openContracts) {
      this.activeContracts.set(contract.contract_id, contract);
      await this.subscribeToContract(contract.contract_id);
    }
    
    // Create session record with enhanced fields
    const session = new AutoTradingSession({
      sessionId: randomUUID(),
      userId: config.userId,
      derivTokenId: tokenDoc?._id.toString(),
      broker: 'deriv',
      strategy: config.strategy,
      status: 'starting',
      startedAt: new Date(),
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      totalProfitLoss: 0,
      currentDrawdown: 0,
      maxDrawdown: 0,
      dailyTradeCount: 0,
      dailyProfitLoss: 0,
      consecutiveLosses: 0,
      startBalance: this.sessionStartBalance,
      currentBalance: this.sessionStartBalance,
      riskSettings: {
        ...config.riskSettings,
        riskPerTrade: config.riskSettings.riskPerTrade || 1,
      },
      signalFilters: config.signalFilters || {},
    });
    await session.save();
    this.sessionId = session.sessionId;
    
    // Update status to active after initialization
    session.status = 'active';
    await session.save();

    this.isRunning = true;
    this.emit('started', { sessionId: this.sessionId, balance: this.sessionStartBalance });

    // Start listening to signals
    this.startSignalListener();
  }

  /**
   * Stop auto-trading session
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    // Unsubscribe from all contracts
    for (const unsubscribe of this.contractSubscriptions.values()) {
      unsubscribe();
    }
    this.contractSubscriptions.clear();

    // Unsubscribe from balance
    if (this.balanceSubscription) {
      this.balanceSubscription();
      this.balanceSubscription = null;
    }

    // Disconnect WebSocket
    if (this.wsClient) {
      await this.wsClient.disconnect();
      this.wsClient = null;
    }

    // Update session record
    if (this.sessionId) {
      await connectToDatabase();
      const session = await AutoTradingSession.findOne({ sessionId: this.sessionId });
      if (session) {
        const accountInfo = this.wsClient ? await this.wsClient.getAccountInfo().catch(() => null) : null;
        session.status = 'stopped';
        session.stoppedAt = new Date();
        session.totalTrades = this.dailyTradeCount;
        session.totalProfitLoss = this.dailyProfitLoss;
        session.endBalance = accountInfo?.balance || this.sessionStartBalance + this.dailyProfitLoss;
        await session.save();
      }
    }

    this.emit('stopped', { sessionId: this.sessionId });
    this.sessionId = null;
  }

  /**
   * Start listening to signals
   */
  private async startSignalListener(): Promise<void> {
    if (!this.isRunning || !this.config) {
      return;
    }

    // Poll for new signals every 5 seconds
    const pollInterval = setInterval(async () => {
      if (!this.isRunning) {
        clearInterval(pollInterval);
        return;
      }

      try {
        await this.processSignals();
      } catch (error) {
        console.error('[AutoTrading] Error processing signals:', error);
        this.emit('error', error);
      }
    }, 5000);

    // Also listen for real-time signal creation (if using database change streams)
    // For now, polling is sufficient
  }

  /**
   * Process active signals
   */
  private async processSignals(): Promise<void> {
    if (!this.config || !this.wsClient) {
      return;
    }

    await connectToDatabase();

    // Get active signals
    const query: any = { status: 'active' };
    if (this.config.signalFilters?.symbols) {
      query.symbol = { $in: this.config.signalFilters.symbols };
    }
    if (this.config.signalFilters?.sources) {
      query.source = { $in: this.config.signalFilters.sources };
    }

    const signals = await Signal.find(query)
      .sort({ createdAt: -1 })
      .limit(10);

    for (const signal of signals) {
      // Check if we should execute this signal
      if (await this.shouldExecuteTrade(signal)) {
        await this.executeTrade(signal);
      }
    }
  }

  /**
   * Check if we should execute a trade for a signal
   */
  private async shouldExecuteTrade(signal: any): Promise<boolean> {
    if (!this.config || !this.wsClient || !this.sessionId) {
      return false;
    }

    // Get current balance
    const accountInfo = await this.wsClient.getAccountInfo().catch(() => null);
    if (!accountInfo) {
      return false;
    }
    const currentBalance = accountInfo.balance;

    // Use Risk Management Service for comprehensive validation
    const riskCheck = await riskManagementService.canExecuteTrade(
      this.sessionId,
      signal,
      currentBalance
    );

    if (!riskCheck.allowed) {
      if (riskCheck.reason) {
        console.log(`[AutoTrading] Trade rejected: ${riskCheck.reason}`);
        this.emit('risk_limit_reached', {
          reason: riskCheck.reason,
          metrics: riskCheck.metrics,
        });

        // If drawdown limit reached, stop trading
        if (riskCheck.reason.includes('Drawdown limit')) {
          await this.stop();
        }
      }
      return false;
    }

    // Check if we already have an open trade for this symbol
    const hasOpenTrade = Array.from(this.activeContracts.values())
      .some(c => c.symbol === signal.symbol && c.status === 'open');
    
    if (hasOpenTrade) {
      return false; // Don't open multiple positions for same symbol
    }

    return true;
  }

  /**
   * Execute a trade based on a signal
   */
  private async executeTrade(signal: any): Promise<TradeExecutionResult> {
    if (!this.config || !this.wsClient) {
      return { success: false, error: 'Service not initialized' };
    }

    try {
      // Get account balance
      const accountInfo = await this.wsClient.getAccountInfo();
      const balance = accountInfo.balance;

      // Calculate stake size using Risk Management Service
      const stake = riskManagementService.calculateStakeSize(
        balance,
        this.config.riskSettings,
        signal.entryPrice,
        signal.stopLoss
      );

      if (stake < 1) {
        return { success: false, error: 'Stake too small (minimum $1)' };
      }

      // Map signal to Deriv contract
      const buyRequest: DerivBuyRequest = {
        symbol: this.mapSymbolToDeriv(signal.symbol),
        contract_type: signal.action === 'BUY' ? 'CALL' : 'PUT',
        amount: Math.floor(stake),
        duration: 5, // Default 5 minutes
        duration_unit: 'm',
        basis: 'stake',
      };

      // Place trade
      const buyResponse = await this.wsClient.buyContract(buyRequest);

      if (buyResponse.error || !buyResponse.buy) {
        return {
          success: false,
          error: buyResponse.error?.message || 'Trade execution failed',
        };
      }

      const contractId = buyResponse.buy.contract_id?.toString() || buyResponse.buy.contract_id;
      const purchasePrice = buyResponse.buy.purchase_price;

      // Subscribe to contract updates
      await this.subscribeToContract(contractId);

      // Save trade to database
      await connectToDatabase();
      const tradeId = randomUUID();
      const trade = new SignalistBotTrade({
        tradeId,
        userId: this.config.userId,
        broker: 'deriv',
        symbol: buyRequest.symbol,
        side: signal.action,
        entryPrice: purchasePrice,
        lotOrStake: stake,
        stopLoss: signal.stopLoss || 0,
        takeProfit: signal.takeProfit || 0,
        status: 'OPEN',
        entryTimestamp: new Date(),
        brokerTradeId: contractId,
        entryReason: `Signal: ${signal.signalId}`,
      });
      await trade.save();

      // Update signal status
      signal.status = 'executed';
      await signal.save();

      // Update daily count
      this.dailyTradeCount++;
      if (this.sessionId) {
        await AutoTradingSession.updateOne(
          { sessionId: this.sessionId },
          { $inc: { totalTrades: 1 } }
        );
      }

      this.emit('trade_executed', {
        tradeId,
        contractId,
        signalId: signal.signalId,
        symbol: buyRequest.symbol,
        stake,
      });

      return {
        success: true,
        tradeId,
        contractId,
      };
    } catch (error: any) {
      console.error('[AutoTrading] Trade execution error:', error);
      return {
        success: false,
        error: error.message || 'Trade execution failed',
      };
    }
  }

  /**
   * Handle contract updates
   */
  private async handleContractUpdate(contract: DerivContract): Promise<void> {
    this.activeContracts.set(contract.contract_id, contract);

    // If contract is closed, update database
    if (contract.status === 'sold' || contract.status === 'won' || contract.status === 'lost') {
      await connectToDatabase();
      const trade = await SignalistBotTrade.findOne({ brokerTradeId: contract.contract_id });
      
      if (trade && trade.status === 'OPEN') {
        const profitLoss = contract.profit || 0;
        const profitLossPercent = trade.lotOrStake > 0 
          ? (profitLoss / trade.lotOrStake) * 100 
          : 0;

        trade.status = contract.status === 'won' ? 'TP_HIT' : 'SL_HIT';
        trade.exitPrice = contract.current_spot || trade.entryPrice;
        trade.exitTimestamp = new Date();
        trade.realizedPnl = profitLoss;
        trade.realizedPnlPercent = profitLossPercent;
        trade.exitReason = contract.status === 'won' ? 'Take profit hit' : 'Stop loss hit';
        await trade.save();

        // Update daily P/L
        this.dailyProfitLoss += profitLoss;
        if (this.sessionId) {
          await AutoTradingSession.updateOne(
            { sessionId: this.sessionId },
            { $inc: { totalProfitLoss: profitLoss } }
          );
        }

        // Unsubscribe from contract
        const unsubscribe = this.contractSubscriptions.get(contract.contract_id);
        if (unsubscribe) {
          unsubscribe();
          this.contractSubscriptions.delete(contract.contract_id);
        }

        this.activeContracts.delete(contract.contract_id);

        this.emit('trade_closed', {
          tradeId: trade.tradeId,
          contractId: contract.contract_id,
          profitLoss,
          profitLossPercent,
          status: trade.status,
        });
      }
    } else {
      // Update unrealized P/L
      await connectToDatabase();
      const trade = await SignalistBotTrade.findOne({ brokerTradeId: contract.contract_id });
      if (trade && trade.status === 'OPEN') {
        const unrealizedPnl = contract.profit || 0;
        const unrealizedPnlPercent = trade.lotOrStake > 0 
          ? (unrealizedPnl / trade.lotOrStake) * 100 
          : 0;

        trade.unrealizedPnl = unrealizedPnl;
        trade.unrealizedPnlPercent = unrealizedPnlPercent;
        await trade.save();

        this.emit('trade_update', {
          tradeId: trade.tradeId,
          contractId: contract.contract_id,
          unrealizedPnl,
          unrealizedPnlPercent,
        });
      }
    }
  }

  /**
   * Subscribe to contract updates
   */
  private async subscribeToContract(contractId: string): Promise<void> {
    if (!this.wsClient) {
      return;
    }

    const unsubscribe = await this.wsClient.subscribeToContract(contractId, (contract) => {
      this.handleContractUpdate(contract);
    });

    this.contractSubscriptions.set(contractId, unsubscribe);
  }

  /**
   * Map symbol to Deriv format
   */
  private mapSymbolToDeriv(symbol: string): string {
    // Convert to uppercase and ensure it's a valid Deriv symbol
    const upperSymbol = symbol.toUpperCase();
    
    // If it's already a Deriv symbol (BOOM, CRASH), return as is
    if (upperSymbol.startsWith('BOOM') || upperSymbol.startsWith('CRASH')) {
      return upperSymbol;
    }

    // Default to BOOM500 for other symbols
    return 'BOOM500';
  }

  /**
   * Get current status
   */
  getStatus(): {
    isRunning: boolean;
    sessionId: string | null;
    activeContracts: number;
    dailyTradeCount: number;
    dailyProfitLoss: number;
  } {
    return {
      isRunning: this.isRunning,
      sessionId: this.sessionId,
      activeContracts: this.activeContracts.size,
      dailyTradeCount: this.dailyTradeCount,
      dailyProfitLoss: this.dailyProfitLoss,
    };
  }
}

// Singleton instance per user
const serviceInstances: Map<string, DerivAutoTradingService> = new Map();

export function getAutoTradingService(userId: string): DerivAutoTradingService {
  if (!serviceInstances.has(userId)) {
    serviceInstances.set(userId, new DerivAutoTradingService());
  }
  return serviceInstances.get(userId)!;
}

export function stopAutoTradingService(userId: string): void {
  const service = serviceInstances.get(userId);
  if (service) {
    service.stop().catch(console.error);
    serviceInstances.delete(userId);
  }
}


