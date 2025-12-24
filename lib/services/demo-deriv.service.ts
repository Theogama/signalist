/**
 * Demo Deriv Service
 * 
 * Simulates Deriv trading behavior for demo mode.
 * Mirrors the DerivServerWebSocketClient interface for seamless integration.
 * 
 * Features:
 * - Simulates balance changes
 * - Generates realistic trade outcomes
 * - Win/Loss logic based on probability
 * - Mock Deriv-like responses
 * - No real money interaction
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import {
  DerivAccountInfo,
  DerivContract,
  DerivBuyRequest,
  DerivBuyResponse,
} from '@/lib/deriv/server-websocket-client';
import { connectToDatabase } from '@/database/mongoose';
import { DemoAccount } from '@/database/models/demo-account.model';

/**
 * Mock Trade Generator Configuration
 */
interface MockTradeConfig {
  winRate: number; // 0-1, probability of winning (default: 0.55 = 55%)
  volatility: number; // 0-1, how much profit/loss varies (default: 0.3)
  minProfitPercent: number; // Minimum profit percentage (default: 50%)
  maxProfitPercent: number; // Maximum profit percentage (default: 200%)
  minLossPercent: number; // Minimum loss percentage (default: 50%)
  maxLossPercent: number; // Maximum loss percentage (default: 100%)
}

/**
 * Contract Simulation State
 */
interface ContractSimulation {
  contractId: string;
  symbol: string;
  contractType: 'CALL' | 'PUT';
  stake: number;
  entryPrice: number;
  startTime: number;
  duration: number;
  durationUnit: 't' | 's' | 'm' | 'h' | 'd';
  expiryTime: number;
  willWin: boolean; // Predetermined outcome
  finalProfit: number; // Predetermined profit/loss
  currentSpot: number;
}

/**
 * Demo Deriv Service
 * Simulates Deriv WebSocket client behavior
 */
export class DemoDerivService extends EventEmitter {
  private connected: boolean = false;
  private authenticated: boolean = false;
  private userId: string;
  private accountInfo: DerivAccountInfo | null = null;
  private requestId: number = 1;
  private activeContracts: Map<string, ContractSimulation> = new Map();
  private contractUpdateIntervals: Map<string, NodeJS.Timeout> = new Map();
  private mockConfig: MockTradeConfig;
  private initialBalance: number = 10000;

  constructor(userId: string, initialBalance: number = 10000, mockConfig?: Partial<MockTradeConfig>) {
    super();
    this.userId = userId;
    this.initialBalance = initialBalance;
    this.mockConfig = {
      winRate: 0.55, // 55% win rate (realistic for good strategies)
      volatility: 0.3, // 30% volatility in outcomes
      minProfitPercent: 50,
      maxProfitPercent: 200,
      minLossPercent: 50,
      maxLossPercent: 100,
      ...mockConfig,
    };
  }

  /**
   * Connect (simulated - always succeeds)
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    // Load or create demo account
    await this.loadDemoAccount();

    this.connected = true;
    this.authenticated = true;

    // Emit connected event
    setTimeout(() => {
      this.emit('authorized', this.accountInfo);
    }, 100);

    console.log('[DemoDeriv] Connected (simulated)');
  }

  /**
   * Disconnect
   */
  async disconnect(): Promise<void> {
    // Clear all contract update intervals
    for (const interval of this.contractUpdateIntervals.values()) {
      clearInterval(interval);
    }
    this.contractUpdateIntervals.clear();

    this.connected = false;
    this.authenticated = false;
    this.activeContracts.clear();

    console.log('[DemoDeriv] Disconnected');
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected && this.authenticated;
  }

  /**
   * Get account information
   */
  async getAccountInfo(): Promise<DerivAccountInfo> {
    if (!this.accountInfo) {
      await this.loadDemoAccount();
    }

    if (!this.accountInfo) {
      throw new Error('Account not initialized');
    }

    return { ...this.accountInfo };
  }

