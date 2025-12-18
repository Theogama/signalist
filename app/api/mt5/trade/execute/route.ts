/**
 * MT5 Trade Execution API Route
 * Executes trades with safety checks
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { mt5SafetyService } from '@/lib/services/mt5-safety.service';

const MT5_SERVICE_URL = process.env.MT5_SERVICE_URL || 'http://localhost:5000';

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { connection_id, symbol, order_type, volume, price, sl, tp, magic, comment } = body;

    if (!connection_id || !symbol || !order_type || !volume) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get account info for safety checks
    const accountResponse = await fetch(`${MT5_SERVICE_URL}/account?connection_id=${connection_id}`);
    const accountData = await accountResponse.json();

    if (!accountData.success) {
      return NextResponse.json(
        { success: false, error: 'Failed to get account info' },
        { status: 400 }
      );
    }

    // Get settings
    const settingsResponse = await fetch(`${request.nextUrl.origin}/api/mt5/settings/update`);
    const settingsData = await settingsResponse.json();
    const settings = settingsData.success ? settingsData.data : {};

    // Safety checks
    const safetyCheck = await mt5SafetyService.checkTradeSafety(
      connection_id,
      symbol,
      parseFloat(volume),
      accountData.account,
      settings
    );

    if (!safetyCheck.passed) {
      return NextResponse.json(
        { success: false, error: safetyCheck.error || 'Safety check failed' },
        { status: 400 }
      );
    }

    // Check connection
    const connectionCheck = await mt5SafetyService.checkConnection(connection_id);
    if (!connectionCheck.passed) {
      return NextResponse.json(
        { success: false, error: connectionCheck.error || 'Connection check failed' },
        { status: 400 }
      );
    }

    // Execute trade
    const tradeEndpoint = order_type.toUpperCase() === 'BUY' ? '/trade/buy' : '/trade/sell';
    const response = await fetch(`${MT5_SERVICE_URL}${tradeEndpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        connection_id,
        symbol,
        volume: parseFloat(volume),
        price: price ? parseFloat(price) : undefined,
        sl: sl ? parseFloat(sl) : undefined,
        tp: tp ? parseFloat(tp) : undefined,
        magic: magic || 2025,
        comment: comment || 'SIGNALIST Bot',
      }),
    });

    const data = await response.json();

    if (data.success) {
      // Record trade for daily tracking
      mt5SafetyService.recordTrade(0); // Profit will be updated when position closes
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('MT5 trade execute error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}






