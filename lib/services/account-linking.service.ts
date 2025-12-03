/**
 * Account Linking Service
 * Automatically links broker account after quick connect and fetches all account data
 */

import { IBrokerAdapter } from '@/lib/auto-trading/interfaces';
import { AccountBalance, Position } from '@/lib/auto-trading/types';
import { PaperTrader } from '@/lib/auto-trading/paper-trader/PaperTrader';
import { BotTrade } from '@/database/models/bot-trade.model';
import { connectToDatabase } from '@/database/mongoose';

export interface AccountData {
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  currency: string;
  openTrades: Array<{
    id: string;
    symbol: string;
    side: 'BUY' | 'SELL';
    entryPrice: number;
    quantity: number;
    currentPrice: number;
    unrealizedPnl: number;
    status: 'OPEN' | 'PENDING';
    openedAt: Date;
  }>;
  historicalTrades: Array<{
    id: string;
    symbol: string;
    side: 'BUY' | 'SELL';
    entryPrice: number;
    exitPrice: number;
    quantity: number;
    profitLoss: number;
    status: 'CLOSED' | 'STOPPED';
    openedAt: Date;
    closedAt: Date;
  }>;
}

export class AccountLinkingService {
  private readonly MT5_SERVICE_URL = process.env.MT5_SERVICE_URL || 'http://localhost:5000';

  /**
   * Check if adapter is an MT5 connection object
   */
  private isMT5Connection(adapter: any): adapter is { type: 'mt5'; connectionId: string; login: string; server: string } {
    return adapter && typeof adapter === 'object' && adapter.type === 'mt5' && adapter.connectionId;
  }

  /**
   * Fetch account data from MT5 service
   */
  private async getMT5AccountData(connectionId: string): Promise<AccountData> {
    try {
      // Fetch account info from MT5 service
      const accountResponse = await fetch(`${this.MT5_SERVICE_URL}/account?connection_id=${connectionId}`);
      const accountInfo = await accountResponse.json();

      if (!accountInfo.success || !accountInfo.account) {
        throw new Error(accountInfo.error || 'Failed to fetch MT5 account info');
      }

      // Fetch open positions from MT5 service
      let openTrades: AccountData['openTrades'] = [];
      try {
        const openTradesResponse = await fetch(`${this.MT5_SERVICE_URL}/trades/open?connection_id=${connectionId}`);
        const openTradesData = await openTradesResponse.json();
        
        if (openTradesData.success && openTradesData.positions) {
          openTrades = openTradesData.positions.map((pos: any) => ({
            id: pos.ticket?.toString() || pos.position_id?.toString() || `pos-${Date.now()}`,
            symbol: pos.symbol || 'UNKNOWN',
            side: pos.type === 0 ? 'BUY' : 'SELL',
            entryPrice: pos.price_open || 0,
            quantity: pos.volume || 0,
            currentPrice: pos.price_current || pos.price_open || 0,
            unrealizedPnl: pos.profit || 0,
            status: 'OPEN' as const,
            openedAt: pos.time ? new Date(pos.time * 1000) : new Date(),
          }));
        }
      } catch (error) {
        console.error('Error fetching MT5 open trades:', error);
        // Continue without open trades
      }

      const account = accountInfo.account;
      return {
        balance: account.balance || 0,
        equity: account.equity || 0,
        margin: account.margin || 0,
        freeMargin: account.free_margin || 0,
        currency: account.currency || 'USD',
        openTrades,
        historicalTrades: [], // Historical trades will be fetched from database
      };
    } catch (error: any) {
      console.error('Error fetching MT5 account data:', error);
      throw error;
    }
  }

