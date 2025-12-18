/**
 * GET /api/deriv/auto-trading/risk-metrics
 * Get risk management metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { riskManagementService } from '@/lib/services/risk-management.service';

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

    const metrics = await riskManagementService.getRiskMetrics(userId);

    return NextResponse.json({
      success: true,
      data: metrics,
    });
  } catch (error: any) {
    console.error('[Risk Metrics API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get risk metrics' },
      { status: 500 }
    );
  }
}