  /**
   * Get proposal (simulated)
   */
  async getProposal(request: {
    symbol: string;
    contract_type: 'CALL' | 'PUT';
    amount: number;
    duration: number;
    duration_unit: 't' | 's' | 'm' | 'h' | 'd';
  }): Promise<{
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
  }> {
    // Simulate proposal response
    const spot = this.getMockSpotPrice(request.symbol);
    const askPrice = request.amount; // For binary options, ask price = stake
    const payout = this.calculatePayout(request.amount, request.contract_type);

    return {
      success: true,
      proposal: {
        ask_price: askPrice,
        payout: payout,
        spot: spot,
      },
    };
  }

  /**
   * Buy contract (simulated)
   */
  async buyContract(request: DerivBuyRequest): Promise<DerivBuyResponse> {
    if (!this.accountInfo) {
      await this.loadDemoAccount();
    }

    if (!this.accountInfo) {
      return {
        error: {
          code: 'ACCOUNT_ERROR',
          message: 'Account not initialized',
        },
      };
    }

    // Check balance
    if (this.accountInfo.balance < request.amount) {
      return {
        error: {
          code: 'INSUFFICIENT_BALANCE',
          message: 'Insufficient balance',
        },
      };
    }

    // Generate contract
    const contractId = randomUUID();
    const now = Date.now();
    const durationMs = this.durationToMs(request.duration, request.duration_unit || 'm');
    const expiryTime = now + durationMs;

    // Determine outcome (win or loss)
    const willWin = Math.random() < this.mockConfig.winRate;
    const profitLoss = this.calculateProfitLoss(
      request.amount,
      willWin,
      request.contract_type
    );

    // Create contract simulation
    const contractSim: ContractSimulation = {
      contractId,
      symbol: request.symbol,
      contractType: request.contract_type,
      stake: request.amount,
      entryPrice: request.amount,
      startTime: now,
      duration: request.duration,
      durationUnit: request.duration_unit || 'm',
      expiryTime,
      willWin,
      finalProfit: profitLoss,
      currentSpot: this.getMockSpotPrice(request.symbol),
    };

    // Deduct stake from balance
    this.accountInfo.balance -= request.amount;
    await this.saveDemoAccount();

    // Store contract
    this.activeContracts.set(contractId, contractSim);

    // Start contract simulation
    this.simulateContract(contractSim);

    return {
      buy: {
        contract_id: contractId,
        purchase_price: request.amount,
        buy_price: request.amount,
        start_time: now,
        date_start: Math.floor(now / 1000),
      },
    };
  }

  /**
   * Subscribe to contract updates
   */
  async subscribeToContract(
    contractId: string,
    callback: (contract: DerivContract) => void
  ): Promise<() => void> {
    const contractSim = this.activeContracts.get(contractId);
    if (!contractSim) {
      return () => {}; // Return no-op unsubscribe
    }

    // Update callback is already handled by simulateContract
    // This is just for compatibility with the real client

    return () => {
      // Unsubscribe (no-op in demo mode)
    };
  }

  /**
   * Subscribe to balance updates
   */
  async subscribeToBalance(callback: (balance: number) => void): Promise<() => void> {
    // In demo mode, balance updates come from contract settlements
    // This is handled automatically
    return () => {};
  }

  /**
   * Get open contracts
   */
  async getOpenContracts(): Promise<DerivContract[]> {
    const contracts: DerivContract[] = [];

    for (const [contractId, sim] of this.activeContracts.entries()) {
      if (Date.now() < sim.expiryTime) {
        contracts.push({
          contract_id: contractId,
          symbol: sim.symbol,
          contract_type: sim.contractType,
          buy_price: sim.stake,
          purchase_price: sim.entryPrice,
          current_spot: sim.currentSpot,
          profit: this.calculateUnrealizedProfit(sim),
          date_start: Math.floor(sim.startTime / 1000),
          date_expiry: Math.floor(sim.expiryTime / 1000),
          status: 'open',
        });
      }
    }

    return contracts;
  }

