/**
 * POST /api/deriv/auto-trading/stop
 * Stop auto-trading session
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { stopAutoTradingService } from '@/lib/services/deriv-auto-trading.service';

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

    // Stop auto-trading service
    stopAutoTradingService(userId);

    return NextResponse.json({
      success: true,
      message: 'Auto-trading stopped successfully',
    });
  } catch (error: any) {
    console.error('[Auto-Trading Stop] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to stop auto-trading' },
      { status: 500 }
    );
  }
}



