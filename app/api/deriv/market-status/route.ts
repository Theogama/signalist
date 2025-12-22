/**
 * Deriv Market Status API
 * Uses DerivMarketStatusService for accurate market status detection
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { marketStatusService } from '@/lib/services/deriv-market-status.service';

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol') || 'BOOM1000'; // Default symbol

    // Initialize service with user token
    await marketStatusService.initialize(session.user.id);

    // Get market status
    const status = await marketStatusService.getMarketStatus(symbol);

    return NextResponse.json({
      success: true,
      isOpen: status.status === 'open',
      status: status.status,
      symbol: status.symbol,
      isTradable: status.isTradable,
      reason: status.reason,
      nextOpen: status.nextOpen?.toISOString(),
      checkedAt: status.lastChecked.toISOString(),
      source: status.source,
      metadata: status.metadata,
    });
  } catch (error: any) {
    console.error('[Deriv Market Status API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to check market status',
        isOpen: true, // Default to open on error (safer for trading)
        status: 'unknown',
      },
      { status: 500 }
    );
  }
}
