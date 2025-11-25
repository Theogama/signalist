/**
 * Stop Bot API
 * POST: Stop the trading bot
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

    const body = await request.json().catch(() => ({}));
    const { botId } = body;

    const userId = session.user.id;

    // If botId not provided, stop all user bots
    if (!botId) {
      const userBots = botManager.getUserBots(userId);
      if (userBots.length === 0) {
        return NextResponse.json(
          { success: false, error: 'No active bots found' },
          { status: 404 }
        );
      }
      
      // Stop all bots
      const stoppedBots = userBots.map(bot => {
        botManager.stopBot(userId, bot.botId);
        return bot.botId;
      });

      return NextResponse.json({
        success: true,
        message: 'All bots stopped successfully',
        data: {
          stoppedBots,
          stoppedAt: new Date().toISOString(),
        },
      });
    }

    // Stop the specific bot
    const stopped = botManager.stopBot(userId, botId);

    if (!stopped) {
      return NextResponse.json(
        { success: false, error: 'Bot not found or not running' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Bot stopped successfully',
      data: {
        botId,
        stoppedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Error stopping bot:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to stop bot' },
      { status: 500 }
    );
  }
}



