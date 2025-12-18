/**
 * MT5 Connection API Route
 * Connects to Exness MT5 account
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
    const { login, password, server } = body;

    if (!login || !password || !server) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: login, password, server' },
        { status: 400 }
      );
    }

    // Validate server
    const validServers = ['Exness-MT5Real', 'Exness-MT5Trial'];
    if (!validServers.includes(server)) {
      return NextResponse.json(
        { success: false, error: 'Invalid server. Use Exness-MT5Real or Exness-MT5Trial' },
        { status: 400 }
      );
    }

    // Call MT5 service
    const response = await fetch(`${MT5_SERVICE_URL}/connect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        login: parseInt(login),
        password,
        server,
      }),
    });

    const data = await response.json();

    if (!data.success) {
      return NextResponse.json(
        { success: false, error: data.error || 'Connection failed' },
        { status: 400 }
      );
    }

    // Store connection info (in production, use encrypted storage)
    // For now, we'll return it to the client to store in session
    return NextResponse.json({
      success: true,
      data: {
        connection_id: data.connection_id,
        account: data.account,
        login,
        server,
      },
    });
  } catch (error: any) {
    console.error('MT5 connect error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}






