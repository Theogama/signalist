/**
 * Stop Bot API
 * POST: Stop the trading bot
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { botManager } from '@/lib/signalist-bot/engine/bot-manager';

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await request.json();
    const reason = body.reason || 'Manual stop';

    const stopped = await botManager.stopBot(userId, reason);

    if (!stopped) {
      return NextResponse.json(
        { success: false, error: 'Bot is not running' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Bot stopped successfully',
    });
  } catch (error: any) {
    console.error('[Stop Bot API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to stop bot' },
      { status: 500 }
    );
  }
}








