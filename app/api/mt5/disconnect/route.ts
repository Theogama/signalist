/**
 * MT5 Disconnect API Route
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
    const { connection_id } = body;

    if (!connection_id) {
      return NextResponse.json(
        { success: false, error: 'Missing connection_id' },
        { status: 400 }
      );
    }

    const response = await fetch(`${MT5_SERVICE_URL}/disconnect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ connection_id }),
    });

    const data = await response.json();

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('MT5 disconnect error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}








