/**
 * MT5 Account Info API Route
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

    if (!connection_id) {
      return NextResponse.json(
        { success: false, error: 'Missing connection_id' },
        { status: 400 }
      );
    }

    const response = await fetch(`${MT5_SERVICE_URL}/account?connection_id=${connection_id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('MT5 account error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}