  /**
   * Link account and fetch all data
   */
  async linkAccount(
    userId: string,
    broker: 'exness' | 'deriv',
    adapter: IBrokerAdapter | any | null
  ): Promise<AccountData> {
    // For Exness, check if it's an MT5 connection
    if (broker === 'exness' && this.isMT5Connection(adapter)) {
      try {
        const accountData = await this.getMT5AccountData(adapter.connectionId);
        // Fetch historical trades from database
        accountData.historicalTrades = await this.getHistoricalTrades(userId, broker);
        return accountData;
      } catch (error: any) {
        console.error(`Error linking MT5 account for Exness:`, error);
        // Fallback to demo account on error
        return this.getDemoAccountData(userId, broker);
      }
    }

    // If no adapter OR adapter is in paper trading mode, use PaperTrader
    if (!adapter || (adapter && typeof adapter === 'object' && 'isPaperTrading' in adapter && adapter.isPaperTrading())) {
      return this.getDemoAccountData(userId, broker);
    }

    // Live trading mode - use adapter directly (for Deriv)
    try {
      // Fetch balance from live adapter
      const balance = await adapter.getBalance();

      // Fetch open positions from live adapter
      const openPositions = await adapter.getOpenPositions();

      // Map positions to account data format
      const openTrades = openPositions.map((pos) => ({
        id: pos.positionId,
        symbol: pos.symbol,
        side: pos.side,
        entryPrice: pos.entryPrice,
        quantity: pos.quantity,
        currentPrice: pos.currentPrice,
        unrealizedPnl: pos.unrealizedPnl || 0,
        status: (pos.status === 'OPEN' ? 'OPEN' : 'PENDING') as 'OPEN' | 'PENDING',
        openedAt: pos.openedAt,
      }));

      // Fetch historical trades from database
      const historicalTrades = await this.getHistoricalTrades(userId, broker);

      return {
        balance: balance.balance,
        equity: balance.equity,
        margin: balance.margin,
        freeMargin: balance.freeMargin,
        currency: balance.currency,
        openTrades,
        historicalTrades,
      };
    } catch (error: any) {
      console.error(`Error linking live account for ${broker}:`, error);
      // Fallback to demo account on error
      return this.getDemoAccountData(userId, broker);
    }
  }

  /**
   * Get demo account data (uses PaperTrader)
   */
  private async getDemoAccountData(
    userId: string,
    broker: 'exness' | 'deriv'
  ): Promise<AccountData> {
    try {
      const paperTrader = new PaperTrader(userId, broker, 10000);
      await paperTrader.initialize();

      const balance = paperTrader.getBalance();
      const openPositions = paperTrader.getOpenPositions();

      // PaperTrader returns: { tradeId, position: { symbol, side, entryPrice, quantity, openedAt } }
      const openTrades = openPositions.map((pos) => ({
        id: pos.tradeId,
        symbol: pos.position.symbol,
        side: pos.position.side,
        entryPrice: pos.position.entryPrice,
        quantity: pos.position.quantity,
        currentPrice: pos.position.entryPrice, // Use entryPrice initially (will be updated with market data)
        unrealizedPnl: 0, // Will be calculated when market data is available
        status: 'OPEN' as const,
        openedAt: pos.position.openedAt || new Date(),
      }));

      const historicalTrades = await this.getHistoricalTrades(userId, broker);

      return {
        balance: balance.balance,
        equity: balance.equity,
        margin: balance.margin,
        freeMargin: balance.freeMargin,
        currency: 'USD',
        openTrades,
        historicalTrades,
      };
    } catch (error: any) {
      console.error(`Error getting demo account data for ${broker}:`, error);
      // Return default demo account on error
      return {
        balance: 10000,
        equity: 10000,
        margin: 0,
        freeMargin: 10000,
        currency: 'USD',
        openTrades: [],
        historicalTrades: [],
      };
    }
  }

