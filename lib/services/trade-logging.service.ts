/**
 * Trade Logging Service
 * 
 * Centralized service for logging trades executed by bots.
 * Works with both demo and live modes.
 * 
 * Features:
 * - Log bot ID with each trade
 * - Track trade results (win/loss)
 * - Store stake and profit/loss
 * - Timestamp tracking
 * - Demo & Live mode compatible
 */

import { connectToDatabase } from '@/database/mongoose';
import { SignalistBotTrade } from '@/database/models/signalist-bot-trade.model';
import { randomUUID } from 'crypto';

/**
 * Trade Log Entry
 */
export interface TradeLogEntry {
  tradeId: string;
  userId: string;
  botId: string;
  broker: 'exness' | 'deriv';
  symbol: string;
  side: 'BUY' | 'SELL';
  stake: number;
  entryPrice: number;
  exitPrice?: number;
  profitLoss?: number;
  profitLossPercent?: number;
  status: 'OPEN' | 'CLOSED' | 'TP_HIT' | 'SL_HIT' | 'REVERSE_SIGNAL' | 'MANUAL_CLOSE' | 'FORCE_STOP';
  entryTimestamp: Date;
  exitTimestamp?: Date;
  entryReason?: string;
  exitReason?: string;
  isDemo?: boolean;
}

/**
 * Trade Result
 */
export interface TradeResult {
  success: boolean;
  tradeId: string;
  profitLoss: number;
  profitLossPercent: number;
  status: 'won' | 'lost' | 'open';
}

/**
 * Trade Logging Service
 */
export class TradeLoggingService {
  /**
   * Log a new trade
   */
  async logTrade(entry: Omit<TradeLogEntry, 'tradeId' | 'entryTimestamp'> & { brokerTradeId?: string }): Promise<string> {
    await connectToDatabase();

    const tradeId = randomUUID();
    const trade = new SignalistBotTrade({
      tradeId,
      userId: entry.userId,
      botId: entry.botId,
      broker: entry.broker,
      symbol: entry.symbol,
      side: entry.side,
      entryPrice: entry.entryPrice,
      exitPrice: entry.exitPrice,
      lotOrStake: entry.stake,
      stopLoss: 0, // Deriv contracts don't use traditional stop loss
      takeProfit: 0, // Deriv contracts don't use traditional take profit
      status: entry.status,
      realizedPnl: entry.profitLoss,
      realizedPnlPercent: entry.profitLossPercent,
      entryReason: entry.entryReason || `Bot: ${entry.botId}`,
      exitReason: entry.exitReason,
      entryTimestamp: entry.entryTimestamp || new Date(),
      exitTimestamp: entry.exitTimestamp,
      brokerTradeId: entry.brokerTradeId,
      isDemo: entry.isDemo || false,
    });

    await trade.save();

    console.log(`[TradeLogging] Trade logged: ${tradeId} | Bot: ${entry.botId} | Stake: ${entry.stake} | Status: ${entry.status}`);

    return tradeId;
  }

  /**
   * Update trade with result
   */
  async updateTradeResult(
    tradeId: string,
    result: {
      exitPrice?: number;
      profitLoss: number;
      profitLossPercent: number;
      status: 'CLOSED' | 'TP_HIT' | 'SL_HIT' | 'MANUAL_CLOSE' | 'FORCE_STOP';
      exitReason?: string;
    }
  ): Promise<boolean> {
    await connectToDatabase();

    try {
      const trade = await SignalistBotTrade.findOne({ tradeId });
      if (!trade) {
        console.warn(`[TradeLogging] Trade not found: ${tradeId}`);
        return false;
      }

      trade.exitPrice = result.exitPrice;
      trade.exitTimestamp = new Date();
      trade.realizedPnl = result.profitLoss;
      trade.realizedPnlPercent = result.profitLossPercent;
      trade.status = result.status;
      trade.exitReason = result.exitReason;

      await trade.save();

      console.log(`[TradeLogging] Trade updated: ${tradeId} | P/L: ${result.profitLoss.toFixed(2)} | Status: ${result.status}`);

      return true;
    } catch (error: any) {
      console.error(`[TradeLogging] Error updating trade ${tradeId}:`, error);
      return false;
    }
  }

