/**
 * GET /api/deriv/auto-trading/trades
 * Get trading history
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
    const status = searchParams.get('status'); // 'OPEN', 'CLOSED', etc.
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    await connectToDatabase();

    const query: any = { userId, broker: 'deriv' };
    if (status) {
      query.status = status;
    }

    const trades = await SignalistBotTrade.find(query)
      .sort({ entryTimestamp: -1 })
      .limit(limit)
      .skip(offset);

    const total = await SignalistBotTrade.countDocuments(query);

    return NextResponse.json({
      success: true,
      data: {
        trades: trades.map(t => ({
          tradeId: t.tradeId,
          symbol: t.symbol,
          side: t.side,
          entryPrice: t.entryPrice,
          exitPrice: t.exitPrice,
          lotOrStake: t.lotOrStake,
          status: t.status,
          realizedPnl: t.realizedPnl,
          realizedPnlPercent: t.realizedPnlPercent,
          unrealizedPnl: t.unrealizedPnl,
          unrealizedPnlPercent: t.unrealizedPnlPercent,
          entryTimestamp: t.entryTimestamp,
          exitTimestamp: t.exitTimestamp,
          entryReason: t.entryReason,
          exitReason: t.exitReason,
        })),
        total,
        limit,
        offset,
      },
    });
  } catch (error: any) {
    console.error('[Trades API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get trades' },
      { status: 500 }
    );
  }
}



