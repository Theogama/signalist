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
    const body = await request.json().catch(() => ({}));
    const { botId } = body;

    if (!botId) {
      return NextResponse.json(
        { success: false, error: 'Missing botId' },
        { status: 400 }
      );
    }

    // Check if bot exists before trying to stop
    const activeBot = botManager.getActiveBot(userId, botId);
    
    // If bot doesn't exist, check if there are any active bots for this user
    if (!activeBot) {
      const userBots = botManager.getUserBots(userId);
      
      // If no active bots at all, the bot is already stopped (success case)
      if (userBots.length === 0) {
        return NextResponse.json({
          success: true,
          message: 'Bot is already stopped',
          data: {
            botId,
            stoppedAt: new Date().toISOString(),
            alreadyStopped: true,
          },
        });
      }
      
      // Bot not found but other bots exist - return error
      return NextResponse.json(
        { success: false, error: `Bot "${botId}" not found. Active bots: ${userBots.map(b => b.botId).join(', ')}` },
        { status: 404 }
      );
    }

    // Stop bot
    const stopped = botManager.stopBot(userId, botId);
    
    if (!stopped) {
      // This shouldn't happen if we found the bot, but handle it gracefully
      return NextResponse.json({
        success: true,
        message: 'Bot was already stopping or stopped',
        data: {
          botId,
          stoppedAt: new Date().toISOString(),
        },
      });
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


