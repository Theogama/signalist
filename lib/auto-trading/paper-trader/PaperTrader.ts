/**
 * Paper Trader
 * Simulates trading execution without real money with persistent demo balance
 */

import { IPaperTrader } from '../interfaces';
import { StrategySignal, MarketData, OrderRequest, OrderResponse, AccountBalance, TradeResult, OrderStatus } from '../types';
import { DemoAccount } from '@/database/models/demo-account.model';
import { SignalistBotTrade } from '@/database/models/signalist-bot-trade.model';
import { connectToDatabase } from '@/database/mongoose';

export class PaperTrader implements IPaperTrader {
  private userId: string;
  private broker: 'exness' | 'deriv' | 'demo';
  private balance: number;
  private equity: number;
  private margin: number;
  private trades: TradeResult[] = [];
  private openPositions: Map<string, { signal: StrategySignal; entryPrice: number; entryTime: Date; quantity: number; currentPrice?: number }> = new Map();
  private initialBalance: number;
  private accountId: string | null = null;

  constructor(userId: string, broker: 'exness' | 'deriv' | 'demo' = 'demo', initialBalance: number = 10000) {
    this.userId = userId;
    this.broker = broker;
    this.initialBalance = initialBalance;
    this.balance = initialBalance;
    this.equity = initialBalance;
    this.margin = 0;
  }

  /**
   * Initialize or load demo account from database
   */
  async initialize(): Promise<void> {
    try {
      await connectToDatabase();
      
      // First try to find existing account to avoid duplicate key errors
      let account = await DemoAccount.findOne({ 
        userId: this.userId, 
        broker: this.broker 
      });

      if (!account) {
        // Only create if it doesn't exist
        try {
          account = await DemoAccount.create({
            userId: this.userId,
            broker: this.broker,
            balance: this.initialBalance,
            equity: this.initialBalance,
            margin: 0,
            freeMargin: this.initialBalance,
            initialBalance: this.initialBalance,
            currency: 'USD',
            totalProfitLoss: 0,
            totalTrades: 0,
            winningTrades: 0,
            losingTrades: 0,
          });
        } catch (createError: any) {
          // Handle duplicate key error - account might have been created by another request
          if (createError.code === 11000) {
            // Try to find the account that was just created
            account = await DemoAccount.findOne({ 
              userId: this.userId, 
              broker: this.broker 
            });
          } else {
            throw createError;
          }
        }
      }
      
      if (!account) {
        throw new Error('Failed to create or retrieve demo account');
      }
      
      this.accountId = (account._id as any)?.toString() || account._id?.toString() || null;
      this.balance = account.balance;
      this.equity = account.equity;
      this.margin = account.margin;
      this.initialBalance = account.initialBalance;
    } catch (error: any) {
      // Handle duplicate key error gracefully
      if (error.code === 11000 || error.message?.includes('duplicate key')) {
        console.log(`[PaperTrader] Account already exists for userId: ${this.userId}, broker: ${this.broker}, loading existing account...`);
        try {
          // Account already exists, just load it
          const existingAccount = await DemoAccount.findOne({ userId: this.userId, broker: this.broker });
          if (existingAccount) {
            this.accountId = (existingAccount._id as any)?.toString() || existingAccount._id?.toString() || null;
            this.balance = existingAccount.balance;
            this.equity = existingAccount.equity;
            this.margin = existingAccount.margin;
            this.initialBalance = existingAccount.initialBalance;
            return; // Successfully loaded existing account
          }
        } catch (loadError) {
          console.error('Error loading existing account:', loadError);
        }
      }
      
      console.error('Error initializing demo account:', error);
      // Fallback to in-memory if DB fails
      // Keep the initial balance values already set in constructor
    }
  }