  /**
   * Log trade result (convenience method)
   */
  async logTradeResult(
    userId: string,
    botId: string,
    broker: 'exness' | 'deriv',
    symbol: string,
    side: 'BUY' | 'SELL',
    stake: number,
    entryPrice: number,
    result: TradeResult,
    isDemo: boolean = false
  ): Promise<string> {
    const status = result.status === 'won' ? 'TP_HIT' : result.status === 'lost' ? 'SL_HIT' : 'OPEN';

    return this.logTrade({
      userId,
      botId,
      broker,
      symbol,
      side,
      stake,
      entryPrice,
      exitPrice: entryPrice, // Will be updated when trade closes
      profitLoss: result.profitLoss,
      profitLossPercent: result.profitLossPercent,
      status,
      entryTimestamp: new Date(),
      isDemo,
      entryReason: `Bot: ${botId}`,
      exitReason: result.status === 'won' ? 'Take profit' : result.status === 'lost' ? 'Stop loss' : undefined,
    });
  }

  /**
   * Get trades for a bot
   */
  async getBotTrades(
    userId: string,
    botId: string,
    filters?: {
      status?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    }
  ): Promise<TradeLogEntry[]> {
    await connectToDatabase();

    const query: any = {
      userId,
      botId,
    };

    if (filters?.status) {
      query.status = filters.status;
    }

    if (filters?.startDate || filters?.endDate) {
      query.entryTimestamp = {};
      if (filters.startDate) {
        query.entryTimestamp.$gte = filters.startDate;
      }
      if (filters.endDate) {
        query.entryTimestamp.$lte = filters.endDate;
      }
    }

    const limit = filters?.limit || 100;
    const offset = filters?.offset || 0;

    const trades = await SignalistBotTrade.find(query)
      .sort({ entryTimestamp: -1 })
      .limit(limit)
      .skip(offset)
      .lean();

    return trades.map((trade) => ({
      tradeId: trade.tradeId,
      userId: trade.userId,
      botId: trade.botId || '',
      broker: trade.broker,
      symbol: trade.symbol,
      side: trade.side,
      stake: trade.lotOrStake,
      entryPrice: trade.entryPrice,
      exitPrice: trade.exitPrice,
      profitLoss: trade.realizedPnl,
      profitLossPercent: trade.realizedPnlPercent,
      status: trade.status,
      entryTimestamp: trade.entryTimestamp,
      exitTimestamp: trade.exitTimestamp,
      entryReason: trade.entryReason,
      exitReason: trade.exitReason,
      isDemo: trade.isDemo || false,
    }));
  }

  /**
   * Get all trades for a user
   */
  async getUserTrades(
    userId: string,
    filters?: {
      botId?: string;
      status?: string;
      isDemo?: boolean;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    }
  ): Promise<TradeLogEntry[]> {
    await connectToDatabase();

    const query: any = { userId };

    if (filters?.botId) {
      query.botId = filters.botId;
    }

    if (filters?.status) {
      query.status = filters.status;
    }

    if (filters?.isDemo !== undefined) {
      query.isDemo = filters.isDemo;
    }

    if (filters?.startDate || filters?.endDate) {
      query.entryTimestamp = {};
      if (filters.startDate) {
        query.entryTimestamp.$gte = filters.startDate;
      }
      if (filters.endDate) {
        query.entryTimestamp.$lte = filters.endDate;
      }
    }

    const limit = filters?.limit || 100;
    const offset = filters?.offset || 0;

    const trades = await SignalistBotTrade.find(query)
      .sort({ entryTimestamp: -1 })
      .limit(limit)
      .skip(offset)
      .lean();

    return trades.map((trade) => ({
      tradeId: trade.tradeId,
      userId: trade.userId,
      botId: trade.botId || '',
      broker: trade.broker,
      symbol: trade.symbol,
      side: trade.side,
      stake: trade.lotOrStake,
      entryPrice: trade.entryPrice,
      exitPrice: trade.exitPrice,
      profitLoss: trade.realizedPnl,
      profitLossPercent: trade.realizedPnlPercent,
      status: trade.status,
      entryTimestamp: trade.entryTimestamp,
      exitTimestamp: trade.exitTimestamp,
      entryReason: trade.entryReason,
      exitReason: trade.exitReason,
      isDemo: trade.isDemo || false,
    }));
  }
}

// Singleton instance
export const tradeLoggingService = new TradeLoggingService();

