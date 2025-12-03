/**
 * Bot Status API
 * GET: Get current bot status
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { botManager } from '@/lib/signalist-bot/engine/bot-manager';

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    const status = botManager.getBotStatus(userId);
    const isRunning = botManager.isBotRunning(userId);

    return NextResponse.json({
      success: true,
      isRunning,
      status: status || null,
    });
  } catch (error: any) {
    console.error('[Bot Status API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get bot status' },
      { status: 500 }
    );
  }
}

