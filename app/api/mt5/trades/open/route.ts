/**
 * MT5 Open Trades API Route
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';

const MT5_SERVICE_URL = process.env.MT5_SERVICE_URL || 'http://localhost:5000';

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const connection_id = request.nextUrl.searchParams.get('connection_id');
    const symbol = request.nextUrl.searchParams.get('symbol');

    if (!connection_id) {
      return NextResponse.json(
        { success: false, error: 'Missing connection_id' },
        { status: 400 }
      );
    }

    let url = `${MT5_SERVICE_URL}/trades/open?connection_id=${connection_id}`;
    if (symbol) {
      url += `&symbol=${symbol}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('MT5 open trades error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}








