/**
 * Open Trades API
 * GET: Get open trades
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

    const query: any = { userId, status: 'OPEN' };
    if (broker) query.broker = broker;
    if (symbol) query.symbol = symbol;

    const trades = await SignalistBotTrade.find(query).sort({ entryTimestamp: -1 });

    return NextResponse.json({
      success: true,
      trades,
    });
  } catch (error: any) {
    console.error('[Open Trades API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get open trades' },
      { status: 500 }
    );
  }
}

