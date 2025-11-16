'use server';

import { connectToDatabase } from '@/database/mongoose';
import { BotTrade } from '@/database/models/bot-trade.model';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';

type ActionResult<T = undefined> = T extends undefined
  ? { success: boolean; error?: string }
  : { success: boolean; data?: T; error?: string };

async function requireUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  return session.user;
}

/**
 * Get bot trading analytics and performance metrics
 */
export async function getBotAnalytics(): Promise<ActionResult<any>> {
  try {
    const user = await requireUser();
    await connectToDatabase();

    const trades = await BotTrade.find({ userId: user.id }).lean();

    // Calculate metrics
    const totalTrades = trades.length;
    const closedTrades = trades.filter((t) => t.status === 'CLOSED');
    const activeTrades = trades.filter((t) => t.status === 'PENDING' || t.status === 'FILLED');
    const winningTrades = closedTrades.filter((t) => (t.profitLoss || 0) > 0);
    const losingTrades = closedTrades.filter((t) => (t.profitLoss || 0) < 0);

    const totalProfitLoss = trades.reduce((sum, t) => sum + (t.profitLoss || 0), 0);
    const totalProfitLossPct = closedTrades.length > 0
      ? closedTrades.reduce((sum, t) => sum + (t.profitLossPct || 0), 0) / closedTrades.length
      : 0;

    const winRate = closedTrades.length > 0
      ? (winningTrades.length / closedTrades.length) * 100
      : 0;

    const avgWin = winningTrades.length > 0
      ? winningTrades.reduce((sum, t) => sum + (t.profitLoss || 0), 0) / winningTrades.length
      : 0;

    const avgLoss = losingTrades.length > 0
      ? losingTrades.reduce((sum, t) => sum + Math.abs(t.profitLoss || 0), 0) / losingTrades.length
      : 0;

    const profitFactor = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? Infinity : 0;

    // Calculate by time period
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const trades24h = trades.filter((t) => new Date(t.createdAt) >= last24h);
    const trades7d = trades.filter((t) => new Date(t.createdAt) >= last7d);
    const trades30d = trades.filter((t) => new Date(t.createdAt) >= last30d);

    const profitLoss24h = trades24h.reduce((sum, t) => sum + (t.profitLoss || 0), 0);
    const profitLoss7d = trades7d.reduce((sum, t) => sum + (t.profitLoss || 0), 0);
    const profitLoss30d = trades30d.reduce((sum, t) => sum + (t.profitLoss || 0), 0);

    // Calculate by symbol
    const tradesBySymbol: Record<string, { count: number; profitLoss: number }> = {};
    trades.forEach((trade) => {
      if (!tradesBySymbol[trade.symbol]) {
        tradesBySymbol[trade.symbol] = { count: 0, profitLoss: 0 };
      }
      tradesBySymbol[trade.symbol].count++;
      tradesBySymbol[trade.symbol].profitLoss += trade.profitLoss || 0;
    });

    const topSymbols = Object.entries(tradesBySymbol)
      .map(([symbol, data]) => ({ symbol, ...data }))
      .sort((a, b) => b.profitLoss - a.profitLoss)
      .slice(0, 5);

    return {
      success: true,
      data: {
        overview: {
          totalTrades,
          closedTrades: closedTrades.length,
          activeTrades: activeTrades.length,
          winningTrades: winningTrades.length,
          losingTrades: losingTrades.length,
        },
        performance: {
          totalProfitLoss,
          totalProfitLossPct,
          winRate,
          avgWin,
          avgLoss,
          profitFactor,
        },
        timePeriods: {
          last24h: {
            trades: trades24h.length,
            profitLoss: profitLoss24h,
          },
          last7d: {
            trades: trades7d.length,
            profitLoss: profitLoss7d,
          },
          last30d: {
            trades: trades30d.length,
            profitLoss: profitLoss30d,
          },
        },
        topSymbols,
      },
    };
  } catch (error: any) {
    console.error('getBotAnalytics error:', error);
    return { success: false, error: error.message || 'Failed to fetch analytics' };
  }
}

/**
 * Get trade history with pagination
 */
export async function getTradeHistory(filters?: {
  status?: string;
  symbol?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}): Promise<ActionResult<any[]>> {
  try {
    const user = await requireUser();
    await connectToDatabase();

    const query: any = { userId: user.id };

    if (filters?.status) {
      query.status = filters.status;
    }

    if (filters?.symbol) {
      query.symbol = filters.symbol.toUpperCase();
    }

    if (filters?.startDate || filters?.endDate) {
      query.createdAt = {};
      if (filters.startDate) {
        query.createdAt.$gte = filters.startDate;
      }
      if (filters.endDate) {
        query.createdAt.$lte = filters.endDate;
      }
    }

    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;

    const trades = await BotTrade.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(offset)
      .lean();

    return {
      success: true,
      data: trades.map((trade) => ({
        tradeId: trade.tradeId,
        signalId: trade.signalId,
        symbol: trade.symbol,
        action: trade.action,
        entryPrice: trade.entryPrice,
        exitPrice: trade.exitPrice,
        status: trade.status,
        profitLoss: trade.profitLoss,
        profitLossPct: trade.profitLossPct,
        quantity: trade.quantity,
        createdAt: trade.createdAt,
        filledAt: trade.filledAt,
        closedAt: trade.closedAt,
      })),
    };
  } catch (error: any) {
    console.error('getTradeHistory error:', error);
    return { success: false, error: error.message || 'Failed to fetch trade history' };
  }
}


