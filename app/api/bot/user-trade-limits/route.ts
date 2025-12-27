/**
 * User Trade Limits API
 * GET: Get user trade limits status
 * PUT: Update user trade limits
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { userTradeLimitsService, UserTradeLimits } from '@/lib/services/user-trade-limits.service';

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
    const status = await userTradeLimitsService.getUserLimitsStatus(userId);

    return NextResponse.json({
      success: true,
      data: status,
    });
  } catch (error: any) {
    console.error('[User Trade Limits API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get trade limits status' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
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
    const limits: Partial<UserTradeLimits> = body;

    // Validate limits
    if (limits.maxTradesPerDay !== undefined && limits.maxTradesPerDay < 1) {
      return NextResponse.json(
        { success: false, error: 'maxTradesPerDay must be at least 1' },
        { status: 400 }
      );
    }

    if (limits.maxDailyLossPercent !== undefined && (limits.maxDailyLossPercent < 0 || limits.maxDailyLossPercent > 100)) {
      return NextResponse.json(
        { success: false, error: 'maxDailyLossPercent must be between 0 and 100' },
        { status: 400 }
      );
    }

    if (limits.maxConcurrentTrades !== undefined && limits.maxConcurrentTrades < 1) {
      return NextResponse.json(
        { success: false, error: 'maxConcurrentTrades must be at least 1' },
        { status: 400 }
      );
    }

    userTradeLimitsService.setUserLimits(userId, limits);
    const status = await userTradeLimitsService.getUserLimitsStatus(userId);

    return NextResponse.json({
      success: true,
      message: 'Trade limits updated',
      data: status,
    });
  } catch (error: any) {
    console.error('[User Trade Limits API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update trade limits' },
      { status: 500 }
    );
  }
}

