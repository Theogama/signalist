/**
 * GET /api/deriv/auto-trading/status
 * Get auto-trading status
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { connectToDatabase } from '@/database/mongoose';
import { AutoTradingSession } from '@/database/models/auto-trading-session.model';
import { getAutoTradingService } from '@/lib/services/deriv-auto-trading.service';

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
    await connectToDatabase();

    // Get active session from database
    const activeSession = await AutoTradingSession.findOne({
      userId,
      broker: 'deriv',
      status: 'active',
    }).sort({ startedAt: -1 });

    // Get service status
    const tradingService = getAutoTradingService(userId);
    const serviceStatus = tradingService.getStatus();

    if (!activeSession && !serviceStatus.isRunning) {
      return NextResponse.json({
        success: true,
        data: {
          isRunning: false,
          session: null,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        isRunning: serviceStatus.isRunning || !!activeSession,
        session: activeSession ? {
          sessionId: activeSession.sessionId,
          strategy: activeSession.strategy,
          startedAt: activeSession.startedAt,
          totalTrades: activeSession.totalTrades,
          totalProfitLoss: activeSession.totalProfitLoss,
          startBalance: activeSession.startBalance,
          riskSettings: activeSession.riskSettings,
        } : null,
        serviceStatus: {
          activeContracts: serviceStatus.activeContracts,
          dailyTradeCount: serviceStatus.dailyTradeCount,
          dailyProfitLoss: serviceStatus.dailyProfitLoss,
        },
      },
    });
  } catch (error: any) {
    console.error('[Auto-Trading Status] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get status' },
      { status: 500 }
    );
  }
}




