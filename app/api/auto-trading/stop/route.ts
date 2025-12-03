/**
 * Stop Auto-Trade API
 * Stops the auto-trading engine
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { botManager } from '@/lib/services/bot-manager.service';

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const body = await request.json();
    const { botId } = body;

    if (!botId) {
      return NextResponse.json(
        { success: false, error: 'Missing botId' },
        { status: 400 }
      );
    }

    // Stop bot
    const stopped = botManager.stopBot(userId, botId);
    
    if (!stopped) {
      return NextResponse.json(
        { success: false, error: 'Bot not found or already stopped' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Auto-trade stopped successfully',
      data: {
        stoppedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Error stopping auto-trade:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to stop auto-trade' },
      { status: 500 }
    );
  }
}