  /**
   * Simulate contract lifecycle
   */
  private simulateContract(contractSim: ContractSimulation): void {
    const updateInterval = 1000; // Update every second
    const startTime = Date.now();
    const duration = contractSim.expiryTime - startTime;

    // Update contract periodically until expiry
    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Update current spot (simulate price movement)
      contractSim.currentSpot = this.simulateSpotMovement(
        contractSim.symbol,
        contractSim.currentSpot,
        progress
      );

      // Emit contract update
      const contract: DerivContract = {
        contract_id: contractSim.contractId,
        symbol: contractSim.symbol,
        contract_type: contractSim.contractType,
        buy_price: contractSim.stake,
        purchase_price: contractSim.entryPrice,
        current_spot: contractSim.currentSpot,
        profit: this.calculateUnrealizedProfit(contractSim),
        date_start: Math.floor(contractSim.startTime / 1000),
        date_expiry: Math.floor(contractSim.expiryTime / 1000),
        status: 'open',
      };

      this.emit('contract_update', contract);

      // Check if contract expired
      if (now >= contractSim.expiryTime) {
        clearInterval(interval);
        this.contractUpdateIntervals.delete(contractSim.contractId);
        this.settleContract(contractSim);
      }
    }, updateInterval);

    this.contractUpdateIntervals.set(contractSim.contractId, interval);
  }

  /**
   * Settle contract (determine win/loss)
   */
  private async settleContract(contractSim: ContractSimulation): Promise<void> {
    // Remove from active contracts
    this.activeContracts.delete(contractSim.contractId);

    // Update balance with profit/loss
    if (this.accountInfo) {
      this.accountInfo.balance += contractSim.stake + contractSim.finalProfit;
      await this.saveDemoAccount();
    }

    // Emit final contract update
    const finalContract: DerivContract = {
      contract_id: contractSim.contractId,
      symbol: contractSim.symbol,
      contract_type: contractSim.contractType,
      buy_price: contractSim.stake,
      purchase_price: contractSim.entryPrice,
      current_spot: contractSim.currentSpot,
      profit: contractSim.finalProfit,
      date_start: Math.floor(contractSim.startTime / 1000),
      date_expiry: Math.floor(contractSim.expiryTime / 1000),
      status: contractSim.willWin ? 'won' : 'lost',
    };

    this.emit('contract_update', finalContract);
    this.emit('balance_update', this.accountInfo?.balance || 0);

    console.log(
      `[DemoDeriv] Contract ${contractSim.contractId} settled: ${
        contractSim.willWin ? 'WON' : 'LOST'
      } (P/L: ${contractSim.finalProfit.toFixed(2)})`
    );
  }

  /**
   * Calculate profit/loss for a contract
   */
  private calculateProfitLoss(
    stake: number,
    willWin: boolean,
    contractType: 'CALL' | 'PUT'
  ): number {
    if (willWin) {
      // Win: profit is between minProfitPercent and maxProfitPercent
      const profitPercent =
        this.mockConfig.minProfitPercent +
        Math.random() *
          (this.mockConfig.maxProfitPercent - this.mockConfig.minProfitPercent);
      return (stake * profitPercent) / 100;
    } else {
      // Loss: lose the stake (or partial loss based on config)
      const lossPercent =
        this.mockConfig.minLossPercent +
        Math.random() *
          (this.mockConfig.maxLossPercent - this.mockConfig.minLossPercent);
      return -(stake * lossPercent) / 100;
    }
  }

  /**
   * Calculate unrealized profit (for open contracts)
   */
  private calculateUnrealizedProfit(contractSim: ContractSimulation): number {
    const progress = Math.min(
      (Date.now() - contractSim.startTime) / (contractSim.expiryTime - contractSim.startTime),
      1
    );

    // Gradually reveal profit/loss as contract approaches expiry
    return contractSim.finalProfit * progress;
  }

  /**
   * Calculate payout for proposal
   */
  private calculatePayout(stake: number, contractType: 'CALL' | 'PUT'): number {
    // Typical binary option payout is 70-95% of stake
    const payoutPercent = 70 + Math.random() * 25; // 70-95%
    return stake + (stake * payoutPercent) / 100;
  }

  /**
   * Get mock spot price for symbol
   */
  private getMockSpotPrice(symbol: string): number {
    // Base prices for common symbols
    const basePrices: Record<string, number> = {
      BOOM500: 1000,
      BOOM1000: 1000,
      BOOM300: 1000,
      BOOM100: 1000,
      CRASH500: 1000,
      CRASH1000: 1000,
      CRASH300: 1000,
      CRASH100: 1000,
    };

    const basePrice = basePrices[symbol] || 1000;
    // Add some random variation
    const variation = (Math.random() - 0.5) * 20; // ±10 variation
    return basePrice + variation;
  }

  /**
   * Simulate spot price movement
   */
  private simulateSpotMovement(
    symbol: string,
    currentSpot: number,
    progress: number
  ): number {
    // Simulate price movement with some volatility
    const volatility = this.mockConfig.volatility * 10;
    const movement = (Math.random() - 0.5) * volatility;
    return currentSpot + movement;
  }

  /**
   * Convert duration to milliseconds
   */
  private durationToMs(
    duration: number,
    unit: 't' | 's' | 'm' | 'h' | 'd'
  ): number {
    switch (unit) {
      case 't':
        return duration * 1000; // Ticks (assume 1 tick = 1 second)
      case 's':
        return duration * 1000;
      case 'm':
        return duration * 60 * 1000;
      case 'h':
        return duration * 60 * 60 * 1000;
      case 'd':
        return duration * 24 * 60 * 60 * 1000;
      default:
        return duration * 60 * 1000; // Default to minutes
    }
  }

  /**
   * Load demo account from database
   */
  private async loadDemoAccount(): Promise<void> {
    try {
      await connectToDatabase();
      let demoAccount = await DemoAccount.findOne({
        userId: this.userId,
        broker: 'deriv',
      });

      if (!demoAccount) {
        // Create new demo account
        demoAccount = new DemoAccount({
          userId: this.userId,
          broker: 'deriv',
          balance: this.initialBalance,
          equity: this.initialBalance,
          margin: 0,
          freeMargin: this.initialBalance,
          totalProfitLoss: 0,
          totalTrades: 0,
          winningTrades: 0,
          losingTrades: 0,
        });
        await demoAccount.save();
      }

      this.accountInfo = {
        balance: demoAccount.balance,
        currency: 'USD',
        accountId: demoAccount._id.toString(),
        accountType: 'demo',
      };
    } catch (error) {
      console.error('[DemoDeriv] Error loading demo account:', error);
      // Fallback to in-memory account
      this.accountInfo = {
        balance: this.initialBalance,
        currency: 'USD',
        accountId: 'demo-' + this.userId,
        accountType: 'demo',
      };
    }
  }

  /**
   * Save demo account to database
   */
  private async saveDemoAccount(): Promise<void> {
    if (!this.accountInfo) {
      return;
    }

    try {
      await connectToDatabase();
      await DemoAccount.findOneAndUpdate(
        {
          userId: this.userId,
          broker: 'deriv',
        },
        {
          balance: this.accountInfo.balance,
          equity: this.accountInfo.balance,
          freeMargin: this.accountInfo.balance,
          updatedAt: new Date(),
        },
        { upsert: true }
      );
    } catch (error) {
      console.error('[DemoDeriv] Error saving demo account:', error);
    }
  }

  /**
   * Reset demo account balance
   */
  async resetBalance(amount: number = 10000): Promise<void> {
    this.initialBalance = amount;
    if (this.accountInfo) {
      this.accountInfo.balance = amount;
    }
    await this.saveDemoAccount();
    this.emit('balance_update', amount);
  }

  /**
   * Get current balance
   */
  getBalance(): number {
    return this.accountInfo?.balance || this.initialBalance;
  }
}

