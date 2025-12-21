/**
 * MT5 Buy Trade API Route
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';

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
    const { connection_id, symbol, volume, price, sl, tp, magic, comment } = body;

    if (!connection_id || !symbol || !volume) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: connection_id, symbol, volume' },
        { status: 400 }
      );
    }

    const response = await fetch(`${MT5_SERVICE_URL}/trade/buy`, {
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

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('MT5 buy trade error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}








