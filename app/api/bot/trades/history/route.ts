/**
 * Trade History API
 * GET: Get closed trades history
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
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const userId = session.user.id;
    const searchParams = request.nextUrl.searchParams;
    const broker = searchParams.get('broker');
    const symbol = searchParams.get('symbol');
    const limit = parseInt(searchParams.get('limit') || '100');
    const fromDate = searchParams.get('fromDate') ? new Date(searchParams.get('fromDate')!) : undefined;
    const toDate = searchParams.get('toDate') ? new Date(searchParams.get('toDate')!) : undefined;

    const query: any = {
      userId,
      status: { $in: ['CLOSED', 'TP_HIT', 'SL_HIT', 'REVERSE_SIGNAL', 'MANUAL_CLOSE', 'FORCE_STOP'] },
    };
    if (broker) query.broker = broker;
    if (symbol) query.symbol = symbol;
    if (fromDate || toDate) {
      query.entryTimestamp = {};
      if (fromDate) query.entryTimestamp.$gte = fromDate;
      if (toDate) query.entryTimestamp.$lte = toDate;
    }

    const trades = await SignalistBotTrade.find(query)
      .sort({ exitTimestamp: -1 })
      .limit(limit);

    return NextResponse.json({
      success: true,
      trades,
    });
  } catch (error: any) {
    console.error('[Trade History API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get trade history' },
      { status: 500 }
    );
  }
}


