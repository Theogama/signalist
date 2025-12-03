/**
 * Bot Status API
 * GET: Get current bot and broker connection status
 * Used to restore state after page refresh
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { botManager } from '@/lib/services/bot-manager.service';
import { sessionManager } from '@/lib/auto-trading/session-manager/SessionManager';

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

    // Get active bots
    const activeBots = botManager.getUserBots(userId);
    
    // Get broker connections from sessions
    const sessions = sessionManager.getUserSessions(userId);
    const connectedBrokers: Array<{
      broker: 'exness' | 'deriv' | 'demo';
      sessionId: string;
      instrument?: string;
      paperTrading: boolean;
    }> = [];

    sessions.forEach(session => {
      if (session.isRunning) {
        connectedBrokers.push({
          broker: session.broker,
          sessionId: session.sessionId,
          instrument: session.instrument,
          paperTrading: session.paperTrading,
        });
      }
    });

    // Get bot details
    const botDetails = activeBots.map(bot => ({
      botId: bot.botId,
      instrument: bot.instrument,
      broker: bot.broker || 'demo',
      isRunning: bot.isRunning,
      startedAt: bot.startedAt,
      parameters: bot.parameters,
    }));

    return NextResponse.json({
      success: true,
      data: {
        activeBots: botDetails,
        connectedBrokers: connectedBrokers.length > 0 ? connectedBrokers : null,
        hasActiveBot: activeBots.length > 0,
        hasConnectedBroker: connectedBrokers.length > 0,
      },
    });
  } catch (error: any) {
    console.error('Error fetching bot status:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch status' },
      { status: 500 }
    );
  }
}
