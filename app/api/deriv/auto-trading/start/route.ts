/**
 * POST /api/deriv/auto-trading/start
 * Start auto-trading session
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { connectToDatabase } from '@/database/mongoose';
import { AutoTradingSession } from '@/database/models/auto-trading-session.model';
import { getAutoTradingService, stopAutoTradingService } from '@/lib/services/deriv-auto-trading.service';
import { SignalistBotSettings } from '@/database/models/signalist-bot-settings.model';

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
    const {
      strategy = 'Signalist-SMA-3C',
      riskSettings,
      signalFilters,
    } = body;

    await connectToDatabase();

    // Check if there's already an active session
    const activeSession = await AutoTradingSession.findOne({
      userId,
      broker: 'deriv',
      status: 'active',
    });

    if (activeSession) {
      return NextResponse.json(
        { success: false, error: 'Auto-trading is already running' },
        { status: 400 }
      );
    }

    // Get bot settings for default risk settings
    const botSettings = await SignalistBotSettings.findOne({
      userId,
      broker: 'deriv',
      enabled: true,
    });

    // Merge risk settings
    const finalRiskSettings = {
      maxTradesPerDay: riskSettings?.maxTradesPerDay || botSettings?.maxDailyTrades || 10,
      dailyLossLimit: riskSettings?.dailyLossLimit || botSettings?.maxDailyLoss || 0,
      maxStakeSize: riskSettings?.maxStakeSize || 0, // 0 means no limit
      riskPerTrade: riskSettings?.riskPerTrade || botSettings?.riskPerTrade || 10,
      autoStopDrawdown: riskSettings?.autoStopDrawdown || botSettings?.forceStopDrawdown || 0,
      maxConsecutiveLosses: riskSettings?.maxConsecutiveLosses || botSettings?.maxConsecutiveLosses,
    };

    // Get auto-trading service
    const tradingService = getAutoTradingService(userId);

    // Start auto-trading
    await tradingService.start({
      userId,
      strategy,
      riskSettings: finalRiskSettings,
      signalFilters: signalFilters || {},
    });

    const status = tradingService.getStatus();

    return NextResponse.json({
      success: true,
      data: {
        sessionId: status.sessionId,
        isRunning: status.isRunning,
        message: 'Auto-trading started successfully',
      },
    });
  } catch (error: any) {
    console.error('[Auto-Trading Start] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to start auto-trading' },
      { status: 500 }
    );
  }
}


