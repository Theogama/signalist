/**
 * Emergency Stop API
 * POST: Emergency stop all bots for a user or system-wide
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { emergencyStopService } from '@/lib/services/emergency-stop.service';

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { userId, systemWide, forceCloseTrades, reason } = body;

    const currentUserId = session.user.id;

    // Check if user is requesting system-wide stop (admin only)
    // In production, add admin role check here
    if (systemWide) {
      const result = await emergencyStopService.stopAllBots(reason || 'System-wide emergency stop');
      
      // If force close trades is requested
      let closedTrades: string[] = [];
      if (forceCloseTrades) {
        // Force close trades for all users (admin operation)
        // This would require getting all user IDs with open trades
        console.warn('[EmergencyStop] Force close trades system-wide not fully implemented - requires admin access');
      }

      return NextResponse.json({
        success: true,
        message: 'System-wide emergency stop executed',
        data: {
          ...result,
          closedTrades,
        },
      });
    }

    // Stop bots for specified user (defaults to current user)
    const targetUserId = userId || currentUserId;

    // Only allow stopping own bots unless admin
    if (targetUserId !== currentUserId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - can only stop own bots' },
        { status: 403 }
      );
    }

    const result = await emergencyStopService.stopUserBots(
      targetUserId,
      reason || 'Emergency stop'
    );

    // If force close trades is requested
    let closedTrades: string[] = [];
    if (forceCloseTrades) {
      closedTrades = await emergencyStopService.forceCloseUserTrades(
        targetUserId,
        reason || 'Emergency force close'
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Emergency stop executed',
      data: {
        ...result,
        closedTrades,
      },
    });
  } catch (error: any) {
    console.error('[Emergency Stop API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to execute emergency stop' },
      { status: 500 }
    );
  }
}

