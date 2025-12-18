/**
 * GET /api/deriv/positions
 * Get open positions and trade history from Deriv
 * Fetches from database and optionally syncs with Deriv API
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { connectToDatabase } from '@/database/mongoose';
import { SignalistBotTrade } from '@/database/models/signalist-bot-trade.model';

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const { searchParams } = new URL(request.url);
    const sync = searchParams.get('sync') === 'true'; // Optional: sync with Deriv API

    await connectToDatabase();

    // Fetch open trades (status: OPEN)
    const openTrades = await SignalistBotTrade.find({
      userId,
      broker: 'deriv',
      status: 'OPEN',
    })
      .sort({ entryTimestamp: -1 })
      .lean();

    // Fetch closed trades (status: CLOSED, TP_HIT, SL_HIT, etc.)
    const closedTrades = await SignalistBotTrade.find({
      userId,
      broker: 'deriv',
      status: { $in: ['CLOSED', 'TP_HIT', 'SL_HIT', 'MANUAL_CLOSE'] },
    })
      .sort({ exitTimestamp: -1 })
      .limit(50)
      .lean();

    // Format trades for frontend
    const formattedOpenTrades = openTrades.map((trade) => ({
      id: trade.tradeId,
      symbol: trade.symbol,
      side: trade.side,
      entryPrice: trade.entryPrice,
      exitPrice: trade.exitPrice || trade.entryPrice, // Use entryPrice as current price if not closed
      quantity: trade.lotOrStake,
      profitLoss: trade.unrealizedPnl || 0,
      status: 'OPEN' as const,
      openedAt: trade.entryTimestamp,
      brokerTradeId: trade.brokerTradeId,
    }));

    const formattedClosedTrades = closedTrades.map((trade) => ({
      id: trade.tradeId,
      symbol: trade.symbol,
      side: trade.side,
      entryPrice: trade.entryPrice,
      exitPrice: trade.exitPrice || trade.entryPrice,
      quantity: trade.lotOrStake,
      profitLoss: trade.realizedPnl || 0,
      status: trade.status === 'TP_HIT' ? 'CLOSED' as const :
              trade.status === 'SL_HIT' ? 'STOPPED' as const :
              'CLOSED' as const,
      openedAt: trade.entryTimestamp,
      closedAt: trade.exitTimestamp || trade.updatedAt,
      brokerTradeId: trade.brokerTradeId,
    }));

    // Calculate account metrics
    const totalProfitLoss = formattedClosedTrades.reduce((sum, t) => sum + (t.profitLoss || 0), 0);
    const runningPL = formattedOpenTrades.reduce((sum, t) => {
      const pl = t.profitLoss || 0;
      return sum + pl;
    }, 0);

    return NextResponse.json({
      success: true,
      data: {
        openTrades: formattedOpenTrades,
        closedTrades: formattedClosedTrades,
        metrics: {
          totalProfitLoss,
          runningPL,
          totalTrades: formattedClosedTrades.length,
          openPositions: formattedOpenTrades.length,
          wins: formattedClosedTrades.filter(t => (t.profitLoss || 0) > 0).length,
          losses: formattedClosedTrades.filter(t => (t.profitLoss || 0) <= 0).length,
        },
      },
    });
  } catch (error: any) {
    console.error('[Deriv Positions API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch positions' },
      { status: 500 }
    );
  }
}