  /**
   * Get historical trades from database
   */
  private async getHistoricalTrades(
    userId: string,
    broker: 'exness' | 'deriv'
  ): Promise<AccountData['historicalTrades']> {
    try {
      await connectToDatabase();
      
      // Map broker name to exchange name for database query
      const exchange = broker; // Use broker name directly or map as needed
      
      // Fetch closed trades from database
      const closedTrades = await BotTrade.find({
        userId,
        $or: [
          { exchange: exchange },
          { exchange: broker }, // Also check broker name
        ],
        status: { $in: ['CLOSED', 'FILLED'] },
        exitPrice: { $exists: true, $ne: null },
        closedAt: { $exists: true, $ne: null },
      })
        .sort({ closedAt: -1 })
        .limit(100) // Get last 100 closed trades
        .lean();

      // Map database trades to account data format
      return closedTrades.map((trade) => ({
        id: trade.tradeId,
        symbol: trade.symbol,
        side: trade.action,
        entryPrice: trade.entryPrice,
        exitPrice: trade.exitPrice || trade.entryPrice,
        quantity: trade.quantity,
        profitLoss: trade.profitLoss || 0,
        status: (trade.status === 'CLOSED' ? 'CLOSED' : 'STOPPED') as 'CLOSED' | 'STOPPED',
        openedAt: trade.createdAt || trade.filledAt || new Date(),
        closedAt: trade.closedAt || new Date(),
      }));
    } catch (error: any) {
      console.error(`Error fetching historical trades for ${broker}:`, error);
      // Return empty array on error
      return [];
    }
  }

  /**
   * Sync account data periodically
   */
  async syncAccountData(
    userId: string,
    broker: 'exness' | 'deriv',
    adapter: IBrokerAdapter | any | null
  ): Promise<Partial<AccountData>> {
    try {
      // For Exness, check if it's an MT5 connection
      if (broker === 'exness' && this.isMT5Connection(adapter)) {
        try {
          const accountData = await this.getMT5AccountData(adapter.connectionId);
          return {
            balance: accountData.balance,
            equity: accountData.equity,
            margin: accountData.margin,
            freeMargin: accountData.freeMargin,
            openTrades: accountData.openTrades,
          };
        } catch (error: any) {
          console.error(`Error syncing MT5 account data:`, error);
          return {};
        }
      }

      // If no adapter or in paper trading mode, use PaperTrader
      if (!adapter || (adapter && typeof adapter === 'object' && 'isPaperTrading' in adapter && adapter.isPaperTrading())) {
        const paperTrader = new PaperTrader(userId, broker, 10000);
        await paperTrader.initialize();
        const balance = paperTrader.getBalance();
        const openPositions = paperTrader.getOpenPositions();

        return {
          balance: balance.balance,
          equity: balance.equity,
          margin: balance.margin,
          freeMargin: balance.freeMargin,
          openTrades: openPositions.map((pos) => ({
            id: pos.tradeId,
            symbol: pos.position.symbol,
            side: pos.position.side,
            entryPrice: pos.position.entryPrice,
            quantity: pos.position.quantity,
            currentPrice: pos.position.entryPrice,
            unrealizedPnl: 0,
            status: 'OPEN' as const,
            openedAt: pos.position.openedAt || new Date(),
          })),
        };
      }

      // Live trading mode (for Deriv)
      const balance = await adapter.getBalance();
      const openPositions = await adapter.getOpenPositions();

      return {
        balance: balance.balance,
        equity: balance.equity,
        margin: balance.margin,
        freeMargin: balance.freeMargin,
        openTrades: openPositions.map((pos) => ({
          id: pos.positionId,
          symbol: pos.symbol,
          side: pos.side,
          entryPrice: pos.entryPrice,
          quantity: pos.quantity,
          currentPrice: pos.currentPrice,
          unrealizedPnl: pos.unrealizedPnl || 0,
          status: (pos.status === 'OPEN' ? 'OPEN' : 'PENDING') as 'OPEN' | 'PENDING',
          openedAt: pos.openedAt,
        })),
      };
    } catch (error: any) {
      console.error(`Error syncing account data for ${broker}:`, error);
      return {};
    }
  }
}

export const accountLinkingService = new AccountLinkingService();
