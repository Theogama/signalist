/**
 * GET /api/deriv/auto-trading/analytics
 * Get trading analytics and statistics
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { tradingAnalyticsService } from '@/lib/services/trading-analytics.service';

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
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : undefined;
    const endDate = searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : undefined;

    const analytics = await tradingAnalyticsService.getAnalytics(userId, startDate, endDate);

    return NextResponse.json({
      success: true,
      data: analytics,
    });
  } catch (error: any) {
    console.error('[Analytics API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get analytics' },
      { status: 500 }
    );
  }
}