  /**
   * Save account state to database
   */
  private async saveAccount(): Promise<void> {
    if (!this.accountId) return;
    
    try {
      await DemoAccount.findByIdAndUpdate(this.accountId, {
        balance: this.balance,
        equity: this.equity,
        margin: this.margin,
        freeMargin: this.equity - this.margin,
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error('Error saving demo account:', error);
    }
  }

  async executeTrade(signal: StrategySignal, marketData: MarketData): Promise<OrderResponse> {
    // Ensure account is initialized
    if (!this.accountId) {
      await this.initialize();
    }

    const orderRequest: OrderRequest = {
      symbol: signal.symbol,
      side: signal.side,
      type: 'MARKET',
      quantity: signal.quantity || 1,
      price: signal.entryPrice,
      stopLoss: signal.stopLoss,
      takeProfit: signal.takeProfit,
    };

    const response = await this.simulateFill(orderRequest, marketData);
    
    // Recalculate equity after opening position
    this.recalculateEquity();
    
    // Save account state after trade
    await this.saveAccount();
    
    return response;
  }

  async simulateFill(order: OrderRequest, marketData: MarketData): Promise<OrderResponse> {
    // Simulate order fill with slight slippage
    const slippage = 0.0001; // 0.01% slippage
    const filledPrice = order.type === 'MARKET'
      ? (order.side === 'BUY' 
          ? marketData.ask * (1 + slippage)
          : marketData.bid * (1 - slippage))
      : (order.price || marketData.last);

    const tradeId = `PAPER-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // For derivatives (Boom/Crash), use stake-based calculation
    // For regular instruments, use position value
    const isDerivative = order.symbol.includes('BOOM') || order.symbol.includes('CRASH');
    
    let positionValue: number;
    let marginRequirement: number;
    
    if (isDerivative) {
      // For derivatives, quantity represents stake amount in currency
      // Position value = stake amount
      positionValue = order.quantity; // Stake amount
      marginRequirement = positionValue; // Full stake is required as margin for derivatives
    } else {
      // For regular instruments (forex, stocks), use position value
      positionValue = filledPrice * order.quantity;
      marginRequirement = positionValue * 0.1; // 10% margin requirement
    }

    // Check if we have enough free margin
    const freeMargin = this.equity - this.margin;
    if (freeMargin < marginRequirement) {
      throw new Error(`Insufficient margin. Required: ${marginRequirement.toFixed(2)}, Available: ${freeMargin.toFixed(2)}`);
    }

    // Record position
    const entryTime = new Date();
    this.openPositions.set(tradeId, {
      signal: {
        symbol: order.symbol,
        side: order.side,
        entryPrice: filledPrice,
        stopLoss: order.stopLoss,
        takeProfit: order.takeProfit,
        quantity: order.quantity,
        timestamp: entryTime,
      },
      entryPrice: filledPrice,
      entryTime: entryTime,
      quantity: order.quantity,
      currentPrice: filledPrice,
    });

    // Save trade to database (OPEN status)
    try {
      await connectToDatabase();
      await SignalistBotTrade.create({
        tradeId,
        userId: this.userId,
        broker: this.broker === 'demo' ? 'deriv' : this.broker, // Map demo to deriv for database
        symbol: order.symbol,
        side: order.side,
        entryPrice: filledPrice,
        lotOrStake: order.quantity,
        stopLoss: order.stopLoss || filledPrice * 0.99,
        takeProfit: order.takeProfit || filledPrice * 1.01,
        status: 'OPEN',
        entryTimestamp: entryTime,
        entryReason: 'Strategy signal',
      });
    } catch (error) {
      console.error('Error saving trade to database:', error);
      // Continue even if database save fails
    }

    // Update margin (lock margin for this position)
    this.margin += marginRequirement;
    
    // Recalculate equity (balance + unrealized P&L - margin)
    // For new positions, unrealized P&L is 0, so equity = balance - margin
    this.recalculateEquity();

    // Log position opening
    console.log(`[PaperTrader] Position opened: ${order.symbol} ${order.side} ${order.quantity} @ ${filledPrice.toFixed(2)} | Margin locked: ${marginRequirement.toFixed(2)} | Balance: ${this.balance.toFixed(2)} | Equity: ${this.equity.toFixed(2)}`);

    return {
      orderId: tradeId,
      symbol: order.symbol,
      side: order.side,
      type: order.type,
      quantity: order.quantity,
      filledQuantity: order.quantity,
      price: order.price || filledPrice,
      filledPrice,
      status: 'FILLED' as OrderStatus,
      timestamp: new Date(),
      stopLoss: order.stopLoss,
      takeProfit: order.takeProfit,
    };
  }

  async updatePositions(marketData: MarketData): Promise<void> {
    // Update unrealized P&L for open positions
    const positionsToClose: Array<{ tradeId: string; exitPrice: number; reason: 'STOPPED' | 'TAKE_PROFIT' | 'CLOSED' }> = [];
    
    for (const [tradeId, position] of this.openPositions.entries()) {
      const currentPrice = marketData.last;
      position.currentPrice = currentPrice;
      
      // Check stop loss / take profit
      let shouldClose = false;
      let exitReason: 'STOPPED' | 'TAKE_PROFIT' | 'CLOSED' = 'CLOSED';
      let exitPrice = currentPrice;

      if (position.signal.stopLoss) {
        if (position.signal.side === 'BUY' && currentPrice <= position.signal.stopLoss) {
          shouldClose = true;
          exitPrice = position.signal.stopLoss;
          exitReason = 'STOPPED';
        } else if (position.signal.side === 'SELL' && currentPrice >= position.signal.stopLoss) {
          shouldClose = true;
          exitPrice = position.signal.stopLoss;
          exitReason = 'STOPPED';
        }
      }

      if (position.signal.takeProfit) {
        if (position.signal.side === 'BUY' && currentPrice >= position.signal.takeProfit) {
          shouldClose = true;
          exitPrice = position.signal.takeProfit;
          exitReason = 'TAKE_PROFIT';
        } else if (position.signal.side === 'SELL' && currentPrice <= position.signal.takeProfit) {
          shouldClose = true;
          exitPrice = position.signal.takeProfit;
          exitReason = 'TAKE_PROFIT';
        }
      }

      if (shouldClose) {
        positionsToClose.push({ tradeId, exitPrice, reason: exitReason });
      }
    }

    // Close positions that hit SL/TP
    for (const { tradeId, exitPrice, reason } of positionsToClose) {
      await this.closePosition(tradeId, exitPrice, reason);
    }

    // Recalculate equity with updated prices
    this.recalculateEquity();
    
    // Save account state
    await this.saveAccount();
  }

  private async closePosition(tradeId: string, exitPrice: number, reason: 'STOPPED' | 'TAKE_PROFIT' | 'CLOSED'): Promise<void> {
    const position = this.openPositions.get(tradeId);
    if (!position) {
      return;
    }

    // Determine if this is a derivative
    const isDerivative = position.signal.symbol.includes('BOOM') || position.signal.symbol.includes('CRASH');
    
    // Calculate position value (for margin release)
    const positionValue = isDerivative 
      ? position.quantity // For derivatives, quantity IS the stake (position value)
      : position.entryPrice * position.quantity; // For regular instruments
    
    // Calculate P&L
    const pnl = this.calculatePnl(position.entryPrice, exitPrice, position.quantity, position.signal.side, position.signal.symbol);
    const pnlPercent = isDerivative 
      ? ((exitPrice / position.entryPrice - 1) * 100) // For derivatives, use multiplier percentage
      : (pnl / positionValue) * 100; // For regular instruments

    // Store old balance for logging
    const oldBalance = this.balance;

    // Update balance: add P&L (profit adds to balance, loss subtracts)
    this.balance += pnl;

    // Release margin (unlock the margin that was locked for this position)
    const marginRequirement = isDerivative 
      ? position.quantity // Full stake for derivatives (quantity = stake amount)
      : positionValue * 0.1; // 10% for regular instruments
    this.margin -= marginRequirement;
    
    // Ensure margin doesn't go negative
    if (this.margin < 0) {
      this.margin = 0;
    }

    // Recalculate equity after closing position
    this.recalculateEquity();

    // Log balance update
    console.log(`[PaperTrader] Position closed: ${position.signal.symbol} ${position.signal.side} | P&L: ${pnl.toFixed(2)} | Balance: ${oldBalance.toFixed(2)} -> ${this.balance.toFixed(2)} | Equity: ${this.equity.toFixed(2)} | Margin: ${this.margin.toFixed(2)}`);

    // Record trade
    const trade: TradeResult = {
      tradeId,
      strategyName: 'PaperTrade',
      symbol: position.signal.symbol,
      side: position.signal.side,
      entryPrice: position.entryPrice,
      exitPrice,
      quantity: position.quantity,
      profitLoss: pnl,
      profitLossPercent: pnlPercent,
      status: reason,
      openedAt: position.entryTime,
      closedAt: new Date(),
      duration: Date.now() - position.entryTime.getTime(),
    };

    this.trades.push(trade);
    this.openPositions.delete(tradeId);

    // Map reason to database status
    const dbStatus = reason === 'TAKE_PROFIT' ? 'TP_HIT' : 
                     reason === 'STOPPED' ? 'SL_HIT' : 
                     'CLOSED';

    // Update trade in database (close the trade)
    try {
      await connectToDatabase();
      await SignalistBotTrade.findOneAndUpdate(
        { tradeId },
        {
          status: dbStatus,
          exitPrice,
          exitTimestamp: new Date(),
          realizedPnl: pnl,
          realizedPnlPercent: pnlPercent,
          exitReason: reason === 'TAKE_PROFIT' ? 'Take Profit Hit' : 
                      reason === 'STOPPED' ? 'Stop Loss Hit' : 
                      'Position Closed',
        }
      );
    } catch (error) {
      console.error('Error updating trade in database:', error);
      // Continue even if database update fails
    }

    // Update account statistics in database
    if (this.accountId) {
      try {
        await DemoAccount.findByIdAndUpdate(this.accountId, {
          $inc: {
            totalTrades: 1,
            totalProfitLoss: pnl,
            ...(pnl > 0 ? { winningTrades: 1 } : { losingTrades: 1 }),
          },
        });
      } catch (error) {
        console.error('Error updating account statistics:', error);
      }
    }
  }

  private calculatePnl(entryPrice: number, exitPrice: number, quantity: number, side: 'BUY' | 'SELL', symbol?: string): number {
    // Check if this is a derivative (Boom/Crash)
    const isDerivative = symbol ? (symbol.includes('BOOM') || symbol.includes('CRASH')) : false;
    
    if (isDerivative) {
      // For derivatives: P&L = stake * (multiplier - 1)
      // Multiplier = exitPrice / entryPrice for BUY, entryPrice / exitPrice for SELL
      if (side === 'BUY') {
        const multiplier = exitPrice / entryPrice;
        return quantity * (multiplier - 1); // Profit if multiplier > 1, loss if < 1
      } else {
        const multiplier = entryPrice / exitPrice;
        return quantity * (multiplier - 1); // Profit if multiplier > 1, loss if < 1
      }
    } else {
      // For regular instruments: P&L = price difference * quantity
      if (side === 'BUY') {
        return (exitPrice - entryPrice) * quantity;
      } else {
        return (entryPrice - exitPrice) * quantity;
      }
    }
  }

  private recalculateEquity(): void {
    let unrealizedPnl = 0;

    // Calculate unrealized P&L for all open positions
    for (const position of this.openPositions.values()) {
      if (position.currentPrice) {
        const pnl = this.calculatePnl(
          position.entryPrice,
          position.currentPrice,
          position.quantity,
          position.signal.side,
          position.signal.symbol
        );
        unrealizedPnl += pnl;
      }
    }

    // Equity = Balance + Unrealized P&L
    // Balance = Initial Balance + Realized P&L (from closed trades)
    // Unrealized P&L = Current profit/loss on open positions (not yet closed)
    // Margin = Locked funds for open positions (already deducted from available balance)
    this.equity = this.balance + unrealizedPnl;
    
    // Ensure equity doesn't go below 0
    if (this.equity < 0) {
      this.equity = 0;
    }
    
    // Ensure equity is at least equal to margin (can't have negative free margin)
    if (this.equity < this.margin) {
      this.equity = this.margin;
    }
  }

  getBalance(): AccountBalance {
    // Recalculate equity to ensure it's up to date
    this.recalculateEquity();
    
    const freeMargin = Math.max(0, this.equity - this.margin);
    
    return {
      balance: this.balance,
      equity: this.equity,
      margin: this.margin,
      freeMargin: freeMargin,
      marginLevel: this.margin > 0 ? (this.equity / this.margin) * 100 : 0,
      currency: 'USD',
    };
  }

  async reset(initialBalance: number): Promise<void> {
    this.initialBalance = initialBalance;
    this.balance = initialBalance;
    this.equity = initialBalance;
    this.margin = 0;
    this.trades = [];
    this.openPositions.clear();

    // Reset in database
    if (this.accountId) {
      try {
        await DemoAccount.findByIdAndUpdate(this.accountId, {
          balance: initialBalance,
          equity: initialBalance,
          margin: 0,
          freeMargin: initialBalance,
          initialBalance: initialBalance,
          totalProfitLoss: 0,
          totalTrades: 0,
          winningTrades: 0,
          losingTrades: 0,
        });
      } catch (error) {
        console.error('Error resetting demo account:', error);
      }
    }
  }

  getHistory(): TradeResult[] {
    return [...this.trades];
  }

  getOpenPositions(): Array<{ tradeId: string; position: any }> {
    return Array.from(this.openPositions.entries()).map(([tradeId, position]) => ({
      tradeId,
      position: {
        symbol: position.signal.symbol,
        side: position.signal.side,
        entryPrice: position.entryPrice,
        quantity: position.quantity,
        openedAt: position.entryTime,
      },
    }));
  }
}



