/**
 * Trade Reconciliation API
 * POST: Trigger trade reconciliation for a user
 * GET: Get reconciliation status
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { tradeReconciliationService } from '@/lib/services/trade-reconciliation.service';

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
    const { allUsers } = body; // Admin only: reconcile all users

    let result;

    if (allUsers) {
      // System-wide reconciliation (admin only)
      // In production, add admin role check here
      result = await tradeReconciliationService.reconcileAll();
    } else {
      // Reconcile current user's trades
      result = await tradeReconciliationService.reconcileUser(userId);
    }

    return NextResponse.json({
      success: true,
      message: 'Trade reconciliation completed',
      data: result,
    });
  } catch (error: any) {
    console.error('[Trade Reconciliation API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to reconcile trades' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const status = tradeReconciliationService.getStatus();

    return NextResponse.json({
      success: true,
      data: status,
    });
  } catch (error: any) {
    console.error('[Trade Reconciliation API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get reconciliation status' },
      { status: 500 }
    );
  }
}

